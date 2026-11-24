// Photographs the quiet side of the first band (quiet.js; world.quiet) from the game's own camera, with the help put away: each place as the fish arrives
// through its gate arch and from inside it, the kelp forest's lanes and clearing, the reef's empty spots for coral to come (marked with rings for the
// picture only), and the colonnade from one column toward the next, from the plate's camera and from the adventure camera.
//   node tools/shot_quiet.mjs [prefix] [seed]     writes out/shots/<prefix>-<name>.png and prints each path
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
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const prefix = process.argv[2] || 'quiet', seed = +(process.argv[3] || 4242), only = process.argv.slice(4);
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${prefix}-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 750 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.addInitScript(() => { window.__noNursery = true; });
await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await page.addStyleTag({ content: '#stage > :not(canvas):not(#library) { display: none !important; }' });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
await page.evaluate(async (seed) => { window.__hold = true; const g = window.__game; window.THREE = await import('three');
  window.S = { none: { dir: null, amount: 0, vertical: 0, sprint: false, gentle: false, coil: 0, tight: false, bite: false },
    fresh(mode = 'point') { localStorage.removeItem('oarfish.nest'); g.setMode(mode); g.startRun(seed); g.run.safe = 1e9; g.sim(0.2, this.none); return g.world.quiet; },
    // the head at (x, z), `lift` over the bed, facing `yaw`, the camera behind it
    put(x, z, yaw, lift = 3) { g.rig.reset(g.rig.pos.clone().set(x, g.world.height(x, z) + lift, z), yaw); g.cam.yaw = yaw + Math.PI; g.snap(); },
    swim(yaw, s, k = 0.45) { g.sim(s, { ...this.none, dir: { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) }, amount: k }); },
    marks: [], mark(x, z, r, color = '#ff5a36') { const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.09, 4, 28), new THREE.MeshBasicMaterial({ color, fog: false })); m.rotation.x = Math.PI / 2; m.position.set(x, g.world.drawn(x, z) + 0.25, z); g.scene.add(m); this.marks.push(m); },
    unmark() { for (const m of this.marks) g.scene.remove(m); this.marks = []; } }; }, seed);
const shots = [];
const shot = async (name, what, setup, arg) => { if (only.length && !only.includes(name)) return; await page.evaluate(setup, arg); await page.evaluate(() => { const g = window.__game; g.run.safe = 0; g.sim(1 / 60, S.none); g.run.safe = 1e9; }); await frame(); await page.screenshot({ path: out(name) }); await page.evaluate(() => S.unmark()); shots.push(out(name)); console.log(`${out(name)}  ${what}`); };
// arriving: the fish set down well outside the gate, swimming in toward it
const arrive = (name) => { const q = S.fresh()[name], gt = q.gate, back = 24; S.put(gt.x + Math.sin(gt.yaw) * back, gt.z + Math.cos(gt.yaw) * back, gt.yaw + Math.PI); S.swim(gt.yaw + Math.PI, 1.0); };
await shot('sand-arrive', 'the sand flat, arriving through its arch', arrive, 'sandflat');
await shot('sand-inside', 'the sand flat from inside: the cistern rim, the tables, grass at the edge', () => { const q = S.fresh().sandflat; S.put(q.x + q.fx * 6, q.z + q.fz * 6, Math.atan2(q.tables[1].x - q.x, q.tables[1].z - q.z) + 0.5); S.swim(Math.atan2(q.meadow.x - q.x, q.meadow.z - q.z), 1); });
await shot('reef-arrive', 'the reef head, arriving through its arch', arrive, 'reef');
await shot('reef-inside', 'the reef head from its middle, where the station will stand', () => { const q = S.fresh().reef; S.put(q.x + q.fx * 2, q.z + q.fz * 2, q.facing + Math.PI); S.swim(q.facing + Math.PI, 0.8, 0.2); });
await shot('reef-grow', 'the reef head, its empty spots for coral to come marked (red rings, for this picture only; the first three larger)', () => { const q = S.fresh().reef; S.put(q.x + q.fx * 4, q.z + q.fz * 4, q.facing + Math.PI, 4); S.swim(q.facing + Math.PI, 0.5, 0.1);
  for (const sp of q.grow) S.mark(sp.x, sp.z, sp.order < 3 ? 1.1 : 0.7); });
await shot('kelp-arrive', 'the kelp forest, arriving through its arch from the old field', arrive, 'kelpwood');
await shot('kelp-lane', 'down the main lane of the kelp forest', () => { const q = S.fresh().kelpwood, L = q.lanes[0].points, a = L[4], b = L[6]; S.put(a[0], a[1], Math.atan2(b[0] - a[0], b[1] - a[1])); S.swim(Math.atan2(b[0] - a[0], b[1] - a[1]), 1.5, 0.4); });
await shot('kelp-lanes-top', 'the kelp forest from above its middle, the lanes marked (blue, for this picture only)', () => { const q = S.fresh().kelpwood; for (const ln of q.lanes) for (let i = 0; i + 1 < ln.points.length; i++) { const [ax, az] = ln.points[i], [bx, bz] = ln.points[i + 1]; for (let t = 0; t < 1; t += 0.34) S.mark(ax + (bx - ax) * t, az + (bz - az) * t, 0.35, '#3a7bff'); }
  S.mark(q.nook.x, q.nook.z, q.nook.r, '#ffb400'); const m = q.lanes[0].points[3]; S.put(m[0], m[1], q.facing + Math.PI, 3); const g = window.__game; g.cam.pitch = 1.35; g.cam.zoom = 2.2; g.snap(); });
await shot('kelp-clearing', 'the clearing at the forest\'s far end', () => { const q = S.fresh().kelpwood, L = q.lanes[0].points, a = L[L.length - 2]; S.put(a[0], a[1], Math.atan2(q.clearing.x - a[0], q.clearing.z - a[1])); S.swim(Math.atan2(q.clearing.x - a[0], q.clearing.z - a[1]), 1.6, 0.4); });
// the colonnade: at a column, looking along the line to the next (plate camera, and the adventure camera which looks further)
for (const [mode, name] of [['point', 'cols-plate'], ['look', 'cols-look']]) await shot(name, `the colonnade toward the sand flat, from one column toward the next (${mode === 'point' ? 'the plate camera' : 'the adventure camera'})`, (mode) => {
  const q = S.fresh(mode), c = q.colonnade.filter((o) => o.toward === 'sandflat'), a = c[0], b = c[1], yaw = Math.atan2(b.x - a.x, b.z - a.z); S.put(a.x - Math.sin(yaw) * 3 + Math.cos(yaw) * 2, a.z - Math.cos(yaw) * 3 - Math.sin(yaw) * 2, yaw); S.swim(yaw, 0.5, 0.2); if (mode === 'look') { const g = window.__game; g.cam.ease = null; g.cam.pitch = 0.12; g.cam.yaw = yaw + Math.PI; g.snap(); } }, mode);
await browser.close(); server.close();
fs.writeFileSync(path.resolve(import.meta.dirname, `../out/shots/${prefix}-list.txt`), shots.join('\n'));
