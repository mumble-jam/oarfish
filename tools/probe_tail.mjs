// Probe: an oarfish starting beside and below a column's flat top rises and swims over it. Records every joint frame by frame and
// reports what the tail does; with `shots` photographs a strip from the side.
//   node tools/probe_tail.mjs [prefix]     writes out/shots/<prefix>-<n>.png
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
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const prefix = process.argv[2] || 'tail';
fs.mkdirSync(path.join(ROOT, 'out/shots'), { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 640, height: 420 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.addInitScript(() => { window.__noNursery = true; });
await page.addInitScript(() => { try { const f = JSON.parse(localStorage.getItem('oarfish.feel') || '{}'); if (!f.mode) localStorage.setItem('oarfish.feel', JSON.stringify({ ...f, mode: 'point' })); } catch {} }); // made on the plate camera, the default when this was written: ask for it, unless a camera was chosen in this page
await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await page.addStyleTag({ content: '#stage > :not(canvas):not(#library) { display: none !important; }' });
await page.evaluate(() => { window.__hold = true; const g = window.__game; g.startRun(4242); g.run.safe = 1e9;
  for (const list of [g.foes.biters, g.foes.anglers || []]) for (const b of list) { b.alive = false; if (b.mesh) b.mesh.visible = false; } });

// one pass: segs, speed ('gentle' | 'swim' | 'sprint'), angle of approach off straight at the column (radians)
const pass = (o) => page.evaluate((o) => {
  const g = window.__game, W = g.world, cols = W.solids.filter((c) => c.top !== undefined && c.r > 0.7 && c.r < 0.9 && c.top - W.height(c.x, c.z) > 3);
  // a column with nothing else solid within 6 m
  const c = cols.find((c) => W.solids.every((d) => d === c || Math.hypot(d.x - c.x, d.z - c.z) > 6)) || cols[0];
  g.run.segs = o.segs; g.buildFish(o.segs);
  const a = o.from, d = 2.6, y0 = c.top - o.below, x0 = c.x + Math.sin(a) * d, z0 = c.z + Math.cos(a) * d, yaw = a + Math.PI + (o.off || 0);
  const rig = g.rig; rig.reset(rig.pos.clone().set(x0, y0, z0), yaw);
  // lay the body out straight behind, level, already moving
  const dir = { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) }, inp = { dir, amount: 1, vertical: 1, sprint: o.speed === 'sprint', gentle: o.speed === 'gentle', coil: 0, tight: false, bite: false };
  const inside = (p) => { let worst = 0; for (const s of W.solids) { if (s.off || s.top === undefined) continue; const h = Math.hypot(p.x - s.x, p.z - s.z); if (h < s.r && p.y < s.top) worst = Math.max(worst, Math.min(s.r - h, s.top - p.y)); } return worst; };
  const rec = [], N = rig.joints.length; let prev = rig.joints.map((j) => j.clone()), prevHead = rig.pos.clone();
  let t = 0, overAt = null, jumps = [], deepest = { d: 0 }, side = [], prev2 = null, jerk = { a: 0 }, jerkSum = 0;
  for (; t < o.time; t += 1 / 60) {
    if (rig.pos.y > c.top + 1.2) inp.vertical = 0; // once over, level off and carry on
    g.sim(1 / 60, inp);
    if (overAt === null && Math.hypot(rig.pos.x - c.x, rig.pos.z - c.z) < c.r) overAt = t;
    const J = rig.joints, hv = rig.pos.distanceTo(prevHead);
    for (let k = 1; k < N; k++) { const m = J[k].distanceTo(prev[k]); if (m > Math.max(3 * hv, 0.12)) jumps.push({ t: +t.toFixed(3), k, m: +m.toFixed(3), head: +hv.toFixed(3), dy: +(J[k].y - prev[k].y).toFixed(3) });
      const din = inside(J[k]); if (din > deepest.d) deepest = { d: +din.toFixed(3), k, t: +t.toFixed(3), y: +J[k].y.toFixed(2), top: +c.top.toFixed(2) }; }
    if (Math.round(t * 60) % 6 === 0) rec.push({ t: +t.toFixed(2), head: [rig.pos.x - c.x, rig.pos.y - c.top, rig.pos.z - c.z].map((v) => +v.toFixed(2)), tail: [J[N - 1].x - c.x, J[N - 1].y - c.top, J[N - 1].z - c.z].map((v) => +v.toFixed(2)), mid: [J[N >> 1].x - c.x, J[N >> 1].y - c.top, J[N >> 1].z - c.z].map((v) => +v.toFixed(2)) });
    if (prev2) for (let k = 1; k < N; k++) { const a = Math.hypot(J[k].x - 2 * prev[k].x + prev2[k].x, J[k].y - 2 * prev[k].y + prev2[k].y, J[k].z - 2 * prev[k].z + prev2[k].z); jerkSum += a; if (a > 0.1) side.push([+t.toFixed(2), k, +a.toFixed(2), +(J[k].x - c.x).toFixed(2), +(J[k].y - c.top).toFixed(2), +(J[k].z - c.z).toFixed(2)]); if (a > jerk.a) jerk = { a: +a.toFixed(3), k, t: +t.toFixed(3), y: +(J[k].y - c.top).toFixed(2), hd: +Math.hypot(J[k].x - c.x, J[k].z - c.z).toFixed(2) }; }
    prev2 = prev; prev = J.map((j) => j.clone()); prevHead.copy(rig.pos);
  }
  return { col: { x: +c.x.toFixed(1), z: +c.z.toFixed(1), r: c.r, top: +c.top.toFixed(2), bed: +W.height(c.x, c.z).toFixed(2) }, length: +rig.length.toFixed(2), N, overAt, jumps: jumps.slice(0, 12), nJumps: jumps.length, deepest, jerk, big: side.length, bigList: o.verbose ? side : undefined, jerkMean: +(jerkSum / (N - 1) / (t * 60)).toFixed(4), rec: o.verbose ? rec : undefined };
}, o);

const only = process.argv[3], OFF = +(process.argv[4] || 0);
if (!only) for (const segs of [6, 10, 18, 26]) for (const speed of ['swim', 'sprint']) for (const below of [1.5, 3]) {
  if (only === 'shots') break;
  const r = await pass({ segs, speed, below, from: 0.5, time: 5, off: OFF });
  console.log(JSON.stringify({ segs, speed, below, length: r.length, overAt: r.overAt?.toFixed(2), nJumps: r.nJumps, deepest: r.deepest.d, jerk: r.jerk, big: r.big, jerkMean: r.jerkMean }));
}
if (only === 'verbose') { const r = await pass({ segs: 18, speed: process.env.SPEED || 'swim', below: +(process.env.BELOW || 2), from: 0.5, time: 4, off: OFF, verbose: true }); console.log(JSON.stringify(r.col)); for (const x of r.bigList) console.log(JSON.stringify(x)); }
if (only === 'shots' || only === 'all') {
  // a strip: the fish (18 segments, swimming) from the side at moments through the climb and over
  const cam = (n) => page.evaluate(() => {});
  const times = [1.30, 1.35, 1.40, 1.45, 2.6, 3.2];
  await pass({ segs: 18, speed: 'swim', below: 2, from: 0.5, time: 0.001 });
  let tPrev = 0;
  for (let i = 0; i < times.length; i++) {
    await page.evaluate(([dt]) => { const g = window.__game, rig = g.rig, W = g.world;
      const c = W.solids.filter((c) => c.top !== undefined && c.r > 0.7 && c.r < 0.9 && c.top - W.height(c.x, c.z) > 3).find((c) => W.solids.every((d) => d === c || Math.hypot(d.x - c.x, d.z - c.z) > 6));
      const yaw = 0.5 + Math.PI, inp = { dir: { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) }, amount: 1, vertical: 1, sprint: false, gentle: false, coil: 0 };
      for (let t = 0; t < dt; t += 1 / 60) { if (rig.pos.y > c.top + 1.2) inp.vertical = 0; if (t + 1 / 60 >= dt) g.run.safe = 0; g.sim(1 / 60, inp); } g.run.safe = 1e9; // (a fish kept safe blinks)
      const s = 0.5 + Math.PI / 2; // look from the side of the line of travel
      g.camera.fov = 40; g.camera.updateProjectionMatrix(); g.camera.position.set(c.x + Math.sin(s) * 7, c.top + 1.0, c.z + Math.cos(s) * 7); g.camera.lookAt(c.x, c.top - 0.5, c.z);
      g.scene.traverse((o) => { if (o.isSkinnedMesh) o.frustumCulled = false; }); g.renderer.render(g.scene, g.camera); let vis = 0; g.scene.traverse((o) => { if (o.isSkinnedMesh && o.visible) vis++; }); return [rig.pos.x - c.x, rig.pos.y - c.top, rig.pos.z - c.z, vis, g.run.state].map((v) => typeof v === "number" ? +v.toFixed(2) : v); }, [times[i] - tPrev]).then((r) => console.log(JSON.stringify(r)));
    tPrev = times[i];
    await page.screenshot({ path: path.join(ROOT, `out/shots/${prefix}-${i}.png`) });
  }
}
await browser.close(); server.close();
