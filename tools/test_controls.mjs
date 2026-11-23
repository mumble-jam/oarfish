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
const page = await (await browser.newContext({ viewport: { width: 1440, height: 820 }, permissions: ['clipboard-read', 'clipboard-write'] })).newPage();
page.on('pageerror', (e) => { failures++; console.log('[pageerror]', e.message); });
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/fonts\.g|ERR_|Failed to load resource|GPU stall|GL Driver|AudioContext/.test(m.text())) console.log(`[${m.type()}]`, m.text().slice(0, 300)); });
await page.addInitScript(() => { window.__noNursery = true;
  // a stand-in for the browser's device access: one DualSense on a cable, on current firmware, that the player may pick
  window.hidSent = []; window.hidPick = true;
  const fw = new DataView(new ArrayBuffer(64)); fw.setUint8(0, 0x20); fw.setUint16(44, 0x0224, true);
  const sense = { vendorId: 0x054c, productId: 0x0ce6, opened: false, collections: [{ outputReports: [{ reportId: 2 }] }], async open() { sense.opened = true; }, async sendReport(id, data) { window.hidSent.push([id, Array.from(data)]); }, async receiveFeatureReport() { return fw; } };
  Object.defineProperty(Navigator.prototype, 'hid', { configurable: true, get: () => ({ getDevices: async () => [], requestDevice: async () => (window.hidPick ? [sense] : []), addEventListener() {} }) });
});
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
    start(lift, yaw = 0) { const s = g.world.spawn; this.put(s.x, g.world.height(s.x, s.z) + lift, s.z, yaw); }, // at the start, which is the middle of the band however wide the band is, `lift` over the bed
    away() { const c = g.camera.position, f = g.rig.pos; const dx = f.x - c.x, dz = f.z - c.z, d = Math.hypot(dx, dz); return { x: dx / d, z: dz / d }; }, // from the camera to the fish, flat
    moved(seconds) { const a = g.rig.pos.clone(); g.sim(seconds); const b = g.rig.pos; const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1; return { x: dx / d, z: dz / d, d, dy: b.y - a.y }; },
  };
});

// ---- the legend and the first state
let s = await ev(() => ({ mode: window.__game.feel.mode, legend: document.getElementById('keys').textContent, fov: window.__game.camera.fov }));
check('starts on point-and-swim with the keyboard legend', s.mode === 'point' && /steer/.test(s.legend) && /adventure camera/.test(s.legend) && s.fov === 30, JSON.stringify(s).slice(0, 200));
await ev(() => window.__game.sim(0.5)); await snap('c-point');

