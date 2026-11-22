# sheet.py <out> <cols> <w> files... : tile screenshots into one labelled sheet
import sys
from PIL import Image, ImageDraw
out, cols, w = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]); files = sys.argv[4:]
ims = [Image.open(f).convert('RGB') for f in files]
h = round(w * ims[0].height / ims[0].width)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * h), '#000')
d = ImageDraw.Draw(sheet)
for i, (im, f) in enumerate(zip(ims, files)):
    x, y = (i % cols) * w, (i // cols) * h
    sheet.paste(im.resize((w, h), Image.LANCZOS), (x, y))
    name = f.split('/')[-1].replace('.png', '')
    d.rectangle([x, y, x + 8 * len(name) + 8, y + 16], fill='#000'); d.text((x + 4, y + 2), name, fill='#fff')
sheet.save(out)
