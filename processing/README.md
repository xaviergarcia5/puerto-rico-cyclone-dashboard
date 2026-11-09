# Rebuild the dashboard data

Run the commands from the repository root. Use a separate output directory so
the rebuilt files can be checked before being used in the dashboard. The
existing interactive application includes its processed data and can be opened
without running these scripts.

The original dashboard was developed in Spanish. Spanish remains the default,
and the in-app language selector switches the interface to English. The
processing code, command-line help and this documentation are in English.
Official storm, municipality and station names retain their original spelling.

## Set up the processing environment

Install Python 3.11 or newer and Node.js. The verified Stage IV build used
Python 3.11, NumPy 2.4.6, ecCodes 2.49.0 and Shapely 2.1.2. Use an environment
with the ecCodes native library available.

```sh
python -m pip install -r processing/requirements.txt
```

## NOAA GOES-16 imagery and NHC tracks

The generator reads the public NOAA GOES-16 AWS archive and uses the
ABI-L2-MCMIPF product. It combines channels 01, 02, 03, 07 and 13, uses
solar elevation for the day-to-night transition, and samples the source
grid with nearest neighbors. Default output is 960 × 600 pixels at a
nominal 30-minute interval. The 672 released WebP frames are the exact
display assets.

Ernesto was processed from the AWS archive. The published Irma, Maria and
Fiona imagery was carried forward from Google Earth Engine exports. The
original Earth Engine export script was not recovered. The AWS script can
apply the preserved rendering recipe to all four events. A rerun can produce
different acquisition selections or encoded bytes from the earlier exports.

```sh
python processing/goes/build_goes_frames.py --storm ernesto --max-frames 3 --output ../cyclone-build/goes
```

Omit `--max-frames` for the full event, or use `--storm all` for all four
events. Outputs include PNG masters, WebP frames, provenance and an event
catalog under the chosen directory. To rebuild the tracks on the published
frame timestamps without downloading imagery, use the catalog mode.

```sh
python processing/goes/build_goes_frames.py --catalog-only events.js --output ../cyclone-build/goes-catalog
```

The generated catalog has English labels for inspection. The released
bilingual interface and its original data files remain the reference for
the deployed application.

HURDAT2 excerpts for the four storms are included. The catalog interpolates
positions within a gap of up to nine hours and uses the latest official record
at each image time for intensity.

- [NOAA GOES archive](https://registry.opendata.aws/noaa-goes/)
- [Earth Engine GOES-16 catalog](https://developers.google.com/earth-engine/datasets/catalog/NOAA_GOES_16_MCMIPF)
- [NHC HURDAT2 archive](https://www.nhc.noaa.gov/data/#hurdat)
- [Exact HURDAT2 source used](https://www.nhc.noaa.gov/data/hurdat/hurdat2-1851-2025-091226.txt)

## NWS/NCEP Stage IV precipitation

Download the three original event-month archives from NSF NCAR GDEX, or
place the matching files in the input directory. Together they are about
910 MB. The download script checks each archive against the SHA-256 checksum
of the file used to rebuild this dashboard.

```sh
python processing/stage4/download_stage4_archives.py ../cyclone-build/stage4-input
python processing/stage4/build_nws_hourly.py . ../cyclone-build/stage4-input ../cyclone-build/stage4
```

The builder reads `events.js` and `municipios.js` from the dashboard. It
decodes the 332 one-hour Puerto Rico GRIB files, accumulates the native grid
values in inches, retains missing cells, and writes `nws_data.js` with a
coverage audit and source inventory. Each event has 83 hourly grids.

- [NSF NCAR GDEX archive d507005](https://gdex.ucar.edu/datasets/d507005/)
- [NOAA precipitation data documentation](https://water.noaa.gov/about/precipitation-data-access)

## USGS precipitation stations

The archived USGS responses used to build `gauge_data.js` are included under
`usgs/source/`. `usgs/source_manifest.json` lists the original queries and
checksums. These are agency observations of precipitation, parameter 00045.
The builder preserves gaps and accumulates only readings available up to each
display time. The selection script uses municipal geometry, station
availability and proximity to reproduce the displayed subset.

```sh
python processing/usgs/build_station_network.py . processing/usgs/source ../cyclone-build/usgs
node processing/usgs/select_display_stations.cjs ../cyclone-build/usgs/gauge_data.js municipios.js ../cyclone-build/usgs-display
```

The outputs are `gauge_data.js`, `field_gauge_data.js`, and audit files
listing the selection, its reasons and eligible stations. The reconstructed
display selection retains 12 stations for Irma, 12 for Maria, 14 for Fiona
and 12 for Ernesto. Sector labels in the reconstruction are in English.

- [USGS Water Data](https://waterdata.usgs.gov/)

## Verification

The processing package was checked against the released assets using the
archived inputs. Stage IV values, grid coordinates, frame cutoffs and
missing-data masks matched for all four events. The rebuilt USGS station
series, displayed station IDs and coordinates matched. The GOES catalog
rebuild matched the four track series and the timestamps and numeric track
states associated with all 672 published frames. The GOES check rebuilt the
catalog from the existing frame timestamps and HURDAT2 excerpts. It did
not rerender the satellite imagery.
