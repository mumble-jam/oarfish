// Scripted checks of the front page (game/title.js). Every other suite opens the page under automation and gets a dive at once;
// these force the front page on (?title=1) and check what it promises: nothing of the dive runs or is drawn behind it; nothing
// plays before the first touch and the music after it, looping between its points, following the sound switch and the volume,
// and silent in the dive; every item can be reached and chosen by keyboard, mouse, touch and controller, and its screen closes
// back to the page; Dive starts a dive; the pause menu and the end card lead back; a link that names a place goes straight in;
// and under automation, by default, there is no front page at all.
//   node tools/test_title.mjs
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
const ROOT = path.resolve(import.meta.dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  const CDN = '/npm/three@0.170.0/';
  const p = u.startsWith(CDN) ? path.resolve(ROOT, 'node_modules/three', u.slice(CDN.length)) : path.join(ROOT, u);
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  if (u === '/index.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(fs.readFileSync(p, 'utf8').replaceAll('https://cdn.jsdelivr.net', '')); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/`;
// no autoplay flag here: the browser's own rule, that sound waits for a gesture, is part of what is checked
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
let failures = 0;
const check = (name, ok, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function open(query = '?title=1', { size = [1440, 820], touch = false, notDriven = false, point = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] }, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { failures++; console.log('[pageerror]', e.message); });
  page.on('console', (m) => { if (['error'].includes(m.type()) && !/fonts\.g|ERR_|Failed to load resource|GPU stall|GL Driver|AudioContext/.test(m.text())) console.log(`[${m.type()}]`, m.text().slice(0, 300)); });
  await page.addInitScript(() => { window.__noNursery = true; });
  if (point) await page.addInitScript(() => { try { const f = JSON.parse(localStorage.getItem('oarfish.feel') || '{}'); if (!f.mode) localStorage.setItem('oarfish.feel', JSON.stringify({ ...f, mode: 'point' })); } catch {} });
  if (notDriven) await page.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { configurable: true, get: () => false }); }); // as a player's browser would say
  // a stand-in controller the checks press (the browser has none here)
  await page.addInitScript(() => {
    const pad = { id: 'stand-in pad', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
    window.__pad = { pad, on: false, press(i, v = true) { pad.buttons[i] = { pressed: v, touched: v, value: v ? 1 : 0 }; pad.timestamp++; } };
    const real = navigator.getGamepads?.bind(navigator);
    navigator.getGamepads = () => (window.__pad.on ? [pad, null, null, null] : real ? real() : []);
  });
  await page.goto(url + query, { waitUntil: 'domcontentloaded' });
  return { page, ctx, ev: (fn, arg) => page.evaluate(fn, arg) };
}
const padTap = async (ev, i) => { await ev((i) => { window.__pad.on = true; window.__pad.press(i, true); }, i); await sleep(160); await ev((i) => window.__pad.press(i, false), i); await sleep(160); };

// ---- 1. under automation, by default: no front page, the dive at once
{ const { page, ctx, ev } = await open('');
  await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  const s = await ev(() => ({ front: !!document.getElementById('front'), flag: window.__front, cls: document.documentElement.className, t0: window.__game.run.time }));
  await sleep(1200);
  const t1 = await ev(() => window.__game.run.time);
  check('under automation, with nothing asked, there is no front page and the dive runs at once', !s.front && s.flag === undefined && !/front/.test(s.cls) && t1 > s.t0, JSON.stringify({ ...s, t1 }));
  await ctx.close(); }

// ---- 2. forced on: the page, and nothing of the dive behind it
const { page, ctx, ev } = await open('?title=1');
await page.waitForFunction('window.__front?.ready === true', null, { timeout: 120000 });
await page.waitForFunction('window.__ready === true', null, { timeout: 180000 });
await sleep(400);
{ const a = await ev(() => ({ shown: !document.getElementById('front').hidden, state: window.__front.state, holds: window.__front.holds, time: window.__game.run.time, frame: window.__game.renderer.info.render.frame, calls: window.__game.renderer.info.render.calls, played: window.__game.session.played }));
  await sleep(1500);
  const b = await ev(() => ({ time: window.__game.run.time, frame: window.__game.renderer.info.render.frame, played: window.__game.session.played, mine: window.__front.frames }));
  check('forced on, the front page shows, silent, and holds the dive', a.shown && a.state === 'silent' && a.holds, JSON.stringify(a));
  check('nothing of the dive is stepped or drawn behind it (its clock and its renderer stand still while the page draws)', b.time === a.time && b.frame === a.frame && b.played === a.played && b.mine > 0, JSON.stringify({ a, b })); }
{ const s = await ev(() => ({ ctx: window.__front.music.ctx, band: window.__game.music.running, invite: getComputedStyle(document.querySelector('#front .invite')).opacity, menu: getComputedStyle(document.querySelector('#front .menu')).visibility }));
  check('nothing plays before the first touch: no sound is even set up, the band has not started, the menu waits and the invitation shows', s.ctx === null && !s.band && s.menu === 'hidden' && +s.invite > 0.5, JSON.stringify(s)); }
