// Photographs the concepts (game/concepts.js: creatures not in the dive yet) in the bands they are meant for, the fish beside each for size.
//   node tools/shot_concepts.mjs [id ...]     writes out/shots/concept-<id>.png
// and beaten. Then its poses on the stand in the specimen library.
//   node tools/shot_crab.mjs [prefix]     writes out/shots/<prefix>-<what>-<n>.png
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
const prefix = process.argv[2] || 'crab';
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/concept-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 750 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.addInitScript(() => { window.__noNursery = true; });
await page.addInitScript(() => { try { const f = JSON.parse(localStorage.getItem('oarfish.feel') || '{}'); if (!f.mode) localStorage.setItem('oarfish.feel', JSON.stringify({ ...f, mode: 'point' })); } catch {} }); // made on the plate camera, the default when this was written: ask for it, unless a camera was chosen in this page
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await page.addStyleTag({ content: '#stage > :not(canvas):not(#library) { display: none !important; }' });
const only = process.argv.slice(2);
const list = await page.evaluate(async () => { const C = await import('/game/concepts.js'); window.C = C; window.__hold = true; return C.CONCEPTS.map((c) => ({ id: c.id, band: c.band })); });
for (const c of list) { if (only.length && !only.includes(c.id)) continue;
  await page.evaluate((id) => { const g = window.__game, c = window.C.CONCEPTS.find((x) => x.id === id); g.startRun(4242); if (c.band) g.enterFloor(c.band, false); g.run.safe = 1e9; g.sim(0.4);
    for (const b of g.foes.biters) { b.alive = false; b.mesh.visible = false; } for (const a of g.foes.anglers || []) { a.alive = false; a.group.visible = false; }
    // open ground near the start: the place within reach that pushes a wide body least
    const p0 = g.rig.pos.clone(); let best = null, least = 1e9; for (let i = 0; i < 40; i++) { const a = i * 2.4, r = 6 + (i % 8) * 2.5, p = p0.clone(); p.x += Math.sin(a) * r; p.z += Math.cos(a) * r; let push = 0; for (const [dx, dz] of [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]]) { const q = p.clone(); q.x += dx; q.z += dz; q.y = g.world.height(q.x, q.z) + 1; const w = q.clone(); g.world.pushOut(q, 1.6); push += q.distanceTo(w) + Math.abs(g.world.height(q.x, q.z) - g.world.height(p.x, p.z)); } if (push < least) { least = push; best = p; } }
    if (window.__concept) g.scene.remove(window.__concept); // one at a time
    const y = g.world.height(best.x, best.z), grp = window.__concept = c.build(); grp.position.set(best.x, y, best.z); grp.rotation.y = c.turn ?? 0.5; g.scene.add(grp);
    { const [fx, fz] = c.fish || [-3.6, 1.6]; g.rig.reset(g.rig.pos.clone().set(best.x + fx, y + 1.5, best.z + fz), c.fish ? -2.2 : 0.7); } g.sim(0.05); // the fish, beside it, for size
    const a = 0.75; g.camera.fov = 30; g.camera.updateProjectionMatrix(); g.camera.position.set(best.x + Math.sin(a) * c.far, y + c.high, best.z + Math.cos(a) * c.far); g.camera.lookAt(best.x, y + 1.2, best.z + 0.8); }, c.id);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); await page.screenshot({ path: out(c.id) }); console.log('shot', c.id); }
await browser.close(); server.close();
