// Scripted checks of the control layer: adventure camera, controller, pause, full screen, hiding the help.
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
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const shots = process.argv.includes('--shots');
let failures = 0;
const check = (name, ok, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
const page = await (await browser.newContext({ viewport: { width: 1440, height: 820 } })).newPage();
page.on('pageerror', (e) => { failures++; console.log('[pageerror]', e.message); });
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/fonts\.g|ERR_|Failed to load resource|GPU stall|GL Driver|AudioContext/.test(m.text())) console.log(`[${m.type()}]`, m.text().slice(0, 300)); });
await page.addInitScript((flat) => { window.__lowpoly = flat; window.__noNursery = true; }, process.env.LOOK !== 'soft');
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await page.evaluate(() => { window.__hold = true; });
const ev = (fn, arg) => page.evaluate(fn, arg);
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const snap = async (name) => { if (!shots) return; await ev(() => { window.__game.run.safe = 0; }); await frame(); await page.screenshot({ path: out(name) }); };
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
await ev(() => {
  const g = window.__game;
  window.T = {
    put(x, y, z, yaw = 0) { g.rig.reset(g.rig.pos.clone().set(x, y, z), yaw); g.snap(); },
    away() { const c = g.camera.position, f = g.rig.pos; const dx = f.x - c.x, dz = f.z - c.z, d = Math.hypot(dx, dz); return { x: dx / d, z: dz / d }; }, // from the camera to the fish, flat
    moved(seconds) { const a = g.rig.pos.clone(); g.sim(seconds); const b = g.rig.pos; const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1; return { x: dx / d, z: dz / d, d, dy: b.y - a.y }; },
  };
});

// ---- the legend and the first state
let s = await ev(() => ({ mode: window.__game.feel.mode, legend: document.getElementById('keys').textContent, fov: window.__game.camera.fov }));
check('starts on point-and-swim with the keyboard legend', s.mode === 'point' && /steer/.test(s.legend) && /adventure camera/.test(s.legend) && s.fov === 30, JSON.stringify(s).slice(0, 200));
await ev(() => window.__game.sim(0.5)); await snap('c-point');

// ---- V switches to the adventure camera: it swings in behind the fish, lower, nearer and wider
await page.keyboard.press('KeyV');
s = await ev(() => { const g = window.__game; g.sim(2.5); return { mode: g.feel.mode, off: Math.atan2(Math.sin(g.cam.yaw - g.rig.yaw - Math.PI), Math.cos(g.cam.yaw - g.rig.yaw - Math.PI)), pitch: g.cam.pitch, fov: g.camera.fov, legend: document.getElementById('keys').textContent, data: document.getElementById('stage').dataset.mode }; });
check('V switches to the adventure camera, behind the fish', s.mode === 'look' && s.data === 'look' && Math.abs(s.pitch - 0.34) < 0.05 && Math.abs(s.fov - 40) < 0.5 && /click the water/.test(s.legend), JSON.stringify({ ...s, legend: undefined }));
await snap('c-look');
// W swims away from the camera, D to its right
await page.keyboard.down('KeyW');
s = await ev(() => { const T = window.T; const a = T.away(); const m = T.moved(1.2); return { dot: a.x * m.x + a.z * m.z, d: m.d }; });
await page.keyboard.up('KeyW');
check('W swims away from the camera', s.dot > 0.9 && s.d > 1.5, JSON.stringify(s));
await page.keyboard.down('KeyD');
s = await ev(() => { const g = window.__game, T = window.T; const yaw = g.cam.yaw; const m = T.moved(1.6); // camera right is (cos yaw, -sin yaw)
  return { right: m.x * Math.cos(yaw) - m.z * Math.sin(yaw), d: m.d }; });
await page.keyboard.up('KeyD');
check('D swims to the right of the view', s.right > 0.6, JSON.stringify(s));

