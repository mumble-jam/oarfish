// Scripted checks of the front page (game/title.js). Every other suite opens the page under automation and gets a dive at once;
// these force the front page on (?title=1) and check what it promises: nothing of the dive runs or is drawn behind it; nothing
// plays before the first touch and the music after it (generated, no sound file fetched), on the band's clock, following the sound switch
// and the volume, landing its run on the band's downbeat when Dive is pressed, and silent in the dive; every item can be reached and chosen by keyboard, mouse, touch and controller, and its screen closes
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
const audioFetched = []; // every sound file any page asked for: there should be none
// where the page's run landed against the band's own beat there (both on one clock): the handover, and the band's scheduled beat
const landing = async (ev) => { await ev(() => new Promise((ok) => { const t0 = performance.now(), f = () => (window.__front.music.handover?.land != null || performance.now() - t0 > 5000 ? ok() : setTimeout(f, 50)); f(); })); return ev(() => { const h = window.__front.music.handover, b = window.__game.music.state.beats.find((x) => h && x.index === h.bar * 4); return { land: h?.land, bar: h?.bar, beat: b?.at, off: h && b && h.land != null ? +((h.land - b.at) * 1000).toFixed(2) : null, guessOff: h && b ? +((h.guess - b.at) * 1000).toFixed(2) : null, at: h?.at, same: window.__front.music.ctx === window.__game.music.context }; }); };
async function open(query = '?title=1', { size = [1440, 820], touch = false, notDriven = false, point = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] }, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { failures++; console.log('[pageerror]', e.message); });
  page.on('request', (r) => { if (/\.(mp4|m4a|mp3|ogg|oga|wav|aac|flac|webm)(\?|$)/i.test(r.url())) audioFetched.push(r.url()); });
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

// ---- 3. the first touch: a key. The menu inks itself in and the music comes in: generated, on the band's clock
await page.keyboard.press('KeyQ');
await sleep(2600);
{ const m = await ev(() => { const M = window.__front.music; return { state: M.ctx?.state, playing: M.playing, which: M.which, gain: M.gain, err: M.error, shared: !!M.ctx && M.ctx === window.__game.music.context, band: window.__game.music.running, notes: M.tm?.state.log.length, cur: window.__front.cur, awake: document.getElementById('front').classList.contains('awake') }; });
  check('the first touch inks the menu in, with Dive chosen, and leaves the dive alone', m.awake && m.cur === 'dive' && !m.band, JSON.stringify({ awake: m.awake, cur: m.cur, band: m.band }));
  check('after it the Lullaby plays, made as it goes, on an AudioContext the band will play on too (the band not started)', m.state === 'running' && m.playing && m.which === 'a' && m.gain > 0.1 && m.notes > 3 && m.shared && !m.band && !m.err, JSON.stringify(m));
  check('no sound file is fetched', audioFetched.length === 0, JSON.stringify(audioFetched)); }

