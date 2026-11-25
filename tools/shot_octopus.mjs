// Photographs the octopus (not in the dive yet: game/octopus.js), at either size. On the stand in the specimen library: each movement from the
// side, a few moments of it since a movement is not a still, and from above; each skin; the model from the front, the side and above. Then in a dive,
// brought by the testing tool beside the fish ("Bring one to look at"), from the adventure camera and the plate's: at rest, crawling over the bed,
// throwing, and one frame beside the oarfish and a squid for scale.
//   node tools/shot_octopus.mjs [prefix] [octopus|mason] [lib|skins|model|dive ...]     writes out/shots/<prefix>-<id>-<what>.png
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
const ROOT = path.resolve(import.meta.dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
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
const [prefix = 'octo', id = 'octopus', ...only] = process.argv.slice(2), want = (k) => !only.length || only.includes(k);
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${prefix}-${id}-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 1000, height: 680 }, deviceScaleFactor: 1 })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource|GPU stall|GL Driver|AudioContext/.test(m.text())) console.log('[error]', m.text().slice(0, 300)); });
await page.addInitScript(() => { window.__noNursery = true; });
await page.addInitScript(() => { try { const f = JSON.parse(localStorage.getItem('oarfish.feel') || '{}'); if (!f.mode) localStorage.setItem('oarfish.feel', JSON.stringify({ ...f, mode: 'point' })); } catch {} });
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const shot = async (name) => { await frame(); await page.screenshot({ path: out(name) }); console.log('shot', name); };

if (want('lib') || want('skins') || want('model')) {
  await page.addStyleTag({ content: '#library > * { display: none !important; }' });
  await page.evaluate((id) => { const g = window.__game; g.setPaused(true); g.openLibrary(id); window.__hold = true; g.lib.state.turn = false; }, id);
  // the stand, stepped by hand: a state, a skin and a light, run for a while
  const pose = (state, secs, skin = '', band = 0, fish = false) => page.evaluate(([state, secs, skin, band, fish]) => { const L = window.__game.lib, S = L.state;
    const press = (set, i) => document.querySelectorAll(`[data-set="${set}"] button`)[i].click();
    if (S.band !== band) press('band', band); if (S.state !== state) press('state', state); if (!!S.fish !== fish) press('show', 2);
    S.skin = skin; S.turn = false; for (let k = 0; k < Math.round(secs * 30); k++) L.frame(1 / 30); }, [state, secs, skin, band, fish]);
  // the camera: turned yaw about the creature, pitched, at dist, looking at a point (x, y over the bed, z), in the creature's own size (mantle lengths)
  const view = (yaw, pitch, dist, at = [0, 0, 0]) => page.evaluate(([yaw, pitch, dist, at]) => { const L = window.__game.lib, c = L.camera, cp = Math.cos(pitch), base = 0; c.clearViewOffset(); // (in the world: the bed is at 0)
    c.position.set(at[0] + Math.sin(yaw) * cp * dist, base + at[1] + Math.sin(pitch) * dist, at[2] + Math.cos(yaw) * cp * dist); c.lookAt(at[0], base + at[1], at[2]); c.updateProjectionMatrix(); }, [yaw, pitch, dist, at]);
  const ml = 0; // views are in metres over the bed
  const sz = id === 'mason' ? 3.1 : 0.55, ML = id === 'mason' ? 0.8 : 0.24, JET = 0.5 + 2.5 * ML; // how far the camera stands off, for this size; its mantle's length; how high it jets on the stand
  const STATES = ['den', 'crawl', 'jet', 'reach', 'carry', 'throw'], FRAMES = { den: [3, 1.2], crawl: [3, 0.45], jet: [3, 0.4], reach: [6, 1], carry: [3, 0.6], throw: [6, 0.65] };
  if (want('lib')) for (let i = 0; i < STATES.length; i++) {
    const [n, gap] = FRAMES[STATES[i]]; await pose(i, 2);
    if (STATES[i] === 'reach' || STATES[i] === 'throw') await pose(i, 6.5 - 2 - (STATES[i] === 'reach' ? 0.5 : 0)); // to the start of a loop
    for (let m = 0; m < n; m++) { await pose(i, gap); await view(0.9, 0.32, 5.2 * sz, [0, STATES[i] === 'jet' ? JET : 0.5 * ML, 0.4 * ML]); await shot(`lib-${i}-${STATES[i]}-${m}`); }
    await view(0.4, 1.25, 5.5 * sz, [0, -ml, 0.1]); await shot(`lib-${i}-${STATES[i]}-above`);
  }
  if (want('skins')) for (const [k, skin] of ['pale', 'mottled', 'dark', 'blanched', 'clouds'].entries()) { await pose(0, k ? 1.5 : 3, skin); await view(0.75, 0.42, 4.2 * sz, [0, 0.45 * ML, 0]); await shot(`skin-${skin}`);
    if (skin === 'dark' || skin === 'mottled') { await view(0.3, 1.1, 11 * sz, [0, -ml, 0]); await shot(`skin-${skin}-far`); } }
  if (want('model')) {
    await pose(0, 3, 'mottled');
    await view(0, 0.25, 3.6 * sz, [0, 0.45 * ML, 0]); await shot('model-front');
    await view(Math.PI / 2, 0.2, 3.8 * sz, [0, 0.45 * ML, 0]); await shot('model-side');
    await view(0.01, 1.5, 4.4 * sz, [0, -ml, 0]); await shot('model-above');
    await view(0.95, 0.25, 1.3 * sz, [0.22 * ML, 0.47 * ML, 0.1 * ML]); await shot('model-eye');
    await pose(2, 2, ''); await view(Math.PI / 2, 0.15, 4.4 * sz, [0, JET, 1.2 * ML]); await shot('model-jet-side');
    // the eye tilted: the body pitched hard (the jet), and the pupil still level
    await view(Math.PI / 2 + 0.2, 0.1, 1.4 * sz, [0.22 * ML, JET, 0]); await shot('model-jet-eye');
  }
  await page.evaluate(() => { window.__hold = false; window.__game.lib.close(); });
}

