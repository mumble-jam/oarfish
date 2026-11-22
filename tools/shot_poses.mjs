// Photographs a creature in every pose its component has, on the stand in the specimen library: a few moments of each, since
// a pose is a movement. This is the first look at any new creature (CREATURES.md).
//   node tools/shot_poses.mjs <prefix> <id> [moments=3] [seconds between=0.45]     writes out/shots/<prefix>-<n>-<state>-<moment>.png
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
const ROOT = path.resolve(import.meta.dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  const CDN = '/npm/three@0.170.0/';
  const p = u.startsWith(CDN) ? path.resolve(import.meta.dirname, '../node_modules/three', u.slice(CDN.length)) : path.join(ROOT, u);
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  if (u === '/index.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(fs.readFileSync(p, 'utf8').replaceAll('https://cdn.jsdelivr.net', '')); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const [prefix = 'pose', id = 'keeper', moments = '3', gap = '0.45'] = process.argv.slice(2);
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${prefix}-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 760 }, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource|GPU stall|GL Driver|AudioContext/.test(m.text())) console.log('[error]', m.text().slice(0, 300)); });
await page.addInitScript(() => { window.__noNursery = true; });
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
await page.evaluate((id) => { const g = window.__game; g.setPaused(true); g.openLibrary(id); g.lib.state.turn = false; }, id); await frame();
const box = await page.evaluate(() => { const r = document.getElementById('lib-stage').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }); // where the specimen is drawn
const states = await page.evaluate(() => [...document.querySelectorAll('[data-set="state"] button')].map((b) => b.textContent));
for (let i = 0; i < Math.max(1, states.length); i++) {
  if (states.length) await page.click(`[data-set="state"] button:nth-child(${i + 1})`, { force: true });
  await page.evaluate(() => { const L = window.__game.lib; L.state.turn = false; for (let k = 0; k < 24; k++) L.frame(0.05); });
  for (let m = 0; m < +moments; m++) { await page.evaluate((gap) => { const L = window.__game.lib; for (let k = 0; k < Math.round(gap / 0.025); k++) L.frame(0.025); }, +gap); await frame(); await page.screenshot({ path: out(`${i}-${(states[i] || 'only').toLowerCase().replace(/\W+/g, '-')}-${m}`), clip: box }); }
}
console.log(id, 'poses:', states.join(', ') || '(one)');
await browser.close(); server.close();
