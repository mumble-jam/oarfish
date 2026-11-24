// Photographs the seal over a closed rift (seal.js) from the dive's own camera: in band 1 from the approach, from over the ledge, with the fish
// touching it, and four moments of it opening when the keeper falls; then one frame in each other band; and the screen at the start of a dive.
//   node tools/shot_seal.mjs <prefix> [glass|shoal] [point|look]     writes out/shots/<prefix>-<n>-<view>.png
//   GAME_ROOT=<another checkout> photographs the game there (the old web, before seal.js: the look is then ignored)
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
const args = process.argv.slice(2), prefix = args[0] || 'seal', look = args.find((a) => a === 'glass' || a === 'shoal') || 'glass', mode = args.find((a) => a === 'point' || a === 'look') || 'look';
const only = args.filter((a) => /^[a-z]+$/.test(a) && !['glass', 'shoal', 'point', 'look'].includes(a) && a !== prefix);
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource|GPU stall|GL Driver|AudioContext/.test(m.text())) console.log('[error]', m.text().slice(0, 300)); });
await page.addInitScript((mode) => { window.__noNursery = true; try { localStorage.setItem('oarfish.feel', JSON.stringify({ mode })); } catch {} }, mode);
await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await page.evaluate(() => { window.__hold = true; window.__game.startRun(4242); });
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${prefix}-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
// a band, fresh, with the seal in the look asked for; the fish u metres along the rift and a across it (less than nothing: the near side), up over the shelf
const go = (band) => page.evaluate(([band, look]) => { const g = window.__game, none = { dir: null, amount: 1, vertical: 0, sprint: false };
  g.run.segs = 16; g.buildFish(16); g.enterFloor(band, false); g.run.safe = 1e9; g.sim(3.6, none); if (g.devSee) { g.devSee.seal = look; g.guard?.reseal(look); } }, [band, look]);
const stand = (o) => page.evaluate(([o, mode]) => { const g = window.__game, none = { dir: null, amount: 1, vertical: 0, sprint: false };
  const r = g.world.rift, yaw = Math.atan2(r.nx, r.nz) + (o.turn || 0), u = o.u || 0, k = o.a + r.mid(u);
  g.run.safe = 1e9; g.rig.reset(g.rig.pos.clone().set(r.x + r.tx * u + r.nx * k, r.y + o.up, r.z + r.tz * u + r.nz * k), yaw);
  const pitch = o.pitch ?? (mode === 'look' ? 0.34 : 0.56);
  g.cam.ease = null; g.cam.yaw = yaw + Math.PI; g.cam.pitch = pitch; g.cam.zoom = o.zoom || 1; g.snap();
  const swim = o.swim ? { ...none, dir: { x: r.tx, y: 0, z: r.tz } } : none; g.sim(o.swim || 0.4, swim); g.cam.yaw = yaw + Math.PI; g.cam.pitch = pitch; g.snap(); g.sim(1 / 60, swim);
  const s = g.guard?.seal?.state; return { q: +r.in(g.rig.pos.x, g.rig.pos.z).toFixed(1), y: +(g.rig.pos.y - r.ledgeY).toFixed(2), look: s ? g.guard.seal.look : 'old', touched: s?.touched }; }, [o, mode]);
const shoot = async (name, o) => { const at = await stand(o); await frame(); await page.screenshot({ path: out(name), timeout: 180000 }); console.log(name, JSON.stringify(at)); };
const want = (k) => !only.length || only.includes(k);

if (want('one')) {
  await go(0);
  await shoot('1-a-approach', { u: 14, a: -20, up: 3.2 });
  await shoot('1-b-over', { a: -3.5, up: 2.2, pitch: mode === 'look' ? 0.5 : 0.7 });
  await shoot('1-c-touch', { u: -14, a: 0, up: -1.5, swim: 1.6, pitch: mode === 'look' ? 0.55 : 0.75 });
  // the keeper falls: four moments of the opening, seen from over the near ledge
  await stand({ u: 6, a: -8, up: 4.5, pitch: mode === 'look' ? 0.55 : 0.75, zoom: 1.4 });
  await page.evaluate(() => window.__game.guard.debug.fall());
  let t = 0;
  for (const [i, at] of [[1, 0.45], [2, 1.1], [3, 1.8], [4, 2.6]].map(([i, s]) => [i, look === 'shoal' && i > 2 ? s * 1.2 : s])) {
    await page.evaluate((d) => { const g = window.__game; g.sim(d, { dir: null, amount: 1, vertical: 0, sprint: false }); }, at - t); t = at;
    await frame(); await page.screenshot({ path: out(`1-d-open${i}`), timeout: 180000 }); console.log(`1-d-open${i}`, at);
  }
}
if (want('bands')) for (const band of [1, 2, 3]) { await go(band); await shoot(`${band + 1}-a-over`, { u: 11, a: -15, up: 4, pitch: mode === 'look' ? 0.5 : 0.66, zoom: 1.2 }); }
if (want('near')) for (const band of [1, 2, 3]) { await go(band); await shoot(`${band + 1}-b-near`, { u: -12, a: -5, up: 2.4, pitch: mode === 'look' ? 0.5 : 0.7 }); }
if (want('palace')) { await page.evaluate(() => { const g = window.__game; g.enterFloor(4, false); g.sim(3.6, { dir: null, amount: 1, vertical: 0, sprint: false }); }); await frame(); await page.screenshot({ path: out('5-palace'), timeout: 180000 }); console.log('5-palace'); }
if (want('corner')) { // the start of a dive, nothing touched: where the marker used to sit at the screen's edge
  await page.evaluate(() => { const g = window.__game; g.startRun(4242); g.sim(4, { dir: null, amount: 1, vertical: 0, sprint: false }); }); await frame(); await page.screenshot({ path: out('0-start'), timeout: 180000 }); console.log('0-start');
}
await browser.close(); server.close();
