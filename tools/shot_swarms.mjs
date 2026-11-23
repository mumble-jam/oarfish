// Photographs the swarms with tempers (world.js, TEMPER): each loose, and each doing what it does.
//   node tools/shot_swarms.mjs [prefix]     writes out/shots/<prefix>-<kind>-<n>.png
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
const prefix = process.argv[2] || 'swarm';
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${prefix}-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.addInitScript(() => { window.__noNursery = true; });
await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await page.addStyleTag({ content: '#stage > :not(canvas):not(#library) { display: none !important; }' });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const none = { dir: null, amount: 1, vertical: 0, sprint: false, gentle: false, coil: 0, tight: false, bite: false };
const band = (n, kind) => page.evaluate(([n, kind, none]) => { window.__hold = true; const g = window.__game; g.startRun(4242); if (n) g.enterFloor(n, false); g.run.safe = 1e9;
  for (const list of [g.foes.biters, g.foes.anglers || []]) for (const b of list) { b.alive = false; if (b.mesh) b.mesh.visible = false; }
  window.__sw = g.world.schools.find((x) => x.kind === kind); const q = window.__sw; g.rig.reset(g.rig.pos.clone().set(q.hx + 30, q.hy, q.hz + 30), 0); g.sim(0.5, none); }, [n, kind, none]);
// look at the swarm (and its other half, if it has one out) from `d` metres off, `h` above it, at angle `a`
const snap = async (name, d = 11, h = 3, a = 0.8, up = 0) => { await page.evaluate(([d, h, a, up]) => { const g = window.__game, q = window.__sw, o = q.twin && q.twin.left ? q.twin : q, x = (q.x + o.x) / 2, z = (q.z + o.z) / 2;
    g.run.safe = 0; g.sim(1 / 60, { dir: null, amount: 0, vertical: 0, sprint: false }); g.run.safe = 1e9; g.camera.fov = 38; g.camera.updateProjectionMatrix(); g.camera.position.set(x + Math.sin(a) * d, q.y + h, z + Math.cos(a) * d); g.camera.lookAt(x, q.y + up, z); }, [d, h, a, up]);
  await frame(); await page.screenshot({ path: out(name) }); };
// swim at the swarm, level with it, for `secs`, stopping `stop` metres short
const toward = (secs, stop = 0, dy = 0) => page.evaluate(([secs, stop, dy, none]) => { const g = window.__game, b = window.__sw; for (let t = 0; t < secs; t += 0.1) { const dx = b.x - g.rig.pos.x, dz = b.z - g.rig.pos.z, d = Math.hypot(dx, dz) || 1; if (d < stop) break;
  g.sim(0.1, { ...none, dir: { x: dx / d, y: 0, z: dz / d }, vertical: Math.max(-1, Math.min(1, (b.y + dy - g.rig.pos.y) * 1.5)) }); } }, [secs, stop, dy, none]);
const put = (dx, dy, dz, yaw = -1.57) => page.evaluate(([dx, dy, dz, yaw, none]) => { const g = window.__game, q = window.__sw; g.rig.reset(g.rig.pos.clone().set(q.x + dx, q.y + dy, q.z + dz), yaw); g.sim(0.05, none); }, [dx, dy, dz, yaw, none]);
const idle = (s) => page.evaluate(([s, none]) => window.__game.sim(s, none), [s, none]);

await band(0, 'bolt'); await snap('bolt-0', 9, 1.5, 0.8, 0.3);                       // as it hangs: a column
await put(8, 0, 0); await page.evaluate(() => { window.__y0 = window.__sw.y; }); await toward(1.6, 2.5); await snap('bolt-1', 14, 1, 0.2, -1.5);   // come at level: it goes up
await toward(1.5, 0); await snap('bolt-2', 16, 0, 0.2, -3);
await put(40, 0, 40); await idle(14); await put(2.6, 3, 0.9, 1.1); await idle(1.2); await snap('bolt-3', 11, 4, 0.8, 0.5);   // come down on it: it holds
await band(1, 'twin'); await snap('twin-0', 8, 7, 0.8);                               // two lobes
await put(12, 0, 0); await toward(6, 3.2); await idle(0.5); await snap('twin-1', 9, 8, 0.8);   // parted
await band(2, 'glow'); await snap('glow-0', 13, 4, 0.8);                               // in the dark: a thin wide sheet
await put(10, 0, 0); await toward(1.0, 2.5); await snap('glow-1', 15, 6, 0.8);         // running
await toward(8, 3.4); await idle(1.2); await snap('glow-2', 12, 5, 0.8);               // bunched by a lantern
await browser.close(); server.close();
