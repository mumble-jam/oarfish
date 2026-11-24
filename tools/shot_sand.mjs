// Photographs the creatures of the sand flat (not in the dive yet: hermit.js, trumpet.js, burrow.js, gardeneel.js, puffer.js). On the stand in
// the specimen library: every state from the side, a few moments of it since a pose is a movement, and from above; the model close; and in a
// dive, brought by the pause menu's testing tool (game.bring), from the high camera the game is played from and from near by.
//   node tools/shot_sand.mjs [prefix] [lib|near|dive ...] [hermit|trumpet|burrow|gardeneel|puffer|sandcircle ...]     writes out/shots/<prefix>-<id>-<what>.png
// `python3 tools/sand_sheet.py` makes the one contact sheet of all of it.
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
// each animal: how far off to stand on the stand, where to look (from the stand's middle), how long between the moments of a state, how many
// moments, and for the close look: how near, and from where (yaw, pitch)
const ALL = {
  hermit: { far: 1.0, at: [0, -0.02, 0.06], gap: 1.5, n: 4, near: 0.55, nearAt: [0, -0.02, 0.06], yaw: 0.9, pitch: 0.35 },
  trumpet: { far: 2.4, at: [0, 0, 0], gap: 0.58, n: 4, near: 0.9, nearAt: [0, 0, 0.25], yaw: 1.1, pitch: 0.25, nearState: 1 },
  burrow: { far: 0.95, at: [0, 0.03, 0.03], gap: 1.5, n: 4, near: 0.6, nearAt: [0, 0.04, 0.05], yaw: 0.9, pitch: 0.4 },
  gardeneel: { far: 3.2, at: [0, 0.3, 0], gap: 0.6, n: 3, near: 0.9, nearAt: [0, 0.45, 0], yaw: 0.8, pitch: 0.25 },
  puffer: { far: 0.85, at: [0, 0, 0], gap: 0.8, n: 3, near: 0.55, nearAt: [0, 0, 0.04], yaw: 1.0, pitch: 0.3 },
  sandcircle: { far: 5.2, at: [0, -0.2, 0], gap: 2, n: 1, near: 3.4, nearAt: [0, -0.3, 0], yaw: 0.7, pitch: 0.9 },
};
const args = process.argv.slice(2), prefix = args[0] && !ALL[args[0]] && !['lib', 'near', 'dive'].includes(args[0]) ? args.shift() : 'sand';
const ids = args.filter((k) => ALL[k]), kinds = args.filter((k) => !ALL[k]), want = (k) => !kinds.length || kinds.includes(k), who = ids.length ? ids : Object.keys(ALL);
const PLAY_FOV = 30; // VIEW.point.fov in main.js
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${prefix}-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1 })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/fonts\.g|ERR_|Failed to load resource|GPU stall|GL Driver|AudioContext|toNonIndexed/.test(m.text())) console.log(`[${m.type()}]`, m.text().slice(0, 400)); });
await page.addInitScript(() => { window.__noNursery = true; });
await page.addInitScript(() => { try { const f = JSON.parse(localStorage.getItem('oarfish.feel') || '{}'); if (!f.mode) localStorage.setItem('oarfish.feel', JSON.stringify({ ...f, mode: 'point' })); } catch {} }); // made on the plate camera, the default when this was written: ask for it, unless a camera was chosen in this page
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const shot = async (name) => { await frame(); await page.screenshot({ path: out(name), type: 'png' }); console.log('shot', name); };

