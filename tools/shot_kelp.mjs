// Photographs the kelp forest and its life (kelpwood.js) from the dive's own camera, with the help put away: the forest and its lanes (from the plate's
// camera as it is, and pulled back), the box jelly on patrol, turning away from the body, herded out of the middle, a sting, the shell taken, the
// fragment in the nook, and the nest's glass box.
//   node tools/shot_kelp.mjs [prefix] [seed] [name…]      writes out/shots/<prefix>-<name>.png and prints each path
//   GAME_ROOT=<another checkout> photographs the game there (only the forest's own pictures, `lane` and `over`, are taken where there is no kelpwood.js)
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
const prefix = process.argv[2] || 'kelp', seed = +(process.argv[3] || 4242), only = process.argv.slice(4);
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${prefix}-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 750 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.addInitScript(() => { window.__noNursery = true; try { localStorage.removeItem('oarfish.nest'); } catch {} });
await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
const hide = await page.addStyleTag({ content: '#stage > :not(canvas):not(#library) { display: none !important; }' });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const life = await page.evaluate(async (seed) => { window.__hold = true; const g = window.__game;
  window.S = { none: { dir: null, amount: 0, vertical: 0, sprint: false, gentle: false, coil: 0, tight: false, bite: false },
    fresh(segs = 14) { g.setMode('point'); g.startRun(seed); g.run.segs = segs; g.buildFish(segs); g.run.safe = 1e9; g.sim(0.2, this.none); return g.world.quiet.kelpwood; },
    // the head at (x, z) in the band's first copy, `y` high (or `lift` over the bed), facing `yaw`, the camera behind it and as the dive has it
    put(x, z, yaw, lift = 3, y = null) { g.rig.reset(g.rig.pos.clone().set(x, y ?? g.world.height(x, z) + lift, z), yaw); g.cam.yaw = yaw + Math.PI; g.cam.pitch = 0.56; g.cam.zoom = 1; g.snap(); },
    // the fish `back` metres short of the clearing's middle on the forest's line (and `side` to one side), facing it
    toClearing(back = 9, side = 0) { const q = this.fresh(), C = q.clearing, a = q.axis, x = C.x - a.ux * back + a.uz * side, z = C.z - a.uz * back - a.ux * side; this.put(x, z, Math.atan2(C.x - x, C.z - z)); return q; },
    swim(yaw, s, k = 0.45) { g.sim(s, { ...this.none, dir: { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) }, amount: k }); } };
  return !!g.kelp || 'kelp' in g; }, seed);
const shots = [];
const shot = async (name, what, setup, arg, keepHud = false) => { if (only.length && !only.includes(name)) return;
  if (keepHud) await hide.evaluate((el) => { el.disabled = true; }); const ok = await page.evaluate(setup, arg); if (ok === false) { if (keepHud) await hide.evaluate((el) => { el.disabled = false; }); return; }
  await page.evaluate(() => { const g = window.__game, safe = g.run.safe; g.run.safe = 0; g.run.hush = 0; g.sim(1 / 60, S.none); g.run.safe = safe; }); // (a fish kept safe blinks: it is drawn for the picture)
  await frame(); await page.screenshot({ path: out(name) }); if (keepHud) await hide.evaluate((el) => { el.disabled = false; }); shots.push(out(name)); console.log(`${out(name)}  ${what}`); };
