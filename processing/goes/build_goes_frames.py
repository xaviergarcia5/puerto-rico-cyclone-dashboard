"""Render NOAA GOES-16 ABI frames and attach NHC HURDAT2 tracks.

The daytime image combines red, synthetic green and blue. The night image
uses C07 and C13 temperatures. Solar elevation controls the transition.
The recipe applies no Rayleigh correction. Regional subsets preserve the
values of the NOAA files. See processing/README.md for instructions.
"""

from __future__ import annotations

import argparse
import bisect
import json
import math
import os
import re
import shutil
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from functools import lru_cache
from goes_tracks import enrich_events, read_events, merge_event
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable, Iterator


TRACK_SOURCE_DIR = Path(__file__).resolve().parent / "tracks"

AWS_BUCKET = "noaa-goes16"
AWS_PRODUCT = "ABI-L2-MCMIPF"
RENDER_RECIPE = "script1-mcmipf-v1"
GOES_PLATFORM = "G16"
REQUIRED_CHANNELS = ("01", "02", "03", "07", "13")

OUTPUT_ROOT = Path("cyclone-build/goes")

# Shared view of Puerto Rico and nearby Caribbean islands.
AOI_BBOX = (-74.0, 14.0, -58.0, 24.0)  # west, south, east, north
PUERTO_RICO_REFERENCE = (18.22, -66.48)  # latitude, longitude

FRAME_WIDTH = 960
FRAME_HEIGHT = 600
FRAME_INTERVAL_MINUTES = 30
PLAYBACK_FPS = 4.0
WEBP_QUALITY = 82
TWILIGHT_LIMIT_DEGREES = 6.0
DOWNLOAD_RETRIES = 4
NETCDF_CACHE_ENV = "GOES16_NETCDF_CACHE"

# Accept all ABI scan modes, including M3, M4 and M6.
ABI_FILENAME_RE = re.compile(
    r"^[A-Z]{2}_ABI-L2-MCMIPF-M\d_G16_"
    r"s(?P<year>\d{4})(?P<doy>\d{3})(?P<hour>\d{2})"
    r"(?P<minute>\d{2})(?P<second>\d{2})(?P<fraction>\d*)_"
)


@dataclass(frozen=True)
class Storm:
    slug: str
    name: str
    start_utc: str
    end_utc: str

    @property
    def start(self) -> datetime:
        return parse_utc(self.start_utc)

    @property
    def end(self) -> datetime:
        return parse_utc(self.end_utc)


@dataclass(frozen=True)
class S3Object:
    key: str
    size: int
    channel: str
    start: datetime

    @property
    def filename(self) -> str:
        return self.key.rsplit("/", 1)[-1]


STORMS: dict[str, Storm] = {
    "irma": Storm(
        slug="irma",
        name="Irma",
        start_utc="2017-09-05T06:00:00Z",
        end_utc="2017-09-08T18:00:00Z",
    ),
    "maria": Storm(
        slug="maria",
        name="María",
        start_utc="2017-09-18T18:00:00Z",
        end_utc="2017-09-22T06:00:00Z",
    ),
    "ernesto": Storm(slug="ernesto", name="Ernesto", start_utc="2024-08-12T18:00:00Z", end_utc="2024-08-16T06:00:00Z"),
    "fiona": Storm(
        slug="fiona",
        name="Fiona",
        start_utc="2022-09-17T00:00:00Z",
        end_utc="2022-09-20T12:00:00Z",
    ),
}

MONTHS_EN = (
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
)


