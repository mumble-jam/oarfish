// The picture a link to the game shows when it is shared: the oarfish in profile, as on the old plate, in the game's own
// water and ruins, under the plate's lettering. It is photographed from the running game, not drawn.
//   node tools/shot_thumbnail.mjs [name] [key=value …]     writes out/shots/<name>.png at 2400 × 1260
//   then: python3 tools/thumbnail.py out/shots/<name>.png thumbnail.jpg
// keys: segs (body segments), band, x, z (where; default by the start), yaw (which way it heads), side (-1 or 1: which flank),
// dist, lift, drop (camera: how far, how high, how far down it looks), bend (how much S there is in the body), up (metres over the bed)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
const ROOT = path.resolve(import.meta.dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2' };
const FONTS = { '/fonts/fell.woff2': 'im-fell-english/files/im-fell-english-latin-400-normal.woff2', '/fonts/fell-italic.woff2': 'im-fell-english/files/im-fell-english-latin-400-italic.woff2',
  '/fonts/fell-sc.woff2': 'im-fell-english-sc/files/im-fell-english-sc-latin-400-normal.woff2', '/fonts/alegreya.woff2': 'alegreya-sans/files/alegreya-sans-latin-500-normal.woff2' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  const CDN = '/npm/three@0.170.0/';
  const p = FONTS[u] ? path.resolve(ROOT, 'node_modules/@fontsource', FONTS[u]) : u.startsWith(CDN) ? path.resolve(ROOT, 'node_modules/three', u.slice(CDN.length)) : path.join(ROOT, u);
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  if (u === '/index.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(fs.readFileSync(p, 'utf8').replaceAll('https://cdn.jsdelivr.net', '')); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const args = process.argv.slice(2), name = args.find((a) => !a.includes('=')) || 'thumbnail';
const o = { segs: 26, band: 0, x: 63, z: 62, yaw: 3.9, side: 1, dist: 11.8, lift: 0.5, drop: 0.1, bend: 0.9, up: 3.8, title: 'Oarfish dive', ...Object.fromEntries(args.filter((a) => a.includes('=')).map((a) => { const [k, v] = a.split('='); return [k, isNaN(+v) ? v : +v]; })) };
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
// a small page at three device pixels to one: the plate's own lettering, larger against the picture than in play
const page = await (await browser.newContext({ viewport: { width: 800, height: 420 }, deviceScaleFactor: 3 })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.addInitScript(() => { window.__noNursery = true; });
await page.addInitScript(() => { try { const f = JSON.parse(localStorage.getItem('oarfish.feel') || '{}'); if (!f.mode) localStorage.setItem('oarfish.feel', JSON.stringify({ ...f, mode: 'point' })); } catch {} }); // made on the plate camera, the default when this was written: ask for it, unless a camera was chosen in this page
await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await page.addStyleTag({ content: `
  @font-face { font-family: "IM Fell English"; src: url(/fonts/fell.woff2) format("woff2"); font-style: normal; }
  @font-face { font-family: "IM Fell English"; src: url(/fonts/fell-italic.woff2) format("woff2"); font-style: italic; }
  @font-face { font-family: "IM Fell English SC"; src: url(/fonts/fell-sc.woff2) format("woff2"); }
  @font-face { font-family: "Alegreya Sans"; src: url(/fonts/alegreya.woff2) format("woff2"); }
  #goal, .top, #toast, #prompt, #stamina, #card, .keys, .tools, .depth { display: none !important; }
  .where b { font-size: 34px !important; } .where span { font-size: 13px !important; margin-top: 4px; }
  .book { font-size: 16px !important; top: 26px !important; left: 30px !important; } .class { display: block !important; font-size: 19px !important; top: 24px !important; right: 30px !important; }
  .caption b { font-size: 19px !important; } .caption i { font-size: 18px !important; display: inline !important; }` });
const at = await page.evaluate(async (o) => {
  window.__hold = true;
  const g = window.__game, none = { dir: null, amount: 1, vertical: 0, sprint: false };
  g.startRun(4242); g.run.segs = o.segs; g.buildFish(o.segs); g.enterFloor(o.band, false); g.run.safe = 1e9; g.sim(3.8, none);
  const w = g.world, x = o.x ?? w.spawn.x, z = o.z ?? w.spawn.z;
  g.rig.reset(g.rig.pos.clone().set(x, w.height(x, z) + o.up, z), o.yaw);
  // swim a slow S so the body lies in a curve, as on the plate
  let yaw = o.yaw;
  for (const turn of [o.bend, -o.bend, o.bend * 0.6]) for (let t = 0; t < 1.5; t += 1 / 30) { yaw += turn * (1 / 30); g.sim(1 / 30, { ...none, dir: { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) }, vertical: Math.max(-1, Math.min(1, (w.height(g.rig.pos.x, g.rig.pos.z) + o.up - g.rig.pos.y) * 1.2)) }); }
  document.getElementById('zone').textContent = o.title;
  // a little shade behind the lettering, top and bottom, so it reads over a busy bed
  for (const css of ['top:0;height:34%;background:linear-gradient(rgba(6,30,40,0.3),transparent)', 'bottom:0;height:42%;background:linear-gradient(transparent,rgba(6,30,40,0.55))']) { const d = document.createElement('div'); d.style.cssText = `position:absolute;left:0;right:0;z-index:1;pointer-events:none;${css}`; document.getElementById('stage').appendChild(d); }
  // stand off its flank, level with it, and take it whole
  const J = g.rig.joints, head = J[0], tail = J[J.length - 1], c = head.clone().add(tail).multiplyScalar(0.5);
  const mid = J[Math.floor(J.length / 2)]; c.lerp(mid, 0.4);
  const ax = head.x - tail.x, az = head.z - tail.z, L = Math.hypot(ax, az) || 1, sx = (az / L) * o.side, sz = (-ax / L) * o.side;
  const cam = g.camera; cam.fov = 28; cam.updateProjectionMatrix();
  cam.position.set(c.x + sx * o.dist, c.y + o.lift, c.z + sz * o.dist); cam.lookAt(c.x, c.y - o.drop + o.lift * 0.4, c.z);
  await document.fonts.ready;
  return { len: +L.toFixed(1), y: +(c.y - w.height(c.x, c.z)).toFixed(1), fonts: [...document.fonts].filter((f) => f.status === 'loaded').length };
}, o);
await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const out = path.resolve(ROOT, `out/shots/${name}.png`); fs.mkdirSync(path.dirname(out), { recursive: true });
await page.screenshot({ path: out });
console.log(name, JSON.stringify(at));
await browser.close(); server.close();
