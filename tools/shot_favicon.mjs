// Renders favicon.svg into the files older browsers and phones ask for: favicon.ico (16, 32, 48) and apple-touch-icon.png.
//   python3 tools/favicon.py && node tools/shot_favicon.mjs
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
const ROOT = path.resolve(import.meta.dirname, '..'), svg = fs.readFileSync(path.join(ROOT, 'favicon.svg'), 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
const out = path.join(ROOT, 'out/shots'); fs.mkdirSync(out, { recursive: true });
for (const size of [16, 32, 48, 180, 512]) {
  const page = await (await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })).newPage();
  // the phone's icon has no rounded corners of its own: the phone rounds it
  await page.setContent(`<body style="margin:0;background:${size === 180 ? '#0b3345' : 'transparent'}">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
  await page.screenshot({ path: path.join(out, `favicon-${size}.png`), omitBackground: size !== 180 });
  await page.close();
}
await browser.close();
fs.copyFileSync(path.join(out, 'favicon-180.png'), path.join(ROOT, 'apple-touch-icon.png'));
execFileSync('python3', ['-c', `from PIL import Image; im = Image.open(r"${path.join(out, 'favicon-48.png')}"); ims = [Image.open(r"${out}/favicon-%d.png" % s) for s in (16, 32, 48)]; ims[2].save(r"${path.join(ROOT, 'favicon.ico')}", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)], append_images=ims[:2])`]);
console.log('favicon.ico, apple-touch-icon.png');