// the forest: down the main lane, from the plate's camera as a dive opens on it; and pulled back and tilted down, as a player can zoom out
await shot('lane', 'down the main lane, from the dive\'s camera', () => { const q = S.fresh(), L = q.lanes[0].points, a = L[3], b = L[5], yaw = Math.atan2(b[0] - a[0], b[1] - a[1]); S.put(a[0], a[1], yaw); S.swim(yaw, 1.2, 0.4); });
await shot('over', 'the forest from over its middle, the camera pulled back and looking down, as the wheel or a pinch can have it', () => { const q = S.fresh(), m = q.lanes[0].points[4], g = window.__game; S.put(m[0], m[1], q.facing + Math.PI, 3); g.cam.pitch = 1.2; g.cam.zoom = 2; g.snap(); g.sim(0.3, S.none); });
if (life) {
  await shot('patrol', 'the box jelly on patrol across the clearing, over the shell it keeps (the fish at the clearing\'s edge)', () => { S.toClearing(8.5, 2); window.__game.sim(4, S.none); const k = window.__game.kelp; return !!k; });
  await shot('turn', 'it turns away from the body: the fish comes up on one side, and it beats hard away, its tentacles drawn up short', () => { const g = window.__game, q = S.toClearing(9), k = g.kelp, C = q.clearing, a = q.axis; k.debug.put(C.x, C.z, Math.atan2(a.uz, -a.ux)); g.sim(0.3, S.none);
    const o = k.debug.off; for (let t = 0; t < 3; t += 0.1) { const dx = k.box.pos.x + o.x - g.rig.snout.x, dz = k.box.pos.z + o.z - g.rig.snout.z, d = Math.hypot(dx, dz); g.sim(0.1, d < 3.6 ? S.none : { ...S.none, dir: { x: dx / d, y: 0, z: dz / d }, amount: 0.5, gentle: true, vertical: Math.max(-1, Math.min(1, (k.box.pos.y - g.rig.pos.y) * 1.5)) }); if (k.box.mode === 'shy' && t > 1.5) break; } g.cam.yaw = g.rig.yaw + Math.PI + 0.5; g.snap(); });
  await shot('herded', 'herded: kept a few metres off, it has been pushed out of the middle, and the shell lies clear', () => { const g = window.__game, q = S.toClearing(9), k = g.kelp, C = q.clearing, a = q.axis; k.debug.put(C.x, C.z, Math.atan2(a.uz, -a.ux)); g.sim(0.3, S.none);
    const o = k.debug.off; for (let t = 0; t < 12; t += 0.25) { const dx = k.box.pos.x + o.x - g.rig.snout.x, dz = k.box.pos.z + o.z - g.rig.snout.z, d = Math.hypot(dx, dz); g.sim(0.25, d < 3.4 ? S.none : { ...S.none, dir: { x: dx / d, y: 0, z: dz / d }, amount: 0.5, gentle: true, vertical: Math.max(-1, Math.min(1, (k.box.pos.y - g.rig.pos.y) * 1.5)) }); } g.cam.yaw = g.rig.yaw + Math.PI; g.snap(); });
  await shot('sting', 'a sting: the body has crossed its tentacles (the fish flashes and loses a segment; the jelly jets away, tentacles drawn short)', () => { const g = window.__game, q = S.toClearing(9), k = g.kelp, C = q.clearing, a = q.axis, J = g.KELPWOOD.jelly; k.debug.put(C.x, C.z, Math.atan2(a.ux, a.uz), 'patrol'); g.sim(2.5, S.none); k.box.held = { speed: J.patrol.speed, mood: 'drift', rate: J.patrol.beat };
    const o = k.debug.off, tt = k.debug.tentacles(), mid = tt.reduce((m, p) => ({ x: m.x + p.x / tt.length, y: m.y + p.y / tt.length, z: m.z + p.z / tt.length }), { x: 0, y: 0, z: 0 }), side = { x: Math.cos(k.box.yaw), z: -Math.sin(k.box.yaw) };
    S.put(mid.x - side.x * 5 + o.x, mid.z - side.z * 5 + o.z, Math.atan2(side.x, side.z), 0, mid.y); g.sim(0.02, S.none); g.run.safe = 0; g.run.hush = 0; const n = k.state.stings;
    for (let t = 0; t < 3 && k.state.stings === n; t += 1 / 60) g.sim(1 / 60, { ...S.none, dir: side, amount: 1 }); k.box.held = null; g.sim(0.25, { ...S.none, dir: side, amount: 1 }); g.run.safe = 1e9; g.cam.yaw = Math.atan2(side.x, side.z) + Math.PI - 0.9; g.snap(); });
  await shot('taken', 'the shell taken with the jelly herded aside, not stung once: kept in the nest as a best (the card)', () => { const g = window.__game, q = S.toClearing(5), k = g.kelp, C = q.clearing, a = q.axis, it = k.shell; k.debug.put(C.x + a.uz * 6.5, C.z - a.ux * 6.5, 0); k.box.held = { speed: 0, mood: 'drift', rate: 0.6 }; g.sim(0.5, S.none);
    const o = k.debug.off; g.run.safe = 0; g.run.hush = 0; for (let t = 0; t < 6 && !it.taken; t += 0.1) { const dx = it.x + o.x - g.rig.snout.x, dz = it.z + o.z - g.rig.snout.z, d = Math.hypot(dx, dz) || 1; g.sim(0.1, { ...S.none, dir: { x: dx / d, y: 0, z: dz / d }, amount: 0.6, vertical: Math.max(-1, Math.min(1, (it.y + 0.3 - g.rig.pos.y) * 1.5)) }); }
    g.sim(0.6, S.none); g.run.safe = 1e9; }, null, true);
  await shot('nook', 'the nook off the loop, and the fragment of the ruins left in it', () => { const g = window.__game, q = S.fresh(), N = q.nook, L = q.lanes[1].points, p = L.reduce((b, c) => (Math.hypot(c[0] - N.x, c[1] - N.z) < Math.hypot(b[0] - N.x, b[1] - N.z) ? c : b), L[0]), yaw = Math.atan2(N.x - p[0], N.z - p[1]);
    S.put(p[0] - Math.sin(yaw) * 2, p[1] - Math.cos(yaw) * 2, yaw); g.sim(0.6, S.none); });
  await shot('nest', 'the nest after a clean take: the glass box lit, behind the squid\'s slab', () => { const g = window.__game; g.nest.kelp = { stings: 0, time: 20 }; g.startRun(4242); g.run.safe = 1e9; g.sim(0.3, S.none); const n = g.world.react.nest, yaw = n.yaw, s = g.world.spawn;
    const x = s.x + Math.cos(yaw) * 2.9 - Math.sin(yaw) * 0.5, z = s.z - Math.sin(yaw) * 2.9 - Math.cos(yaw) * 0.5; S.put(x, z, yaw, 2.4); g.cam.zoom = 0.7; g.snap(); g.sim(0.3, S.none); g.nest.kelp = null; });
}
await browser.close(); server.close();
fs.writeFileSync(path.resolve(import.meta.dirname, `../out/shots/${prefix}-list.txt`), shots.join('\n'));
