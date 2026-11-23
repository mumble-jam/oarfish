// Photographs the four jellyfish (not in the dive yet: game/jelly.js). On the stand in the specimen library: each state from the side, a few moments
// of it since a pose is a movement, and from above; the model close, from above, from underneath and along its strands, in a bright band and a dark
// one; beside the oarfish. Then in a dive, brought there by the pause menu's testing tool (game.bring): from the high camera the game is played from
// and from near by, in a pale band and a dark one.
//   node tools/shot_jelly.mjs [prefix] [lib|model|dive ...] [moonjelly|nettle|helmetjelly|boxjelly ...]     writes out/shots/<prefix>-<id>-<what>.png
// Asked for by name only: `stroke` (six moments of one stroke, close on the bell) and `family` (all four in a row beside the fish). OPAQUE=1 draws the
// bells in a dive with nothing seen through them, which is how the clear bell was chosen.
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
// each animal: its states, how far off to stand, where to look (from the stand's middle), and how long to wait between the moments of a state
const ALL = {
  moonjelly: { states: ['drifting', 'pulsing', 'resting'], far: 1.5, at: [0, -0.04, 0], gap: 0.45, near: 0.75, beat: 0.8 },
  nettle: { states: ['drifting', 'pulsing', 'turning', 'fishing'], far: 6.4, at: [0, -0.1, 0], gap: 0.5, near: 2.2, travel: [0, 0.1, -1.2], beat: 0.72 },
  helmetjelly: { states: ['drifting', 'pulsing', 'lit', 'down'], far: 2.4, at: [0, 0.08, 0], gap: 0.55, near: 1.3, beat: 0.62 },
  boxjelly: { states: ['drifting', 'pulsing', 'turning', 'fishing'], far: 3.6, at: [0, -0.2, 0], gap: 0.3, near: 1.1, travel: [0, 0, -0.45], beat: 1.7 },
};
const args = process.argv.slice(2), prefix = args[0] && !ALL[args[0]] && !['lib', 'model', 'dive', 'stroke', 'family'].includes(args[0]) ? args.shift() : 'jelly';
const ids = args.filter((k) => ALL[k]), kinds = args.filter((k) => !ALL[k]), want = (k) => !kinds.length || kinds.includes(k), who = ids.length ? ids : Object.keys(ALL);
const PLAY_FOV = 30; // VIEW.point.fov in main.js
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${prefix}-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 1000, height: 660 }, deviceScaleFactor: 1.5 })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/fonts\.g|ERR_|Failed to load resource|GPU stall|GL Driver|AudioContext|toNonIndexed/.test(m.text())) console.log(`[${m.type()}]`, m.text().slice(0, 400)); });
await page.addInitScript((opaque) => { window.__noNursery = true; window.__opaque = opaque; }, !!process.env.OPAQUE);
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const shot = async (name) => { await frame(); await page.screenshot({ path: out(name) }); console.log('shot', name); };

