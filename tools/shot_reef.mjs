// Photographs the reef head's life (reef.js) from the dive's own camera, with the help put away: the station mending; the trumpetfish hanging by
// the rods; one peeling off, riding, striking at a swarm being wrapped, and shaken off by a dash; the reef with 0, 5 and 14 corals grown; and one
// growing in. Prints what each picture is of, with the numbers that say it is so.
//   node tools/shot_reef.mjs [prefix] [seed]     writes out/shots/<prefix>-<n>.png;  python3 tools/sheet.py <out> 4 480 out/shots/<prefix>-*.png
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
const prefix = process.argv[2] || 'reef', seed = +(process.argv[3] || 4242);
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${prefix}-${String(n).padStart(2, '0')}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 750 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.addInitScript(() => { window.__noNursery = true; });
await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await page.addStyleTag({ content: '#stage > :not(canvas):not(#library) { display: none !important; }' });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const shot = async (n, what, info = '') => { await page.evaluate(() => { const g = window.__game; g.run.safe = 0; g.sim(1 / 60, S.none); g.run.safe = 1e9; }); await frame(); await page.screenshot({ path: out(n) }); console.log(`${out(n)}  ${what}  ${info}`); };
await page.evaluate((seed) => { window.__hold = true; const g = window.__game;
  const none = { dir: null, amount: 0, vertical: 0, sprint: false, gentle: false, coil: 0, tight: false, bite: false };
  window.S = { none,
    fresh(reef = null) { const n = JSON.parse(localStorage.getItem('oarfish.nest') || '{}'); n.reef = reef; localStorage.setItem('oarfish.nest', JSON.stringify(n)); Object.assign(g.nest, { reef });
      g.startRun(seed); g.run.safe = 1e9; g.sim(0.2, none); return g.reef; },
    put(x, z, yaw, lift = 1.6) { const o = g.reef.debug.off; g.rig.reset(g.rig.pos.clone().set(x + o.x, g.world.height(x + o.x, z + o.z) + lift, z + o.z), yaw); g.cam.yaw = yaw + Math.PI; g.snap(); },
    swim(dx, dz, secs, extra = {}) { const d = Math.hypot(dx, dz) || 1; g.sim(secs, { ...none, dir: { x: dx / d, y: 0, z: dz / d }, amount: 1, ...extra }); },
    info() { const r = g.reef, f = r.rider; return JSON.stringify({ segs: g.run.segs, k: +r.debug.st.k.toFixed(2), uses: r.debug.st.uses, rider: f ? f.do : null, state: { ...r.state, rider: undefined, t: undefined }, fish: r.fish.map((x) => x.do).join(',') }); } }; }, seed);

// 0. the station mending: two segments lost, held still over it, the work half done
let info = await page.evaluate(() => { const g = window.__game, r = S.fresh(), P = r.plan; g.run.longest = 12; g.run.segs = 10; g.buildFish(10);
  S.put(P.station.x, P.station.z - 1.6, 0, 1.7); g.sim(3.8, S.none); return S.info(); });
await shot(0, 'the station at work: held still over it, the ring half full, the cleaners along the body', info);
// 1. the trumpetfish hanging by the rods: the fish still, a few metres from the nearest, which is in the middle of the picture
info = await page.evaluate(() => { const g = window.__game, r = S.fresh(), P = r.plan, f = r.fish[0], a = Math.atan2(f.home.x - P.x, f.home.z - P.z) + 0.6;
  S.put(f.home.x - Math.sin(a) * 3.5, f.home.z - Math.cos(a) * 3.5, a, 1.6); g.sim(0.8, S.none); g.cam.yaw = a + Math.PI - 0.35; g.snap(); return S.info(); });
await shot(1, 'trumpetfish hanging head down by the sea rods', info);
// 2. one peels off as the fish swims by it; 3. riding along its flank
info = await page.evaluate(() => { const g = window.__game, r = S.fresh(), f = r.fish[0], a = f.homeYaw;
  S.put(f.home.x - Math.sin(a) * 5 + Math.cos(a) * 1.6, f.home.z - Math.cos(a) * 5 - Math.sin(a) * 1.6, a, 0.4); let t = 0; while (!r.rider && t < 6) { S.swim(Math.sin(a), Math.cos(a), 0.1); t += 0.1; } S.swim(Math.sin(a), Math.cos(a), 0.35); g.snap(); return S.info(); });
