// Photographs the squid (not in the dive yet: game/squid.js). On the stand in the specimen library: each state from the side, a few
// moments of it since a pose is a movement, then from above, from below, and close on the arms. Then in a dive, where this tool puts one
// beside the fish itself (nothing in the game does): hovering, and jetting past, from the high camera the game is played from, in a
// pale band and a dark one.
//   node tools/shot_squid.mjs [prefix] [lib|jet|model|dive ...]     writes out/shots/<prefix>-<what>.png
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
const [prefix = 'squid', ...only] = process.argv.slice(2), want = (k) => !only.length || only.includes(k);
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${prefix}-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 750 }, deviceScaleFactor: 1.5 })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource|GPU stall|GL Driver|AudioContext/.test(m.text())) console.log('[error]', m.text().slice(0, 300)); });
await page.addInitScript(() => { window.__noNursery = true; });
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const shot = async (name) => { await frame(); await page.screenshot({ path: out(name) }); console.log('shot', name); };

if (want('lib') || want('model') || want('jet')) {
  await page.addStyleTag({ content: '#library > * { display: none !important; }' });
  await page.evaluate(() => { const g = window.__game; g.setPaused(true); g.openLibrary('squid'); window.__hold = true; g.lib.state.turn = false; });
  // the stand, stepped by hand: choose a state and a light, run it for a while, and look from where we like (at: a point to look at, from the head)
  const pose = (state, band, secs, fish = false) => page.evaluate(([state, band, secs, fish]) => { const g = window.__game, L = g.lib, S = L.state;
    const press = (set, i) => document.querySelectorAll(`[data-set="${set}"] button`)[i].click();
    if (S.band !== band) press('band', band); if (S.state !== state) press('state', state); if (!!S.fish !== fish) press('show', 2);
    S.turn = false; for (let k = 0; k < Math.round(secs * 60); k++) L.frame(1 / 60); }, [state, band, secs, fish]);
  const view = (yaw, pitch, dist, at = [0, 0, 0]) => page.evaluate(([yaw, pitch, dist, at]) => { const L = window.__game.lib, c = L.camera, y = L.state.lift, cp = Math.cos(pitch);
    c.clearViewOffset(); c.position.set(at[0] + Math.sin(yaw) * cp * dist, y + at[1] + Math.sin(pitch) * dist, at[2] + Math.cos(yaw) * cp * dist); c.lookAt(at[0], y + at[1], at[2]); c.updateProjectionMatrix(); }, [yaw, pitch, dist, at]);
  const STATES = ['hovering', 'jetting', 'turning', 'alarmed', 'reaching'], GAP = [0.9, 0.26, 0.9, 0.11, 0.62];
  if (want('lib')) for (let i = 0; i < STATES.length; i++) {
    await pose(i, 1, 4);
    for (let m = 0; m < 4; m++) { await pose(i, 1, GAP[i]); await view(1.25, 0.16, 4.6, [0, -0.1, 0.25]); await shot(`lib-${i}-${STATES[i]}-${m}`); }
    await view(0.5, 1.05, 4.8, [0, 0, 0.2]); await shot(`lib-${i}-${STATES[i]}-above`);
  }
  // one jet, close, from over its shoulder: the squeeze, the glide and the filling
  if (want('jet')) { await pose(1, 1, 4); for (let m = 0; m < 6; m++) { await pose(1, 1, 0.16); await view(0.95, 0.5, 3.4, [0, 0, 0.1]); await shot(`lib-jet-${m}`); } }
  // the model itself: hovering, from above, from below, from the front, and close on the arms; then in the dark, and beside the fish
  if (want('model')) {
  await pose(0, 0, 5);
  await view(2.5, 0.75, 3.1, [0, 0, -0.3]); await shot('lib-model-back');
  await view(1.3, -0.55, 3.2, [0, -0.1, 0]); await shot('lib-model-under');
  await view(0.75, 0.2, 2.1, [0, -0.25, 0.5]); await shot('lib-model-arms');
  await view(0.35, 0.1, 1.5, [0, -0.05, 0.1]); await shot('lib-model-face');
  await view(1.57, 0.12, 2.3, [0, 0, -0.35]); await shot('lib-model-fins');
  await view(1.25, 0.16, 4.6, [0, -0.1, 0.25]); await shot('lib-band1');
  await pose(0, 3, 2); await view(1.25, 0.16, 4.6, [0, -0.1, 0.25]); await shot('lib-band4');
  await pose(0, 4, 2); await view(1.25, 0.16, 4.6, [0, -0.1, 0.25]); await shot('lib-band5');
  for (const band of [1, 2, 3]) { await pose(0, band, 2); await view(0.8, 0.3, 4.3, [0, -0.3, 0.35]); await shot(`lib-hero-${band + 1}`); } // as in the picture George gave: seen over its shoulder, the arms flowing down and away
  await pose(0, 1, 2, true); await view(0.5, 0.85, 9, [-0.9, 0, 0.2]); await shot('lib-fish');
  }
  await page.evaluate(() => { window.__hold = false; window.__game.lib.close(); });
}