// ---- the mouse turns the view with no button held: first the real pointer lock, if this browser grants it
await page.mouse.move(700, 420);
await page.mouse.click(700, 420);
await page.waitForFunction(() => window.__game.look.locked || window.__game.look.free, null, { timeout: 8000 }).catch(() => {});
s = await ev(() => ({ locked: window.__game.look.locked, free: window.__game.look.free, el: !!document.pointerLockElement }));
console.log('      after a click on the water:', JSON.stringify(s));
const locked = s.locked;
check('a click on the water captures the mouse, or falls back to following it', s.locked || s.free, JSON.stringify(s));
let y0 = await ev(() => window.__game.cam.yaw), p0 = await ev(() => window.__game.cam.pitch);
await page.mouse.move(800, 380, { steps: 10 });
await page.waitForTimeout(100);
s = await ev(() => ({ yaw: window.__game.cam.yaw, pitch: window.__game.cam.pitch }));
check('moving the mouse turns the view, no button held', Math.abs(wrapPi(s.yaw - y0) + 0.28) < 0.06 && s.pitch < p0, JSON.stringify({ dyaw: wrapPi(s.yaw - y0), dpitch: s.pitch - p0, locked }));
// left button wraps (auto side), right button sprints
await page.mouse.down({ button: 'left' });
s = await ev(() => { const g = window.__game; g.sim(1.2); return { coiling: g.rig.coiling, rate: g.rig.yawRate }; });
await page.mouse.up({ button: 'left' });
check('holding the left button coils', s.coiling > 0.5 && Math.abs(s.rate) > 0.5, JSON.stringify(s));
await page.keyboard.down('KeyW'); await page.mouse.down({ button: 'right' });
s = await ev(() => { const g = window.__game; g.sim(1.6); return { speed: g.rig.speed }; });
await page.mouse.up({ button: 'right' }); await page.keyboard.up('KeyW');
check('holding the right button sprints', s.speed > 4.5, JSON.stringify(s));
if (locked) {
  // the browser taking the mouse back (Esc) pauses the dive; Resume hands it back
  await ev(() => document.exitPointerLock()); await page.waitForFunction(() => !window.__game.look.locked, null, { timeout: 8000 });
  s = await ev(() => ({ paused: window.__game.paused, menu: document.getElementById('pause').classList.contains('on') }));
  check('losing the mouse pauses the dive', s.paused && s.menu, JSON.stringify(s));
  await snap('c-pause');
  await page.click('#btn-resume'); await page.waitForFunction(() => window.__game.look.locked, null, { timeout: 8000 }).catch(() => {});
  s = await ev(() => ({ paused: window.__game.paused, locked: window.__game.look.locked }));
  check('Resume takes the mouse again', !s.paused && s.locked, JSON.stringify(s));
  await ev(() => { window.__game.look.mine = true; document.exitPointerLock(); }); await page.waitForFunction(() => !window.__game.look.locked, null, { timeout: 8000 });
  check('...and the game letting go of it does not pause', (await ev(() => window.__game.paused)) === false);
}
// ...then the stand-in for pages that may not lock the pointer
await ev(() => { const g = window.__game; g.setPaused(false); g.look.free = true; });
await page.mouse.move(600, 420); await page.waitForTimeout(60);
y0 = await ev(() => window.__game.cam.yaw);
await page.mouse.move(700, 420, { steps: 10 }); await page.waitForTimeout(60);
s = await ev(() => ({ yaw: window.__game.cam.yaw, over: window.__game.look.over }));
check('without pointer lock the view still follows the mouse', Math.abs(wrapPi(s.yaw - y0) + 0.28) < 0.06, JSON.stringify({ dyaw: wrapPi(s.yaw - y0), over: s.over }));
await page.mouse.move(1432, 420, { steps: 4 }); await page.waitForTimeout(60);
y0 = await ev(() => window.__game.cam.yaw);
s = await ev(() => { const g = window.__game; g.sim(1); return g.cam.yaw; });
check('...and keeps turning while it rests at the edge', wrapPi(s - y0) < -1, `turned ${wrapPi(s - y0).toFixed(2)} rad in a second`);
await page.mouse.move(700, 420); await ev(() => { window.__game.look.free = false; });
const unlock = async () => { await ev(() => { if (document.pointerLockElement) { window.__game.look.mine = true; document.exitPointerLock(); } }); await page.waitForFunction(() => !document.pointerLockElement && !window.__game.look.locked, null, { timeout: 8000 }); };

