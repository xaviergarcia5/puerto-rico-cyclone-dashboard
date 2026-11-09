"""Download the three event-month original NCEP archives linked by NCAR GDEX."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import argparse
import requests,hashlib,json,tarfile
parser = argparse.ArgumentParser(description="Download the original NCAR GDEX Stage IV event-month archives.")
parser.add_argument("sources", type=Path, help="Destination for the three archives.")
OUT = parser.parse_args().sources.resolve()
OUT.mkdir(parents=True, exist_ok=True)
ARCHIVE_URL = "https://osdf-director.osg-htc.org/ncar/gdex/d507005/NCEP/"
ARCHIVE_SHA256 = {
 '201709': '7166bc588c7c554b53921ab56b8b6917ea6022360800b3a110d38557c7ff6f6e',
 '202209': 'c7244e81ecd0cf6ad848f4cbdb42f08e42f61ed3328ad2098f6d1f839378b8a5',
 '202408': 'd9e1caea9ab2f27bd983fb4371235541f02c32a5b2f62ca87686f98f288e081b',
}
months = tuple(ARCHIVE_SHA256)
def get(month):
 name=f'katz_{month}.tar'
 url=ARCHIVE_URL+name
 p=OUT/name
 if not p.exists():
  with requests.get(url,stream=True,timeout=(30,50)) as r:
   r.raise_for_status();print(month,'download',r.headers.get('Content-Length'),flush=True)
   with p.with_suffix('.partial').open('wb') as f:
    for chunk in r.iter_content(1024*1024): f.write(chunk)
   p.with_suffix('.partial').replace(p)
 h=hashlib.sha256()
 with p.open('rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
 if h.hexdigest() != ARCHIVE_SHA256[month]:
  raise ValueError(f"Unexpected SHA-256 for {p}")
 with tarfile.open(p) as tf: members=[{'name':m.name,'size':m.size} for m in tf.getmembers()]
 meta={'month':month,'source':url,'file':name,'sha256':h.hexdigest(),'members':members}
 (OUT/(name+'.inventory.json')).write_text(json.dumps(meta,indent=2),encoding='utf-8')
 print(month,'finished',p.stat().st_size,'members',len(members),'first',members[:5],flush=True)
 return meta
with ThreadPoolExecutor(max_workers=3) as pool: results=list(pool.map(get,months))
