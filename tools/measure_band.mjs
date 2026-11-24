// Runs the pause menu's "Measure the first band" (game/gauge.js) once in headless Chrome and prints its table.
//   node tools/measure_band.mjs [seed] [--quick]     --quick: a fraction of a second at each spot (for trying the tool, not for numbers)
// Here the processor does the graphics card's work, so only the shape of the table means anything; the numbers are for George's laptop.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
const ROOT = process.env.GAME_ROOT || path.resolve(import.meta.dirname, '..');
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
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.addInitScript(() => { window.__noNursery = true; });
await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
const args = process.argv.slice(2), quick = args.includes('--quick'), seed = Number(args.find((a) => /^\d+$/.test(a)) || 4242);
const text = await page.evaluate(async ([seed, quick]) => {
  const g = window.__game; g.startRun(seed); g.setPaused(true);
  const r = await window.__gauge.tour(quick ? { settle: 0.3, measure: 0.6 } : {});
  return r.text;
}, [seed, quick]);
console.log(text);
await browser.close(); server.close();
