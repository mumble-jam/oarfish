// Photographs the world answering the fish: what grows pulling in or leaning away, silt lifting off the bed, pilot fish riding at
// its side, chimes swinging where it brushed them. A strip of moments for each.
//   node tools/shot_react.mjs [prefix] [what …]     writes out/shots/<prefix>-<what>-<n>.png
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
const prefix = process.argv[2] || 'react', only = process.argv.slice(3);
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${prefix}-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource|GPU stall|GL Driver|AudioContext/.test(m.text())) console.log('[error]', m.text().slice(0, 300)); });
await page.addInitScript(() => { window.__noNursery = true; });
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await page.addStyleTag({ content: '#stage > :not(canvas):not(#library) { display: none !important; }' });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const band = (f) => page.evaluate((f) => { window.__hold = true; const g = window.__game; g.startRun(4242); if (f) g.enterFloor(f, false); g.run.safe = 1e9;
  for (const list of [g.foes.biters, g.foes.anglers || [], g.foes.drifters || [], g.foes.leeches || []]) for (const b of list) { b.alive = false; if (b.mesh) b.mesh.visible = false; } }, f);
// The fish is put `back` metres short of (x, z) and `side` metres to its right, `up` over the bed there, and swims straight on for
// `secs` at a time. The camera looks at (x, z) from `d` metres off at angle `a` round from the fish's heading and `h` over the bed;
// with `follow` it keeps that place relative to the fish's head instead.
const pass = async (name, { x, z, yaw = 0, back = 6, up = 1.0, n = 10, secs = 0.35, d = 9, h = 3.2, a = 1.2, fov = 34, lift = 0.5, segs = 0, side = 0, sprint = false, follow = false }) => {
  if (only.length && !only.includes(name)) return;
  await page.evaluate(([x, z, yaw, back, up, segs, side]) => { const g = window.__game; if (segs) { g.run.segs = segs; g.buildFish(segs); }
    const sx = x - Math.sin(yaw) * back + Math.cos(yaw) * side, sz = z - Math.cos(yaw) * back - Math.sin(yaw) * side; g.rig.reset(g.rig.pos.clone().set(sx, g.world.height(sx, sz) + up, sz), yaw); g.sim(0.05, { dir: null, amount: 0, vertical: 0, sprint: false }); }, [x, z, yaw, back, up, segs, side]);
  for (let i = 0; i < n; i++) {
    const at = await page.evaluate(([x, z, yaw, up, secs, d, h, a, fov, lift, i, sprint, follow]) => { const g = window.__game;
      if (i) for (let t = 0; t < secs; t += 1 / 60) { const y = g.world.height(g.rig.pos.x, g.rig.pos.z) + up; g.sim(1 / 60, { dir: { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) }, amount: 1, vertical: Math.max(-1, Math.min(1, (y - g.rig.pos.y) * 2)), sprint }); }
      g.run.safe = 0; g.sim(1 / 60, { dir: { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) }, amount: 1, vertical: 0, sprint }); // a fish that cannot be hurt blinks, and the picture may catch it gone
      const cx = follow ? g.rig.pos.x : x, cz = follow ? g.rig.pos.z : z, y = follow ? g.rig.pos.y - lift : g.world.height(x, z);
      g.camera.fov = fov; g.camera.updateProjectionMatrix(); g.camera.position.set(cx + Math.sin(yaw + a) * d, y + h, cz + Math.cos(yaw + a) * d); g.camera.lookAt(cx, y + lift, cz);
      const R = g.world.react; return { puffs: R.puffs, rings: R.rings, riding: R.pilots.filter((f) => f.riding).length, speed: +R.speed.toFixed(1), clear: +(g.rig.pos.y - g.world.height(g.rig.pos.x, g.rig.pos.z)).toFixed(2) }; }, [x, z, yaw, up, secs, d, h, a, fov, lift, i, sprint, follow]);
    await frame(); await page.screenshot({ path: out(`${name}-${i}`) });
    if (i === 0 || i === n - 1 || i === Math.floor(n / 2)) console.log(name, i, JSON.stringify(at));
  }
};
// the nearest thing of a kind to the start (or to a point), as [x, z]
const nearest = (kind, from = null) => page.evaluate(([kind, from]) => { const g = window.__game, list = g.world.react.grown[kind] || [], p = from || [g.rig.pos.x, g.rig.pos.z]; let best = null, bd = 1e9;
  for (const it of list) { const d = Math.hypot(it.x - p[0], it.z - p[1]); if (d < bd) { bd = d; best = it; } } return best ? [best.x, best.z, list.length] : null; }, [kind, from]);
const want = (...names) => !only.length || names.some((nm) => only.includes(nm));

