// Photographs the Keeper's fight with the testing tool 'Show hit shapes' on: what the fight believes, drawn over the picture, blow by blow, each
// moment from the dive's own camera (from ahead of the crab and a little to its left) and from straight above. It leans only on what the fight has
// had since the tool came in, so the same pictures can be taken of the game before a change and after it (OARFISH_SRC, as in shot_bosses.mjs).
//   node tools/shot_shapes.mjs <prefix> [moment ...]     writes out/shots/<prefix>-<moment>-<play|top>.png
//   OARFISH_SRC=<a copy of the repository as it was> node tools/shot_shapes.mjs before
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
const [prefix = 'shapes', ...only] = process.argv.slice(2), want = (k) => !only.length || only.includes(k);
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${prefix}-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 800, height: 560 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource|GPU stall|GL Driver|AudioContext/.test(m.text())) console.log('[error]', m.text().slice(0, 300)); });
await page.addInitScript(() => { window.__noNursery = true; });
await page.addInitScript(() => { try { const f = JSON.parse(localStorage.getItem('oarfish.feel') || '{}'); if (!f.mode) localStorage.setItem('oarfish.feel', JSON.stringify({ ...f, mode: 'point' })); } catch {} }); // made on the plate camera, the default when this was written: ask for it, unless a camera was chosen in this page
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await page.addStyleTag({ content: '#stage > :not(canvas) { display: none !important; }' });
await page.evaluate(() => { const g = window.__game; g.setPaused(false); window.__hold = true; g.startRun(4242); g.run.segs = 16; g.buildFish(16); g.run.hush = 1e9;
  for (const h of g.foes.hooks) h.pos.y += 500; for (const b of g.foes.biters) { b.alive = false; b.mesh.visible = false; } g.hitView.on = true; });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const none = '{ dir: null, amount: 1, vertical: 0, sprint: false }';
const sim = (secs) => page.evaluate(`window.__game.sim(${secs}, ${none})`);
const until = (state, k = 0, secs = 9) => page.evaluate(`(() => { const g = window.__game, S = g.guard.state; let t = 0; while (t < ${secs} && !(S.state === ${JSON.stringify(state)} && (S.T > 0 ? 1 - S.t / S.T : 1) >= ${k})) { g.sim(1 / 60, ${none}); t += 1 / 60; } return S.state; })()`);
const home = () => page.evaluate(() => { const g = window.__game, G = g.guard, r = g.world.rift, wx = r.x - r.nx * 24, wz = r.z - r.nz * 24; G.pos.set(wx + Math.sin(2.7) * 6, 0, wz + Math.cos(2.7) * 6); G.pos.y = g.world.height(G.pos.x, G.pos.z) + 0.9; G.state.ang = 2.7; });
const ready = (o = {}) => page.evaluate((o) => { const g = window.__game, G = g.guard, S = G.state; G.debug.forget?.(); G.debug.set('stalk'); Object.assign(S, { cool: 0, stun: 0, jabT: 9, chargeT: 9, digT: 9, last: '' }, o); g.run.hush = 1e9; g.run.segs = 16; g.buildFish(16); }, o);
// the fish across the crab's front, `far` metres out, `up` over the bed; side 1 turns that toward the crab's left
const lie = (far, side = 0, up = 1.6) => page.evaluate(([far, side, up]) => { const g = window.__game, G = g.guard, yaw = G.mesh.rotation.y + side * 1.1, fx = Math.sin(yaw), fz = Math.cos(yaw), half = g.rig.length / 2, x = G.pos.x + fx * far + fz * half, z = G.pos.z + fz * far - fx * half;
  g.rig.reset(g.rig.pos.clone().set(x, g.world.height(x, z) + up, z), yaw + Math.PI / 2); }, [far, side, up]);
// the two views: the dive's camera (15 m off at 0.56 rad up, fov 30) from ahead of the crab and to its left, and straight down from 24 m
let lookYaw = null;
const look = async (name, { mix = 0.25, a = 0.55, keep = false } = {}) => {
  for (const v of ['play', 'top']) {
    await page.evaluate(([v, mix, a, keep]) => { const g = window.__game, G = g.guard, p = G.pos, f = g.rig.joints[Math.floor(g.rig.joints.length / 2)], w = g.world;
      const x = p.x + (f.x - p.x) * mix, z = p.z + (f.z - p.z) * mix, y = w.height(x, z) + 0.8; if (!keep || window.__ly === undefined) window.__ly = G.mesh.rotation.y + a; const ang = window.__ly;
      if (v === 'play') { g.camera.fov = 30; g.camera.position.set(x + Math.sin(ang) * 12.7, y + 8, z + Math.cos(ang) * 12.7); g.camera.up.set(0, 1, 0); g.camera.lookAt(x, y, z); }
      else { g.camera.fov = 34; g.camera.position.set(x, y + 24, z); g.camera.up.set(Math.sin(ang + Math.PI), 0, Math.cos(ang + Math.PI)); g.camera.lookAt(x, y, z); }
      g.camera.updateProjectionMatrix(); g.hitView.draw(g.guard.shapes(g.sctx || { joints: g.rig.joints })); }, [v, mix, a, keep]);
    await frame(); await page.screenshot({ path: out(`${name}-${v}`) });
  }
  await page.evaluate(() => { window.__game.camera.up.set(0, 1, 0); });
  console.log(name, await page.evaluate(() => { const S = window.__game.guard.state; return `${S.state} ${S.T > 0 ? (1 - S.t / S.T).toFixed(2) : ''} open ${S.open}`; }));
};

if (want('open')) { await home(); await ready(); await lie(3.4); await sim(0.2); await page.evaluate(() => { window.__game.guard.debug.set('rest', 9); }); await sim(0.4); await look('open'); }
if (want('slam')) { await home(); await ready({ last: 'sweep' }); await lie(3.6); await until('slam', 0.85); await look('slam-aimed'); await until('stuck', 0, 3); await sim(1 / 60); await look('slam-strike', { keep: true }); }
if (want('sweep')) { await home(); await ready({ last: 'slam' }); await lie(3.0); await until('sweep', 0.8); await look('sweep-wind'); await until('sweeping', 0.45, 3); await look('sweeping', { keep: true }); }
if (want('jab')) { await home(); await ready({ jabT: 0 }); await lie(1.9, 1); await until('jab', 0.8); await look('jab-wind', { a: -0.3 }); await until('rest', 0, 3); await sim(1 / 60); await look('jab-strike', { a: -0.3, keep: true }); }
if (want('charge')) { await home(); await ready({ chargeT: 0 }); await lie(8.5); await until('charge', 0.8); await look('charge-tuck', { mix: 0.4 }); await until('run', 0.4, 3); await look('charge-run', { mix: 0.4, keep: true }); }
if (want('dig')) { await home(); await page.evaluate(() => { const G = window.__game.guard; G.debug.tear(2, false); G.debug.tear(5, false); G.state.stun = 0; }); await ready({ digT: 0, chargeT: 0 }); await lie(8.5); await until('rise', 0.8, 9); await look('dig-rise', { mix: 0.1 }); await until('rest', 0, 3); await sim(1 / 60); await look('dig-strike', { mix: 0.1, keep: true }); }
await browser.close(); server.close();