// ---- 3b. the dorsal fin stays on the back (George: 'the dorsal fin isn't attached to the body consistently across the body'). At three
// moments of its wave, slice by slice along the body, measured on the screen against the same moment with the wave stilled: its foot is
// drawn on the back's outline (no more than a few millimetres of the fish above it, so no paper shows under it, nor more than 3 cm below
// it, the ridge it stands on as the plate's projection draws it), and its height over the back moves by no more than its own rise allows (twice FRONT.fin.rise and 4% more: a quarter at 0.1;
// the old lean, 0.6 to the side, moved it by up to 0.3 + 0.07 of the fin's height): the wave stays in the fin's own plane and does not lean
// it onto or off the back.
{ const r = await ev(() => { const F = window.__front, out = [];
    for (const t of [3, 3.75, 4.5]) { F.shared.uStir.value = 0; F.at(t); const still = F.finProbe(); F.shared.uStir.value = 1; F.at(t); const wave = F.finProbe();
      out.push({ t, px: wave.summary.px, rows: wave.rows.map((w, i) => ({ z: w.z, gap: w.gap, shows: w.shows, still: still.rows[i].shows })) }); }
    F.shared.uStir.value = 1; return { out, rise: F.FRONT.fin.rise }; });
  const allow = 2 * r.rise + 0.04;
  const bad = [];
  for (const m of r.out) for (const x of m.rows) {
    if (x.gap > 0.004 * m.px || x.gap < -0.03 * m.px) bad.push(`t ${m.t} z ${x.z}: foot ${x.gap} px from the outline`);
    if (x.still > 5 && Math.abs(x.shows - x.still) > allow * x.still) bad.push(`t ${m.t} z ${x.z}: height ${x.shows} px against ${x.still} still`);
  }
  const n = r.out.reduce((a, m) => a + m.rows.length, 0);
  check('the dorsal fin\'s foot stays on the back\'s outline along the whole body at three moments of its wave, and the wave never leans it onto or off the back', n > 100 && !bad.length, `${n} slices; ${bad.length} off: ${bad.slice(0, 6).join('; ')}`); }

// ---- 4. every item by keyboard: each opens its screen over the page, and closing it comes back to the page
const items = await ev(() => window.__front.menu.map((b) => b.dataset.go));
{ const seen = []; for (let i = 0; i < items.length; i++) { seen.push(await ev(() => window.__front.cur)); await page.keyboard.press('ArrowRight'); }
  const wrap = await ev(() => window.__front.cur);
  check('the arrow keys reach every item, in order, and come round', seen.join() === items.join() && wrap === items[0], seen.join() + ' / ' + wrap); }
const screenOf = () => ev(() => { const st = document.getElementById('stage'), p = document.getElementById('pause'); return { lib: st.classList.contains('lib'), pause: p.classList.contains('on'), ch: p.dataset.ch, dials: document.getElementById('lf-band').contains(document.getElementById('m-dream')), noting: p.classList.contains('noting'), drawer: document.getElementById('drawer').classList.contains('open'), over: window.__front.over, holds: window.__front.holds, time: window.__game.run.time, frame: window.__game.renderer.info.render.frame, z: getComputedStyle(p).zIndex, resume: document.getElementById('btn-resume').textContent, frontVis: getComputedStyle(document.getElementById('front')).visibility, letters: [...document.querySelectorAll('#front .ink, #front .menu button')].filter((e) => getComputedStyle(e).visibility !== 'hidden' && e.getClientRects().length).map((e) => e.className || e.tagName) }; });
const want = { library: (s) => s.lib, band: (s) => s.pause && s.ch === 'band' && s.dials, settings: (s) => s.pause && !s.noting && s.ch === 'settings', feedback: (s) => s.noting }; // the band and the settings are chapters of the pause menu's leaf (leaf.js)
for (const go of ['library', 'band', 'settings', 'feedback']) {
  for (let n = 0; n < 6 && (await ev(() => window.__front.cur)) !== go; n++) await page.keyboard.press('ArrowRight');
  const before = await screenOf();
  await page.keyboard.press('Enter'); await sleep(700);
  const s = await screenOf();
  await page.keyboard.press('Escape'); await sleep(500);
  if (go === 'library') await sleep(300);
  const back = await screenOf();
  const after = await ev(() => ({ cur: window.__front.cur, state: window.__front.state, cls: document.documentElement.classList.contains('front-over') }));
  check(`over "${go}", nothing of the page's lettering shows (George saw its head line through the library's header)${go === 'library' ? ', and the page has stepped aside from the library altogether' : ''}; back on the page, it shows again`, !s.letters.length && (go !== 'library' || s.frontVis === 'hidden') && back.letters.length > 5 && back.frontVis === 'visible', JSON.stringify({ letters: s.letters, front: s.frontVis, back: back.letters.length }));
  check(`by keyboard, "${go}" opens its own screen over the page, the dive held under it, and Esc comes back to the page`, want[go](s) && s.over === go && s.holds && s.time === before.time && !back.lib && !back.pause && !back.over && after.cur === go && after.state === 'menu' && !after.cls && back.time === before.time, JSON.stringify({ s, back, after }));
}
{ const s = await ev(() => ({ band: window.__game.music.running, playing: window.__front.music.playing })); check('none of it started the band behind the page, and the page\'s music plays on', !s.band && s.playing, JSON.stringify(s)); }

