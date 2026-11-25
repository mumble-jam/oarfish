# One contact sheet of the front page from the pictures tools/shot_title.mjs takes.
#   python3 tools/title_sheet.py <pictures dir> <out.jpg> <the plate's picture>
import sys, os
from PIL import Image, ImageDraw, ImageFont
src, out, plate = sys.argv[1], sys.argv[2], sys.argv[3]
W = 3000
def font(size):
    for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf']:
        if os.path.exists(f): return ImageFont.truetype(f, size)
    return ImageFont.load_default()
F, FB = font(26), font(34)
def load(name):
    p = os.path.join(src, name + '.png')
    return Image.open(p).convert('RGB') if os.path.exists(p) else None
def fit_h(im, h): return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
def fit_w(im, w): return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
rows = []  # each: list of (image, label)
def row(title, items, h=None, w=None):
    items = [(im, l) for im, l in items if im is not None]
    if not items: return
    gap = 24
    if w: items = [(fit_w(im, w), l) for im, l in items]
    elif h: items = [(fit_h(im, h), l) for im, l in items]
    tw = sum(im.width for im, _ in items) + gap * (len(items) - 1)
    if tw > W - 40:
        k = (W - 40 - gap * (len(items) - 1)) / sum(im.width for im, _ in items)
        items = [(im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS), l) for im, l in items]
    rows.append((title, items))
pl = Image.open(plate).convert('RGB')
row('The plate (left) and the front page at 1920 x 1080, after the first touch (right)', [(pl, 'the plate, 960 x 666'), (load('1920x1080-menu'), 'the page, 1920 x 1080')], h=1000)
row('Silent, before the first touch (left), and after it (right), 1920 x 1080', [(load('1920x1080-silent'), 'silent: the invitation, no menu, no sound'), (load('1920x1080-menu'), 'after the first touch: the menu inked in, the music on')], h=760)
row('Other sizes, after the first touch', [(load('1440x900-menu'), '1440 x 900'), (load('1280x720-menu'), '1280 x 720')], h=700)
row('A phone: upright, silent and after the first touch; on its side, silent and after', [(load('phone-up-silent'), 'upright, silent'), (load('phone-up-menu'), 'upright, menu'), (load('phone-side-silent'), 'on its side, silent'), (load('phone-side-menu'), 'on its side, menu')], h=820)
foc = [(load(f), f.split('-', 2)[2]) for f in sorted(x[:-4] for x in os.listdir(src) if x.startswith('focus-'))]
for i in range(0, len(foc), 2): row('Each item in focus (the foot of the page at 1920 x 1080)' if i == 0 else '', foc[i:i + 2], w=1460)
row('Rejected: the name large across the paper (the chosen place is the running head at the top)', [(load('alt-name'), 'not chosen'), (load('1920x1080-menu'), 'chosen')], h=760)
dv = [(load(f'dive-{i}'), l) for i, l in enumerate(['0.0 s: Dive chosen', '0.35 s', '0.7 s', '1.05 s', '1.4 s: the dive released under the water', '2.1 s: the dive'])]
row('Diving in: six frames', dv[:3], w=960); row('', dv[3:], w=960)
H = 40 + sum((60 if t else 10) + max(im.height for im, _ in items) + 46 for t, items in rows) + 20
sheet = Image.new('RGB', (W, H), (236, 233, 226)); d = ImageDraw.Draw(sheet)
y = 30
for t, items in rows:
    if t: d.text((24, y + 10), t, fill=(40, 34, 30), font=FB); y += 60
    else: y += 10
    x = 24
    for im, l in items:
        sheet.paste(im, (x, y)); d.text((x, y + im.height + 8), l, fill=(70, 60, 52), font=F); x += im.width + 24
    y += max(im.height for im, _ in items) + 46
sheet.save(out, quality=86)
print(out, sheet.size)