await shot(2, 'one peels off its rod and comes after the body, turning yellow', info);
info = await page.evaluate(() => { const g = window.__game, r = window.__game.reef; for (let i = 0; i < 25 && r.rider?.do !== 'ride'; i++) S.swim(Math.sin(g.rig.yaw), Math.cos(g.rig.yaw), 0.1); S.swim(Math.sin(g.rig.yaw + 0.3), Math.cos(g.rig.yaw + 0.3), 2); return S.info(); });
await shot(3, 'riding: lying yellow along the flank, bent to it', info);
// 4. the strike: a small swarm (brought, for the picture, to open bed beside the reef) and a loop closed on it with the rider aboard
info = await page.evaluate(() => { const g = window.__game, r = g.reef, o = r.debug.off, sc = g.world.schools.find((x) => x.tier === 's' && !x.kind && !x.bloom && x.left > 0), P = r.plan, G = P.gate;
  const ax = G.x + Math.sin(G.yaw) * 12 + o.x, az = G.z + Math.cos(G.yaw) * 12 + o.z; sc.hx = ax; sc.hz = az; sc.px = sc.pz = 0; sc.hy = g.world.height(ax, az) + 1.6; g.sim(0.6, S.none);
  const R = (g.rig.length + 0.8) / (Math.PI * 2); g.rig.reset(g.rig.pos.clone().set(sc.x - R, sc.y, sc.z), 0); g.snap(); const f = r.rider; f.pos.set(g.rig.joints[4].x - o.x, g.rig.joints[4].y, g.rig.joints[4].z - o.z);
  let t = 0; const left = sc.left; while (t < 8 && !(f.do === 'strike' && f.hit)) { g.sim(1 / 60, { ...S.none, coil: 1 }); t += 1 / 60; } g.sim(0.04, { ...S.none, coil: 1 }); return S.info() + ` swarm ${left}->${sc.left} t ${t.toFixed(2)}`; });
await shot(4, 'the strike: out from the flank into the swarm being wrapped, a flash where it takes', info);
// 5. shaken off by a dash
info = await page.evaluate(() => { const g = window.__game, r = S.fresh(), f = r.fish[1] || r.fish[0]; r.state.again = 0; const a = f.homeYaw;
  S.put(f.home.x - Math.sin(a) * 5 + Math.cos(a) * 1.4, f.home.z - Math.cos(a) * 5 - Math.sin(a) * 1.4, a, 0.4); let t = 0; while (r.rider?.do !== 'ride' && t < 8) { S.swim(Math.sin(a), Math.cos(a), 0.1); t += 0.1; } S.swim(Math.sin(a), Math.cos(a), 1); const G = r.plan.gate; for (let i = 0; i < 40; i++) { const o = r.debug.off, dx = G.x + Math.sin(G.yaw) * 14 + o.x - g.rig.pos.x, dz = G.z + Math.cos(G.yaw) * 14 + o.z - g.rig.pos.z; S.swim(dx, dz, 0.1); }
  g.sim(1 / 60, { ...S.none, dir: { x: Math.sin(g.rig.yaw), y: 0, z: Math.cos(g.rig.yaw) }, dash: true, dashNow: true }); g.sim(0.3, S.none); return S.info(); });
await shot(5, 'a dash shakes it off: flung aside, its colours coming back', info);
// 6 to 8. the reef with 0, 5 and 14 corals grown (all seen before): the fish at the station, the camera drawn back as far as the player can draw it
for (const [n, k] of [[6, 0], [7, 5], [8, 14]]) {
  info = await page.evaluate((k) => { const g = window.__game, r = S.fresh({ grown: k, seen: k }), P = r.plan, G = P.gate;
    S.put(P.station.x, P.station.z, G.yaw + Math.PI, 1.8); g.sim(0.5, S.none); g.cam.zoom = 2.6; g.cam.pitch = 0.9; g.snap(); const out = `${S.info()} pieces ${r.debug.pieces.length}`; return out; }, k);
  await shot(n, `the reef with ${k} corals grown`, info); }
await page.evaluate(() => { const g = window.__game; g.cam.zoom = 1; g.cam.pitch = 0.56; });
// 9, 10. one growing in: five seen before, a sixth won since; the fish comes to the reef and it grows
for (const [n, secs] of [[9, 1.4], [10, 4]]) {
  info = await page.evaluate((secs) => { const g = window.__game, r = S.fresh({ grown: 6, seen: 5 }), P = r.plan, sp = P.grow[5];
    S.put(sp.x - 5, sp.z - 1, Math.PI / 2, 2.2); g.sim(secs, S.none); g.snap(); const p = r.debug.pieces.find((q) => q.spot === 5); return `${S.info()} k ${r.debug.grownBy(p).toFixed(2)}`; }, secs);
  await shot(n, `a coral growing in, ${secs} s after the fish came`, info); }
await browser.close(); server.close();