// ---- P pauses: nothing moves, the menu is up, the band steps back
await page.keyboard.press('KeyP'); await page.waitForTimeout(100);
s = await ev(() => { const g = window.__game; const t0 = g.run.time, p0 = g.rig.pos.clone(); g.sim(1); return { paused: g.paused, dt: g.run.time - t0, moved: g.rig.pos.distanceTo(p0), menu: getComputedStyle(document.getElementById('pause')).display, focus: document.activeElement?.id, duck: g.music.state.duck, keys: document.getElementById('pause-keys').textContent.length }; });
check('P pauses the dive and opens the menu', s.paused && s.dt === 0 && s.moved === 0 && s.menu === 'grid' && s.focus === 'btn-resume' && s.duck === 0.5 && s.keys > 40, JSON.stringify(s));
await page.waitForTimeout(300); await snap('c-pause-look');
// the menu's own controls
s = await ev(() => { const g = window.__game; document.getElementById('mode-point').click(); const m1 = g.feel.mode; document.getElementById('mode-look').click(); const m2 = g.feel.mode;
  const ls = document.getElementById('f-look'); ls.value = 100; ls.dispatchEvent(new Event('input')); const look = g.feel.look; ls.value = 50; ls.dispatchEvent(new Event('input'));
  document.getElementById('btn-new').click(); const armed = document.getElementById('btn-new').textContent;
  return { m1, m2, look, armed, saved: JSON.parse(localStorage.getItem('oarfish.feel') || '{}') }; });
check('the menu switches controls, sets look speed, and asks twice before a new dive', s.m1 === 'point' && s.m2 === 'look' && s.look === 1 && /again/.test(s.armed) && s.saved.mode === 'look' && s.saved.look === 50, JSON.stringify(s));
await page.waitForTimeout(450);
await page.keyboard.press('KeyP');
s = await ev(() => { const g = window.__game; const t0 = g.run.time; g.sim(0.5); return { paused: g.paused, dt: g.run.time - t0, menu: getComputedStyle(document.getElementById('pause')).display, duck: g.music.state.duck }; });
check('P again resumes', !s.paused && s.dt > 0.4 && s.menu === 'none' && s.duck === 1, JSON.stringify(s));
await unlock(); // P took the mouse back on resuming; a captured mouse cannot reach the corner buttons
await page.keyboard.press('KeyV');
check('V goes back to point-and-swim', (await ev(() => window.__game.feel.mode)) === 'point');
await page.click('#btn-pause'); await page.waitForTimeout(450);
s = await ev(() => window.__game.paused);
await page.keyboard.press('Escape');
check('the corner button pauses and Esc resumes', s === true && (await ev(() => window.__game.paused)) === false);

// ---- H hides the help and brings it back
await page.keyboard.press('KeyH');
s = await ev(() => ({ bare: document.getElementById('stage').classList.contains('bare'), keys: getComputedStyle(document.getElementById('keys')).display, top: getComputedStyle(document.querySelector('.top')).display, tools: getComputedStyle(document.querySelector('.tools')).display, scale: getComputedStyle(document.getElementById('scale')).display, saved: localStorage.getItem('oarfish.ui') }));
check('H hides the key list and the corner buttons, and keeps the scale bar', s.bare && s.keys === 'none' && s.top === 'none' && s.tools === 'none' && s.scale !== 'none' && /true/.test(s.saved), JSON.stringify(s));
await ev(() => window.__game.sim(0.3)); await snap('c-bare');
await page.keyboard.press('KeyP'); await page.waitForTimeout(100);
s = await ev(() => getComputedStyle(document.querySelector('.top')).display);
check('...but the corner buttons come back while paused', s === 'flex', s);
await page.waitForTimeout(450); await page.keyboard.press('KeyP'); await page.keyboard.press('KeyH');
s = await ev(() => getComputedStyle(document.getElementById('keys')).display);
check('H again shows them', s === 'flex', s);

