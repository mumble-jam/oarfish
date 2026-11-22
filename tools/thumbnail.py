"""Scale the poster shot down to the size link previews expect and save it small.
   python3 tools/thumbnail.py out/shots/thumbnail.png thumbnail.jpg"""
import sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB").resize((1200, 630), Image.LANCZOS)
im.save(dst, "JPEG", quality=88, optimize=True, progressive=True)
print(dst, im.size)
