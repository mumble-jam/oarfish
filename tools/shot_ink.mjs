// Photographs a squid's ink copy (bloom.js, ink.js) as it lives: left at 0 s and seen at 1, 3, 7 and 12 s, close up at 0 and 3 s, and with the fish
// swimming through it; each from the adventure camera and from the plate camera (both set here, whichever the game opens on). With --bed, the
// same cloud left over the darkest and the palest ground near the bloom.
//   node tools/shot_ink.mjs [prefix] [seed] [--bed | --bed-only]     writes out/shots/<prefix>-<camera>-<name>.png
//   GAME_ROOT=<another checkout> photographs that copy of the game instead (how a before and an after are made)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
const ROOT = path.resolve(process.env.GAME_ROOT || path.resolve(import.meta.dirname, '..'));
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
const args = process.argv.slice(2).filter((a) => !a.startsWith('--')), bedOnly = process.argv.includes('--bed-only'), bedToo = bedOnly || process.argv.includes('--bed');
const prefix = args[0] || 'ink', seed = +(args[1] || 4242);
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${prefix}-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 750 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.addInitScript(() => { window.__noNursery = true; });
await page.addInitScript(() => { try { const f = JSON.parse(localStorage.getItem('oarfish.feel') || '{}'); if (!f.mode) localStorage.setItem('oarfish.feel', JSON.stringify({ ...f, mode: 'point' })); } catch {} }); // made on the plate camera, the default when this was written: ask for it, unless a camera was chosen in this page
await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await page.addStyleTag({ content: '#stage > :not(canvas):not(#library) { display: none !important; }' });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
await page.evaluate((seed) => { window.__hold = true; const g = window.__game;
  const none = { dir: null, amount: 0, vertical: 0, sprint: false, gentle: false, coil: 0, tight: false, bite: false };
  window.S = { none,
    // a fresh dive in this camera, the lead squid inked where it rests (or moved first to `to`, kept-space x, z), the fish `d` metres off it along `side`, facing it
    leave(mode, d, side, to) { localStorage.removeItem('oarfish.nest'); g.setMode(mode); g.startRun(seed); g.run.safe = 1e9; g.sim(0.3, none); const b = g.bloom, L = b.squid[0];
      if (to) { L.pos.set(to.x, g.world.height(to.x, to.z) + 3.4, to.z); g.sim(0.2, none); }
      this.place(L.pos, d, side); b.debug.scatter(L); this.left = g.run.time; this.at = L.pos.clone(); this.side = side; g.sim(1 / 60, none); },
    place(p, d, side, zoom = 1) { const b = g.bloom, o = b.debug.off, yaw = Math.atan2(-side.x, -side.z);
      g.rig.reset(g.rig.pos.clone().set(p.x + side.x * d + o.x, p.y, p.z + side.z * d + o.z), yaw); g.cam.ease = null; g.cam.yaw = yaw + Math.PI + 0.6; g.cam.zoom = zoom; // a little to one side, so the fish does not stand in front of it
      g.cam.pitch = g.feel.mode === 'look' ? 0.2 : 0.56; g.snap(); },
    age() { const b = window.__game.bloom; return b.debug.ink?.clouds[0]?.t ?? b.debug.inks[0]?.t ?? (window.__game.run.time - this.left); },
    now() { const c = window.__game.bloom.debug.ink?.clouds[0]; return c ? c.mid.clone() : this.at; }, // where the cloud is now (the old copy stayed where it was left)
    hold(t) { for (let s = 0; s < t - 1e-6; s += 0.1) { g.sim(Math.min(0.1, t - s), none); g.cam.ease = null; g.cam.pitch = g.feel.mode === 'look' ? 0.2 : 0.56; } g.snap(); } }; }, seed);