// ---- full screen
await page.click('#btn-fs'); await page.waitForTimeout(600);
s = await ev(() => ({ fs: !!document.fullscreenElement, pressed: document.getElementById('btn-fs').getAttribute('aria-pressed'), hint: document.getElementById('hint').textContent, enabled: document.fullscreenEnabled }));
console.log('      full screen from the corner button:', JSON.stringify(s));
check('the full-screen button goes full screen, or says it cannot', s.fs ? s.pressed === 'true' : /not available/.test(s.hint), JSON.stringify(s));
if (s.fs) {
  await page.keyboard.press('KeyF'); await page.waitForTimeout(600);
  s = await ev(() => ({ fs: !!document.fullscreenElement, paused: window.__game.paused }));
  check('F leaves full screen without pausing', !s.fs && !s.paused, JSON.stringify(s));
}

// ---- a controller, stood in for by a stub of the browser's Gamepad API with a DualSense's id and layout
await ev(() => {
  window.rumbles = [];
  const pad = { id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 18 }, () => ({ pressed: false, value: 0 })), vibrationActuator: { playEffect: (type, o) => { window.rumbles.push({ type, ...o }); return Promise.resolve('complete'); } } };
  window.fakePad = pad;
  Object.defineProperty(navigator, 'getGamepads', { value: () => [pad, null, null, null], configurable: true });
  window.B = (i, v = 1) => { pad.buttons[i] = { pressed: v > 0.5, value: v }; };
  window.tap = (i) => { const g = window.__game; window.B(i, 1); g.sim(0.05); window.B(i, 0); g.sim(0.05); };
});
s = await ev(() => { const g = window.__game, T = window.T, pad = window.fakePad; g.sim(0.1); const before = g.dev;
  pad.axes[1] = -1; const a = T.away(); const m = T.moved(1.2); pad.axes[1] = 0;
  return { before, dev: g.dev, dot: a.x * m.x + a.z * m.z, d: m.d, legend: document.getElementById('keys').textContent, note: document.getElementById('pad-note').textContent, hint: document.getElementById('hint').textContent }; });
check('the left stick swims away from the camera, and the legend turns to the controller', s.before === 'keys' && s.dev === 'pad' && s.dot > 0.9 && s.d > 1.5 && /L2/.test(s.legend) && /Options/.test(s.legend) && /DualSense Wireless Controller is connected/.test(s.note), JSON.stringify(s).slice(0, 420));
await snap('c-pad');
s = await ev(() => { const g = window.__game, pad = window.fakePad; pad.axes[1] = -0.45; g.sim(2); const slow = g.rig.speed; pad.axes[1] = -1; g.sim(2); const full = g.rig.speed; window.B(7, 1); g.sim(2); const sprint = g.rig.speed; window.B(7, 0); pad.axes[1] = 0; return { slow, full, sprint }; });
check('the stick is analogue and R2 sprints', s.slow < s.full - 0.4 && s.sprint > s.full + 1.5, JSON.stringify(s));
s = await ev(() => { const g = window.__game, pad = window.fakePad; const y0 = g.cam.yaw, p0 = g.cam.pitch; pad.axes[2] = 1; g.sim(0.5); pad.axes[2] = 0; const dyaw = g.cam.yaw - y0; pad.axes[3] = -1; g.sim(0.4); pad.axes[3] = 0; const dpitch = g.cam.pitch - p0;
  const z0 = g.cam.zoom; window.B(12, 1); g.sim(0.5); window.B(12, 0); const zoom = g.cam.zoom / z0;
  g.cam.yaw += 2; window.tap(11); g.sim(1.5); const off = Math.atan2(Math.sin(g.cam.yaw - g.rig.yaw - Math.PI), Math.cos(g.cam.yaw - g.rig.yaw - Math.PI));
  return { dyaw, dpitch, zoom, off }; });
