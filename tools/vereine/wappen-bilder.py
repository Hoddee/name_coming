"""Wandelt die geladenen Logos (tools/vereine/roh/*.png) in kleine WebP-Wappen für die App um: assets/img/w/<Q-ID>.webp, 128×128,
transparent, Logo mittig eingepasst. Aufruf im Repo-Root: python3 tools/vereine/wappen-bilder.py  (braucht Pillow)"""
import os, sys
from PIL import Image

SRC, DST, S = 'tools/vereine/roh', 'assets/img/w', 128
os.makedirs(DST, exist_ok=True)
n = bad = 0
for f in sorted(os.listdir(SRC)):
  q = f.rsplit('.', 1)[0]
  out = os.path.join(DST, q + '.webp')
  if os.path.exists(out):
    n += 1
    continue
  try:
    im = Image.open(os.path.join(SRC, f))
    im.seek(0)
    im = im.convert('RGBA')
    bb = im.getbbox()
    if bb:
      im = im.crop(bb)
    w, h = im.size
    if w < 24 or h < 24:
      bad += 1
      continue
    k = (S - 4) / max(w, h)
    im = im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
    c = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    c.paste(im, ((S - im.size[0]) // 2, (S - im.size[1]) // 2), im)
    c.save(out, 'WEBP', quality=82, method=6)
    n += 1
  except Exception as e:
    print('Fehler', f, e)
    bad += 1
print('Wappen:', n, 'Fehler:', bad)