const shot = async (name, what) => { await page.evaluate(() => { const g = window.__game; g.run.safe = 0; g.sim(1 / 120, S.none); g.run.safe = 1e9; g.cam.ease = null; g.cam.pitch = g.feel.mode === 'look' ? 0.2 : 0.56; g.snap(); }); await frame(); await page.screenshot({ path: out(name) }); console.log(`${out(name)}  ${what}`); };
const side = { x: Math.sin(2.1), z: Math.cos(2.1) };
for (const mode of ['look', 'point']) {
  if (!bedOnly) {
  // the cloud through its life, from the dive's camera (the first at 0.2 s, as the squid starts away): the fish a few metres off, still
  await page.evaluate(([mode, side]) => { S.leave(mode, 7, side); }, [mode, side]);
  for (const t of [0.2, 1, 3, 7, 12]) { await page.evaluate((t) => { S.hold(t - S.age() - 0.1); S.place(S.now(), window.__game.feel.mode === 'look' ? 5 : 2.5, S.side, 0.55); }, t); // (the page runs on a little by itself while it is photographed: go by the ink's own clock)
    await shot(`${mode}-t${String(Math.round(t)).padStart(2, "0")}`, `${mode}: ${t} s after it is left (its clock: ${(await page.evaluate(() => S.age())).toFixed(2)} s)`); }
  // close up
  await page.evaluate(([mode, side]) => { S.leave(mode, 3.2, side); S.hold(0.2); S.place(S.at, 3.2, S.side, 0.45); }, [mode, side]); await shot(`${mode}-near0`, `${mode}: close up, as it is left`);
  await page.evaluate(() => { S.hold(3 - S.age() - 0.1); S.place(S.now(), 3.2, S.side, 0.45); }); await shot(`${mode}-near3`, `${mode}: close up, 3 s`);
  // the fish swims through it at a swim, 1.5 s after it is left, and is seen half through
  await page.evaluate(([mode, side]) => { const g = window.__game; S.leave(mode, 6, side); S.hold(1.5); S.place(S.at, 5, S.side);
    const dir = { x: -S.side.x, y: 0, z: -S.side.z }; for (let t = 0; t < 2.2; t += 0.05) { g.sim(0.05, { ...S.none, dir, amount: 1 }); g.cam.ease = null; g.cam.pitch = g.feel.mode === 'look' ? 0.2 : 0.56; } g.snap(); }, [mode, side]);
  await shot(`${mode}-through`, `${mode}: the fish swimming through it`);
  await page.evaluate(() => { const g = window.__game; const dir = { x: -S.side.x, y: 0, z: -S.side.z }; g.sim(0.4, { ...S.none, dir, amount: 1 }); for (let t = 0; t < 1.2; t += 0.1) g.sim(0.1, S.none); const yaw = g.rig.yaw; g.cam.ease = null; g.cam.yaw = yaw; g.snap(); });
  await shot(`${mode}-after`, `${mode}: looking back at where it went through`);
  }
  if (bedToo) for (const [name, pick] of [['dark', -1], ['pale', 1]]) { // the darkest and the palest bed within 20 m of the squid's home, by the bed's drawn colour under it
    await page.evaluate(async ([mode, side, pick]) => { const g = window.__game, THREE = await import('three'); g.setMode(mode); g.startRun(4242); g.sim(0.3, S.none); const P = g.bloom.plan, o = g.bloom.debug.off;
      const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), at = new THREE.Vector3(), beds = []; let best = null, bv = -1e9;
      g.scene.traverse((x) => { if (x.isMesh && !x.isInstancedMesh && x.geometry.attributes.color && x.geometry.attributes.position.count > 3000) beds.push(x); });
      for (let dx = -26; dx <= 26; dx += 2) for (let dz = -26; dz <= 26; dz += 2) { const x = P.home.x + dx, z = P.home.z + dz; ray.set(at.set(x + o.x, 60, z + o.z), down);
        const hit = ray.intersectObjects(beds, false).find((h) => h.face);
        if (!hit) continue; const c = hit.object.geometry.attributes.color, v = pick * (c.getX(hit.face.a) + c.getY(hit.face.a) + c.getZ(hit.face.a)); if (v > bv) { bv = v; best = { x, z }; } }
      S.leave(mode, 7, side, best || { x: P.home.x, z: P.home.z }); S.hold(1 - S.age()); S.place(S.now(), mode === 'look' ? 5 : 2.5, S.side, 0.55); }, [mode, side, pick]);
    await shot(`${mode}-bed-${name}`, `${mode}: 1 s, over the ${name === 'pale' ? 'palest' : 'darkest'} bed near the bloom`);
  }
}
await browser.close(); server.close();