check('the right stick turns the view, the D-pad zooms, R3 brings the view behind', Math.abs(s.dyaw + 1.3) < 0.15 && s.dpitch < -0.15 && s.zoom < 0.7 && Math.abs(s.off) < 0.15, JSON.stringify(s));
s = await ev(() => { const g = window.__game; window.T.put(72, g.world.height(72, 72) + 3, 72, 0); g.sim(0.3); const y0 = g.rig.pos.y; window.B(5, 1); g.sim(1); window.B(5, 0); const up = g.rig.pos.y - y0; const y1 = g.rig.pos.y; window.B(4, 1); g.sim(1); window.B(4, 0); return { up, down: g.rig.pos.y - y1 }; });
check('R1 rises and L1 dives', s.up > 0.4 && s.down < -0.3, JSON.stringify(s));
// L2 wraps the nearest swarm, choosing its own side
s = await ev(() => { const g = window.__game, T = window.T; g.sim(0.05); const out = [];
  for (const yaw of [1.1, 1.1 + Math.PI]) { const sw = g.world.schools.find((x) => x.tier === 's' && x.left > 0); T.put(sw.x + 2.6, sw.hy, sw.z + 0.9, yaw); g.sim(0.8); const caught = g.run.caught; window.B(6, 1); let t = 0, sign = 0; while (sw.left > 0 && t < 9) { g.sim(0.1); t += 0.1; if (!sign && Math.abs(g.rig.yawRate) > 0.4) sign = Math.sign(g.rig.yawRate); } window.B(6, 0); g.sim(1.2); out.push({ left: sw.left, t: +t.toFixed(1), gained: g.run.caught - caught, n: sw.n, sign }); }
  return out; });
check('L2 wraps a swarm from either heading, picking the side itself', s.every((r) => r.left === 0 && r.gained === r.n) && s[0].sign !== s[1].sign, JSON.stringify(s));
s = await ev(() => { const g = window.__game; g.run.safe = 0; const before = g.run.segs; window.rumbles.length = 0; window.tap(2); return { before, after: g.run.segs, rumbles: window.rumbles.length, r: window.rumbles[0] }; });
check('Square sheds the tail, and the pad rumbles', s.after === s.before - 3 && s.rumbles >= 1 && s.r.type === 'dual-rumble' && s.r.weakMagnitude > 0.3, JSON.stringify(s));
// what the hands feel beyond hits: a heartbeat while hunted, a hum and clicks as a loop closes, nothing at rest, and the strength slider scales it
s = await ev(() => { const g = window.__game, h = g.hap; g.sim(1.5); g.setPaused(true); h.log = []; g.sim(0.5); const rest = Math.max(0, ...h.log.flat()); g.setPaused(false);
  const real = g.foes.state.danger; g.foes.state.danger = 0.9; h.log = []; for (let i = 0; i < 90; i++) { g.foes.state.danger = 0.9; g.sim(1 / 60); } const beat = h.log.map((r) => r[0]); g.foes.state.danger = real;
  const knocks = beat.filter((v, i) => v > 0.3 && !(beat[i - 1] > 0.3)).length;
  g.feel.rumble = 0.35; h.log = []; for (let i = 0; i < 60; i++) { g.foes.state.danger = 0.9; g.sim(1 / 60); } const soft = Math.max(...h.log.map((r) => r[0])); g.feel.rumble = 0.7; g.foes.state.danger = real;
  h.log = null; return { rest, peak: Math.max(...beat), knocks, soft }; });
check('a hunter closing in is a heartbeat in the hands, a paused dive is still, and the slider scales it', s.rest < 0.02 && s.peak > 0.35 && s.knocks >= 3 && s.knocks <= 8 && s.soft < s.peak * 0.6 && s.soft > 0.1, JSON.stringify(s));
s = await ev(() => { const g = window.__game, h = g.hap, sw = g.world.schools.find((x) => x.tier === 's' && x.left > 0); window.T.put(sw.x + 2.6, sw.hy, sw.z + 0.9, 1.1); g.sim(0.8); h.log = []; window.rumbles.length = 0; window.B(6, 1); let t = 0; while (sw.left > 0 && t < 9) { g.sim(0.1); t += 0.1; } window.B(6, 0);
  const hum = h.log.map((r) => r[1]), clicks = hum.filter((v, i) => v > 0.33 && !(hum[i - 1] > 0.33)).length; h.log = null; g.sim(1); return { left: sw.left, hum: Math.max(...hum), clicks, sent: window.rumbles.length }; });
