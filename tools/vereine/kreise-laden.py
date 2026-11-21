"""Lädt die Landkreise und kreisfreien Städte Deutschlands (Grenzen) aus Overture Maps Divisions nach kreise.json.

Overture Maps Foundation, Divisions (CDLA Permissive 2.0; enthält Daten von © OpenStreetMap-Mitwirkenden, ODbL).
build.mjs ordnet damit jedem Verein seinen Landkreis zu – daraus folgen Landesverband und Fußballkreis (kreise-fussball.mjs).
Aufruf im Repo-Root (einmalig: pip install pyarrow fsspec aiohttp requests shapely):
  python3 tools/vereine/kreise-laden.py [Release]
"""
import json, re, sys, urllib.request
import pyarrow.parquet as pq, fsspec
from shapely import wkb
from shapely.geometry import mapping

B = 'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/'
OUT = 'tools/vereine/kreise.json'
DE = (5.8, 15.1, 47.2, 55.1)


def ls(prefix, delim=True):
  u = B + '?list-type=2&prefix=' + prefix + ('&delimiter=/' if delim else '')
  x = urllib.request.urlopen(u).read().decode()
  return re.findall(r'<Prefix>([^<]*)</Prefix>', x) if delim else re.findall(r'<Key>([^<]*)</Key>', x)


rel = sys.argv[1] if len(sys.argv) > 1 else sorted(p for p in ls('release/') if p != 'release/')[-1].split('/')[1]
files = ls('release/' + rel + '/theme=divisions/type=division_area/', False)
fs = fsspec.filesystem('https', client_kwargs={'trust_env': True})
feats = []
for k in files:
  f = pq.ParquetFile(fs.open(B + k, block_size=2 ** 22))
  md = f.metadata
  ix = {md.schema.column(i).path: i for i in range(md.num_columns)}
  rgs = []
  for r in range(md.num_row_groups):
    g = md.row_group(r)
    s = lambda n: g.column(ix[n]).statistics
    if s('bbox.xmax').max >= DE[0] and s('bbox.xmin').min <= DE[1] and s('bbox.ymax').max >= DE[2] and s('bbox.ymin').min <= DE[3]:
      rgs.append(r)
  print(k[-30:], len(rgs), 'Blöcke', flush=True)
  if not rgs:
    continue
  for r in f.read_row_groups(rgs, columns=['subtype', 'class', 'country', 'region', 'names', 'geometry', 'is_land']).to_pylist():
    if r.get('country') != 'DE' or r.get('subtype') != 'county':
      continue
    if r.get('is_land') is False:
      continue
    g = wkb.loads(r['geometry']).simplify(0.003, preserve_topology=True)
    rd = lambda c: [round(c[0], 4), round(c[1], 4)]
    gj = mapping(g)
    def fix(c):
      if isinstance(c[0], (int, float)): return rd(c)
      return [fix(x) for x in c]
    feats.append({'n': (r.get('names') or {}).get('primary') or '', 'r': (r.get('region') or '').replace('DE-', ''), 'g': {'type': gj['type'], 'coordinates': fix(gj['coordinates'])}})
json.dump({'quelle': 'Overture Maps Foundation, Divisions ' + rel + ' (CDLA Permissive 2.0, © OpenStreetMap-Mitwirkende ODbL)', 'k': feats}, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
print('Kreise:', len(feats))
