"""Lädt Sport-/Vereins-Orte in Deutschland aus Overture Maps Places nach quellen/overture.tsv.

Overture Maps Foundation, Places, Lizenz CDLA Permissive 2.0 (https://docs.overturemaps.org/attribution/).
Enthält u. a. Einträge aus Unternehmens-/Vereinsregistern (Quelle BrightQuery) – damit kommen viele kleine Vereine dazu,
die in OpenStreetMap fehlen. Gefiltert wird später in build.mjs (Kategorie + Vereinsname).

Aufruf im Repo-Root (Python 3, einmalig: pip install pyarrow fsspec aiohttp requests):
  python3 tools/vereine/overture-laden.py [Release]     z. B. 2026-11-18.0 (Standard: neuestes)
Liest per HTTP-Range nur die Teile der Parquet-Dateien, die Deutschland abdecken (ca. 10–30 Min.).
"""
import json, re, sys, urllib.request
import pyarrow.parquet as pq, fsspec

B = 'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/'
OUT = 'tools/vereine/quellen/overture.tsv'
DE = (5.8, 15.1, 47.2, 55.1)  # Rahmen um Deutschland; genau filtert das Land der Adresse
KAT = re.compile(r'^(sport_league|amateur_sport_league|social_club|sport_or_recreation_club|sports_club_and_league|soccer_club|football_club|amateur_sport_team|professional_sport_team|sports_and_recreation|stadium_arena|football_stadium|soccer_stadium|sport_or_fitness_facility|gymnastics_club|soccer_field|sports_complex|community_services_non_profits|non_profit_organization)$')  # wie OVKAT in build.mjs


def ls(prefix, delim=True):
  u = B + '?list-type=2&prefix=' + prefix + ('&delimiter=/' if delim else '')
  x = urllib.request.urlopen(u).read().decode()
  return re.findall(r'<Prefix>([^<]*)</Prefix>', x) if delim else re.findall(r'<Key>([^<]*)</Key>', x)


rel = sys.argv[1] if len(sys.argv) > 1 else sorted(p for p in ls('release/') if p != 'release/')[-1].split('/')[1]
files = ls('release/' + rel + '/theme=places/type=place/', False)
fs = fsspec.filesystem('https', client_kwargs={'trust_env': True})
cl = lambda s: (s or '').replace('\t', ' ').replace('\n', ' ').strip()
rows, seen = [], set()
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
  print(k[-40:], len(rgs), 'Blöcke', flush=True)
  for i in range(0, len(rgs), 16):
    for r in f.read_row_groups(rgs[i:i + 16], columns=['id', 'names', 'basic_category', 'taxonomy', 'bbox', 'addresses', 'websites']).to_pylist():
      a = (r.get('addresses') or [{}])[0] or {}
      if a.get('country') != 'DE' or r['id'] in seen:
        continue
      tx = r.get('taxonomy') or {}
      cat = tx.get('primary') or ''
      nm = (r.get('names') or {}).get('primary') or ''
      if not nm or not KAT.match(cat):
        continue
      seen.add(r['id'])
      rows.append('\t'.join(map(cl, [r['id'], nm, a.get('locality'), a.get('postcode'), str(round(r['bbox']['ymin'], 5)),
                                       str(round(r['bbox']['xmin'], 5)), (r.get('websites') or [None])[0], cat])))
with open(OUT, 'w') as o:
  o.write('# Overture Maps Foundation, Places (CDLA Permissive 2.0), Release ' + rel + '.\nid\tname\tort\tplz\tlat\tlon\tweb\tkat\n' + '\n'.join(rows) + '\n')
print('Einträge:', len(rows))