if (want('anemone', 'kelp', 'grass', 'clam', 'silt', 'pilots', 'chimes')) {
  await band(0);
  const home = await page.evaluate(() => { const g = window.__game; return [g.rig.pos.x, g.rig.pos.z]; });
  { const p = await nearest('anemone', home); if (p) await pass('anemone', { x: p[0], z: p[1], back: 6, up: 0.75, n: 10, secs: 0.35, d: 4.4, h: 2.1, a: 1.35, fov: 32, lift: 0.3, side: -0.75 }); }
  { const rows = await page.evaluate(() => window.__game.world.spots.kelpRows), cx = rows.reduce((s, r) => s + r[0], 0) / rows.length, cz = rows.reduce((s, r) => s + r[1], 0) / rows.length;
    await pass('kelp', { x: cx, z: cz, yaw: Math.PI / 2, back: 11, up: 2.0, n: 12, secs: 0.4, d: 13, h: 10, a: 0.75, lift: 1.4, fov: 38, segs: 16 }); }
  { const p = await nearest('seagrass', home); if (p) await pass('grass', { x: p[0], z: p[1], back: 6, up: 0.6, n: 9, secs: 0.35, d: 6.5, h: 3.6, a: 1.4, lift: 0.2, side: -0.5 }); }
  { const p = await nearest('clam', home); if (p) await pass('clam', { x: p[0], z: p[1], back: 5, up: 0.7, n: 8, secs: 0.35, d: 2.6, h: 1.3, a: 1.3, fov: 28, lift: 0.1, side: -0.8 }); }
  // silt: low over open bed past where the first pilot fish waits; then the pilot fish that came along
  { const s = await page.evaluate(() => { const g = window.__game, f = g.world.react.pilots[0]; return [f.hx, f.hz, Math.atan2(g.world.goal.x - f.hx, g.world.goal.z - f.hz)]; });
    await pass('silt', { x: s[0], z: s[1], yaw: s[2], back: 9, up: 0.5, n: 9, secs: 0.35, d: 7.5, h: 2.4, a: 1.2, lift: 0.2, follow: true });
    await pass('pilots', { x: s[0], z: s[1], yaw: s[2], back: 9, up: 2.4, n: 9, secs: 0.6, d: 6.5, h: 2.2, a: 1.25, lift: 0.3, fov: 36, follow: true }); }
  // chimes: through the middle of the nearest set, at the height its bars hang
  { const c = await page.evaluate((home) => { const g = window.__game, sets = g.world.react.chimes; let best = null, bd = 1e9; for (const cs of sets) { const d = Math.hypot(cs.x - home[0], cs.z - home[1]); if (d < bd) { bd = d; best = cs; } }
      const yaw = 2 * Math.atan2(best.q.y, best.q.w) + Math.PI / 2, low = Math.max(...best.bars.map((b) => b.len)); return { n: sets.length, bars: sets.reduce((a, cs) => a + cs.bars.length, 0), x: best.x, z: best.z, yaw, up: best.y - g.world.height(best.x, best.z) - low + 0.4, len: best.bars.map((b) => +b.len.toFixed(2)) }; }, home);
    console.log('chimes', JSON.stringify(c));
    await pass('chimes', { x: c.x, z: c.z, yaw: c.yaw, back: 6, up: c.up, n: 12, secs: 0.35, d: 9, h: c.up + 2.2, a: 0.7, lift: c.up + 0.5, fov: 36 }); }
}
if (want('gate')) { // a gateway's curtains, band 2 of 5
  await band(1);
  const c = await page.evaluate(() => { const g = window.__game, sets = g.world.react.chimes, best = sets.reduce((a, cs) => (cs.bars.length > a.bars.length ? cs : a), sets[0]);
    const yaw = 2 * Math.atan2(best.q.y, best.q.w) + Math.PI / 2, low = Math.max(...best.bars.map((b) => b.len)); return { n: sets.length, x: best.x, z: best.z, yaw, up: best.y - g.world.height(best.x, best.z) - low + 0.5, bars: best.bars.length }; });
  console.log('gate', JSON.stringify(c));
  await pass('gate', { x: c.x, z: c.z, yaw: c.yaw, back: 7, up: c.up, n: 12, secs: 0.35, d: 12, h: c.up + 2.5, a: 0.6, lift: c.up, fov: 38, segs: 16 });
}
if (want('seapen', 'tubeworms', 'sealily')) {
  await band(3);
  const home = await page.evaluate(() => { const g = window.__game; return [g.rig.pos.x, g.rig.pos.z]; });
  for (const kind of ['seapen', 'tubeworms', 'sealily']) { const p = await nearest(kind, home); if (p) await pass(kind, { x: p[0], z: p[1], back: 6, up: 0.8, n: 10, secs: 0.35, d: 4, h: 1.9, a: 1.35, fov: 32, lift: 0.5, side: -0.75 }); }
}
await browser.close(); server.close();
