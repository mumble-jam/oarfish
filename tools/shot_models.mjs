// A contact sheet of the game's models: each one framed close, with the fish beside it for scale and finish.
// node tools/shot_models.mjs [prefix] [only-subject ...]   → out/shots/<prefix>-<floor>-<subject>.png
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
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const [prefix = 'm', ...only] = process.argv.slice(2);
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${prefix}-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource|GPU stall|GL Driver/.test(m.text())) console.log('[error]', m.text().slice(0, 300)); });
await page.addInitScript(() => { try { localStorage.setItem('oarfish.ui', JSON.stringify({ full: false })); } catch {} });
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

// put the camera at `from` looking at `at` (world metres); the dive is held still meanwhile
const look = (from, at, fov = 34) => page.evaluate(([f, a, v]) => { const g = window.__game; window.__hold = true; g.camera.fov = v; g.camera.updateProjectionMatrix(); g.camera.position.set(...f); g.camera.lookAt(...a); }, [from, at, fov]);
const shot = async (name, from, at, fov) => { await look(from, at, fov); await frame(); await page.screenshot({ path: out(name) }); console.log('shot', name); };
// a three-quarter view of a thing at p, from `d` metres away and `h` metres above it
const around = (p, d, h, a = 0.7) => [[p[0] + Math.sin(a) * d, p[1] + h, p[2] + Math.cos(a) * d], p];