// ---- the mouse on the plate: the left button turns the view, the right one swims to the pointer, both swim where the view points
{ const G = (fn, a) => ev(fn, a), here = () => G(() => { const g = window.__game; g.cam.ease = null; return { yaw: g.cam.yaw, pitch: g.cam.pitch, x: g.rig.pos.x, y: g.rig.pos.y, z: g.rig.pos.z }; });
  const reset = () => G(() => { const g = window.__game; window.T.start(4, 0.62 + Math.PI); g.cam.ease = null; g.cam.yaw = 0.62; g.cam.pitch = 0.56; g.run.safe = 1e9; g.sim(0.3); }); // the fish facing away from the viewer, as the view has it
  const sim = (t) => G((t) => window.__game.sim(t), t), turn = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  // left: drag, and the view turns; the fish stays where it is
  await reset(); await page.mouse.move(700, 420); let a = await here(); await page.mouse.down({ button: 'left' }); await page.mouse.move(800, 470, { steps: 10 }); await sim(0.8); let b = await here();
  const left = { dyaw: +turn(b.yaw, a.yaw).toFixed(2), dpitch: +(b.pitch - a.pitch).toFixed(2), swum: +Math.hypot(b.x - a.x, b.z - a.z).toFixed(2) }; await page.mouse.up({ button: 'left' });
  // right: hold, and the fish swims to the pointer; the view does not turn
  await reset(); await page.mouse.move(1150, 300); a = await here(); await page.mouse.down({ button: 'right' }); await sim(0.2);
  const aim = await G(() => { const g = window.__game, i = g.readInput(); return i.aim ? { x: i.aim.x, z: i.aim.z } : null; }); await sim(1.0); await page.mouse.move(1180, 320, { steps: 4 }); b = await here();
  const right = { aim: !!aim, toward: aim ? +(((b.x - a.x) * (aim.x - a.x) + (b.z - a.z) * (aim.z - a.z)) / (Math.hypot(b.x - a.x, b.z - a.z) * Math.hypot(aim.x - a.x, aim.z - a.z) || 1)).toFixed(2) : 0, swum: +Math.hypot(b.x - a.x, b.z - a.z).toFixed(2), dyaw: +turn(b.yaw, a.yaw).toFixed(2) }; await page.mouse.up({ button: 'right' });
  // both: forward, where the view points; the mouse steers it, and tilting the view sends it down or up
  await reset(); await page.mouse.move(700, 420); a = await here(); await page.mouse.down({ button: 'left' }); await page.mouse.down({ button: 'right' }); await sim(1.0); b = await here();
  const fwd = (p, q, yaw) => +(((q.x - p.x) * -Math.sin(yaw) + (q.z - p.z) * -Math.cos(yaw)) / (Math.hypot(q.x - p.x, q.z - p.z) || 1)).toFixed(2);
  const both = { swum: +Math.hypot(b.x - a.x, b.z - a.z).toFixed(2), along: fwd(a, b, a.yaw), level: +(b.y - a.y).toFixed(2) };
  await page.mouse.move(820, 420, { steps: 10 }); await sim(1.2); let c = await here(); await sim(0.8); let d = await here(); both.dyaw = +turn(c.yaw, a.yaw).toFixed(2); both.steered = fwd(c, d, c.yaw);
  await page.mouse.move(820, 560, { steps: 10 }); c = await here(); await sim(1.2); d = await here(); both.down = { pitch: +c.pitch.toFixed(2), dy: +(d.y - c.y).toFixed(2) };
  await page.mouse.move(820, 300, { steps: 10 }); await sim(0.4); c = await here(); await sim(1.2); d = await here(); both.up = { pitch: +c.pitch.toFixed(2), dy: +(d.y - c.y).toFixed(2) };
  // one of the two let go: it stops going forward, and the view still turns
  await G(() => { window.__game.cam.pitch = 0.56; }); await page.mouse.up({ button: 'right' }); await sim(1.5); c = await here(); await page.mouse.move(760, 300, { steps: 6 }); await sim(0.6); d = await here();
  both.after = { swum: +Math.hypot(d.x - c.x, d.z - c.z).toFixed(2), dyaw: +turn(d.yaw, c.yaw).toFixed(2) }; await page.mouse.up({ button: 'left' });
  const note = await G(() => document.getElementById('keys').textContent);
  await G(() => { const g = window.__game; g.cam.yaw = 0.62; g.cam.pitch = 0.56; g.run.safe = 0; });
  check('on the plate the left mouse button turns the view and moves nothing; the right one swims the fish to the pointer and leaves the view alone', Math.abs(left.dyaw + 0.6) < 0.08 && left.dpitch > 0.2 && left.swum < 0.6 && right.aim && right.toward > 0.7 && right.swum > 1.2 && right.dyaw === 0, JSON.stringify({ left, right }));
  check('both buttons swim it where the view points, level while the view is at rest; the mouse steers it, a view tilted down dives and one tilted up rises; letting one go stops it, and the legend says so',
    both.swum > 1.8 && both.along > 0.95 && Math.abs(both.level) < 0.15 && Math.abs(both.dyaw + 0.72) < 0.1 && both.steered > 0.9 && both.down.pitch > 1.1 && both.down.dy < -0.4 && both.up.pitch < 0.3 && both.up.dy > 0.3 && both.after.swum < 0.7 && Math.abs(both.after.dyaw) > 0.2 && /both buttons/.test(note) && /left button/.test(note), JSON.stringify(both)); }

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
// the adventure camera also aims the fish up and down: W goes where the view points
await page.keyboard.down('KeyW');
s = await ev(() => { const g = window.__game, T = window.T; const go = (pitch) => { T.start(4); g.cam.ease = null; g.cam.pitch = pitch; g.sim(0.2); const y0 = g.rig.pos.y; g.sim(1.2); return g.rig.pos.y - y0; };
  const level = go(0.34), nearly = go(0.42), up = go(-0.2), down = go(0.95); g.cam.pitch = 0.34; return { level, nearly, up, down }; });