check('a loop closing hums and clicks its way round', s.left === 0 && s.hum > 0.15 && s.clicks >= 4 && s.sent > 5, JSON.stringify(s));
await page.keyboard.press('KeyP'); await page.waitForTimeout(150);
await page.click('#btn-rumble'); await page.waitForFunction(() => /played|answered/.test(document.getElementById('rumble-msg').textContent), null, { timeout: 20000 }).catch(() => {}); // timers run slowly in a window nobody is looking at
s = await ev(() => ({ msg: document.getElementById('rumble-msg').textContent, note: document.getElementById('pad-note').textContent, n: window.rumbles.filter((r) => r.duration === 350).length }));
check('the pause menu tests the vibration and says what the browser reports for the controller', /motors \(dual-rumble\)/.test(s.msg) && /played all three/.test(s.msg) && /can vibrate/.test(s.note) && s.n === 2, JSON.stringify(s));
await page.waitForTimeout(350); await page.keyboard.press('KeyP');
s = await ev(() => { const g = window.__game; window.tap(9); const p1 = g.paused; const f0 = document.activeElement?.id; window.tap(13); const f1 = document.activeElement?.id; window.tap(12); const f2 = document.activeElement?.id; window.tap(0); const p2 = g.paused;
  window.tap(8); const bare1 = g.ui.bare; window.tap(8); return { p1, f0, f1, f2, p2, bare1, bare2: g.ui.bare }; });
check('Options pauses, the D-pad walks the menu, Cross resumes, Create hides the help', s.p1 && s.f0 === 'btn-resume' && s.f1 === 'btn-full' && s.f2 === 'btn-resume' && !s.p2 && s.bare1 && !s.bare2, JSON.stringify(s));
// ---- the key-binding menu: change keys and buttons, save the set under a name, get it back
await page.keyboard.press('KeyP'); await page.waitForTimeout(150); await page.click('#btn-binds');
s = await ev(() => ({ shown: getComputedStyle(document.querySelector('#pause .binds')).display, main: getComputedStyle(document.querySelector('#pause .in')).display, slots: document.querySelectorAll('#bind-grid button').length, w: document.querySelector('#bind-grid button[data-a="up"][data-k="0"]').textContent, pad: document.querySelector('#bind-grid button[data-a="sprint"][data-p]').textContent }));
check('the pause menu opens a key-binding menu listing every action with its keys and its controller button', s.shown === 'flex' && s.main === 'none' && s.slots === 18 * 2 + 14 && s.w === 'W' && s.pad === 'R2', JSON.stringify(s));
await snap('c-binds');
await page.click('#bind-grid button[data-a="dive"][data-k="0"]'); await page.keyboard.press('KeyZ');
await page.click('#bind-grid button[data-a="rise"][data-k="0"]'); await page.keyboard.press('KeyX'); // X was the shed key
const stolen = await ev(() => document.getElementById('bind-msg').textContent);
await page.click('#bind-grid button[data-a="shed"][data-p]'); await ev(() => { const g = window.__game; window.B(3, 1); g.sim(0.05); window.B(3, 0); g.sim(0.05); }); // the controller's Triangle
await page.click('#bind-grid button[data-a="pause"][data-k="0"]'); await page.keyboard.press('Escape');
await page.click('#bind-grid button[data-a="view"][data-k="0"]'); await page.keyboard.press('Backspace');
s = await ev(() => { const b = window.__game.binds; return { dive: b.keys.dive.join(), rise: b.keys.rise.join(), shed: b.keys.shed.join(), padShed: b.pad.shed, pause: b.keys.pause.join(), view: b.keys.view.join(), paused: window.__game.paused, sel: document.getElementById('bind-preset').value }; });
check('a slot takes the next key or button, takes it from whatever had it, Esc leaves it and Backspace empties it', s.dive === 'KeyZ' && s.rise === 'KeyX' && s.shed === '' && /moved/.test(stolen) && s.padShed === 3 && s.pause === 'KeyP' && s.view === '' && s.paused && s.sel === '*', JSON.stringify({ ...s, stolen }));
await page.fill('#bind-name', 'lefty'); await page.click('#bind-save'); await page.click('#bind-reset');
const reset = await ev(() => ({ dive: window.__game.binds.keys.dive.join(), saved: Object.keys(JSON.parse(localStorage.getItem('oarfish.binds')).presets).join(), sel: document.getElementById('bind-preset').value }));
await page.selectOption('#bind-preset', 'lefty');
s = await ev(() => ({ dive: window.__game.binds.keys.dive.join(), padShed: window.__game.binds.pad.shed, sel: document.getElementById('bind-preset').value, now: JSON.parse(localStorage.getItem('oarfish.binds')).now.keys.dive.join() }));
check('a set can be saved under a name in this browser, the defaults restored, and the set picked again', reset.dive === 'KeyC' && reset.saved === 'lefty' && reset.sel === '' && s.dive === 'KeyZ' && s.padShed === 3 && s.sel === 'lefty' && s.now === 'KeyZ', JSON.stringify({ reset, s }));
await page.click('#bind-back'); await page.waitForTimeout(450); await page.keyboard.press('KeyP');
await ev(() => { const g = window.__game; g.run.segs = 14; g.buildFish(14); g.run.safe = 0; g.sim(0.3); });
await page.keyboard.down('KeyZ'); const fell = await ev(() => { const g = window.__game; const y = g.rig.pos.y; g.sim(1); return g.rig.pos.y - y; }); await page.keyboard.up('KeyZ');
await page.keyboard.down('KeyC'); const old = await ev(() => { const g = window.__game; g.sim(0.5); const y = g.rig.pos.y; g.sim(1); return g.rig.pos.y - y; }); await page.keyboard.up('KeyC');
s = await ev(() => { const g = window.__game; g.run.safe = 0; const before = g.run.segs; window.tap(2); const square = before - g.run.segs; window.tap(3); return { square, triangle: before - g.run.segs, legend: document.getElementById('keys').textContent }; });
check('the dive then answers to the new keys and buttons, and not the old ones', fell < -0.3 && old > -0.2 && s.square === 0 && s.triangle === 3 && /△/.test(s.legend), JSON.stringify({ fell, old, ...s }));
await page.keyboard.press('KeyP'); await page.waitForTimeout(150); await page.click('#btn-binds'); await page.click('#bind-delete'); await page.click('#bind-reset'); await page.click('#bind-back'); await page.waitForTimeout(450); await page.keyboard.press('KeyP');
check('a saved set can be deleted', (await ev(() => Object.keys(window.__game.bindStore.presets).length)) === 0 && (await ev(() => window.__game.binds.keys.dive.join())) === 'KeyC' && !(await ev(() => window.__game.paused)));