// the page goes quiet when left alone, as the game does
{ await ev(() => { window.__front.FRONT.idle = 0.5; }); await sleep(1200); const f0 = await ev(() => window.__front.frames); await sleep(1500); const f1 = await ev(() => window.__front.frames);
  check('left alone, the page stops drawing', f1 === f0, `${f0} → ${f1}`); await ev(() => { window.__front.FRONT.idle = 90; }); }

// ---- 3. the first touch: a key. The menu inks itself in and the music comes in, looping between its points
await page.keyboard.press('KeyQ');
await sleep(2600);
{ const m = await ev(() => { const M = window.__front.music; return { state: M.ctx?.state, playing: M.playing, loop: M.src?.loop, ls: M.src?.loopStart, le: M.src?.loopEnd, start: M.loopStart, end: M.loopEnd, period: window.__front.FRONT.music.long.period, gain: M.master?.gain.value, fade: M.fade?.gain.value, err: M.error, which: M.which, dur: M.buffer?.duration, band: window.__game.music.running, cur: window.__front.cur, awake: document.getElementById('front').classList.contains('awake') }; });
  check('the first touch inks the menu in, with Dive chosen, and leaves the dive alone', m.awake && m.cur === 'dive' && !m.band, JSON.stringify({ awake: m.awake, cur: m.cur, band: m.band }));
  check('after it the music plays, from a sound decoded once and looped between its exact points', m.state === 'running' && m.playing && m.loop && Math.abs((m.le - m.ls) - m.period / 44100) < 1e-6 && m.ls === m.start && m.le <= m.dur + 1e-6 && m.gain > 0.1 && m.fade > 0.5 && !m.err, JSON.stringify(m));
  const pos = await ev(() => { const M = window.__front.music; M.startedAt -= 200; return M.position(); }); // two hundred seconds on, it is still inside its loop
  check('its place in the sound stays between the loop points however long it plays', pos >= m.ls && pos < m.le, String(pos)); }

// ---- 4. every item by keyboard: each opens its screen over the page, and closing it comes back to the page
const items = await ev(() => window.__front.menu.map((b) => b.dataset.go));
{ const seen = []; for (let i = 0; i < items.length; i++) { seen.push(await ev(() => window.__front.cur)); await page.keyboard.press('ArrowRight'); }
  const wrap = await ev(() => window.__front.cur);
  check('the arrow keys reach every item, in order, and come round', seen.join() === items.join() && wrap === items[0], seen.join() + ' / ' + wrap); }
const screenOf = () => ev(() => { const st = document.getElementById('stage'), p = document.getElementById('pause'); return { lib: st.classList.contains('lib'), pause: p.classList.contains('on'), noting: p.classList.contains('noting'), drawer: document.getElementById('drawer').classList.contains('open'), over: window.__front.over, holds: window.__front.holds, time: window.__game.run.time, frame: window.__game.renderer.info.render.frame, z: getComputedStyle(p).zIndex, resume: document.getElementById('btn-resume').textContent }; });
const want = { library: (s) => s.lib, band: (s) => s.pause && s.drawer, settings: (s) => s.pause && !s.noting && !s.drawer, feedback: (s) => s.noting };
for (const go of ['library', 'band', 'settings', 'feedback']) {
  for (let n = 0; n < 6 && (await ev(() => window.__front.cur)) !== go; n++) await page.keyboard.press('ArrowRight');
  const before = await screenOf();
  await page.keyboard.press('Enter'); await sleep(700);
  const s = await screenOf();
  await page.keyboard.press('Escape'); await sleep(500);
  if (go === 'library') await sleep(300);
  const back = await screenOf();
  const after = await ev(() => ({ cur: window.__front.cur, state: window.__front.state, cls: document.documentElement.classList.contains('front-over') }));
  check(`by keyboard, "${go}" opens its own screen over the page, the dive held under it, and Esc comes back to the page`, want[go](s) && s.over === go && s.holds && s.time === before.time && !back.lib && !back.pause && !back.over && after.cur === go && after.state === 'menu' && !after.cls && back.time === before.time, JSON.stringify({ s, back, after }));
}
{ const s = await ev(() => ({ band: window.__game.music.running, playing: window.__front.music.playing })); check('none of it started the band behind the page, and the page\'s music plays on', !s.band && s.playing, JSON.stringify(s)); }