if (want('lib') || want('model') || kinds.includes('stroke')) {
  await page.addStyleTag({ content: '#library > * { display: none !important; }' });
  for (const id of who) { const A = ALL[id];
    await page.evaluate((id) => { const g = window.__game; g.setPaused(true); g.openLibrary(id); window.__hold = true; g.lib.state.turn = false; }, id);
    const pose = (state, band, secs, fish = false) => page.evaluate(([state, band, secs, fish]) => { const L = window.__game.lib, S = L.state;
      const press = (set, i) => document.querySelectorAll(`[data-set="${set}"] button`)[i].click();
      if (S.band !== band) press('band', band); if (S.state !== state) press('state', state); if (!!S.fish !== fish) press('show', 2);
      S.turn = false; for (let k = 0; k < Math.round(secs * 60); k++) L.frame(1 / 60); }, [state, band, secs, fish]);
    const view = (yaw, pitch, dist, at = [0, 0, 0]) => page.evaluate(([yaw, pitch, dist, at]) => { const L = window.__game.lib, c = L.camera, y = L.state.lift, cp = Math.cos(pitch);
      c.clearViewOffset(); c.position.set(at[0] + Math.sin(yaw) * cp * dist, y + at[1] + Math.sin(pitch) * dist, at[2] + Math.cos(yaw) * cp * dist); c.lookAt(at[0], y + at[1], at[2]); c.updateProjectionMatrix(); }, [yaw, pitch, dist, at]);
    if (want('lib')) for (let i = 0; i < A.states.length; i++) { const at = i === 0 || !A.travel || /fish|lit|down|rest/.test(A.states[i]) ? A.at : A.travel;
      await pose(i, 1, 7);
      for (let m = 0; m < 3; m++) { await pose(i, 1, A.gap); await view(1.35, 0.14, A.far, at); await shot(`${id}-lib-${i}-${A.states[i]}-${m}`); }
      await view(0.5, 1.05, A.far, at); await shot(`${id}-lib-${i}-${A.states[i]}-above`);
    }
    // one stroke, close on the bell: six moments of it
    if (kinds.includes('stroke')) { await pose(1, 1, 6);
      for (let m = 0; m < 6; m++) { await pose(1, 1, 1 / (6 * (A.beat || 0.7))); await view(1.45, 0.1, A.near * 1.25, [0, 0, 0]); await shot(`${id}-stroke-${m}`); } }
    if (id === 'helmetjelly' && want('model')) { await pose(2, 3, 5); for (let m = 0; m < 2; m++) { await pose(2, 3, 0.3); await view(1.1, 0.2, A.near, [0, 0.02, 0]); await shot(`${id}-lit-dark-${m}`); } }
    if (want('model')) {
      await pose(0, 0, 6);
      await view(0.6, 1.25, A.near * 1.6, [0, 0.1, 0]); await shot(`${id}-model-above`);
      await view(1.2, -0.6, A.near * 1.5, [0, 0, 0]); await shot(`${id}-model-under`);
      await view(1.1, 0.2, A.near, [0, 0.02, 0]); await shot(`${id}-model-near`);
      await view(1.1, 0.1, A.near * 1.1, [0, -A.near * 0.32, 0]); await shot(`${id}-model-strands`);
      await view(1.35, 0.14, A.far, A.at); await shot(`${id}-band1`);
      await pose(0, 3, 2); await view(1.35, 0.14, A.far, A.at); await shot(`${id}-band4`);
      await view(0.6, 1.25, A.near * 1.6, [0, 0.1, 0]); await shot(`${id}-band4-above`);
      await pose(0, 1, 2, true); await view(0.5, 0.85, 9, [-0.9, 0, 0.2]); await shot(`${id}-fish`); await pose(0, 1, 0.1, false);
    }
    await page.evaluate(() => { window.__hold = false; window.__game.lib.close(); });
  }
}