// unplugged: the keyboard legend returns on the next key
s = await ev(() => { const g = window.__game; Object.defineProperty(navigator, 'getGamepads', { value: () => [null, null, null, null], configurable: true }); g.sim(0.1); return document.getElementById('pad-note').textContent; });
await page.keyboard.press('KeyA');
check('unplugging is noticed and a key brings the keyboard legend back', /No controller/.test(s) && (await ev(() => window.__game.dev)) === 'keys' && /Shift/.test(await ev(() => document.getElementById('keys').textContent)), s);

// ---- the world's seed: the same seed is the same world, and it can be copied, pasted and kept
s = await ev(() => { const g = window.__game; const look = () => { const w = g.world; return [w.goal.x, w.goal.z, ...w.schools.flatMap((x) => [x.hx, x.hz]), g.foes.biters.length].map((v) => +v.toFixed(3)).join(); };
  const snapOf = (seed) => { g.startRun(seed); const a = look(); g.enterFloor(2, false); const b = look(); g.enterFloor(4, false); const c = [g.world.hall.x, g.world.hall.z].map((v) => +v.toFixed(3)).join(); return a + '|' + b + '|' + c; };
  const one = snapOf(4242), again = snapOf(4242), other = snapOf(4243);
  return { same: one === again, differs: one !== other, word: [g.readSeed('Ryugu').seed, g.readSeed(' ryugu ').seed, g.readSeed('Warsaw').seed], bare: g.readSeed('31337').seed, code: g.readSeed('try this: oarfish-world:1:777 !!').seed, old: g.readSeed('oarfish-world:9:5').old, none: g.readSeed('  ') }; });