def parse_utc(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(
        timezone.utc
    )


def ast_label(moment_utc: datetime) -> str:
    ast = moment_utc.astimezone(timezone(timedelta(hours=-4), name="AST"))
    hour = ast.hour % 12 or 12
    suffix = "AM" if ast.hour < 12 else "PM"
    return (
        f"{ast.day:02d} {MONTHS_EN[ast.month - 1]} {ast.year}"
        f" · {hour}:{ast.minute:02d} {suffix}"
    )


def solar_elevation_degrees(
    moment_utc: datetime, latitude: float, longitude: float
) -> float:
    moment_utc = moment_utc.astimezone(timezone.utc)
    day_of_year = moment_utc.timetuple().tm_yday
    fractional_hour = (
        moment_utc.hour
        + moment_utc.minute / 60.0
        + moment_utc.second / 3600.0
    )
    gamma = 2.0 * math.pi / 365.0 * (
        day_of_year - 1 + (fractional_hour - 12.0) / 24.0
    )
    equation_of_time = 229.18 * (
        0.000075
        + 0.001868 * math.cos(gamma)
        - 0.032077 * math.sin(gamma)
        - 0.014615 * math.cos(2.0 * gamma)
        - 0.040849 * math.sin(2.0 * gamma)
    )
    declination = (
        0.006918
        - 0.399912 * math.cos(gamma)
        + 0.070257 * math.sin(gamma)
        - 0.006758 * math.cos(2.0 * gamma)
        + 0.000907 * math.sin(2.0 * gamma)
        - 0.002697 * math.cos(3.0 * gamma)
        + 0.00148 * math.sin(3.0 * gamma)
    )
    utc_minutes = fractional_hour * 60.0
    true_solar_minutes = utc_minutes + equation_of_time + 4.0 * longitude
    hour_angle = math.radians(true_solar_minutes / 4.0 - 180.0)
    latitude_radians = math.radians(latitude)
    cosine_zenith = (
        math.sin(latitude_radians) * math.sin(declination)
        + math.cos(latitude_radians)
        * math.cos(declination)
        * math.cos(hour_angle)
    )
    cosine_zenith = max(-1.0, min(1.0, cosine_zenith))
    return 90.0 - math.degrees(math.acos(cosine_zenith))


def display_mode(moment_utc: datetime) -> str:
    latitude, longitude = PUERTO_RICO_REFERENCE
    elevation = solar_elevation_degrees(moment_utc, latitude, longitude)
    if elevation >= TWILIGHT_LIMIT_DEGREES:
        return "DAY"
    if elevation <= -TWILIGHT_LIMIT_DEGREES:
        return "NIGHT"
    return "TRANSITION"


@lru_cache(maxsize=1)
def require_dependencies() -> dict[str, Any]:
    import importlib
    missing=[]
    for name in ('boto3','numpy','PIL','xarray','h5netcdf','h5py','fsspec','pyproj'):
        try: importlib.import_module(name)
        except ImportError: missing.append(name)
    if missing: raise SystemExit('Missing dependencies: '+', '.join(missing))
    import boto3, numpy as np, xarray as xr
    from botocore import UNSIGNED
    from botocore.config import Config
    from PIL import Image
    xr.set_options(netcdf_engine_order=['h5netcdf','netcdf4','scipy'])
    return dict(boto3=boto3,UNSIGNED=UNSIGNED,Config=Config,np=np,Image=Image)


def create_s3_client(modules: dict[str, Any]) -> Any:
    return modules["boto3"].client(
        "s3",
        region_name="us-east-1",
        config=modules["Config"](signature_version=modules["UNSIGNED"]),
    )


def contains_non_ascii(path: Path) -> bool:
    try:
        str(path).encode("ascii")
    except UnicodeEncodeError:
        return True
    return False


def get_netcdf_cache_root(output_root: Path | None = None) -> Path:
    # h5netcdf supports Unicode paths, so temporary data stays in the project.
    cache_root = Path(os.environ[NETCDF_CACHE_ENV]) if os.environ.get(NETCDF_CACHE_ENV) else (output_root or OUTPUT_ROOT) / "netcdf_cache"
    cache_root.mkdir(parents=True, exist_ok=True)
    return cache_root.resolve()


def floor_hour(moment: datetime) -> datetime:
    return moment.replace(minute=0, second=0, microsecond=0)


def iter_hours(start: datetime, end: datetime) -> Iterator[datetime]:
    current = floor_hour(start)
    limit = floor_hour(end)
    while current <= limit:
        yield current
        current += timedelta(hours=1)


def s3_hour_prefix(moment: datetime) -> str:
    return (
        f"{AWS_PRODUCT}/{moment.year}/"
        f"{moment.timetuple().tm_yday:03d}/{moment.hour:02d}/"
    )


def parse_abi_object(key: str, size: int) -> S3Object | None:
    filename = key.rsplit("/", 1)[-1]
    match = ABI_FILENAME_RE.match(filename)
    if not match:
        return None
    channel = "MCMIPF"

    year = int(match.group("year"))
    doy = int(match.group("doy"))
    hour = int(match.group("hour"))
    minute = int(match.group("minute"))
    second = int(match.group("second"))
    fraction_text = match.group("fraction") or ""
    microseconds = int((fraction_text + "000000")[:6]) if fraction_text else 0

    start = (
        datetime(year, 1, 1, tzinfo=timezone.utc)
        + timedelta(
            days=doy - 1,
            hours=hour,
            minutes=minute,
            seconds=second,
            microseconds=microseconds,
        )
    )
    return S3Object(key=key, size=size, channel=channel, start=start)


def list_scan_files(
    s3: Any,
    storm: Storm,
) -> dict[datetime, dict[str, S3Object]]:
    """
    Find official full-disk multichannel ABI Level 2 products.

    Search one hour on either side to find the closest acquisition to each
    requested time.
    """
    start = storm.start - timedelta(hours=1)
    end = storm.end + timedelta(hours=1)
    grouped: dict[datetime, dict[str, S3Object]] = {}

    for hour in iter_hours(start, end):
        prefix = s3_hour_prefix(hour)
        continuation: str | None = None
        while True:
            kwargs: dict[str, Any] = {
                "Bucket": AWS_BUCKET,
                "Prefix": prefix,
                "MaxKeys": 1000,
            }
            if continuation:
                kwargs["ContinuationToken"] = continuation
            response = s3.list_objects_v2(**kwargs)

            for item in response.get("Contents", []):
                parsed = parse_abi_object(item["Key"], int(item.get("Size", 0)))
                if parsed is None:
                    continue
                if not (start <= parsed.start <= end):
                    continue
                grouped.setdefault(parsed.start, {})[parsed.channel] = parsed

            if not response.get("IsTruncated"):
                break
            continuation = response.get("NextContinuationToken")
            if not continuation:
                break

    complete = {
        moment: channels
        for moment, channels in grouped.items()
        if "MCMIPF" in channels
    }
    if not complete:
        raise RuntimeError(
            f"No ABI Level 2 imagery found for {storm.name}."
        )
    return complete


def choose_frames(
    scans: dict[datetime, dict[str, S3Object]],
    start: datetime,
    end: datetime,
    interval_minutes: int,
) -> list[tuple[datetime, dict[str, S3Object]]]:
    available = sorted(scans.items(), key=lambda item: item[0])
    available_seconds = [item[0].timestamp() for item in available]
    interval = timedelta(minutes=interval_minutes)
    maximum_gap = max(12.0, interval_minutes * 0.60) * 60.0

    selected: list[tuple[datetime, dict[str, S3Object]]] = []
    used: set[datetime] = set()
    target = start

    while target < end:
        position = bisect.bisect_left(available_seconds, target.timestamp())
        candidates: list[tuple[datetime, dict[str, S3Object]]] = []
        if position < len(available):
            candidates.append(available[position])
        if position > 0:
            candidates.append(available[position - 1])
        if candidates:
            nearest = min(
                candidates,
                key=lambda item: abs((item[0] - target).total_seconds()),
            )
            difference = abs((nearest[0] - target).total_seconds())
            if difference <= maximum_gap and nearest[0] not in used:
                selected.append(nearest)
                used.add(nearest[0])
        target += interval
    return selected


def download_s3_object(
    s3: Any,
    obj: S3Object,
    destination: Path,
    retries: int = DOWNLOAD_RETRIES,
) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.stat().st_size == obj.size:
        return

    temporary = destination.with_suffix(destination.suffix + ".part")
    for attempt in range(1, retries + 1):
        try:
            if temporary.exists():
                temporary.unlink()
            s3.download_file(AWS_BUCKET, obj.key, str(temporary))
            if obj.size and temporary.stat().st_size != obj.size:
                raise OSError(
                    f"incomplete download size: {temporary.stat().st_size} != {obj.size}"
                )
            temporary.replace(destination)
            if not destination.is_file():
                raise FileNotFoundError(
                    f"The download finished but the file is missing: {destination}"
                )
            if obj.size and destination.stat().st_size != obj.size:
                raise OSError(
                    f"incomplete final file size: "
                    f"{destination.stat().st_size} != {obj.size}"
                )
            return
        except Exception as error:
            if temporary.exists():
                temporary.unlink()
            if attempt == retries:
                raise RuntimeError(
                    f"Could not download {obj.filename}: {error}"
                ) from error
            wait_seconds = attempt * 3
            print(f"      Retrying C{obj.channel} in {wait_seconds}s...")
            time.sleep(wait_seconds)


def latitude_longitude_grids(np: Any, width: int, height: int) -> tuple[Any, Any]:
    west, south, east, north = AOI_BBOX
    lon_step = (east - west) / width
    lat_step = (north - south) / height
    longitudes = west + (np.arange(width, dtype=np.float32) + 0.5) * lon_step
    latitudes = north - (np.arange(height, dtype=np.float32) + 0.5) * lat_step
    return np.meshgrid(longitudes, latitudes)


def daylight_weight_array(
    np: Any,
    moment_utc: datetime,
    lon_grid: Any,
    lat_grid: Any,
) -> Any:
    moment_utc = moment_utc.astimezone(timezone.utc)
    day_of_year = moment_utc.timetuple().tm_yday
    fractional_hour = (
        moment_utc.hour
        + moment_utc.minute / 60.0
        + moment_utc.second / 3600.0
    )
    gamma = 2.0 * math.pi / 365.0 * (
        day_of_year - 1 + (fractional_hour - 12.0) / 24.0
    )
    equation_of_time = 229.18 * (
        0.000075
        + 0.001868 * math.cos(gamma)
        - 0.032077 * math.sin(gamma)
        - 0.014615 * math.cos(2.0 * gamma)
        - 0.040849 * math.sin(2.0 * gamma)
    )
    declination = (
        0.006918
        - 0.399912 * math.cos(gamma)
        + 0.070257 * math.sin(gamma)
        - 0.006758 * math.cos(2.0 * gamma)
        + 0.000907 * math.sin(2.0 * gamma)
        - 0.002697 * math.cos(3.0 * gamma)
        + 0.00148 * math.sin(3.0 * gamma)
    )

    utc_minutes = fractional_hour * 60.0
    true_solar_minutes = utc_minutes + equation_of_time + 4.0 * lon_grid
    hour_angle = np.deg2rad(true_solar_minutes / 4.0 - 180.0)
    latitude_radians = np.deg2rad(lat_grid)

    cos_zenith = (
        np.sin(latitude_radians) * math.sin(declination)
        + np.cos(latitude_radians)
        * math.cos(declination)
        * np.cos(hour_angle)
    )
    cos_zenith = np.clip(cos_zenith, -1.0, 1.0)

    lower = math.sin(math.radians(-TWILIGHT_LIMIT_DEGREES))
    upper = math.sin(math.radians(TWILIGHT_LIMIT_DEGREES))
    raw = np.clip((cos_zenith - lower) / (upper - lower), 0.0, 1.0)
    return raw * raw * (3.0 - 2.0 * raw)


def convert_png_to_webp(
    Image: Any,
    source_png: Path,
    destination_webp: Path,
    quality: int,
) -> None:
    destination_webp.parent.mkdir(parents=True, exist_ok=True)
    temporary_webp = destination_webp.with_suffix(".webp.tmp")
    with Image.open(source_png) as source:
        source.convert("RGB").save(
            temporary_webp,
            format="WEBP",
            quality=quality,
            method=6,
        )
    temporary_webp.replace(destination_webp)


def _render_frame_job(job: dict[str, Any]) -> dict[str, Any]:
    from goes_classic import render_classic, VARIABLES
    from goes_subset import download_subset
    modules = require_dependencies()
    moment_utc = parse_utc(job['utc'])
    png_path,webp_path,proof = Path(job['png']),Path(job['webp']),Path(job['provenance'])
    previous = json.loads(proof.read_text(encoding='utf-8')) if proof.exists() else {}
    rendered = job['overwrite'] or not png_path.exists() or previous.get('recipe') != RENDER_RECIPE
    if rendered:
        scan_dir = Path(job['cache'])/job['slug']/moment_utc.strftime('%Y%m%dT%H%M%SZ')
        scan_dir.mkdir(parents=True,exist_ok=True)
        try:
            entry=job['channels']['MCMIPF']
            obj=S3Object(entry['key'],entry['size'],'MCMIPF',moment_utc)
            source=scan_dir/obj.filename
            if job['fullDisk']: download_s3_object(create_s3_client(modules),obj,source)
            else: download_subset(obj.key,source,AOI_BBOX,obj.size,VARIABLES)
            lon,lat=latitude_longitude_grids(modules['np'],job['width'],job['height'])
            daylight=daylight_weight_array(modules['np'],moment_utc,lon,lat)
            result=render_classic(source,png_path,AOI_BBOX,job['width'],job['height'],daylight)
            if parse_utc(result['timeCoverageStart']) != moment_utc:
                raise ValueError('The NOAA file time does not match the selected scan time')
            provenance={**result,'utc':job['utc'],'channels':job['channels'],'bbox':AOI_BBOX,
                        'regionalSubset':not job['fullDisk'],'renderedChannels':list(REQUIRED_CHANNELS)}
            provenance['subsets']=[json.loads(p.read_text()) for p in scan_dir.glob('*.source.json')] if not job['fullDisk'] else []
            write_text(proof,json.dumps(provenance,ensure_ascii=False,indent=2))
        finally:
            if not job['keepNetcdf']:
                cache=Path(job['cache']).resolve()
                if scan_dir.resolve().is_relative_to(cache) and scan_dir.resolve()!=cache:
                    shutil.rmtree(scan_dir,ignore_errors=True)
    if rendered or not webp_path.exists():
        convert_png_to_webp(modules['Image'],png_path,webp_path,job['quality'])
    return {'src':f"frames/{job['slug']}/{webp_path.name}",'utc':job['utc'],
            'labelAst':ast_label(moment_utc),'mode':display_mode(moment_utc)}


def process_storm(modules, s3, storm, output_root, interval_minutes, width, height,
                  webp_quality, overwrite, max_frames, keep_netcdf, workers=2, full_disk=False):
    print(f"\n{storm.name}: searching for NOAA ABI Level 2 imagery...",flush=True)
    plan_path=output_root/"provenance"/(storm.slug+"_scans.json")
    if plan_path.exists():
        saved=json.loads(plan_path.read_text(encoding="utf-8"))
    else:
        saved=[]
    signature={"start":storm.start_utc,"end":storm.end_utc,"interval":interval_minutes,"product":AWS_PRODUCT}
    if isinstance(saved,dict) and saved.get("selection")==signature:
        plan=saved["frames"]
    else:
        scans=list_scan_files(s3,storm)
        selected=choose_frames(scans,storm.start,storm.end,interval_minutes)
        plan=[{"utc":t.isoformat().replace("+00:00","Z"),"channels":{c:{"key":o.key,"size":o.size} for c,o in channels.items()}} for t,channels in selected]
        write_text(plan_path,json.dumps({"selection":signature,"frames":plan},indent=2))
    planned_total=len(plan)
    if max_frames:plan=plan[:max_frames]
    if not plan:raise RuntimeError("No frames are available")
    png_dir=output_root/"png_frames"/storm.slug;web_dir=output_root/"web"/"frames"/storm.slug
    png_dir.mkdir(parents=True,exist_ok=True);web_dir.mkdir(parents=True,exist_ok=True)
    cache=get_netcdf_cache_root(output_root)
    jobs=[]
    for number,entry in enumerate(plan,1):
        moment=parse_utc(entry["utc"]);timestamp=moment.strftime("%Y%m%dT%H%M%SZ")
        stem=f"{number:04d}_{timestamp}";png=png_dir/(stem+".png");webp=web_dir/(stem+".webp")
        if not overwrite:
            previous=next(iter(sorted(png_dir.glob(f"*_{timestamp}.png"))),None)
            if previous is not None:png=previous;webp=web_dir/(previous.stem+".webp")
        jobs.append({**entry,"slug":storm.slug,"png":str(png),"webp":str(webp),"cache":str(cache),"overwrite":overwrite,"width":width,"height":height,"quality":webp_quality,"keepNetcdf":keep_netcdf,"fullDisk":full_disk,"provenance":str(output_root/"provenance"/storm.slug/(timestamp+".json"))})
    event={"slug":storm.slug,"name":storm.name,"imageRecipe":RENDER_RECIPE,"imageProduct":AWS_PRODUCT,"frameIntervalMinutes":interval_minutes,"expectedFrames":planned_total,"frames":[]}
    checkpoint=output_root/"provenance"/(storm.slug+"_frames.json")
    print(f"  {len(jobs)} frames; {workers} workers; {'full-disk' if full_disk else 'lossless regional'} download",flush=True)
    def record(frame):
        event["frames"].append(frame);event["frames"].sort(key=lambda item:item["utc"])
        event["startUtc"]=event["frames"][0]["utc"];event["endUtc"]=event["frames"][-1]["utc"]
        write_text(checkpoint,json.dumps(event,ensure_ascii=False,indent=2))
        print(f"  [{len(event['frames']):03d}/{len(jobs):03d}] {frame['utc']}",flush=True)
    if workers==1:
        for job in jobs:record(_render_frame_job(job))
    else:
        with ProcessPoolExecutor(max_workers=workers) as executor:
            futures={executor.submit(_render_frame_job,job):job for job in jobs}
            failures=[]
            for future in as_completed(futures):
                try:record(future.result())
                except Exception as error:
                    failures.append(futures[future]["utc"])
                    print(f"  ERROR {futures[future]['utc']}: {error}",flush=True)
            if failures:raise RuntimeError(f"{len(failures)} frames failed: {failures}. Run the command again to resume.")
    return event


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(content, encoding="utf-8", newline="\n")
    temporary.replace(path)


def write_event_catalog(
    output_root: Path,
    events: dict[str, dict[str, Any]],
    playback_fps: float,
) -> Path:
    web_root = output_root / "web"
    web_root.mkdir(parents=True, exist_ok=True)

    existing = read_events(web_root / "events.js")
    for slug,event in events.items():
        previous=existing.get(slug,{})
        existing[slug]=event if event.get("imageRecipe") and event.get("imageRecipe")!=previous.get("imageRecipe") else merge_event(previous,event)
    for slug in ("irma","maria","fiona","ernesto"):
        if slug not in existing:existing[slug]={"slug":slug,"name":STORMS[slug].name,"frames":[]}
    events = enrich_events({slug:existing[slug] for slug in ("irma","maria","fiona","ernesto")},TRACK_SOURCE_DIR,AOI_BBOX)
    data = {
        "bbox": AOI_BBOX, "frameWidth": FRAME_WIDTH, "frameHeight": FRAME_HEIGHT,
        "positionMethod": "Positions are interpolated between National Hurricane Center records. Intensity uses the latest official record.",
        "defaultStorm": "maria" if "maria" in events else next(iter(events)),
        "playbackFps": playback_fps,
        "events": events,
    }
    events_javascript = (
        "window.HURRICANE_DATA = "
        + json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )
    write_text(web_root / "events.js", events_javascript)
    return web_root / "events.js"



def parse_arguments(argv: Iterable[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Render GOES-16 imagery and generate an event catalog with NHC tracks."
        )
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=OUTPUT_ROOT,
        help="Output directory.",
    )
    parser.add_argument(
        "--storm",
        nargs="+",
        choices=["all", *STORMS.keys()],
        default=["all"],
        help="Storms to process.",
    )
    parser.add_argument(
        "--interval-minutes",
        type=int,
        default=FRAME_INTERVAL_MINUTES,
        help="Nominal frame interval in minutes.",
    )
    parser.add_argument("--width", type=int, default=FRAME_WIDTH)
    parser.add_argument("--height", type=int, default=FRAME_HEIGHT)
    parser.add_argument("--webp-quality", type=int, default=WEBP_QUALITY)
    parser.add_argument("--playback-fps", type=float, default=PLAYBACK_FPS)
    parser.add_argument(
        "--max-frames",
        type=int,
        default=None,
        help="Limit the number of frames per storm for a test run.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Regenerate existing PNG and WebP files.",
    )
    parser.add_argument(
        "--keep-netcdf",
        action="store_true",
        help="Keep downloaded NetCDF subsets in the cache.",
    )
    parser.add_argument("--catalog-only", type=Path, metavar="EVENTS_JS",
                        help="Rebuild tracks for an existing events.js without downloading imagery.")
    parser.add_argument("--workers", type=int, default=2, help="Concurrent rendering workers (1 to 8).")
    parser.add_argument("--full-disk", action="store_true", help="Download full-disk NetCDF files instead of regional subsets.")
    return parser.parse_args(argv)


def main(argv: Iterable[str] | None = None) -> int:
    args = parse_arguments(argv)
    if args.interval_minutes <= 0:
        raise SystemExit("--interval-minutes must be greater than zero.")
    if args.width < 320 or args.height < 240:
        raise SystemExit("The image must be at least 320 x 240 pixels.")
    if not 1 <= args.webp_quality <= 100:
        raise SystemExit("--webp-quality must be between 1 and 100.")
    if args.playback_fps <= 0:
        raise SystemExit("--playback-fps must be greater than zero.")

    if not 1 <= args.workers <= 8:
        raise SystemExit("--workers must be between 1 and 8.")
    if args.max_frames is not None and args.max_frames <= 0:
        raise SystemExit("--max-frames must be positive.")

    requested = (
        list(STORMS)
        if "all" in args.storm
        else list(dict.fromkeys(args.storm))
    )
    output_root = args.output.expanduser().resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    if args.catalog_only:
        recovered = read_events(args.catalog_only)
        if not recovered:
            raise SystemExit(f"No events found in {args.catalog_only}")
        catalog_path = write_event_catalog(output_root, recovered, args.playback_fps)
        print(f"Catalog updated: {catalog_path}")
        return 0
    modules = require_dependencies()
    s3 = create_s3_client(modules)

    print("Source: NOAA GOES-16 ABI Level 2 MCMIPF, public AWS archive")
    print("Day: visible and near-infrared composite with synthetic green")
    print("Night: C07/C13 thermal composite")
    print(f"Output: {output_root}")
    print(f"Temporary NetCDF cache: {get_netcdf_cache_root(output_root)}")

    events: dict[str, dict[str, Any]] = {}
    for slug in requested:
        storm = STORMS[slug]
        events[slug] = process_storm(
            modules=modules,
            s3=s3,
            storm=storm,
            output_root=output_root,
            interval_minutes=args.interval_minutes,
            width=args.width,
            height=args.height,
            webp_quality=args.webp_quality,
            overwrite=args.overwrite,
            max_frames=args.max_frames,
            keep_netcdf=args.keep_netcdf,
            workers=args.workers,
            full_disk=args.full_disk,
        )

    catalog_path = write_event_catalog(output_root, events, args.playback_fps)
    print("\nProcessing complete.")
    print(f"Event catalog: {catalog_path}")
    print(f"Master PNG files: {output_root / 'png_frames'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
