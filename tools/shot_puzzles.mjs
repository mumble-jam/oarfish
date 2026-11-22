// Photographs the three body puzzles of a band: as they stand, half done, and opened.
//   node tools/shot_puzzles.mjs [prefix] [band]     writes out/shots/<prefix>-<kind>-<n>.png
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
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const prefix = process.argv[2] || 'puzzle', band = +(process.argv[3] || 0);
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${prefix}-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.addInitScript(() => { window.__noNursery = true; });
await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await page.addStyleTag({ content: '#stage > :not(canvas):not(#library) { display: none !important; }' });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
await page.evaluate((band) => { window.__hold = true; const g = window.__game; g.startRun(4242); if (band) g.enterFloor(band, false);
  for (const list of [g.foes.biters, g.foes.anglers || []]) for (const b of list) { b.alive = false; if (b.mesh) b.mesh.visible = false; } }, band);
// look at the middle of a puzzle and its cache from `d` metres off, `h` up, at angle `a`
const snap = async (kind, n, d = 13, h = 6, a = 0.8) => { await page.evaluate(([kind, d, h, a]) => { const g = window.__game, p = g.world.react.puzzles.find((x) => x.kind === kind), c = p.cache, mx = (p.x + c.x) / 2, mz = (p.z + c.z) / 2, y = g.world.height(mx, mz);
    g.run.safe = 0; g.sim(1 / 60, { dir: null, amount: 0, vertical: 0, sprint: false }); g.camera.fov = 38; g.camera.updateProjectionMatrix(); g.camera.position.set(mx + Math.sin(a) * d, y + h, mz + Math.cos(a) * d); g.camera.lookAt(mx, y + 1.4, mz); }, [kind, d, h, a]);
  await frame(); await page.screenshot({ path: out(`${kind}-${n}`) }); };
const has = (kind) => page.evaluate((kind) => !!window.__game.world.react.puzzles.find((x) => x.kind === kind), kind);
const none = { dir: null, amount: 1, vertical: 0, sprint: false, gentle: false, coil: 0, tight: false, bite: false };
if (await has('capstan')) {
  await page.evaluate(() => { const g = window.__game, p = g.world.react.puzzles.find((x) => x.kind === 'capstan'); g.rig.reset(g.rig.pos.clone().set(p.x + 20, p.y + 3, p.z + 20), 0); g.sim(0.2, { dir: null, amount: 0, vertical: 0, sprint: false }); }); await snap('capstan', 0);
  await page.evaluate((none) => { const g = window.__game, p = g.world.react.puzzles.find((x) => x.kind === 'capstan'); g.rig.reset(g.rig.pos.clone().set(p.x + 2.6, p.y + 0.2, p.z + 0.9), 1.1); g.sim(0.3, none); let t = 0; while (p.k < 0.55 && t < 20) { g.sim(0.1, { ...none, coil: 1 }); t += 0.1; } }, none); await snap('capstan', 1);
  await page.evaluate((none) => { const g = window.__game, p = g.world.react.puzzles.find((x) => x.kind === 'capstan'); let t = 0; while (!p.done && t < 20) { g.sim(0.1, { ...none, coil: 1 }); t += 0.1; } g.sim(0.35, none); }, none); await snap('capstan', 2);
  await page.evaluate((none) => window.__game.sim(1.5, none), none); await snap('capstan', 3);
}
if (await has('windows')) {
  const go = (list, from) => page.evaluate(([list, from, none]) => { const g = window.__game, p = g.world.react.puzzles.find((x) => x.kind === 'windows'), H = p.hoops;
    if (from) g.rig.reset(g.rig.pos.clone().set(H[0].x - p.ux * 4, H[0].y, H[0].z - p.uz * 4), Math.atan2(p.ux, p.uz));
    for (const k of list) { const hp = H[k]; let n = 0; while (n++ < 400) { const dx = hp.x + p.ux * 1.5 - g.rig.pos.x, dz = hp.z + p.uz * 1.5 - g.rig.pos.z, d = Math.hypot(dx, dz); if (d < 0.5) break; g.sim(1 / 60, { ...none, dir: { x: dx / d, y: 0, z: dz / d }, vertical: Math.max(-1, Math.min(1, (hp.y - g.rig.pos.y) * 2)) }); } } }, [list, from, none]);
  await page.evaluate(() => { const g = window.__game, p = g.world.react.puzzles.find((x) => x.kind === 'windows'); g.rig.reset(g.rig.pos.clone().set(p.x - 30, p.y + 3, p.z - 30), 0); g.sim(0.2, { dir: null, amount: 0, vertical: 0, sprint: false }); }); await snap('windows', 0, 19, 8, 1.3);
  await go([0, 1], true); await snap('windows', 1, 19, 8, 1.3);
  await go([2, 3], false); await page.evaluate((none) => window.__game.sim(0.4, none), none); await snap('windows', 2, 19, 8, 1.3);
}
if (await has('vent')) {
  await page.evaluate(() => { const g = window.__game, p = g.world.react.puzzles.find((x) => x.kind === 'vent'); g.rig.reset(g.rig.pos.clone().set(p.x + 20, p.y + 3, p.z + 20), 0); g.sim(2.5, { dir: null, amount: 0, vertical: 0, sprint: false }); }); await snap('vent', 0, 12, 4.5, 2.2);
  await page.evaluate((none) => { const g = window.__game, p = g.world.react.puzzles.find((x) => x.kind === 'vent'), c = p.cache, a = Math.atan2(p.x - c.x, p.z - c.z); g.rig.reset(g.rig.pos.clone().set(p.x + Math.sin(a) * 2.2, p.y + 0.45, p.z + Math.cos(a) * 2.2), a); let t = 0; while (p.press < 0.75 && t < 5) { g.sim(0.05, none); t += 0.05; } }, none); await snap('vent', 1, 12, 4.5, 2.2);
  await page.evaluate((none) => { const g = window.__game, p = g.world.react.puzzles.find((x) => x.kind === 'vent'); let t = 0; while (!p.done && t < 5) { g.sim(0.05, none); t += 0.05; } g.sim(0.4, none); }, none); await snap('vent', 2, 12, 4.5, 2.2);
  await page.evaluate((none) => window.__game.sim(1.6, none), none); await snap('vent', 3, 12, 4.5, 2.2);
}
await browser.close(); server.close();
