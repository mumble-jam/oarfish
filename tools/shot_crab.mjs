// Photographs the Keeper at work, a strip of moments for each thing it does: walking its ground across a slope, watching a
// fish that is near, snapping at a tail, stunned, and beaten. Then its poses on the stand in the specimen library.
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
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${prefix}-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource|GPU stall|GL Driver|AudioContext/.test(m.text())) console.log('[error]', m.text().slice(0, 300)); });
await page.addInitScript(() => { window.__noNursery = true; });
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await page.addStyleTag({ content: '#stage > :not(canvas):not(#library) { display: none !important; }' });
await page.evaluate(() => { window.__hold = true; const g = window.__game; g.startRun(4242); g.run.safe = 1e9; for (const b of g.foes.biters) { b.alive = false; b.mesh.visible = false; } });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
// put the fish `far` metres from the crab on the side away from the rift (turned toward it), with its tail `tail` metres from the crab if that is given
const fish = (far, tail = 0) => page.evaluate(([far, tail]) => { const g = window.__game, G = g.guard, r = g.world.rift, x = G.pos.x - r.nx * far, z = G.pos.z - r.nz * far, yaw = Math.atan2(r.nx, r.nz) + (tail ? Math.PI : 0);
  g.rig.reset(g.rig.pos.clone().set(x, g.world.height(x, z) + 1.3, z), yaw); g.run.safe = tail ? 0 : 1e9; }, [far, tail]);
// let the dive run on `secs`, then look at the crab from `d` metres off at angle `a` round it and `h` over it
const step = (secs, d = 13, h = 5.2, a = 0.9) => page.evaluate(([secs, d, h, a]) => { const g = window.__game, G = g.guard, none = { dir: null, amount: 1, vertical: 0, sprint: false };
  if (secs) g.sim(secs, none);
  const r = g.world.rift, base = Math.atan2(-r.nx, -r.nz) + a, p = G.pos, y = g.world.height(p.x, p.z);
  g.camera.fov = 30; g.camera.updateProjectionMatrix(); g.camera.position.set(p.x + Math.sin(base) * d, y + h, p.z + Math.cos(base) * d); g.camera.lookAt(p.x, y + 0.7, p.z);
  const w = g.guard.state; return { state: w.state, y: +(p.y - y).toFixed(2) }; }, [secs, d, h, a]);
const strip = async (name, n, secs, view = []) => { for (let i = 0; i < n; i++) { const at = await step(secs, ...view); await frame(); await page.screenshot({ path: out(`${name}-${i}`) }); if (i === 0 || i === n - 1) console.log(name, i, JSON.stringify(at)); } };

// 1. walking its ground, nobody near: put it where the ground falls away, and let it go on down
await page.evaluate(() => { const g = window.__game, G = g.guard, r = g.world.rift, S = G.state; S.ang = 2.7; const wx = r.x - r.nx * 24, wz = r.z - r.nz * 24;
  G.pos.set(wx + Math.sin(S.ang) * 8.6, 0, wz + Math.cos(S.ang) * 8.6); G.pos.y = g.world.height(G.pos.x, G.pos.z) + 0.9; });
await fish(34); await step(1.2);
await strip('walk', 8, 0.45);
await strip('gait', 8, 0.07, [11.5, 2.2, 1.5]);
// 2. a fish comes near: it turns to it and puts its claws up
await fish(7.5); await step(0.3);
await strip('wary', 4, 0.5, [12, 4.5, 3.6]);
// 3. a tail within reach: it winds up and snaps
await fish(5.2, 1); await page.evaluate(() => { window.__game.guard.debug.set('snap', 0.6); });
await strip('snap', 8, 0.1, [12, 4.5, 3.6]);
// 4. rammed, and beaten
await fish(9); await page.evaluate(() => { window.__game.guard.debug.hurt(1.6); });
await strip('stun', 4, 0.12, [12, 3.4, 0.6]);
await page.evaluate(() => { window.__game.guard.debug.fall(); });
await strip('down', 4, 0.6, [12, 4, 0.6]);
// 5. on the stand in the library, one picture of each pose
await page.evaluate(() => { window.__hold = false; window.__game.setPaused(true); window.__game.openLibrary('keeper'); }); await frame();
const states = await page.evaluate(() => [...document.querySelectorAll('[data-set="state"] button')].map((b) => b.textContent));
for (let i = 0; i < states.length; i++) { await page.click(`[data-set="state"] button:nth-child(${i + 1})`); await page.evaluate((i) => { const L = window.__game.lib; for (let k = 0; k < 40; k++) L.frame(i === 3 ? 0.0235 : 0.05); }, i); await frame(); await page.screenshot({ path: out(`lib-${i}`) }); }
console.log('library states', states.join(', '));
await browser.close(); server.close();