await page.keyboard.up('KeyW');
await page.keyboard.down('KeyS');
s.back = await ev(() => { const g = window.__game; window.T.start(4); g.cam.ease = null; g.cam.pitch = 0.95; g.sim(0.2); const y0 = g.rig.pos.y; g.sim(1.2); g.cam.pitch = 0.34; return g.rig.pos.y - y0; });
await page.keyboard.up('KeyS');
check('in the adventure camera W swims where the view points: up when it looks up, down when it looks down, level in between, and S the other way', Math.abs(s.level) < 0.1 && Math.abs(s.nearly) < 0.1 && s.up > 0.4 && s.down < -0.4 && s.back > 0.4, JSON.stringify(s));

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
await page.keyboard.down('KeyW');
s = await ev(() => { const g = window.__game, was = g.cam.pitch, ease = g.cam.ease; window.T.start(4); g.cam.ease = null; g.cam.pitch = 1.2; g.sim(0.2); const y0 = g.rig.pos.y; g.sim(1.2); g.cam.pitch = was; g.cam.ease = ease; return g.rig.pos.y - y0; });
await page.keyboard.up('KeyW');
check('...where the view looks down from above and W stays level', Math.abs(s) < 0.1, String(s));
await page.click('#btn-pause'); await page.waitForTimeout(450);
s = await ev(() => window.__game.paused);
await page.keyboard.press('Escape');
check('the corner button pauses and Esc resumes', s === true && (await ev(() => window.__game.paused)) === false);

// ---- a dive opens on the plain view; H adds the key list and the tools, and takes them away again
const view = () => ev(() => { const st = (q) => getComputedStyle(document.querySelector(q)).display;
  return { full: document.getElementById('stage').classList.contains('full'), keys: st('#keys'), tools: st('.tools'), tuning: st('#music-tab'), fs: st('#btn-fs'), pause: st('#btn-pause'), scale: st('#scale'), prompt: st('#prompt'), saved: localStorage.getItem('oarfish.ui') }; });
s = await view();
check('a dive opens on the plain view: no key list or tools, but a pause button, the scale bar and the key prompts', !s.full && s.keys === 'none' && s.tools === 'none' && s.tuning === 'none' && s.fs === 'none' && s.pause !== 'none' && s.scale !== 'none' && s.prompt !== 'none', JSON.stringify(s));
await ev(() => window.__game.sim(0.3)); await snap('c-plain');
await page.keyboard.press('KeyP'); await page.waitForTimeout(100);
s = await view();
check('...and the other corner buttons come back while paused', s.tuning !== 'none' && s.fs !== 'none', JSON.stringify(s));
await page.waitForTimeout(450); await page.keyboard.press('KeyP');
await page.keyboard.press('KeyH');
s = await view();
check('H shows the key list, the tuning drawer and the model tools, and the choice is kept', s.full && s.keys === 'flex' && s.tools === 'flex' && s.tuning !== 'none' && s.fs !== 'none' && /"full":true/.test(s.saved), JSON.stringify(s));
await ev(() => window.__game.sim(0.3)); await snap('c-full');
await page.keyboard.press('KeyH'); await ev(() => window.__game.sim(0.3));
s = { ...(await view()), hint: await ev(() => document.getElementById('hint').textContent) };
check('H again hides them and says how to get them back', !s.full && s.keys === 'none' && /"full":false/.test(s.saved) && /brings them back/.test(s.hint), JSON.stringify(s));
await page.keyboard.press('KeyH'); // the checks below use the corner buttons of the full view

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
s = await ev(() => { const g = window.__game, pad = window.fakePad; g.cam.ease = null; g.cam.pitch = 0.98; // a known tilt: what the mouse checks above leave behind depends on what the browser reports for the first move after it hands the mouse back
  const y0 = g.cam.yaw, p0 = g.cam.pitch; pad.axes[2] = 1; g.sim(0.5); pad.axes[2] = 0; const dyaw = g.cam.yaw - y0; pad.axes[3] = -1; g.sim(0.4); pad.axes[3] = 0; const dpitch = g.cam.pitch - p0;
  const z0 = g.cam.zoom; window.B(12, 1); g.sim(0.5); window.B(12, 0); const zoom = g.cam.zoom / z0;
  g.cam.yaw += 2; window.tap(11); g.sim(1.5); const off = Math.atan2(Math.sin(g.cam.yaw - g.rig.yaw - Math.PI), Math.cos(g.cam.yaw - g.rig.yaw - Math.PI));
  return { dyaw, dpitch, zoom, off, p0, mode: g.feel.mode }; });