if (want('lib') || want('near')) {
  const hide = await page.addStyleTag({ content: '#library > * { display: none !important; }' });
  for (const id of who) { const A = ALL[id];
    const states = await page.evaluate((id) => { const g = window.__game; g.setPaused(true); g.openLibrary(id); window.__hold = true; g.lib.state.turn = false; return [...document.querySelectorAll('[data-set="state"] button')].map((b) => b.textContent); }, id);
    const pose = (state, band, secs, fish = false) => page.evaluate(([state, band, secs, fish]) => { const L = window.__game.lib, S = L.state;
      const press = (set, i) => document.querySelectorAll(`[data-set="${set}"] button`)[i]?.click();
      if (S.band !== band) press('band', band); if (S.state !== state) press('state', state); if (!!S.fish !== fish) press('show', 2);
      S.turn = false; for (let k = 0; k < Math.round(secs * 30); k++) L.frame(1 / 30); }, [state, band, secs, fish]);
    const view = (yaw, pitch, dist, at = [0, 0, 0]) => page.evaluate(([yaw, pitch, dist, at]) => { const L = window.__game.lib, c = L.camera, y = L.state.lift, cp = Math.cos(pitch);
      c.clearViewOffset(); c.position.set(at[0] + Math.sin(yaw) * cp * dist, y + at[1] + Math.sin(pitch) * dist, at[2] + Math.cos(yaw) * cp * dist); c.lookAt(at[0], y + at[1], at[2]); c.updateProjectionMatrix(); }, [yaw, pitch, dist, at]);
    const n = Math.max(1, states.length);
    if (want('lib')) for (let i = 0; i < n; i++) {
      await pose(i, 0, 3);
      for (let m = 0; m < A.n; m++) { if (m) await pose(i, 0, A.gap); await view(A.yaw + 0.35, 0.22, A.far, A.at); await shot(`${id}-lib-${i}-${m}`); }
      await view(A.yaw - 0.3, 1.1, A.far, A.at); await shot(`${id}-lib-${i}-above`);
    }
    if (want('near')) { await pose(A.nearState || 0, 0, 3);
      await view(A.yaw, A.pitch, A.near, A.nearAt); await shot(`${id}-near-a`);
      await view(A.yaw + 2.4, A.pitch + 0.2, A.near, A.nearAt); await shot(`${id}-near-b`);
      await view(A.yaw - 1.2, -0.25, A.near * 1.2, A.nearAt); await shot(`${id}-near-c`); }
    await page.evaluate(() => { window.__hold = false; window.__game.lib.close(); });
  }
  await hide.evaluate((el) => el.remove());
}

if (want('dive')) {
  await page.addStyleTag({ content: '#stage > :not(canvas) { display: none !important; }' });
  for (const id of who) {
  for (const swim of id === 'trumpet' ? [false, true] : [false]) { const bring = id, tag = swim ? '-swim' : ''; // the trumpetfish twice: hanging by a still fish, and lying along a swimming one
    const got = await page.evaluate(async ([id, swim]) => { const g = window.__game; window.__hold = false; g.setPaused(false);
      g.startRun(4242); g.run.hush = 1e9; g.sim(1.2, { dir: { x: 0.6, y: 0, z: 0.8 }, amount: 1, vertical: 0, sprint: false });
      for (const b of g.foes.biters) { b.alive = false; b.mesh.visible = false; }
      const still = { dir: { x: 0, y: 0, z: 0 }, amount: 0, vertical: 0, sprint: false }; g.bring(id, true); g.sim(6, swim ? { dir: { x: 0.6, y: 0, z: 0.8 }, amount: 0.7, vertical: 0, sprint: false } : still); window.__hold = true;
      const F = g.rig.pos, l = Math.hypot(g.rig.forward.x, g.rig.forward.z) || 1, P = g.pets[id].centre || g.pets[id].list[0].pos; return { F: [F.x, F.y, F.z], f: [g.rig.forward.x / l, g.rig.forward.z / l], P: [P.x, P.y, P.z] }; }, [bring, swim]);
    const look = (from, to, fov) => page.evaluate(([f, a, v]) => { const g = window.__game; g.camera.fov = v; g.camera.updateProjectionMatrix(); g.camera.position.set(...f); g.camera.lookAt(...a); }, [from, to, fov]);
    const F = got.F, P = got.P, mid = [F[0] * 0.5 + P[0] * 0.5, F[1] * 0.5 + P[1] * 0.5, F[2] * 0.5 + P[2] * 0.5], [fx, fz] = got.f, dx = fx * 0.85 + fz * 0.53, dz = fz * 0.85 - fx * 0.53;
    // the game's own camera: fifteen metres off and 0.56 of a radian up (cam.dist, PLATE_LEVEL in main.js), here from ahead of the fish and to one side
    await look([mid[0] + dx * 12.7, mid[1] + 8, mid[2] + dz * 12.7], mid, PLAY_FOV); await shot(`${id}-dive${tag}-play`);
    await look([P[0] + dx * 3.2, P[1] + 2.2, P[2] + dz * 3.2], [P[0], P[1] - 0.3, P[2]], 40); await shot(`${id}-dive${tag}-near`);
    await page.evaluate((id) => { const g = window.__game; g.bring(id, false); window.__hold = false; }, bring);
  } }
}
await browser.close(); server.close();