if (want('dive')) {
  await page.addStyleTag({ content: '#stage > :not(canvas) { display: none !important; }' });
  for (const band of [0, 3]) {
    // a squid of the tool's own, put in the water beside the fish and moved as a behaviour would move it
    const at = await page.evaluate(async (band) => { const g = window.__game, N = await import('/game/npc.js'); window.__hold = false; g.setPaused(false);
      g.startRun(4242); if (band) g.enterFloor(band, false); g.run.safe = 1e9; g.sim(1.2, { dir: { x: 0.6, y: 0, z: 0.8 }, amount: 1, vertical: 0, sprint: false });
      for (const b of g.foes.biters) { b.alive = false; b.mesh.visible = false; }
      window.__hold = true; const F = g.rig.pos, a = window.__squid = N.make('squid'); g.scene.add(a.object);
      return [F.x, F.y, F.z]; }, band);
    // move(seconds, fn): fn(t) gives { x, y, z, yaw, pitch, mood } at each sixtieth of a second
    const run = (kind, secs) => page.evaluate(([kind, secs, F]) => { const a = window.__squid, yaw = 2.2, f = [Math.sin(yaw), Math.cos(yaw)]; let d = 0, t = 0;
      a.rig.pose.yawWas = null; for (const arm of a.rig.arms) arm.st.fresh = true;
      for (let k = 0; k < Math.round(secs * 60); k++) { t += 1 / 60;
        if (kind === 'hover') a.rig.update(1 / 60, { x: F[0] + 2.2 + 0.07 * Math.sin(t * 0.43), y: F[1] + 0.5 + 0.08 * Math.sin(t * 0.71), z: F[2] + 0.6, yaw: yaw + 0.14 * Math.sin(t * 0.27), pitch: 0.4, mood: 'hover' });
        else { const q = a.rig.pose.jet, v = 2.6 * (0.3 + 1.25 * (q < 0.2 ? q / 0.2 : Math.exp(-(q - 0.2) * 4.5))); d += v / 60; // it goes point first: away from where its head points
          a.rig.update(1 / 60, { x: F[0] + 2.2 + f[0] * (4.4 - d), y: F[1] + 0.5, z: F[2] + 0.6 + f[1] * (4.4 - d), yaw, pitch: -0.05, mood: 'jet' }); } }
      const p = a.object.position; return [p.x, p.y, p.z]; }, [kind, secs, at]);
    const look = (from, to, fov) => page.evaluate(([f, a, v]) => { const g = window.__game; g.camera.fov = v; g.camera.updateProjectionMatrix(); g.camera.position.set(...f); g.camera.lookAt(...a); }, [from, to, fov]);
    let S = await run('hover', 5);
    await look([at[0] - 9, at[1] + 8.5, at[2] - 12], [at[0] + 1, at[1], at[2]], 30); await shot(`dive-${band}-hover-play`);
    await look([S[0] + 2.6, S[1] + 2.4, S[2] + 4.4], [S[0] - 0.8, S[1] - 0.3, S[2]], 34); await shot(`dive-${band}-hover-near`);
    S = await run('jet', 1.72);
    await look([at[0] - 9, at[1] + 8.5, at[2] - 12], [at[0] + 1, at[1], at[2]], 30); await shot(`dive-${band}-jet-play`);
    await look([S[0] + 2.6, S[1] + 2.4, S[2] + 4.4], [S[0] - 0.8, S[1] - 0.3, S[2]], 34); await shot(`dive-${band}-jet-near`);
    await page.evaluate(() => { const g = window.__game; g.scene.remove(window.__squid.object); window.__squid.dispose(); window.__hold = false; });
  }
}
await browser.close(); server.close();