// ---- 5. the sound switch and the volume, set in the band's own drawer over the page
for (let n = 0; n < 6 && (await ev(() => window.__front.cur)) !== 'band'; n++) await page.keyboard.press('ArrowRight');
await page.keyboard.press('Enter'); await sleep(600);
{ await ev(() => { const v = document.getElementById('m-volume'); v.value = '20'; v.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(700);
  const quiet = await ev(() => window.__front.music.master.gain.value);
  await page.click('#music-mute'); await sleep(700);
  const off = await ev(() => ({ g: window.__front.music.master.gain.value, muted: window.__game.music.muted }));
  await page.click('#music-mute'); await sleep(200);
  await ev(() => { const v = document.getElementById('m-volume'); v.value = '70'; v.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(700);
  const on = await ev(() => window.__front.music.master.gain.value);
  check('the music follows the game\'s volume and its sound switch', Math.abs(quiet - 0.2 * 0.75 * 0.6) < 0.03 && off.muted && off.g < 0.01 && on > quiet, JSON.stringify({ quiet, off, on })); }
await page.keyboard.press('Escape'); await sleep(500);

// ---- 6. a controller: it moves through the items and chooses, and the game's own menu answers it over the page
await ev(() => { window.__pad.on = true; }); await sleep(200);
{ const start = await ev(() => window.__front.cur);
  await padTap(ev, 13); const one = await ev(() => window.__front.cur);
  await padTap(ev, 15); const two = await ev(() => window.__front.cur);
  await padTap(ev, 12); await padTap(ev, 12); const back = await ev(() => window.__front.cur);
  const i0 = items.indexOf(start);
  check('a controller\'s D-pad moves through the items', one === items[(i0 + 1) % 5] && two === items[(i0 + 2) % 5] && back === start, [start, one, two, back].join(' → ')); }
for (let i = 0; i < items.length; i++) { const c = await ev(() => window.__front.cur); if (c === 'settings') break; await padTap(ev, 13); }
await padTap(ev, 0); await sleep(500);
{ const s = await screenOf();
  await padTap(ev, 1); await sleep(600); // Circle: the game's menu goes back
  const b = await screenOf();
  check('Cross chooses "settings" and the pause menu opens over the page; Circle, read by the game, closes it and the page has the pad again', s.pause && s.over === 'settings' && !b.pause && !b.over && b.frame === s.frame, JSON.stringify({ s, b })); }
{ for (let i = 0; i < items.length; i++) { const c = await ev(() => window.__front.cur); if (c === 'library') break; await padTap(ev, 13); }
  await padTap(ev, 0); await sleep(900); const s = await screenOf();
  await padTap(ev, 1); await sleep(800); const b = await screenOf();
  check('Cross chooses the specimen library; Circle leaves it and comes back to the page', s.lib && !b.lib && !b.pause && !b.over, JSON.stringify({ s: s.lib, b })); }
await ev(() => { window.__pad.on = false; });

// ---- 7. by mouse: Dive starts a dive, the page's music goes, the band comes in
{ const before = await ev(() => window.__game.run.time);
  await page.mouse.move(10, 10);
  await page.click('#front .menu button.dive');
  await page.waitForFunction('window.__front.state === "gone"', null, { timeout: 15000 }).catch(() => {});
  await sleep(1500);
  const s = await ev(() => ({ state: window.__front.state, hidden: document.getElementById('front').hidden, holds: window.__front.holds, time: window.__game.run.time, play: window.__game.run.state, paused: window.__game.paused, front: window.__front.music.playing, fctx: window.__front.music.ctx.state, band: window.__game.music.running, cls: document.documentElement.className }));
  check('clicking Dive starts a dive: the page is gone, the dive runs', s.state === 'gone' && s.hidden && !s.holds && s.time > before && s.play === 'play' && !s.paused && !/front-over/.test(s.cls), JSON.stringify(s));
  check('in the dive the page\'s music is silent and its sound put away, and the band plays', !s.front && s.fctx !== 'running' && s.band, JSON.stringify(s)); }

// ---- 8. back to the page from the end card, and from the pause menu; Dive again is as quick as before
{ await ev(() => window.__game.die()); await sleep(1300);
  const end = await ev(() => ({ on: document.getElementById('end').classList.contains('on'), focus: document.activeElement?.id, has: !!document.getElementById('btn-front-end') }));
  await page.click('#btn-front-end'); await sleep(1600);
  const s = await ev(() => ({ state: window.__front.state, shown: !document.getElementById('front').hidden, holds: window.__front.holds, run: window.__game.run.state, end: document.getElementById('end').classList.contains('on'), playing: window.__front.music.playing, t: window.__game.run.time, f: window.__game.renderer.info.render.frame }));
  await sleep(1000);
  const s2 = await ev(() => ({ t: window.__game.run.time, f: window.__game.renderer.info.render.frame, band: window.__game.music.state.duck }));
  check('the end card keeps "Dive again" on the keyboard, and has a way back to the front page', end.on && end.focus === 'btn-again' && end.has, JSON.stringify(end));
  check('back from the end card: the page is up with its music, a fresh dive waits behind it, held and not drawn', s.state === 'menu' && s.shown && s.holds && s.run === 'play' && !s.end && s.playing && s2.t === s.t && s2.f === s.f && s2.band === 0, JSON.stringify({ s, s2 })); }
{ await page.keyboard.press('Enter'); await page.waitForFunction('window.__front.state === "gone"', null, { timeout: 15000 }).catch(() => {});
  await sleep(600); await ev(() => window.__game.setPaused(true)); await sleep(300);
  await page.click('#btn-front'); const armed = await ev(() => ({ text: document.getElementById('btn-front').textContent, front: window.__front.state }));
  await page.click('#btn-front'); await sleep(1500);
  const s = await ev(() => ({ state: window.__front.state, holds: window.__front.holds, paused: window.__game.paused, pause: document.getElementById('pause').classList.contains('on') }));
  check('from the pause menu, "Front page" asks once more (it leaves the dive) and then goes back to the page', /Again/.test(armed.text) && armed.front === 'gone' && s.state === 'menu' && s.holds && !s.paused && !s.pause, JSON.stringify({ armed, s })); }
{ await page.keyboard.press('Space'); await page.waitForFunction('window.__front.state === "gone"', null, { timeout: 15000 }).catch(() => {});
  await sleep(500); await ev(() => window.__game.die()); await sleep(1200);
  const t0 = Date.now(); await page.keyboard.press('Enter'); await sleep(300);
  const s = await ev(() => ({ run: window.__game.run.state, front: window.__front.state }));
  check('Dive again on the end card is still one key, straight into the next dive', s.run === 'play' && s.front === 'gone' && Date.now() - t0 < 2000, JSON.stringify(s)); }
await ctx.close();

// ---- 9. touch, on a phone held upright: a tap wakes the page, a tap on Dive dives
{ const { page, ctx, ev } = await open('?title=1', { size: [390, 844], touch: true });
  await page.waitForFunction('window.__ready === true', null, { timeout: 180000 });
  await page.tap('#front .pic'); await sleep(1500);
  const a = await ev(() => ({ awake: document.getElementById('front').classList.contains('awake'), playing: window.__front.music.playing }));
  const box = await page.locator('#front .menu button.dive').boundingBox();
  await page.tap('#front .menu button.dive');
  await page.waitForFunction('window.__front.state === "gone"', null, { timeout: 15000 }).catch(() => {});
  const s = await ev(() => ({ state: window.__front.state, run: window.__game.run.state }));
  check('on a phone, a tap wakes the page and starts the music, and a tap on Dive dives', a.awake && a.playing && s.state === 'gone' && s.run === 'play' && box && box.width > 40 && box.height > 30, JSON.stringify({ a, s, box }));
  await ctx.close(); }

// ---- 10. as a player opens it: the page shows; a link that names a place goes straight in; ?title=0 turns it off
{ const { page, ctx, ev } = await open('', { notDriven: true });
  await page.waitForFunction('window.__front?.ready === true', null, { timeout: 120000 });
  const s = await ev(() => ({ shown: !!document.getElementById('front') && !document.getElementById('front').hidden }));
  check('opened as a player opens it, the page is the front page', s.shown, JSON.stringify(s)); await ctx.close(); }
{ const { page, ctx, ev } = await open('#library/keeper', { notDriven: true });
  await page.waitForFunction('window.__ready === true', null, { timeout: 120000 }); await sleep(500);
  const s = await ev(() => ({ front: !!document.getElementById('front'), lib: document.getElementById('stage').classList.contains('lib') }));
  check('a link that names a place (#library/keeper) goes straight there, with no front page', !s.front && s.lib, JSON.stringify(s)); await ctx.close(); }
{ const { page, ctx, ev } = await open('?title=0', { notDriven: true });
  await page.waitForFunction('window.__ready === true', null, { timeout: 120000 }); await sleep(800);
  const s = await ev(() => ({ front: !!document.getElementById('front'), t: window.__game.run.time }));
  check('?title=0 turns it off for a player too', !s.front && s.t > 0, JSON.stringify(s)); await ctx.close(); }

await browser.close(); server.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall front page checks passed');
process.exit(failures ? 1 : 0);