check('the right stick turns the view, the D-pad zooms, R3 brings the view behind', Math.abs(s.dyaw + 1.3) < 0.15 && s.dpitch < -0.15 && s.zoom < 0.7 && Math.abs(s.off) < 0.15, JSON.stringify(s));
s = await ev(() => { const g = window.__game; window.T.start(3); g.sim(0.3); const y0 = g.rig.pos.y; window.B(5, 1); g.sim(1); window.B(5, 0); const up = g.rig.pos.y - y0; const y1 = g.rig.pos.y; window.B(4, 1); g.sim(1); window.B(4, 0); return { up, down: g.rig.pos.y - y1 }; });
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
// a DualSense's motors, which no browser drives on Windows: the page asks for the controller and sends it Sony's own command
s = await ev(async () => { const P = await import('/game/pad.js'), enc = new TextEncoder();
  const usb = P.senseReport(0.8, 0.2), old = P.senseReport(1, 1, false, 0, 'old'), neu = P.senseReport(1, 1, false, 0, 'new'), bt = P.senseReport(0.8, 0.2, true, 5), sum = P.crc32([0xa2, 0x31, ...bt.data.subarray(0, 73)]);
  return { crc: P.crc32(enc.encode('123456789')).toString(16), usb: [usb.id, usb.data.length, usb.data[0], usb.data[2], usb.data[3], usb.data[38]], old: [old.data[0], old.data[38]], neu: [neu.data[0], neu.data[38]],
    bt: [bt.id, bt.data.length, bt.data[0], bt.data[1], bt.data[2], bt.data[4], bt.data[5], bt.data[40]], sealed: [sum & 255, (sum >>> 8) & 255, (sum >>> 16) & 255, sum >>> 24].join() === Array.from(bt.data.subarray(73)).join() }; });
check('the DualSense command is laid out as Sony has it: flags, light motor, heavy motor, and over Bluetooth a counter in front and a checksum behind',
  s.crc === 'cbf43926' && s.usb.join() === '2,47,3,51,204,4' && s.old.join() === '3,0' && s.neu.join() === '2,4' && s.bt.join() === '49,77,80,16,3,51,204,4' && s.sealed, JSON.stringify(s));
s = await ev(async () => { window.hidPick = false; const b = document.getElementById('btn-direct'), shown = !b.hidden; b.click(); await new Promise((r) => setTimeout(r, 120)); const none = document.getElementById('rumble-msg').textContent;
  window.hidPick = true; window.hidSent.length = 0; b.click(); await new Promise((r) => setTimeout(r, 700)); const g = window.__game;
  return { shown, none, msg: document.getElementById('rumble-msg').textContent, label: b.textContent, first: window.hidSent[0], last: window.hidSent[window.hidSent.length - 1], n: window.hidSent.length, motors: g.pad.motors, report: g.pad.report().join('; ') }; });
check('“Connect DualSense motors” asks the browser for the controller, buzzes it once, stops the motors, and says so',
  s.shown && /No controller was picked/.test(s.none) && /Connected \(cable, current firmware\)/.test(s.msg) && /connected/.test(s.label) && s.n >= 2 && s.first[0] === 2 && s.first[1][0] === 2 && s.first[1][38] === 4 && s.first[1][2] > 100 && s.first[1][3] > 100 && s.last[1][2] === 0 && s.last[1][3] === 0 && s.motors && /spoken to directly/.test(s.report), JSON.stringify({ ...s, first: s.first && s.first[1].slice(0, 5), last: s.last && s.last[1].slice(0, 5) }));
s = await ev(async () => { const g = window.__game; window.hidSent.length = 0; g.pad.rumble(0.5, 0.25, 60); g.pad.rumble(0.9, 0.1, 60); await new Promise((r) => setTimeout(r, 400)); return window.hidSent.map((r) => [r[1][3], r[1][2]]); });
check('once connected, every vibration the game plays goes down the direct line too, and each one ends', s.length >= 2 && s.some((r) => r[0] === 230 && r[1] === 26) && s[s.length - 1].join() === '0,0', JSON.stringify(s));
await page.waitForTimeout(350); await page.keyboard.press('KeyP');
s = await ev(() => { const g = window.__game; window.tap(9); const p1 = g.paused; const f0 = document.activeElement?.id; window.tap(13); const f1 = document.activeElement?.id; window.tap(12); const f2 = document.activeElement?.id; window.tap(0); const p2 = g.paused;
  window.tap(8); const full1 = g.ui.full; window.tap(8); return { p1, f0, f1, f2, p2, full1, full2: g.ui.full }; });
