# sand_sheet.py [prefix] [out.jpg]: the one contact sheet of the sand flat's creatures, from what tools/shot_sand.mjs wrote (out/shots/<prefix>-*).
# A band to each creature: every pose on the stand (its moments side by side, then from above), the close looks, and the dive's camera beside the fish.
import sys, glob, os, re
from PIL import Image, ImageDraw
prefix = sys.argv[1] if len(sys.argv) > 1 else 's'; out = sys.argv[2] if len(sys.argv) > 2 else '/home/claude/sand-flat-sheet.jpg'
base = os.path.join(os.path.dirname(__file__), '..', 'out', 'shots')
W, H, COLS = 320, 213, 8
WHO = [('hermit', 'Hermit crab'), ('trumpet', 'Trumpetfish'), ('burrow', 'Goby and pistol shrimp'), ('gardeneel', 'Garden eels'), ('puffer', 'White-spotted puffer'), ('sandcircle', 'Sand circle')]
def key(f):
    m = re.search(r'-lib-(\d+)-(\w+)\.png$', f)
    return (0, int(m.group(1)), 9 if m.group(2) == 'above' else int(m.group(2))) if m else (1 if '-near-' in f else 2, 0, 0)
rows = []
for id, name in WHO:
    files = sorted(glob.glob(os.path.join(base, f'{prefix}-{id}-*.png')), key=key)
    if not files: continue
    rows.append(('title', name))
    for i in range(0, len(files), COLS): rows.append(('ims', files[i:i + COLS]))
T = 26
height = sum(T if r[0] == 'title' else H for r in rows)
sheet = Image.new('RGB', (COLS * W, height), '#101418'); d = ImageDraw.Draw(sheet); y = 0
for kind, v in rows:
    if kind == 'title': d.text((8, y + 7), v, fill='#ffe9a8'); y += T; continue
    for i, f in enumerate(v):
        im = Image.open(f).convert('RGB').resize((W, H), Image.LANCZOS); sheet.paste(im, (i * W, y))
        label = os.path.basename(f)[len(prefix) + 1:-4]; d.rectangle([i * W, y, i * W + 7 * len(label) + 6, y + 13], fill='#000'); d.text((i * W + 3, y + 1), label, fill='#fff')
    y += H
sheet.save(out, quality=82); print(out, sheet.size)
