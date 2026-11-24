// How hard the Keeper's fight is, as numbers: for each blow, how often it lands on a scripted fish that dashes off at a random moment of the wind-up (a fifth of the time it does not move), and how many segments it takes; and how often a dash aimed at a leg while it is open lands. Sixty tries a blow, the same random numbers each run, so a before and an after can be compared (OARFISH_SRC, as in shot_bosses.mjs). About five minutes.
//   node tools/rate_keeper.mjs
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
const ROOT = process.env.OARFISH_SRC ? path.resolve(process.env.OARFISH_SRC) : path.resolve(import.meta.dirname, '..');
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
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const shots = process.argv.includes('--shots');
let failures = 0;
const check = (name, ok, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
const page = await (await browser.newContext({ viewport: { width: 1440, height: 820 } })).newPage();
page.on('pageerror', (e) => { failures++; console.log('[pageerror]', e.message); });
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/fonts\.g|ERR_|Failed to load resource|GPU stall|GL Driver|AudioContext/.test(m.text())) console.log(`[${m.type()}]`, m.text().slice(0, 400)); });
await page.addInitScript(() => { window.__noNursery = true; });
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
const body = String.raw`
const g = window.__game; g.startRun(31); for (const b of g.foes.biters) { b.alive = false; b.mesh.visible = false; } for (const h of g.foes.hooks) h.pos.y += 500;
const G = g.guard, S = G.state, F = g.KEEPER_FIGHT, none = { dir: null, amount: 1, vertical: 0, sprint: false, gentle: false, coil: 0, tight: false, bite: false };
let seed = 12345; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const r = g.world.rift, W = { x: r.x - r.nx * 24, z: r.z - r.nz * 24 };
const home = () => { G.debug.set('stalk'); S.stun = 0; G.pos.set(W.x + Math.sin(2.7) * 5, 0, W.z + Math.cos(2.7) * 5); G.pos.y = g.world.height(G.pos.x, G.pos.z) + 0.9; g.sim(0.05, none); };
const ready = (o = {}) => { G.debug.set('stalk'); Object.assign(S, { cool: 0, stun: 0, flash: 0, jabT: 9, chargeT: 9, digT: 9, last: '' }, o); g.run.segs = 16; g.buildFish(16); g.run.safe = 0; g.run.hush = 0; };
const put = (x, y, z, yaw) => { g.rig.reset(g.rig.pos.clone().set(x, y, z), yaw); };
const lie = (far, side, up, turn) => { const toward = G.mesh.rotation.y, yaw = toward + side, fx = Math.sin(yaw), fz = Math.cos(yaw), half = g.rig.length / 2, x = G.pos.x + fx * far + fz * half * turn, z = G.pos.z + fz * far - fx * half * turn; put(x, g.world.height(x, z) + up, z, yaw + Math.PI / 2 * turn); };
const until = (st, secs) => { let t = 0; while (S.state !== st && t < secs) { g.sim(0.02, none); t += 0.02; } return S.state === st; };
// one trial: a blow is set up; at a random moment of its wind-up (or never) the fish swims off a random way
function trial(blow) {
  home();
  const far = { slam: 2.5 + rnd() * 2, sweep: 2.2 + rnd() * 1.6, jab: 1.4 + rnd() * 1.2, charge: 6.5 + rnd() * 3, dig: 8 + rnd() * 2.5 }[blow], side = { jab: 0.6 + rnd() * 0.8, charge: (rnd() - 0.5) * 0.6 }[blow] ?? (rnd() - 0.5) * 0.8, up = 1.5 + rnd() * 1.0, turn = rnd() < 0.5 ? 1 : -1;
  ready(blow === 'slam' ? { last: 'sweep' } : blow === 'sweep' ? { last: 'slam' } : blow === 'jab' ? { jabT: 0 } : blow === 'charge' ? { chargeT: 0 } : { digT: 0, chargeT: 0 });
  if (blow === 'dig') { S.lost = F.rage; }
  if (blow === 'charge' || blow === 'dig') { const ang = Math.atan2(W.x - G.pos.x, W.z - G.pos.z); G.debug.set('stalk'); lie(far, 0, up, turn); const yaw = ang, fx = Math.sin(yaw), fz = Math.cos(yaw), x = G.pos.x + fx * far, z = G.pos.z + fz * far; put(x, g.world.height(x, z) + up, z, yaw + Math.PI / 2 * turn); }
  else lie(far, side, up, turn);
  const want = { slam: 'slam', sweep: 'sweep', jab: 'jab', charge: 'charge', dig: 'dig' }[blow];
  if (!until(want, 4)) return { blow, skip: S.state };
  const wind = { slam: F.slam.wind, sweep: F.sweep.wind, jab: F.jab.wind, charge: F.charge.tell, dig: F.dig.down + 1.75 + F.dig.tell }[blow], react = rnd() < 0.2 ? 99 : rnd() * wind;
  const segs = g.run.segs; let t = 0, go = null;
  while (t < wind + 1.6) { if (t >= react && !go) { const away = Math.atan2(g.rig.pos.x - G.pos.x, g.rig.pos.z - G.pos.z), a = rnd() < 0.5 ? g.rig.yaw + (rnd() - 0.5) * 1.6 : away + (rnd() - 0.5) * 2.4; go = { ...none, dir: { x: Math.sin(a), y: 0, z: Math.cos(a) }, sprint: true }; g.run.dashCool = 0; g.run.stamina = 1; g.sim(1 / 60, { ...go, dashNow: true }); t += 1 / 60; }
    g.sim(0.02, go || none); t += 0.02; if (segs - g.run.segs > 0) break; }
  return { blow, lost: segs - g.run.segs };
}
const out = {};
for (const blow of ['slam', 'sweep', 'jab', 'charge', 'dig']) { let n = 0, hit = 0, lost = 0, skip = 0; for (let i = 0; i < 60; i++) { const r = trial(blow); if (r.skip) { skip++; continue; } n++; if (r.lost > 0) hit++; lost += r.lost; S.lost = 0; for (let k = 0; k < 8; k++) S.leg[k] = 0; } out[blow] = { n, skip, hitRate: +(hit / Math.max(1, n)).toFixed(2), perBlow: +(lost / Math.max(1, n)).toFixed(2) }; }
// rams at a leg: from 2.9 m out at a random height in the fish's range, aimed at the foot, the crab open; how often does a leg take it
{ let n = 0, landed = 0; for (let i = 0; i < 40; i++) { home(); ready(); G.debug.set('stuck', 4); g.sim(0.05, none); const li = Math.floor(rnd() * 8), f = G.debug.leg(li), dx = f.x - G.pos.x, dz = f.z - G.pos.z, d = Math.hypot(dx, dz), at = { ...none, dir: { x: -dx / d, y: 0, z: -dz / d } };
  const y = g.world.height(f.x + dx / d * 2.9, f.z + dz / d * 2.9) + 1.5 + rnd() * 1.2; put(f.x + dx / d * 2.9, y, f.z + dz / d * 2.9, Math.atan2(-dx, -dz)); g.run.safe = 5; g.run.dashCool = 0; g.run.stamina = 1; const h0 = S.hits; g.sim(1 / 60, { ...at, dashNow: true }); g.sim(0.35, at); n++; if (S.hits > h0) landed++; for (let k = 0; k < 8; k++) S.leg[k] = 0; S.hits = 0; }
  out.ram = { n, landed: +(landed / n).toFixed(2) }; }
return out;
`;
console.log(JSON.stringify(await page.evaluate(`(async () => { ${body} })()`)));
await browser.close(); server.close();
