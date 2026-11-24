// Photographs the tall Keeper for a contact sheet, each moment from a camera of its own (from the side for size, from the dive's height for the rest):
// beside the old one (OARFISH_SRC, with `size`), the fish going under it, each state a leg can be in, the stomp's tell and strike, a leg wound round and
// hauled, a shed leg and the fish eating it, the list with the great claw's side lame, and the wave at three tempos (three frames each, a fifth of a second apart).
//   node tools/shot_tall.mjs <prefix> [moment ...]     writes out/shots/<prefix>-<moment>.png
//   OARFISH_SRC=<the repository before the crab stood tall> node tools/shot_tall.mjs old size
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
const ROOT = process.env.OARFISH_SRC ? path.resolve(process.env.OARFISH_SRC) : path.resolve(import.meta.dirname, '..');
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
const [prefix = 'tall', ...only] = process.argv.slice(2), want = (k) => !only.length || only.includes(k);
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${prefix}-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 800, height: 560 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.addInitScript(() => { window.__noNursery = true; });
await page.addInitScript(() => { try { const f = JSON.parse(localStorage.getItem('oarfish.feel') || '{}'); if (!f.mode) localStorage.setItem('oarfish.feel', JSON.stringify({ ...f, mode: 'point' })); } catch {} }); // made on the plate camera, the default when this was written: ask for it, unless a camera was chosen in this page
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await page.addStyleTag({ content: '#stage > :not(canvas) { display: none !important; }' });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
// a fresh dive each time, the Keeper at the same place on its ground, nothing to bite
const fresh = () => page.evaluate(() => { const g = window.__game; g.setPaused(false); window.__hold = true; g.startRun(4242); g.run.segs = 16; g.buildFish(16); g.run.hush = 1e9;
  for (const h of g.foes.hooks) h.pos.y += 500; for (const b of g.foes.biters) { b.alive = false; b.mesh.visible = false; }
  const G = g.guard, S = G.state, r = g.world.rift, wx = r.x - r.nx * 24, wz = r.z - r.nz * 24; G.pos.set(wx + Math.sin(2.7) * 5, 0, wz + Math.cos(2.7) * 5); G.pos.y = g.world.height(G.pos.x, G.pos.z) + (G.rig.walker.legs[0].l3 ? 3.6 : 0.9); S.ang = 2.7;
  G.debug.set('stalk'); Object.assign(S, { cool: 99, stun: 0, chargeT: 99, digT: 99, jabT: 99, stompT: 99, bellyT: 99, met: true }); g.sim(0.6, { dir: null }); });
const none = '{ dir: null, amount: 1, vertical: 0, sprint: false }';
const sim = (secs) => page.evaluate(`window.__game.sim(${secs}, ${none})`);
const until = (state, k = 0, secs = 9) => page.evaluate(`(() => { const g = window.__game, S = g.guard.state; let t = 0; while (t < ${secs} && !(S.state === ${JSON.stringify(state)} && (S.T > 0 ? 1 - S.t / S.T : 1) >= ${k})) { g.sim(1 / 60, ${none}); t += 1 / 60; } return S.state; })()`);
// a camera `d` metres off, `h` up, at `a` radians round from the crab's front, looking at a point `mix` of the way from the crab to the fish's middle (or at `at`)
const look = async (name, { d = 20, h = 12, a = 0.55, mix = 0.2, lift = 1.5, fov = 30, at = null } = {}) => {
  await page.evaluate(([d, h, a, mix, lift, fov, at]) => { const g = window.__game, G = g.guard, p = G.pos, J = g.rig.joints, f = J[J.length >> 1], w = g.world;
    const x = at ? at[0] : p.x + (f.x - p.x) * mix, z = at ? at[2] : p.z + (f.z - p.z) * mix, y = w.height(x, z) + lift, ang = G.mesh.rotation.y + a;
    g.camera.fov = fov; g.camera.position.set(x + Math.sin(ang) * d, y + h, z + Math.cos(ang) * d); g.camera.up.set(0, 1, 0); g.camera.lookAt(x, y, z); g.camera.updateProjectionMatrix(); }, [d, h, a, mix, lift, fov, at]);
  await frame(); await page.screenshot({ path: out(name) }); console.log(name, await page.evaluate(() => { const S = window.__game.guard.state; return `${S.state} legs ${S.leg.join('')}`; }));
};
const put = (code) => page.evaluate(code);