await page.addStyleTag({ content: '#stage > :not(canvas) { display: none !important; }' });
// bring the fish beside a subject, let the world settle round it, and say where the subject is
const visit = (floor, what, side = 2.4) => page.evaluate(([f, what, side]) => {
  const g = window.__game; window.__hold = false;
  if (g.run.floor !== f || !window.__visited) { g.startRun(4242); if (f) g.enterFloor(f, false); g.run.segs = 14; g.buildFish(14); window.__visited = true; }
  g.run.safe = 1e9;
  const w = g.world, r = g.rig, v = (p) => (p ? [p.x, p.y, p.z] : null);
  const near = (list) => list.filter((o) => o.alive !== false)[0];
  const sc = w.schools.find((s) => !s.gone && s.tier !== 's') || w.schools[0];
  const at = {
    spawn: () => v(r.pos), well: () => [w.goal.x, w.goal.y, w.goal.z], hall: () => (w.hall ? [w.hall.x, w.hall.y + 2, w.hall.z] : null),
    school: () => (sc ? (sc.x || sc.z ? [sc.x, sc.y, sc.z] : [sc.hx, sc.hy, sc.hz]) : null), biter: () => v(near(g.foes.biters)?.pos), angler: () => v(near(g.foes.anglers)?.pos), mine: () => v(near(g.foes.mines)?.pos), leech: () => v(near(g.foes.leeches)?.pos),
    hook: () => (g.foes.hooks[0] ? [g.foes.hooks[0].x, g.foes.hooks[0].y0, g.foes.hooks[0].z] : null), guard: () => (g.guard ? v(g.guard.pos) : null),
    shell: () => (g.field?.items[0] ? [g.field.items[0].x, g.field.items[0].y, g.field.items[0].z] : null),
  }[what];
  let p = at(); if (!p) return null;
  if (what !== 'spawn') { r.reset(r.pos.clone().set(p[0] + side, Math.max(p[1], w.height(p[0] + side, p[2]) + 0.8), p[2] + 0.4), 0.3, 0); g.sim(0.25, { dir: { x: 0, y: 0, z: 1 }, amount: 0.4, vertical: 0, sprint: false }); }
  else g.sim(1.2, { dir: { x: 0.6, y: 0, z: 0.8 }, amount: 1, vertical: 0, sprint: false });
  p = at(); window.__hold = true;
  return { p, fish: v(r.pos), ground: w.height(r.pos.x, r.pos.z), groundAt: w.height(p[0], p[2]) };
}, [floor, what, side]);
const want = (name) => !only.length || only.some((o) => name.includes(o) || o.includes(name));
for (const floor of [0, 1, 2, 3, 4]) {
  let s;
  if (want('spawn') && (s = await visit(floor, 'spawn'))) {
    const F = s.fish;
    await shot(`${floor}-spawn-play`, [F[0] - 9, F[1] + 8.5, F[2] - 12], F, 30);
    await shot(`${floor}-spawn-fish`, [F[0] + 2.2, F[1] + 0.8, F[2] + 2.4], [F[0] - 0.4, F[1] - 0.1, F[2] - 0.8], 34);
    await shot(`${floor}-spawn-bed`, [F[0] - 1.5, s.ground + 0.9, F[2] - 3.5], [F[0] + 4, s.ground + 0.6, F[2] + 8], 46);
    await shot(`${floor}-spawn-eye`, [F[0], F[1] + 1.6, F[2]], [F[0] + 9, F[1] + 0.4, F[2] + 12], 60);
    await shot(`${floor}-spawn-eye2`, [F[0], F[1] + 1.6, F[2]], [F[0] - 12, F[1] + 0.4, F[2] + 5], 60);
  }
  if (floor < 4 && want('well') && (s = await visit(floor, 'well', 8.5))) { const g = [s.p[0], s.groundAt + 4, s.p[2]]; await shot(`${floor}-well-wide`, ...around(g, 19, 7, 0.5), 40); await shot(`${floor}-well-near`, ...around([g[0], s.groundAt + 7.5, g[2]], 10.5, 2.4, 2.2), 46); await shot(`${floor}-well-top`, ...around([g[0], s.groundAt + 6, g[2]], 7, 9, 4), 46); }
  if (want('guard') && (s = await visit(floor, 'guard', 3))) await shot(`${floor}-guard`, ...around(s.p, 5.2, 1.6, 0.9), 40);
  if (want('hall') && (s = await visit(floor, 'hall', 6))) { await shot(`${floor}-hall-wide`, ...around(s.p, 34, 20, 0.4), 44); await shot(`${floor}-hall-sum`, ...around(s.p, 9, 3.4, 1.4), 50); }
  if (want('school') && (s = await visit(floor, 'school', 3))) await shot(`${floor}-school`, ...around(s.p, 3.6, 0.9, 0.3), 40);
  if (want('biter') && (s = await visit(floor, 'biter', 1.6))) await shot(`${floor}-biter`, ...around(s.p, 1.9, 0.5, 1.1), 36);
  if (want('angler') && (s = await visit(floor, 'angler', 3))) await shot(`${floor}-angler`, ...around(s.p, 3.4, 0.7, 1.1), 38);
  if (want('mine') && (s = await visit(floor, 'mine', 2))) await shot(`${floor}-mine`, ...around(s.p, 2.6, 0.6, 1.1), 36);
  if (want('leech') && (s = await visit(floor, 'leech', 2))) await shot(`${floor}-leech`, ...around(s.p, 2.2, 0.5, 1.1), 36);
  if (want('hook') && (s = await visit(floor, 'hook', 2.5))) await shot(`${floor}-hook`, ...around(s.p, 4.2, 0.8, 1.1), 40);
  if (floor === 0 && want('gallery')) { // all ten shells in a row, and a shed tail
    const g = await page.evaluate(() => { const g = window.__game; window.__hold = false; g.startRun(4242); g.run.safe = 1e9; g.sim(0.3); const r = g.rig, w = g.world; const types = Object.keys(g.SHELLS); const x0 = r.pos.x + 3, z0 = r.pos.z + 6; types.forEach((t, i) => { const it = g.field.drop(x0 + (i % 5) * 1.25, z0 + Math.floor(i / 5) * 2.6, t, 0.5); it.group.children[1].visible = false; it.mesh.rotation.y = 0.5; }); g.sim(0.1); g.field.items.forEach((it) => { it.mesh.rotation.y = 2.6; }); window.__hold = true; return { x: x0 + 2.5, y: w.height(x0 + 3, z0) + 0.9, z: z0 }; });
    await shot('0-gallery-shells', [g.x, g.y + 1.3, g.z - 5.4], [g.x, g.y - 0.2, g.z], 50);
    await shot('0-gallery-shells2', [g.x, g.y + 1.3, g.z - 2.8], [g.x, g.y - 0.2, g.z + 2.6], 50);
  }
  if (want('shell') && (s = await visit(floor, 'shell', 1.6))) await shot(`${floor}-shell`, ...around(s.p, 1.8, 0.5, 1.1), 36);
}
await browser.close(); server.close();