if (want('dive') || want('scale')) {
  await page.addStyleTag({ content: '#stage > :not(canvas) { display: none !important; }' });
  // the octopus brought by the testing tool, and lived by sandpets.js; the tool here only chooses what it does and where the camera is
  await page.evaluate(() => { const g = window.__game; window.__hold = false; g.setPaused(false); g.startRun(4242); g.run.safe = 1e9; g.sim(1.0, { dir: { x: 0.6, y: 0, z: 0.8 }, amount: 1, vertical: 0, sprint: false }); for (const b of g.foes.biters) { b.alive = false; b.mesh.visible = false; } });
  await page.evaluate((id) => { const g = window.__game; g.bring(id, true); }, id);
  const pet = (secs, act) => page.evaluate(([id, secs, act]) => { const g = window.__game, P = g.pets[id]; if (act) P.force(act); g.sim(secs); const o = P.body; return [o.x, o.y, o.z]; }, [id, secs, act]);
  const look = (from, to, fov = 34) => page.evaluate(([f, a, v]) => { const g = window.__game; g.camera.fov = v; g.camera.updateProjectionMatrix(); g.camera.position.set(...f); g.camera.lookAt(...a); window.__hold = true; }, [from, to, fov]);
  const free = () => page.evaluate(() => { window.__hold = false; });
  const s = id === 'mason' ? 2.4 : 1;
  const pairs = async (name, at) => { await look([at[0] + 3.2 * s, at[1] + 2.6 * s, at[2] + 3.6 * s], at); await shot(`dive-${name}-near`); await look([at[0] - 7 * s, at[1] + 9 * s, at[2] - 9 * s], at, 30); await shot(`dive-${name}-play`); await free(); };
  if (want('dive')) {
    let at = await pet(3, 'den'); await pairs('den', at);
    at = await pet(2.2, 'crawl'); await pairs('crawl-0', at); at = await pet(0.6); await pairs('crawl-1', at);
    at = await pet(2.4, 'reach'); await pairs('reach', at);
    at = await pet(2.2, 'carry'); await pairs('carry', at);
    at = await pet(1.6, 'throw'); await pairs('throw-dark', at); at = await pet(0.75); await pairs('throw-blast', at);
    at = await pet(1.2, 'jet'); await pairs('jet', at);
  }
  if (want('scale')) { // beside the fish and a squid, from the adventure camera, as the game draws it
    await page.evaluate(() => { const g = window.__game; g.bring(window.__octoId, false); g.setMode('look'); g.startRun(4242); g.run.safe = 1e9; g.sim(1.0, { dir: { x: 0.6, y: 0, z: 0.8 }, amount: 1, vertical: 0, sprint: false }); for (const b of g.foes.biters) { b.alive = false; b.mesh.visible = false; } }).catch(() => {});
    await page.evaluate((id) => { const g = window.__game; if (g.pets[id]) g.bring(id, false); g.bring(id, true); g.bring('squid', true); }, id);
    for (const [k, ahead, aside] of [[0, 3.4, -3.2], [1, 3.4, 3.2]]) {
      await page.evaluate(([id, ahead, aside, k]) => { const g = window.__game, F = g.rig.pos, d = new F.constructor(); g.camera.getWorldDirection(d); d.y = 0; d.normalize(); // along the way the camera looks, past the fish
        const x = F.x + d.x * ahead - d.z * aside, z = F.z + d.z * ahead + d.x * aside; g.pets[id].place(x, z, Math.atan2(F.x - x, F.z - z)); g.pets[id].force('den');
        const sq = g.pets.squid.list[0]; sq.pos.set(F.x + d.x * (ahead - 1.5) + d.z * aside * 0.9, F.y + 0.8, F.z + d.z * (ahead - 1.5) - d.x * aside * 0.9); sq.mood = 'hover'; sq.t = 99; g.sim(2.5); }, [id, ahead, aside, k]);
      await frame(); await page.screenshot({ path: out(`scale-${k}`) }); console.log('shot', `scale-${k}`); }
  }
}
await browser.close(); server.close();