// ---- 5. the sound switch and the volume, set in the band's own drawer over the page
for (let n = 0; n < 6 && (await ev(() => window.__front.cur)) !== 'band'; n++) await page.keyboard.press('ArrowRight');
await page.keyboard.press('Enter'); await sleep(600);
{ await ev(() => { const v = document.getElementById('m-volume'); v.value = '20'; v.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(1200);
  const quiet = await ev(() => window.__front.music.gain);
  await page.click('#music-mute'); await sleep(700);
  const off = await ev(() => ({ g: window.__front.music.gain, muted: window.__game.music.muted }));
  await page.click('#music-mute'); await sleep(200);
  await ev(() => { const v = document.getElementById('m-volume'); v.value = '70'; v.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(700);
  const on = await ev(() => window.__front.music.gain);
  check('the music follows the game\'s volume and its sound switch', Math.abs(quiet - 0.2 * (await ev(() => window.__front.music.DREAM.level)) * 0.6) < 0.03 && off.muted && off.g < 0.01 && on > quiet, JSON.stringify({ quiet, off, on })); }
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
  const s = await ev(() => ({ state: window.__front.state, hidden: document.getElementById('front').hidden, holds: window.__front.holds, time: window.__game.run.time, play: window.__game.run.state, paused: window.__game.paused, front: window.__front.music.playing, band: window.__game.music.running, cls: document.documentElement.className }));
  const L = await landing(ev);
  check('clicking Dive starts a dive: the page is gone, the dive runs', s.state === 'gone' && s.hidden && !s.holds && s.time > before && s.play === 'play' && !s.paused && !/front-over/.test(s.cls), JSON.stringify(s));
  check('in the dive the page\'s music has let go (its hand-over rings out under the band), and the band plays', !s.front && s.band, JSON.stringify(s));
  check('the hand-over run lands on the band\'s second downbeat, on the same clock, within 3 ms', L.same && L.bar === 1 && L.off !== null && Math.abs(L.off) < 3, JSON.stringify(L)); }

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
  await sleep(600);
  { const L = await landing(ev); check('diving again from the page (the band playing silently all along): the run lands on one of its downbeats, within 3 ms', L.same && L.off !== null && Math.abs(L.off) < 3 && L.land - L.at >= 1.5, JSON.stringify(L)); } await ev(() => window.__game.setPaused(true)); await sleep(300);
  await page.click('#btn-front'); const armed = await ev(() => ({ text: document.getElementById('btn-front').textContent, front: window.__front.state }));
  await page.click('#btn-front'); await sleep(1500);
  const s = await ev(() => ({ state: window.__front.state, holds: window.__front.holds, paused: window.__game.paused, pause: document.getElementById('pause').classList.contains('on') }));
  check('from the pause menu, "Front page" asks once more (it leaves the dive) and then goes back to the page', /Again/.test(armed.text) && armed.front === 'gone' && s.state === 'menu' && s.holds && !s.paused && !s.pause, JSON.stringify({ armed, s })); }
{ await page.keyboard.press('Space'); await sleep(250); await page.keyboard.press('KeyX'); // and skipped with a key
  await page.waitForFunction('window.__front.state === "gone"', null, { timeout: 15000 }).catch(() => {});
  await sleep(1800);
  { const L = await landing(ev); check('a dive-in skipped with a key: the run still lands on the band\'s downbeat, within 3 ms', L.same && L.off !== null && Math.abs(L.off) < 3, JSON.stringify(L)); } await ev(() => window.__game.die()); await sleep(1200);
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

// ---- 9b. the lettering at every size (George, on an upright iPhone: Dive drawn over the caption, the menu right of the centre line, one
// lozenge of the focus mark adrift and the other gone). Upright phones (393x660 is Safari with its bars), a tablet, a phone on its side, a
// wide screen: no item of the menu meets the caption or the credit (upright, the menu starts below the caption); upright, the menu is centred
// on the caption's line within 2 px; and for each item in focus, its rule is drawn and a lozenge sits at each end of it, on its line, inside
// what the item's clip and the ink filter's region let show.
{ const { page, ctx, ev } = await open('?title=1', { size: [393, 852], touch: true });
  await page.waitForFunction('window.__front?.ready === true', null, { timeout: 120000 });
  await ev(() => window.__front.touch()); await sleep(1800);
  // the end state of every transition at once: what is measured is where the mark comes to rest
  await ev(() => document.head.insertAdjacentHTML('beforeend', '<style>#front .menu button, #front .menu button::before, #front .menu button::after { transition: none !important; }</style>'));
  const SIZES = [[320, 568, 'up'], [375, 667, 'up'], [393, 660, 'up'], [393, 852, 'up'], [430, 932, 'up'], [768, 1024, 'up'], [844, 390, 'side'], [1274, 476, 'side'], [1440, 900, 'wide'], [1907, 894, 'wide']];
  for (const [w, h, kind] of SIZES) {
    await page.setViewportSize({ width: w, height: h }); await sleep(300);
    const bad = [];
    for (let k = 0; k < 5; k++) {
      await ev((k) => window.__front.menu.forEach((b, j) => b.classList.toggle('cur', j === k)), k); await sleep(450);
      const r = await ev((k) => {
        const R = (e) => { const q = e.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom }; };
        const btns = [...document.querySelectorAll('#front .menu button')], b = btns[k], B = R(b), menu = R(document.querySelector('#front .menu'));
        const px = (v) => parseFloat(v), A = getComputedStyle(b, '::after'), L = getComputedStyle(b, '::before'), W = B.r - B.l, H = B.b - B.t;
        const rule = { l: B.l + px(A.left), r: B.r - px(A.right), y: B.b - px(A.bottom) - px(A.height) / 2, on: A.transform };
        const loz = { l: B.l + px(L.left), r: B.r - px(L.right), y: B.b - px(L.bottom) - px(L.height) / 2, op: +L.opacity };
        const v = (getComputedStyle(b).clipPath.match(/-?[\d.]+%/g) || []).map((x) => parseFloat(x) / 100), ins = v.length ? [v[0], v[1] ?? v[0], v[2] ?? v[0], v[3] ?? v[1] ?? v[0]] : []; // top right bottom left, as CSS shortens them
        const clip = ins.length === 4 ? { l: B.l + ins[3] * W, r: B.r - ins[1] * W, t: B.t + ins[0] * H, b: B.b - ins[2] * H } : B;
        const mw = menu.r - menu.l, mh = menu.b - menu.t, filt = { l: menu.l - 0.02 * mw, r: menu.r + 0.02 * mw, t: menu.t - 0.2 * mh, b: menu.b + 0.2 * mh };
        return { B, rule, loz, clip, filt, menu, items: btns.map(R), cap: R(document.querySelector('#front .caption')), credit: R(document.querySelector('#front .credit')) };
      }, k);
      const meet = (a, c) => a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b;
      if (k === 0) r.items.forEach((it, i) => { for (const [n, c] of [['caption', r.cap], ['credit', r.credit]]) if (meet(it, c)) bad.push(`item ${i} meets the ${n}`); if (kind === 'up' && it.t < r.cap.b) bad.push(`item ${i} starts above the caption's foot`); });
      if (k === 0 && kind === 'up') { const cc = (r.cap.l + r.cap.r) / 2; if (Math.abs((r.menu.l + r.menu.r) / 2 - cc) > 2) bad.push(`menu centre ${((r.menu.l + r.menu.r) / 2).toFixed(1)} vs caption ${cc.toFixed(1)}`);
        r.items.forEach((it, i) => { if (Math.abs((it.l + it.r) / 2 - cc) > 2) bad.push(`item ${i} centre ${((it.l + it.r) / 2).toFixed(1)} vs caption ${cc.toFixed(1)}`); }); }
      const { rule, loz, clip, filt } = r, lz = [[loz.l, loz.l + 6], [loz.r - 6, loz.r]];
      if (!/matrix\(1, 0, 0, 1/.test(rule.on) || loz.op < 0.8) bad.push(`item ${k}: mark not shown (${rule.on}, ${loz.op})`);
      if (Math.abs(loz.y - rule.y) > 1) bad.push(`item ${k}: lozenges ${(loz.y - rule.y).toFixed(1)} px off the rule's line`);
      if (!(lz[0][1] <= rule.l && rule.l - lz[0][1] <= 6) || !(lz[1][0] >= rule.r && lz[1][0] - rule.r <= 6)) bad.push(`item ${k}: lozenges not at the rule's ends (${lz.map((z) => z.map((v) => v.toFixed(1)).join('-')).join(' / ')} vs rule ${rule.l.toFixed(1)}-${rule.r.toFixed(1)})`);
      for (const [a, z] of lz) for (const [n, c] of [['clip', clip], ['ink filter', filt]]) if (a < c.l - 0.5 || z > c.r + 0.5 || loz.y - 3.5 < c.t || loz.y + 3.5 > c.b) bad.push(`item ${k}: a lozenge is cut by the ${n}`);
    }
    check(`${kind === 'up' ? 'upright' : kind === 'side' ? 'on its side' : 'wide'} at ${w}x${h}: the menu clears the caption and the credit${kind === 'up' ? ', is centred on the caption' : ''}, and every item's focus mark is whole`, !bad.length, bad.slice(0, 6).join('; '));
    // ---- 9c. the plate's grid (George: 'pay closer attention to alignments of all the graphic block'; and, of the side-by-side layout, the
    // fish should look at the menu). The running head on one baseline (upright: its two ends, the name standing over them) and its ends on
    // equal margins; the credit a small line on the caption's axis, under it and above the menu; in the plate and upright layouts the fish (the mean of its ink
    // over a breath: it waves by several px either way), the caption and the menu on one centre line; side by side, the menu on the left
    // margin, left of the fish, at the height of its head, and nothing overlapping.
    const G = await ev(() => {
      const F = window.__front, q = (s) => document.querySelector('#front ' + s);
      const ink = (el) => { const r = document.createRange(); r.selectNodeContents(el); const b = r.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
      const base = (el) => { const tn = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim()); const s = document.createElement('span'), mk = document.createElement('span'); mk.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'; tn.replaceWith(s); s.append(tn, mk); const y = mk.getBoundingClientRect().bottom; s.replaceWith(tn); return y; };
      const pic = q('.pic').getBoundingClientRect(), s = F.view.s, B = F.box, pcx = pic.left + pic.width / 2, pcy = pic.top + pic.height / 2, cy = (B.y0 + B.y1) / 2;
      const frame = { l: pcx - s * (B.x1 - B.x0) / 2, r: pcx + s * (B.x1 - B.x0) / 2, t: pcy - s * (B.y1 - B.y0) / 2, b: pcy + s * (B.y1 - B.y0) / 2 };
      const head = { t: pcy - (B.hy1 - cy) * s, b: pcy - (B.hy0 - cy) * s };
      const mesh = F.mesh, pos = mesh.geometry.attributes.position, v = new mesh.position.constructor(); let sum = 0, m = 0;
      for (let t = 0; t < 15; t += 0.5) { F.at(t); mesh.skeleton.update(); let l = 1e9, r = -1e9; for (let i = 0; i < pos.count; i += 3) { v.fromBufferAttribute(pos, i); mesh.applyBoneTransform(i, v); v.applyMatrix4(mesh.matrixWorld).project(F.camera); const x = (v.x + 1) / 2 * innerWidth; l = Math.min(l, x); r = Math.max(r, x); } sum += (l + r) / 2; m++; }
      F.at(3);
      const items = [...document.querySelectorAll('#front .menu button')], box = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
      const row = items.map(ink).reduce((a, b) => ({ l: Math.min(a.l, b.l), r: Math.max(a.r, b.r), t: Math.min(a.t, b.t), b: Math.max(a.b, b.b) }));
      return { W: innerWidth, base: [base(q('.book')), base(q('.name')), base(q('.class'))], book: ink(q('.book')), cls: ink(q('.class')), name: box(q('.name')), credit: ink(q('.credit')), caption: ink(q('.caption')), capBox: box(q('.caption')), menuBox: box(q('.menu')), row, items: items.map(box), dive: box(items[0]), frame, head, fishMean: sum / m };
    });
    { const bad = [], c = (b) => (b.l + b.r) / 2, f1 = (x) => x.toFixed(1), meet = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
      const [bb, nb, cb] = G.base;
      if (Math.abs(bb - cb) > 1 || (kind !== 'up' && Math.abs(bb - nb) > 1)) bad.push(`head line baselines ${[bb, nb, cb].map(f1).join(' / ')}`);
      if (Math.abs(G.book.l - (G.W - G.cls.r)) > 1) bad.push(`margins ${f1(G.book.l)} left, ${f1(G.W - G.cls.r)} right`);
      if (Math.abs(c(G.credit) - c(G.caption)) > 2) bad.push(`credit centred at ${f1(c(G.credit))}, the caption at ${f1(c(G.caption))}`);
      if (G.credit.t < G.capBox.b) bad.push(`the credit (top ${f1(G.credit.t)}) is not under the caption (foot ${f1(G.capBox.b)})`);
      if (kind !== 'side' && G.credit.b > Math.min(...G.items.map((it) => it.t))) bad.push(`the credit (foot ${f1(G.credit.b)}) runs into the menu`);
      if (meet(G.credit, G.capBox) || meet(G.credit, G.frame)) bad.push('the credit meets the caption or the picture');
      if (kind !== 'side') {
        const cc = c(G.caption), menuC = kind === 'up' ? c(G.menuBox) : c(G.row);
        if (Math.abs(G.fishMean - cc) > 2 || Math.abs(menuC - cc) > 2 || Math.abs(c(G.frame) - cc) > 2) bad.push(`centres: fish ${f1(G.fishMean)} (framed ${f1(c(G.frame))}), caption ${f1(cc)}, menu ${f1(menuC)}`);
      } else {
        if (!(G.menuBox.r <= G.frame.l)) bad.push(`menu reaches ${f1(G.menuBox.r)}, the fish starts at ${f1(G.frame.l)}`);
        if (Math.abs(G.row.l - G.book.l) > 1) bad.push(`menu's left ${f1(G.row.l)} off the margin ${f1(G.book.l)}`);
        const dy = (G.dive.t + G.dive.b) / 2; if (dy < G.head.t || dy > G.head.b) bad.push(`Dive at ${f1(dy)}, the head from ${f1(G.head.t)} to ${f1(G.head.b)}`);
        G.items.forEach((it, i) => { for (const [n, o] of [['caption', G.capBox], ['credit', G.credit], ['head line', G.name]]) if (meet(it, o)) bad.push(`item ${i} meets the ${n}`); if (it.b > h) bad.push(`item ${i} runs off the page`); });
      }
      check(`${kind === 'up' ? 'upright' : kind === 'side' ? 'side by side' : 'plate layout'} at ${w}x${h}: the running head on one baseline and equal margins, the credit on the caption's axis under it, ${kind === 'side' ? 'the menu on the left margin at the height of the fish\'s head, nothing overlapping' : 'fish, caption and menu on one centre line'}`, !bad.length, bad.join('; '));
    }
  }
  await ctx.close(); }

// ---- 9d. the library opened from the page draws its specimens (at about George's laptop pane, in a page of its own: choosing a
// specimen can start the band silently, which the hand-over checks above must not inherit) (George: it showed the front page in its middle, the paper, the fish, the
// caption, on any specimen). Two specimens: at the middle of the library's stage what is on top is the library's own surface, nothing of
// the page; the pixels there are not the paper's colour, and differ between the two; and the page's fish is not stepped meanwhile.
{ const { page, ctx, ev } = await open('?title=1', { size: [1274, 476] });
  await page.waitForFunction('window.__ready === true && window.__front?.ready === true', null, { timeout: 180000 });
  await page.keyboard.press('KeyQ'); await sleep(1800);
  for (let n = 0; n < 6 && (await ev(() => window.__front.cur)) !== 'library'; n++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter'); await sleep(900);
  const look = async (name) => {
    await page.click(`#lib-list button:has-text("${name}")`); await sleep(1400);
    const r = await ev(() => { const b = document.getElementById('lib-stage').getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2, top = document.elementFromPoint(x, y);
      return { x, y, top: top ? (top.id || top.className || top.tagName) : null, inFront: !!top?.closest('#front'), frames: window.__front.frames }; });
    const png = (await page.screenshot({ clip: { x: r.x - 80, y: r.y - 80, width: 160, height: 160 } })).toString('base64');
    const px = await ev(async (png) => { const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode(); const c = document.createElement('canvas'); c.width = 16; c.height = 16; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 16, 16); return [...g.getImageData(0, 0, 16, 16).data]; }, png);
    return { ...r, px };
  };
  const paper = await ev(() => { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = window.__front.FRONT.colours.paper; c.fillRect(0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data]; });
  const a = await look('Sprat'), b = await look('Pilot fish');
  const near = (p) => { let n = 0; for (let i = 0; i < p.length; i += 4) if (Math.abs(p[i] - paper[0]) + Math.abs(p[i + 1] - paper[1]) + Math.abs(p[i + 2] - paper[2]) < 30) n++; return n / (p.length / 4); };
  let diff = 0; for (let i = 0; i < a.px.length; i += 4) diff += Math.abs(a.px[i] - b.px[i]) + Math.abs(a.px[i + 1] - b.px[i + 1]) + Math.abs(a.px[i + 2] - b.px[i + 2]); diff /= a.px.length / 4;
  check('the library opened from the page draws each specimen in its middle: the library\'s surface on top there, not the paper, and two specimens look different', a.top === 'lib-stage' && b.top === 'lib-stage' && !a.inFront && !b.inFront && near(a.px) < 0.2 && near(b.px) < 0.2 && diff > 8 && b.frames === a.frames, JSON.stringify({ a: a.top, b: b.top, paperA: near(a.px).toFixed(2), paperB: near(b.px).toFixed(2), diff: diff.toFixed(1), frames: [a.frames, b.frames] }));
  await page.mouse.move(1270, 470); // off the menu's column (a mouse resting over an item marks it, by design)
  await page.keyboard.press('Escape'); await sleep(800);
  const back = await ev(() => ({ state: window.__front.state, cur: window.__front.cur, vis: getComputedStyle(document.getElementById('front')).visibility }));
  check('and closing it comes back to the page, the library still marked', back.state === 'menu' && back.cur === 'library' && back.vis === 'visible', JSON.stringify(back));
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
check('no page asked for a sound file at any point', audioFetched.length === 0, JSON.stringify(audioFetched));
console.log(failures ? `\n${failures} check(s) failed` : '\nall front page checks passed');
process.exit(failures ? 1 : 0);