if (want('size')) { // from the side, low, the same camera before and after: the fish laid beside it, along its flank
  await fresh(); await put(`(() => { const g = window.__game, G = g.guard, yaw = G.mesh.rotation.y, lx = Math.cos(yaw), lz = -Math.sin(yaw), x = G.pos.x - lx * 7.5, z = G.pos.z - lz * 7.5; g.rig.reset(g.rig.pos.clone().set(x - Math.sin(yaw) * 2.5, g.world.height(x, z) + 1.5, z - Math.cos(yaw) * 2.5), yaw); })()`); await sim(0.3);
  await look('size', { d: 24, h: 3.5, a: -Math.PI / 2, mix: 0, lift: 2.6, fov: 34 }); }
if (want('under')) { await fresh(); await put(`(() => { const g = window.__game, G = g.guard, yaw = G.mesh.rotation.y, lx = Math.cos(yaw), lz = -Math.sin(yaw); G.debug.set('rest', 30); g.rig.reset(g.rig.pos.clone().set(G.pos.x + lx * 9, g.world.height(G.pos.x, G.pos.z) + 1.5, G.pos.z + lz * 9), Math.atan2(-lx, -lz)); g.run.hush = 1e9; })()`);
  await page.evaluate(`window.__game.sim(2.3, { dir: (() => { const y = window.__game.guard.mesh.rotation.y; return { x: -Math.cos(y), y: 0, z: Math.sin(y) }; })(), amount: 1 })`);
  await look('under-play', { d: 22, h: 14, a: 0.6, mix: 0 }); await look('under-side', { d: 18, h: 2.2, a: Math.PI + 0.35, mix: 0, lift: 1.8, fov: 40 }); }
if (want('legs')) { await fresh(); await put(`(() => { const G = window.__game.guard, S = G.state; G.debug.crack(1); G.debug.crack(2); G.debug.numb(2); G.debug.crack(3); G.debug.numb(3); G.debug.tear(3, false); S.stun = 0; G.debug.set('rest', 30); for (const b of G.debug.limbs()) b.bait.life = 0; })()`);
  await sim(0.5); await look('legs', { d: 14, h: 9, a: 1.5, mix: 0, lift: 1.5 }); }
if (want('stomp')) { await fresh(); await put(`(() => { const g = window.__game, G = g.guard, S = G.state, yaw = G.mesh.rotation.y, x = G.pos.x, z = G.pos.z; g.rig.reset(g.rig.pos.clone().set(x - Math.cos(yaw) * 2.6, g.world.height(x, z) + 1.6, z + Math.sin(yaw) * 2.6), yaw + Math.PI / 2); g.run.hush = 0; g.run.safe = 0; Object.assign(S, { cool: 0, stompT: 0 }); })()`);
  await until('stomp', 0.8, 3); await page.evaluate(() => { window.__game.run.hush = 1e9; }); await look('stomp-tell', { d: 21, h: 14, a: -0.7, mix: 0 }); await until('pinned', 0.1, 2); await look('stomp-strike', { d: 21, h: 14, a: -0.7, mix: 0 }); }
if (want('haul')) { await fresh(); await put(`(() => { const g = window.__game, G = g.guard, S = G.state; G.debug.set('rest', 60); g.run.safe = 1e9; S.wrapLeg = 1; G.wrapped(); const L = G.rig.walker.legs[1], f = L.foot, dx = f.x - G.pos.x, dz = f.z - G.pos.z, d = Math.hypot(dx, dz); g.rig.reset(g.rig.pos.clone().set(f.x - dz / d * 0.9, g.world.height(f.x, f.z) + 1.6, f.z + dx / d * 0.9), Math.atan2(-dz, dx)); window.__out = [dx / d, dz / d]; })()`);
  await sim(0.4); await look('wrap', { d: 15, h: 9, a: 1.3, mix: 0.6 }); await page.evaluate(`(() => { const g = window.__game, [x, z] = window.__out; g.sim(0.5, { dir: { x, y: 0, z }, amount: 1 }); })()`); await look('haul', { d: 19, h: 12, a: 1.3, mix: 0.5 }); }
