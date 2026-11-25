// Photographs the front page (game/title.js) for one contact sheet: the plate beside the page at 1920 × 1080, the page at every
// size and on a phone both ways, silent and after the first touch, each menu item in focus, the placing of the game's name that
// was not chosen, and six frames of diving in.
//   node tools/shot_title.mjs [out-dir] [only…]      pictures into out/title/ (or out-dir); `only` picks steps by name: sizes, states, focus, alt, dive
//   then: python3 tools/title_sheet.py out/title /home/claude/title-sheet.jpg <the plate's picture>
// The page moves; every picture is taken with the fish's clock set (`F.at(seconds)`), so a picture can be taken again the same.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
const ROOT = path.resolve(import.meta.dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.m4a': 'audio/mp4' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  const CDN = '/npm/three@0.170.0/';
  const p = u.startsWith(CDN) ? path.resolve(ROOT, 'node_modules/three', u.slice(CDN.length)) : path.join(ROOT, u);
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  if (u === '/index.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(fs.readFileSync(p, 'utf8').replaceAll('https://cdn.jsdelivr.net', '')); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/`;
const args = process.argv.slice(2), OUT = path.resolve(ROOT, args[0] && !['sizes', 'states', 'focus', 'alt', 'dive'].includes(args[0]) ? args.shift() : 'out/title');
const only = new Set(args); const want = (s) => !only.size || only.has(s);
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const SIZES = { '1920x1080': [1920, 1080, 1], '1440x900': [1440, 900, 1], '1280x720': [1280, 720, 1], 'phone-up': [390, 844, 3], 'phone-side': [844, 390, 3] };
async function open(size, query = '') {
  const [w, h, dpr] = SIZES[size];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: dpr > 1, isMobile: dpr > 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
  await page.goto(`${url}?title=1${query}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__front?.ready === true', null, { timeout: 120000 });
  await page.waitForFunction('window.__ready === true', null, { timeout: 180000 });
  return { page, ctx };
}
const at = (page, t) => page.evaluate((t) => window.__front.at(t), t);
const shot = async (page, name) => { await page.waitForTimeout(120); await page.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log('wrote', name); };
if (want('sizes') || want('states')) for (const size of Object.keys(SIZES)) {
  if (!want('sizes') && size !== '1920x1080') continue;
  const { page, ctx } = await open(size);
  await at(page, 3);
  if (size === '1920x1080' || want('states')) await shot(page, `${size}-silent`);
  await page.evaluate(() => window.__front.touch()); await page.waitForTimeout(1600); await at(page, 3);
  await shot(page, `${size}-menu`);
  await ctx.close();
}
if (want('focus')) {
  const { page, ctx } = await open('1920x1080');
  await page.evaluate(() => window.__front.touch()); await page.waitForTimeout(1600);
  const items = await page.evaluate(() => window.__front.menu.map((b) => b.dataset.go));
  for (let i = 0; i < items.length; i++) { if (i) await page.keyboard.press('ArrowRight'); await at(page, 3); await page.screenshot({ path: path.join(OUT, `focus-${i}-${items[i]}.png`), clip: { x: 0, y: 780, width: 1920, height: 300 } }); console.log('wrote focus', items[i]); }
  await ctx.close();
}
if (want('alt')) {
  const { page, ctx } = await open('1920x1080', '&name=large');
  await page.evaluate(() => window.__front.touch()); await page.waitForTimeout(1600); await at(page, 3);
  await shot(page, 'alt-name');
  await ctx.close();
}
if (want('dive')) {
  const { page, ctx } = await open('1920x1080');
  await page.evaluate(() => window.__front.touch()); await page.waitForTimeout(1600); await at(page, 3);
  // the event is stepped by hand, so each frame is where the clock says
  await page.evaluate(() => { window.__front.manual = true; window.__front.choose('dive'); });
  const times = [0.0, 0.35, 0.7, 1.05, 1.4, 2.1];
  let t = 0;
  for (let i = 0; i < times.length; i++) {
    await page.evaluate((dt) => window.__front.advance(dt), times[i] - t); t = times[i];
    if (i === times.length - 1) await page.waitForTimeout(900);
    await shot(page, `dive-${i}`);
  }
  console.log(await page.evaluate(() => JSON.stringify({ state: window.__front.state, holds: window.__front.holds })));
  await ctx.close();
}
await browser.close(); server.close();
