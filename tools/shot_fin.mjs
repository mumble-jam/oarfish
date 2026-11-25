// The front page's dorsal fin against the back it stands on (George: 'the dorsal fin isn't attached to the body consistently across the
// body'). Photographs the page at 1920 × 1080 at three moments of the fin's wave and once with the wave stilled: the whole fish, and close
// views of the middle run and the right-hand turn; and prints, for each picture, how far the fin's base lies from the back's outline as
// drawn on the paper, slice by slice along the body (fin.json beside the pictures).
//   node tools/shot_fin.mjs [out-dir] [label]      pictures into out/fin/ (or out-dir), named <label>-<moment>-{whole,mid,turn}.png
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
const ROOT = path.resolve(import.meta.dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  const CDN = '/npm/three@0.170.0/';
  const p = u.startsWith(CDN) ? path.resolve(ROOT, 'node_modules/three', u.slice(CDN.length)) : path.join(ROOT, u);
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  if (u === '/index.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(fs.readFileSync(p, 'utf8').replaceAll('https://cdn.jsdelivr.net', '')); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const OUT = path.resolve(ROOT, process.argv[2] || 'out/fin'), LABEL = process.argv[3] || 'now';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${server.address().port}/?title=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__front?.ready === true', null, { timeout: 120000 });
await page.waitForFunction('window.__ready === true', null, { timeout: 180000 });
await page.evaluate(() => window.__front.touch()); await page.waitForTimeout(1600);
const MOMENTS = { w1: [3, 1], w2: [3.75, 1], w3: [4.5, 1], still: [3, 0] }; // [the fish's clock, the wave on or off]
const report = {};
for (const [name, [t, stir]] of Object.entries(MOMENTS)) {
  const r = await page.evaluate(({ t, stir }) => {
    const F = window.__front; F.shared.uStir.value = stir; F.at(t);
    const probe = F.finProbe ? F.finProbe() : null;
    // where to look: the right-hand turn (the trail's rightmost point) and the middle of the middle run, on the screen
    const cam = F.camera, W = innerWidth, H = innerHeight, scr = (p) => { const q = p.clone().project(cam); return [(q.x + 1) / 2 * W, (1 - q.y) / 2 * H]; };
    const tr = F.rig.trail.map((x) => x.p); let iR = 0, iL = 0; tr.forEach((p, i) => { if (p.x > tr[iR].x) iR = i; if (i > iR && p.x < tr[iL].x) iL = i; });
    if (iL < iR) iL = tr.length - 1;
    return { probe, turn: scr(tr[iR]), mid: scr(tr[Math.round((iR + iL) / 2)]) };
  }, { t, stir });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(OUT, `${LABEL}-${name}-whole.png`) });
  const clip = ([x, y], w, h) => ({ x: Math.max(0, Math.min(1920 - w, x - w / 2)), y: Math.max(0, Math.min(1080 - h, y - h / 2)), width: w, height: h });
  await page.screenshot({ path: path.join(OUT, `${LABEL}-${name}-mid.png`), clip: clip(r.mid, 560, 260) });
  await page.screenshot({ path: path.join(OUT, `${LABEL}-${name}-turn.png`), clip: clip(r.turn, 420, 360) });
  report[name] = r.probe; console.log(name, r.probe ? JSON.stringify(r.probe.summary) : '(no probe)');
}
fs.writeFileSync(path.join(OUT, `${LABEL}-fin.json`), JSON.stringify(report, null, 1));
await browser.close(); server.close();
