// Looks for what hangs in the water or is buried by a rift: every piece within reach of a rift's edge is measured against the bed as it is drawn
// (world.drawn) and against the pieces under it. A piece hangs if nothing is under its foot: not the bed, and not the top of another piece.
//   node tools/audit_rift.mjs [seed ...]     prints, band by band, how many pieces were looked at and the ones that hang or are sunk
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
import { audit } from './audit_fn.mjs';
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
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.addInitScript(() => { window.__noNursery = true; });
await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await page.evaluate(() => { window.__hold = true; });
{
  const seeds = process.argv.slice(2).map(Number); if (!seeds.length) seeds.push(4242);
  let bad = 0;
  for (const seed of seeds) for (let band = 0; band < 4; band++) { const a = await audit(page, seed, band); bad += a.hanging.length + a.sunk.length;
    const tally = (list) => Object.entries(list.reduce((t, h) => { t[h.name] = (t[h.name] || 0) + 1; return t; }, {})).map(([k, n]) => `${k} ${n}`).join(', ');
    console.log(`seed ${seed} band ${band + 1}: ${a.looked} pieces by the rift; ${a.hanging.length} hang${a.hanging.length ? ` (${tally(a.hanging)}; worst ${Math.max(...a.hanging.map((h) => h.gap))} m)` : ''}; ${a.sunk.length} sunk${a.sunk.length ? ` (${tally(a.sunk)})` : ''}`);
    if (process.env.VERBOSE) for (const h of [...a.hanging].sort((x, y) => y.gap - x.gap).slice(0, 12)) console.log('   hangs', JSON.stringify(h)); }
  console.log(bad ? `${bad} piece(s) out of place` : 'nothing hangs and nothing is buried');
  await browser.close(); server.close();
}