check('the same seed builds the same world in every band, another seed a different one', s.same && s.differs, JSON.stringify(s));
check('a seed can be a code, a bare number or any word', s.code === 777 && s.bare === 31337 && s.word[0] === s.word[1] && s.word[0] !== s.word[2] && s.word[0] >= 0 && s.word[0] < 1e6 && s.old === true && s.none === null, JSON.stringify(s));
await ev(() => window.__game.startRun(4242));
await page.keyboard.press('KeyP'); await page.waitForTimeout(150);
await page.click('#seed-copy'); await page.waitForTimeout(200);
s = await ev(() => ({ now: document.getElementById('seed-now').textContent, msg: document.getElementById('seed-msg').textContent, box: document.getElementById('seed-in').value }));
check('the pause menu shows this dive\'s seed and copies it', /world 4242\./.test(s.now) && (/Copied: oarfish-world:1:4242/.test(s.msg) || s.box === 'oarfish-world:1:4242'), JSON.stringify(s));
await snap('c-seed');
await page.click('#seed-go'); // nothing pasted yet
s = await ev(() => ({ msg: document.getElementById('seed-msg').textContent, paused: window.__game.paused, seed: window.__game.run.seed }));
await page.fill('#seed-in', 'hey, try oarfish-world:1:777 :)'); await page.click('#seed-go'); await page.waitForTimeout(150);
const dived = await ev(() => { const g = window.__game; g.sim(0.2); return { seed: g.run.seed, paused: g.paused, state: g.run.state, floor: g.run.floor, segs: g.run.segs, hint: document.getElementById('hint').textContent }; });
check('pasting a seed and pressing Dive starts a new dive in that world', /Paste a seed first/.test(s.msg) && s.paused && s.seed === 4242 && dived.seed === 777 && !dived.paused && dived.state === 'play' && dived.floor === 0 && dived.segs === 10 && /World 777/.test(dived.hint), JSON.stringify({ s, dived }));
await page.keyboard.press('KeyP'); await page.waitForTimeout(150); await page.click('#seed-keep');
s = await ev(() => { const g = window.__game; const label = document.getElementById('seed-keep').textContent, saved = localStorage.getItem('oarfish.world'); g.setPaused(false); g.startRun(); const a = g.run.seed; g.startRun(); const b = g.run.seed;
  document.getElementById('seed-keep').click(); const seeds = new Set(); for (let i = 0; i < 4; i++) { g.startRun(); seeds.add(g.run.seed); } return { label, saved, a, b, after: seeds.size, now: document.getElementById('seed-now').textContent }; });
check('Keep this world makes every new dive the same world, until it is let go', /Keeping/.test(s.label) && /"keep":true/.test(s.saved) && s.a === 777 && s.b === 777 && s.after > 1 && /draws a new one/.test(s.now), JSON.stringify(s));
await page.keyboard.press('KeyV'); await ev(() => window.__game.sim(0.3));

// ---- how the adventure camera looks in each band, level and from below
if (shots) {
  await ev(() => window.__game.setMode('look'));
  for (const f of [0, 1, 2, 3, 4]) {
    await ev((f) => { const g = window.__game; g.run.segs = 12 + f * 2; g.buildFish(g.run.segs); g.enterFloor(f, false); g.sim(2.5); g.run.safe = 0; }, f);
    await snap(`c-look-band${f}`);
  }
  await ev(() => { const g = window.__game; g.enterFloor(0, false); g.sim(1.5); g.cam.ease = null; g.cam.pitch = -0.25; g.sim(0.6); }); await snap('c-look-low');
  await ev(() => { const g = window.__game; g.cam.pitch = 1.1; g.sim(0.6); }); await snap('c-look-high');
  await ev(() => { const g = window.__game; g.setMode('point'); g.sim(2); }); await snap('c-point-after');
}
await ev(() => { try { localStorage.clear(); } catch {} });
await browser.close(); server.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall control checks passed');
process.exit(failures ? 1 : 0);
