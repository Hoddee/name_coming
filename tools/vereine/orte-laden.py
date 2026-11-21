"""Lädt Orte und Ortsteile in Deutschland (Punkte) aus Overture Maps Divisions nach quellen/orte.tsv.
build.mjs ordnet damit Vereinen ohne Koordinaten einen Ort zu („1. FC 1928 Elfershausen“ → Elfershausen).

Overture Maps Foundation, Divisions (CDLA Permissive 2.0; enthält Daten von © OpenStreetMap-Mitwirkenden, ODbL).
Aufruf im Repo-Root: python3 tools/vereine/orte-laden.py [Release]
"""
import re, sys, urllib.request
import pyarrow.parquet as pq, fsspec
from shapely import wkb

B = 'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/'
OUT = 'tools/vereine/quellen/orte.tsv'
DE = (5.8, 15.1, 47.2, 55.1)
TYP = ('locality', 'localadmin', 'county', 'neighborhood', 'macrohood')


def ls(prefix, delim=True):
  u = B + '?list-type=2&prefix=' + prefix + ('&delimiter=/' if delim else '')
  x = urllib.request.urlopen(u).read().decode()
  return re.findall(r'<Prefix>([^<]*)</Prefix>', x) if delim else re.findall(r'<Key>([^<]*)</Key>', x)


rel = sys.argv[1] if len(sys.argv) > 1 else sorted(p for p in ls('release/') if p != 'release/')[-1].split('/')[1]
files = ls('release/' + rel + '/theme=divisions/type=division/', False)
fs = fsspec.filesystem('https', client_kwargs={'trust_env': True})
rows = {}
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
  for r in f.read_row_groups(rgs, columns=['subtype', 'country', 'region', 'names', 'geometry']).to_pylist():
    if r.get('country') != 'DE' or r.get('subtype') not in TYP:
      continue
    n = ((r.get('names') or {}).get('primary') or '').strip()
    if not n or '\t' in n:
      continue
    p = wkb.loads(r['geometry'])
    rows.setdefault((n, r['subtype']), []).append((round(p.y, 4), round(p.x, 4), (r.get('region') or '').replace('DE-', '')))
with open(OUT, 'w') as o:
  o.write('# Overture Maps Foundation, Divisions ' + rel + ' (CDLA Permissive 2.0, © OpenStreetMap-Mitwirkende ODbL)\n')
  o.write('name\ttyp\tlat\tlon\tland\n')
  for (n, t), ps in sorted(rows.items()):
    for lat, lon, land in ps:
      o.write(f'{n}\t{t}\t{lat}\t{lon}\t{land}\n')
print('Orte:', sum(len(v) for v in rows.values()))