if (want('dive')) {
  await page.addStyleTag({ content: '#stage > :not(canvas) { display: none !important; }' });
  for (const band of [0, 3]) for (const id of who) {
    // brought by the game's own testing tool, and left to live for a while. (run.hush, not run.safe: safe has the fish blink, and half the pictures would have no fish in them)
    const got = await page.evaluate(async ([band, id]) => { const g = window.__game; window.__hold = false; g.setPaused(false);
      g.startRun(4242); if (band) g.enterFloor(band, false); g.run.hush = 1e9; g.sim(1.2, { dir: { x: 0.6, y: 0, z: 0.8 }, amount: 1, vertical: 0, sprint: false });
      for (const b of g.foes.biters) { b.alive = false; b.mesh.visible = false; }
      const still = { dir: { x: 0, y: 0, z: 0 }, amount: 0, vertical: 0, sprint: false }; g.bring(id, true); g.sim(9, still);
      // the fish never quite stops, and has left them behind: they are set down again a little ahead of it and to one side, as they were to one another, and given a moment more
      { const l = Math.hypot(g.rig.forward.x, g.rig.forward.z) || 1, fx = g.rig.forward.x / l, fz = g.rig.forward.z / l, list = g.pets[id].list, o = list[0].pos.clone(), to = { x: g.rig.pos.x + fx * 4.4 + fz * 2.6, y: g.rig.pos.y + 0.9, z: g.rig.pos.z + fz * 4.4 - fx * 2.6 };
        for (const s of list) { s.pos.set(to.x + s.pos.x - o.x, to.y + s.pos.y - o.y, to.z + s.pos.z - o.z); s.a.rig.pose.yawWas = null; for (const st of s.a.rig.strands) st.st.fresh = true; } g.sim(1.6, still); } window.__hold = true;
      if (window.__opaque) for (const s of g.pets[id].list) s.a.rig.see.value = 10; // to compare: the bell's skin with nothing seen through it
      const F = g.rig.pos, l = Math.hypot(g.rig.forward.x, g.rig.forward.z) || 1, list = g.pets[id].list.map((s) => [s.pos.x, s.pos.y, s.pos.z]); return { F: [F.x, F.y, F.z], f: [g.rig.forward.x / l, g.rig.forward.z / l], list }; }, [band, id]);
    const look = (from, to, fov) => page.evaluate(([f, a, v]) => { const g = window.__game; g.camera.fov = v; g.camera.updateProjectionMatrix(); g.camera.position.set(...f); g.camera.lookAt(...a); }, [from, to, fov]);
    const F = got.F, J = got.list[0], mid = [F[0] * 0.5 + J[0] * 0.5, F[1] * 0.5 + J[1] * 0.5, F[2] * 0.5 + J[2] * 0.5], far = ALL[id].far;
    const [fx, fz] = got.f, dx = fx * 0.85 + fz * 0.53, dz = fz * 0.85 - fx * 0.53; // the game's own camera: fifteen metres off and 0.56 of a radian up (cam.dist, PLATE_LEVEL in main.js), here from ahead of the fish and to one side
    await look([mid[0] + dx * 12.7, mid[1] + 8, mid[2] + dz * 12.7], mid, PLAY_FOV); await shot(`${id}-dive-${band}-play`);
    await look([J[0] + far * 0.55, J[1] + far * 0.4, J[2] + far * 0.9], [J[0], J[1] - far * 0.06, J[2]], 34); await shot(`${id}-dive-${band}-near`);
    await page.evaluate((id) => { const g = window.__game; g.bring(id, false); window.__hold = false; }, id);
  }
}
// all four in one picture, in a row beside the fish, for telling them apart: from near by and from the high camera, in a pale band and a dark one
if (kinds.includes('family')) {
  await page.addStyleTag({ content: '#stage > :not(canvas) { display: none !important; }' });
  for (const band of [0, 3]) {
    const got = await page.evaluate(async (band) => { const g = window.__game, still = { dir: { x: 0, y: 0, z: 0 }, amount: 0, vertical: 0, sprint: false }; window.__hold = false; g.setPaused(false);
      g.startRun(4242); if (band) g.enterFloor(band, false); g.run.hush = 1e9; g.sim(1.2, { dir: { x: 0.6, y: 0, z: 0.8 }, amount: 1, vertical: 0, sprint: false });
      for (const b of g.foes.biters) { b.alive = false; b.mesh.visible = false; }
      g.sim(3, still); for (const id of ['moonjelly', 'nettle', 'helmetjelly', 'boxjelly']) g.bring(id, true); g.sim(5, still); // (they are given a while to live, and then set in a row a little ahead of the fish, which never quite stops)
      const l = Math.hypot(g.rig.forward.x, g.rig.forward.z) || 1, F = g.rig.pos.clone(), f = { x: g.rig.forward.x / l, z: g.rig.forward.z / l }, r = { x: f.z, z: -f.x }, ids = ['moonjelly', 'nettle', 'helmetjelly', 'boxjelly'], at = [];
      ids.forEach((id, i) => { const side = (i - 1.5) * 2.3; g.pets[id].list.forEach((s, k) => { const a = k * 2.4, d = k ? 0.5 + 0.22 * k : 0; s.pos.set(F.x + f.x * 5.2 + r.x * side + Math.sin(a) * d, F.y + (id === 'nettle' ? 1.7 : 0.7) + (k % 3) * 0.3, F.z + f.z * 5.2 + r.z * side + Math.cos(a) * d); s.vel.set(0, 0, 0); s.mood = 'drift'; s.t = 30; s.leg = 30; s.head = s.yaw; s.a.rig.pose.yawWas = null; for (const st of s.a.rig.strands) st.st.fresh = true; }); });
      g.sim(1.4, still); window.__hold = true;
      for (const id of ids) at.push([g.pets[id].list[0].pos.x, g.pets[id].list[0].pos.y, g.pets[id].list[0].pos.z]);
      return { F: [g.rig.pos.x, g.rig.pos.y, g.rig.pos.z], f: [f.x, f.z], at }; }, band);
    const look = (from, to, fov) => page.evaluate(([f, a, v]) => { const g = window.__game; g.camera.fov = v; g.camera.updateProjectionMatrix(); g.camera.position.set(...f); g.camera.lookAt(...a); }, [from, to, fov]);
    const mid = [0, 1, 2].map((k) => got.at.reduce((t, p) => t + p[k], 0) / 4), [fx, fz] = got.f;
    // from in front of them, the fish behind; and from the high camera
    await look([mid[0] + fx * 6.6 + fz * 1.5, mid[1] + 1.5, mid[2] + fz * 6.6 - fx * 1.5], [mid[0] - fx, mid[1] - 0.5, mid[2] - fz], 40); await shot(`family-${band}-near`);
    await look([mid[0] + (fx * 0.85 + fz * 0.53) * 12.7 - fx * 1.5, mid[1] + 7.5, mid[2] + (fz * 0.85 - fx * 0.53) * 12.7 - fz * 1.5], [mid[0] - fx * 1.5, mid[1] - 0.5, mid[2] - fz * 1.5], PLAY_FOV); await shot(`family-${band}-play`);
    await page.evaluate(() => { const g = window.__game; for (const id of Object.keys(g.pets)) g.bring(id, false); window.__hold = false; });
  }
}
await browser.close(); server.close();