if (want('shed')) { await fresh(); await put(`(() => { const g = window.__game, G = g.guard, S = G.state; G.debug.set('rest', 60); g.run.safe = 1e9; S.wrapLeg = 5; G.wrapped(); const f = G.rig.walker.legs[5].foot; g.rig.reset(g.rig.pos.clone().set(f.x + 0.9, g.world.height(f.x, f.z) + 1.6, f.z + 0.9), 0); })()`);
  await sim(2.4); await page.evaluate(() => { const g = window.__game, G = g.guard, b = G.debug.limbs()[0]; window.__limb = b; g.rig.reset(g.rig.pos.clone().set(b.pos.x + 9, g.world.height(b.pos.x, b.pos.z) + 3, b.pos.z + 9), 0); G.state.cool = 99; G.debug.set('rest', 60); g.sim(2.2, { dir: null }); // it falls, and lies
    { const dx = G.pos.x - b.pos.x, dz = G.pos.z - b.pos.z, d = Math.hypot(dx, dz) || 1; G.pos.x += dx / d * 7; G.pos.z += dz / d * 7; g.sim(0.6, { dir: null }); } // and the Keeper is moved off it, so that it can be seen
    const dx = b.pos.x - G.pos.x, dz = b.pos.z - G.pos.z, d = Math.hypot(dx, dz) || 1; g.rig.reset(g.rig.pos.clone().set(b.pos.x + dx / d * 4, g.world.height(b.pos.x, b.pos.z) + 1.6, b.pos.z + dz / d * 4), Math.atan2(-dx, -dz)); g.sim(0.1, { dir: null }); });
  const at = await page.evaluate(() => window.__limb.pos.toArray()); await look('shed', { d: 13, h: 9, a: 2.4, mix: 0, at, lift: 0.5 });
  console.log('eaten', await page.evaluate(() => { const g = window.__game, b = window.__limb; for (let t = 0; t < 4 && !b.eaten; t += 0.05) { const dx = b.pos.x - g.rig.snout.x, dz = b.pos.z - g.rig.snout.z, d = Math.hypot(dx, dz) || 1; g.sim(0.05, { dir: { x: dx / d, y: 0, z: dz / d }, amount: 0.5 }); } g.sim(0.2, { dir: null }); return b.eaten; }));
  await look('eat', { d: 13, h: 9, a: 2.4, mix: 0, at, lift: 0.5 }); }
if (want('list')) { await fresh(); await put(`(() => { const G = window.__game.guard, S = G.state; for (const i of [4, 5]) G.debug.tear(i, false); S.stun = 0; G.debug.set('stalk'); S.cool = 99; for (const b of G.debug.limbs()) b.bait.life = 0; })()`); await sim(2); await look('list', { d: 20, h: 4, a: 0, mix: 0, lift: 2.5, fov: 34 }); }
if (want('wave')) { await fresh(); for (const [name, far] of [['slow', 16], ['quick', 7]]) {
    await put(`(() => { const g = window.__game, G = g.guard, yaw = G.mesh.rotation.y; g.rig.reset(g.rig.pos.clone().set(G.pos.x + Math.sin(yaw) * ${far}, g.world.height(G.pos.x, G.pos.z) + 2, G.pos.z + Math.cos(yaw) * ${far}), yaw + Math.PI); G.state.cool = 99; })()`); await sim(1.2);
    for (let i = 0; i < 3; i++) { await look(`wave-${name}-${i}`, { d: 15, h: 4, a: 0.6, mix: 0, lift: 4 }); await sim(0.2); } }
  await put(`(() => { const G = window.__game.guard; G.debug.set('stalk'); G.state.cool = 0.6; })()`); await sim(0.05); for (let i = 0; i < 3; i++) { await page.evaluate(() => { const G = window.__game.guard; G.debug.set('stalk'); G.state.cool = 0.55; }); await look(`wave-frantic-${i}`, { d: 15, h: 4, a: 0.6, mix: 0, lift: 4 }); await sim(0.2); } }
await browser.close(); server.close();