check('Options pauses, the D-pad walks the menu, Cross resumes, Create hides and shows the keys and tools', s.p1 && s.f0 === 'btn-resume' && s.f1 === 'btn-full' && s.f2 === 'btn-resume' && !s.p2 && !s.full1 && s.full2, JSON.stringify(s));
// ---- the key-binding menu: change keys and buttons, save the set under a name, get it back
await page.keyboard.press('KeyP'); await page.waitForTimeout(150); await page.click('#btn-binds');
s = await ev(() => ({ shown: getComputedStyle(document.querySelector('#pause .binds')).display, main: getComputedStyle(document.querySelector('#pause .in')).display, slots: document.querySelectorAll('#bind-grid button').length, w: document.querySelector('#bind-grid button[data-a="up"][data-k="0"]').textContent, pad: document.querySelector('#bind-grid button[data-a="sprint"][data-p]').textContent }));
check('the pause menu opens a key-binding menu listing every action with its keys and its controller button', s.shown === 'flex' && s.main === 'none' && s.slots === 20 * 2 + 16 && s.w === 'W' && s.pad === 'R2', JSON.stringify(s));
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

// ---- a dive is built from one number that players never see: the checks rely on the same number giving the same world
s = await ev(() => { const g = window.__game; const look = () => { const w = g.world; return [w.goal.x, w.goal.z, ...w.schools.flatMap((x) => [x.hx, x.hz]), g.foes.biters.length].map((v) => +v.toFixed(3)).join(); };
  const snapOf = (seed) => { g.startRun(seed); const a = look(); g.enterFloor(2, false); const b = look(); g.enterFloor(4, false); const c = [g.world.hall.x, g.world.hall.z].map((v) => +v.toFixed(3)).join(); return a + '|' + b + '|' + c; };
  const one = snapOf(4242), again = snapOf(4242), other = snapOf(4243); g.startRun(4242);
  const seeds = new Set(); for (let i = 0; i < 4; i++) { g.startRun(); seeds.add(g.run.seed); } g.startRun(4242);
  return { same: one === again, differs: one !== other, fresh: seeds.size, menu: !!document.getElementById('seed-copy') || /seed/i.test(document.getElementById('pause').textContent), stored: localStorage.getItem('oarfish.world') }; });
check('the same number builds the same world in every band, each new dive draws a new one, and nothing about seeds is shown or kept', s.same && s.differs && s.fresh > 1 && !s.menu && s.stored === null, JSON.stringify(s));
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
// ---- testing tools: in the pause menu, in either view
await ev(() => { const g = window.__game; g.startRun(4242); g.sim(1); g.setFull(false, true); g.setPaused(true); }); await frame();
const devPlain = await ev(() => document.querySelector('#pause .dev').getClientRects().length > 0);
await ev(() => { window.__game.setFull(true, true); }); await frame();
s = await ev(() => ({ shown: document.querySelector('#pause .dev').getClientRects().length > 0, bands: document.querySelectorAll('#dev-bands button').length, here: document.querySelector('#dev-bands [aria-pressed="true"]')?.textContent, segs: window.__game.run.segs }));
await page.click('#dev-grow'); await page.click('#dev-bands button:nth-child(3)'); await frame();
const went = await ev(() => { const g = window.__game; return { floor: g.run.floor, paused: g.paused, state: g.run.state, segs: g.run.segs, keeper: g.guard?.kind }; });
await ev(() => { window.__game.setPaused(true); }); await page.click('#dev-keeper'); await frame();
const beat = await ev(() => { const g = window.__game, out = { done: g.guard.done, here: document.querySelector('#dev-bands [aria-pressed="true"]')?.textContent, off: document.getElementById('dev-keeper').disabled }; g.setFull(false, true); g.setPaused(false); return out; });
check('the testing tools are in the pause menu, in the plain view too: any band, a longer body, the keeper beaten', devPlain && s.shown && s.bands === 5 && s.here === '1' && went.floor === 2 && !went.paused && went.state === 'play' && went.segs === s.segs + 4 && went.keeper === 'lamplighter' && beat.done && beat.here === '3', JSON.stringify({ devPlain, ...s, went, beat }));
// ---- feedback: a sheet in the pause menu and at the end of a dive; the note is copied, never sent
await ev(() => { const g = window.__game; g.startRun(4242); g.sim(3); g.setPaused(true); });
await page.click('#btn-note'); await frame(page);
s = await ev(() => { const p = document.getElementById('pause'), vis = (id) => document.getElementById(id).getClientRects().length > 0; // drawn at all, whatever hides it
  return { noting: p.classList.contains('noting'), sheet: vis('note-text'), menu: vis('btn-resume'), facts: document.getElementById('note-facts-text').textContent, focus: document.activeElement.id }; });
