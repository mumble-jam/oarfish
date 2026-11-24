// Photographs the Shearer at work in the second band: searching over the rift, then each of its two blows from the first
// feeling of a fish to the saw being spent or stuck. A strip of moments for each.
//   node tools/shot_shearer.mjs [prefix]     writes out/shots/<prefix>-<what>-<n>.png
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
const prefix = process.argv[2] || 'shearer';
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${prefix}-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource|GPU stall|GL Driver|AudioContext/.test(m.text())) console.log('[error]', m.text().slice(0, 300)); });
await page.addInitScript(() => { window.__noNursery = true; });
await page.addInitScript(() => { try { const f = JSON.parse(localStorage.getItem('oarfish.feel') || '{}'); if (!f.mode) localStorage.setItem('oarfish.feel', JSON.stringify({ ...f, mode: 'point' })); } catch {} }); // made on the plate camera, the default when this was written: ask for it, unless a camera was chosen in this page
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await page.addStyleTag({ content: '#stage > :not(canvas):not(#library) { display: none !important; }' });
await page.evaluate(() => { window.__hold = true; const g = window.__game; g.startRun(4242); g.enterFloor(1, false); g.run.segs = 14; g.buildFish(14); g.run.safe = 1e9; for (const h of g.foes.hooks) h.pos.y += 500; for (const b of g.foes.biters) { b.alive = false; b.mesh.visible = false; } });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
// where the checks stand the fish: on the shelf by the near edge of the rift, `up` metres over the bed, lying along the edge; and the Shearer brought round to it
const stage = (up) => page.evaluate(([up]) => { const g = window.__game, G = g.guard, S = G.state, w = g.world, r = w.rift, x = r.x - r.nx * (r.w(0) + 3.5), z = r.z - r.nz * (r.w(0) + 3.5);
  g.rig.reset(g.rig.pos.clone().set(x, w.height(x, z) + up, z), Math.atan2(r.tx, r.tz)); g.run.safe = 1e9; g.sim(0.2, { dir: null, amount: 1, vertical: 0, sprint: false });
  S.ang = Math.atan2(-r.nx, -r.nz); G.pos.set(r.x - r.nx * 11, r.y + 2.6, r.z - r.nz * 11); G.debug.set('idle'); S.cool = 0; S.stun = 0; }, [up]);
// let the dive run on `secs`, then look from the shelf side at the middle of what is going on: `d` metres off, `h` up, `a` round
const step = (secs, d = 17, h = 7, a = 0.5) => page.evaluate(([secs, d, h, a]) => { const g = window.__game, G = g.guard, none = { dir: null, amount: 1, vertical: 0, sprint: false };
  if (secs) g.sim(secs, none);
  const r = g.world.rift, base = Math.atan2(-r.nx, -r.nz) + a, p = G.pos, f = g.rig.pos, mx = (p.x + f.x) / 2, mz = (p.z + f.z) / 2, y = r.y;
  g.camera.fov = 30; g.camera.updateProjectionMatrix(); g.camera.position.set(mx + Math.sin(base) * d, y + h, mz + Math.cos(base) * d); g.camera.lookAt(mx, y + 1.5, mz);
  return { state: G.state.state, mode: G.state.mode, stuck: G.state.stuck }; }, [secs, d, h, a]);
const strip = async (name, n, secs, view = []) => { const seen = []; for (let i = 0; i < n; i++) { const at = await step(secs, ...view); await frame(); await page.screenshot({ path: out(`${name}-${i}`) }); seen.push(at.state + (at.stuck ? '!' : '')); } console.log(name, seen.join(' ')); };

// 1. nobody near: round and round over the rift, the saw sweeping
await page.evaluate(() => { const g = window.__game, r = g.world.rift, x = r.x - r.nx * 52, z = r.z - r.nz * 52; g.rig.reset(g.rig.pos.clone().set(x, g.world.height(x, z) + 2, z), 0); g.guard.state.cool = 99; });
const over = (secs) => page.evaluate(([secs]) => { const g = window.__game, G = g.guard, r = g.world.rift; g.sim(secs, { dir: null, amount: 1, vertical: 0, sprint: false }); const p = G.pos, b = Math.atan2(-r.nx, -r.nz) + 0.4;
  g.camera.fov = 30; g.camera.updateProjectionMatrix(); g.camera.position.set(p.x + Math.sin(b) * 11, p.y + 6, p.z + Math.cos(b) * 11); g.camera.lookAt(p.x, p.y, p.z); }, [secs]);
for (let i = 0; i < 6; i++) { await over(0.7); await frame(); await page.screenshot({ path: out(`search-${i}`) }); }
// 2. a fish up in the water: felt, the saw cocked, the slash, spent
await stage(3.2); await page.evaluate(() => { window.__game.run.safe = 0; }); await strip('slash', 12, 0.14);
// 3. a fish along the bed: felt, the climb, the stoop, the saw stuck
await page.evaluate(() => { const g = window.__game; g.run.segs = 14; g.buildFish(14); }); await stage(0.5); await page.evaluate(() => { window.__game.run.safe = 0; }); await strip('pin', 12, 0.2, [19, 9, 0.5]);
// 4. beaten
await page.evaluate(() => { window.__game.run.safe = 1e9; window.__game.guard.debug.fall(); }); await strip('down', 3, 0.7);
await browser.close(); server.close();