check('Leave feedback, in the pause menu, opens a sheet in its place that says what will go with the note', s.noting && s.sheet && !s.menu && /Band 1 of 5/.test(s.facts) && /plain view|keys and tools/.test(s.facts) && s.focus === 'note-text', JSON.stringify(s));
await page.click('#note-copy');
const empty = await ev(() => document.getElementById('note-msg').textContent);
await page.click('#note-text'); await page.keyboard.type('the crab is great, hp wasd'); await ev(() => window.__game.sim(0.2));
s = await ev(() => ({ paused: window.__game.paused, state: window.__game.run.state, full: window.__game.ui.full, text: document.getElementById('note-text').value }));
check('typing in it is not for the game: nothing unpauses, hides or moves', /Write a line first/.test(empty) && s.paused && s.text === 'the crab is great, hp wasd', JSON.stringify({ empty, ...s }));
await page.click('#note-copy'); await page.waitForFunction(() => document.getElementById('note-msg').textContent !== '');
s = await ev(async () => { const g = window.__game, out = document.getElementById('note-out'); let clip = null; try { clip = await navigator.clipboard.readText(); } catch {}
  return { msg: document.getElementById('note-msg').textContent, clip, byHand: out.hidden ? null : out.value, body: g.noteBody() }; });
const got = s.clip ?? s.byHand ?? '';
const same = (t) => t.replace(/\d+ frames a second/, 'N frames a second').replace(/This dive [^\n]*\n/, 'This dive\n'); // the clock runs on between the copying and the asking: what it counts is not what is being checked
check('Copy puts the note and how the dive went on the clipboard, or lays it out to be copied by hand where that is blocked', (/Copied/.test(s.msg) || /selected: copy it/.test(s.msg)) && same(got) === same(s.body) && /the crab is great/.test(got) && /How the dive went\nBand 1 of 5/.test(got) && /frames a second|Chrome on/.test(got), JSON.stringify({ msg: s.msg, got: got.slice(0, 260) }));
await page.click('#note-facts'); s = await ev(() => window.__game.noteBody());
check('the lines about the dive can be left out', !/How the dive went/.test(s) && /the crab is great/.test(s), s.slice(0, 120));
await page.keyboard.press('Escape'); await frame(page);
s = await ev(() => ({ noting: document.getElementById('pause').classList.contains('noting'), paused: window.__game.paused }));
check('Esc closes the sheet and leaves the dive paused', !s.noting && s.paused, JSON.stringify(s));
await ev(() => { const g = window.__game; g.setPaused(false); g.die(); g.sim(0.5); }); await frame(page);
await page.click('#btn-note-end'); await frame(page);
s = await ev(() => { const p = document.getElementById('pause'); return { noting: p.classList.contains('noting'), over: +getComputedStyle(p).zIndex > +getComputedStyle(document.getElementById('end')).zIndex, kept: document.getElementById('note-text').value, facts: document.getElementById('note-facts-text').textContent }; });
await page.click('#note-back'); await frame(page);
const after = await ev(() => ({ on: document.getElementById('pause').classList.contains('on'), end: document.getElementById('end').classList.contains('on'), state: window.__game.run.state }));
check('the same sheet opens over the end of a dive, with what was written still in it, and Back returns to the end', s.noting && s.over && /the crab is great/.test(s.kept) && /died there/.test(s.facts) && !after.on && after.end && after.state === 'dead', JSON.stringify({ ...s, after }));
await ev(() => { try { localStorage.clear(); } catch {} });
await browser.close(); server.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall control checks passed');
process.exit(failures ? 1 : 0);
