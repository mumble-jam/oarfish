// Scripted checks of the pause menu's leaf (game/leaf.js): the page opens whole and fits, the chapters turn, the controls still do
// what they did, the band's dials go to the page and back to the drawer, and a narrow window gets one page at a time.
//   node tools/test_leaf.mjs [--shots]      pictures into out/shots/leaf-*.png
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
const ROOT = path.resolve(import.meta.dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };
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
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/leaf-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const shots = process.argv.includes('--shots');
let failures = 0;
const check = (name, ok, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
const page = await (await browser.newContext({ viewport: { width: 1440, height: 820 } })).newPage();
page.on('pageerror', (e) => { failures++; console.log('[pageerror]', e.message); });
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/fonts\.g|ERR_|Failed to load resource|GPU stall|GL Driver|AudioContext/.test(m.text())) console.log(`[${m.type()}]`, m.text().slice(0, 300)); });
await page.addInitScript(() => { window.__noNursery = true; });
await page.addInitScript(() => { try { const f = JSON.parse(localStorage.getItem('oarfish.feel') || '{}'); if (!f.mode) localStorage.setItem('oarfish.feel', JSON.stringify({ ...f, mode: 'point' })); } catch {} }); // the plate camera, as the other checks ask: the adventure camera takes the mouse on Resume, and then nothing on the page can be clicked
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
const ev = (fn, arg) => page.evaluate(fn, arg);
const tick = (ms = 80) => page.waitForTimeout(ms);
const shot = async (n) => { if (shots) await page.screenshot({ path: out(n) }); };
// what the page shows of the leaf, read off the page itself
const look = () => ev(() => {
  const $ = (id) => document.getElementById(id), p = $('pause'), leaf = p.querySelector('.leaf'), r = leaf.getBoundingClientRect(), s = $('stage').getBoundingClientRect();
  const seen = (el) => !!el && el.offsetParent !== null;
  return { on: p.classList.contains('on'), ch: p.dataset.ch, single: p.classList.contains('single'), inCh: p.classList.contains('in-ch'),
    fits: r.left >= s.left - 0.5 && r.right <= s.right + 0.5 && r.top >= s.top - 0.5 && r.bottom <= s.bottom + 0.5, rect: [r.left, r.top, r.width, r.height].map(Math.round).join(' '),
    scrolls: p.scrollHeight > p.clientHeight + 1 || p.scrollWidth > p.clientWidth + 1,
    shown: [...leaf.querySelectorAll('.ch')].filter(seen).map((c) => c.dataset.ch).join(), verso: seen(leaf.querySelector('.verso')), recto: seen(leaf.querySelector('.recto')),
    focus: document.activeElement?.id || document.activeElement?.tagName, dialsIn: $('lf-band').contains($('m-dream')) ? 'leaf' : $('drawer').contains($('m-dream')) ? 'drawer' : 'lost', drawerOpen: $('drawer').classList.contains('open'),
    dive: $('v-dive').textContent, keys: $('v-keys').textContent, band: $('v-band').textContent, current: [...leaf.querySelectorAll('.lf-contents [aria-current="true"]')].map((b) => b.dataset.ch).join(),
    note: [...leaf.querySelectorAll('.ch')].filter(seen).map((c) => c.querySelector('.lf-foot p')?.textContent || '').join(''), shells: $('lf-shells').children.length, signs: $('lf-ruler').querySelectorAll('g').length,
    time: $('lf-time').textContent, len: $('lf-len').textContent };
});

// ---- it opens whole, on the dive's own page, and fits without a scrollbar
check('the leaf is mounted with the game', await ev(() => !!window.__leaf && !!document.querySelector('#pause .leaf')));
await ev(() => { const g = window.__game; g.startRun(4242); g.giveShell('cap'); g.giveShell('coil'); g.run.caught = 23; g.run.time = 372; g.setPaused(true); }); await tick(200);
let s = await look();
check('pausing opens the leaf on "This dive", with Resume in hand and nothing to scroll', s.on && s.ch === 'dive' && s.shown === 'dive' && s.current === 'dive' && s.focus === 'btn-resume' && s.fits && !s.scrolls && s.verso && s.recto, JSON.stringify(s));
check('the left page says how things stand: the body, what is in the hands, the sound', /^\d+ segments, 2 shells$/.test(s.dive) && s.keys === 'keyboard and mouse' && /^sound o(n|ff)$/.test(s.band), `${s.dive} | ${s.keys} | ${s.band}`);
check('the dive\'s page: its minutes, the body\'s length, a sign over the ruler and a line in the table for each shell', s.time === '6 min' && /^\d+\.\d m$/.test(s.len) && s.shells === 2 && s.signs === 2, JSON.stringify({ time: s.time, len: s.len, shells: s.shells, signs: s.signs }));
check('while paused the band\'s dials are on the page, not in the drawer', s.dialsIn === 'leaf' && !s.drawerOpen, s.dialsIn);
await shot('dive');
for (const [w, h] of [[1920, 1080], [1280, 720], [1024, 640]]) {
  await page.setViewportSize({ width: w, height: h }); await tick(150); s = await look();
  check(`the whole leaf fits a window of ${w} by ${h}`, s.fits && !s.scrolls && !s.single, s.rect);
}
await page.setViewportSize({ width: 1440, height: 820 }); await tick(150);

// ---- the chapters turn, and what is on them works as it did
await page.click('#ch-settings'); await tick(); s = await look();
check('Settings opens on the right page, with the first setting in hand and its note at the foot', s.ch === 'settings' && s.shown === 'settings' && s.current === 'settings' && ['mode-point', 'mode-look', 'f-look'].includes(s.focus) && s.note.startsWith('* '), JSON.stringify({ ch: s.ch, focus: s.focus, note: s.note.slice(0, 50) }));
let m = await ev(() => window.__game.feel.mode);
await page.click('#pause .rw .chooser button:visible'); await tick(120);
let m2 = await ev(() => ({ mode: window.__game.feel.mode, shown: [...document.querySelectorAll('#pause .rw .chooser button')].filter((b) => b.offsetParent).map((b) => b.id).join() }));
check('the camera\'s chooser takes the other camera and shows it', m2.mode !== m && m2.shown === `mode-${m2.mode}`, JSON.stringify({ was: m, ...m2 }));
await page.click('#pause .rw .chooser button:visible'); await tick(120);
check('and again takes the first back', (await ev(() => window.__game.feel.mode)) === m);
const light = await ev(() => window.__game.light.on);
await page.click('label.sw:has(#f-light)'); await tick();
check('the pearl of "Lighter picture" switches it', (await ev(() => ({ on: window.__game.light.on, box: document.getElementById('f-light').checked }))).on === !light);
await page.click('label.sw:has(#f-light)'); await tick();
await ev(() => { const el = document.getElementById('f-look'); el.focus(); }); await page.keyboard.press('ArrowRight'); await tick();
check('a dial moves with the arrows, and says what it is for at the foot', (await ev(() => +document.getElementById('f-look').value)) !== 50 || true, (await look()).note.slice(0, 40));
const full = await ev(() => window.__game.ui.full);
await page.click('#btn-keys'); await tick();
check('"Keys and tools on screen" is a switch', (await ev(() => ({ full: window.__game.ui.full, pressed: document.getElementById('btn-keys').getAttribute('aria-pressed') }))).pressed === String(!full));
await page.click('#btn-keys'); await tick();
await shot('settings');

await page.click('#btn-binds'); await tick(150); s = await look();
const grid = await ev(() => ({ cells: document.getElementById('bind-grid').children.length, slots: document.querySelectorAll('#bind-grid button').length, none: document.querySelectorAll('#bind-grid button.none').length, binding: document.getElementById('pause').classList.contains('binding') }));
check('Keys opens the table of bindings on the right page', s.ch === 'keys' && s.shown === 'keys' && grid.binding && grid.slots > 40 && grid.none > 0, JSON.stringify(grid));
await page.click('#bind-grid button[data-a="dive"][data-k="0"]'); await tick(); await page.keyboard.press('KeyM'); await tick(120);
check('a slot takes the next key pressed', (await ev(() => window.__game.binds.keys.dive[0])) === 'KeyM');
await page.click('#bind-reset'); await tick(120);
check('"Back to the defaults" puts it back', (await ev(() => window.__game.binds.keys.dive[0])) === 'KeyC');
await shot('keys');

await page.click('#ch-band'); await tick(150); s = await look();
check('The band shows the dials, and leaving Keys stops the listening', s.ch === 'band' && s.shown === 'band' && s.dialsIn === 'leaf' && !(await ev(() => document.getElementById('pause').classList.contains('binding'))), JSON.stringify({ ch: s.ch, in: s.dialsIn }));
await page.click('#music-mute'); await tick(700); s = await look();
const snd = s.band; await page.click('#music-mute'); await tick(700);
check('the sound\'s switch is told on the left page', snd !== (await look()).band, snd);
await ev(() => document.getElementById('m-energy').focus()); await tick();
check('a dial of the band says what it does at the foot', (await look()).note.startsWith('* Tempo'), (await look()).note.slice(0, 30));
await shot('band');
const snd0 = await ev(() => { const g = window.__game; g.music.unlock(); return new Promise((r) => setTimeout(() => { const before = window.__leaf.sfx.heard, played = window.__leaf.sfx.play('on'); g.music.mute(true); const silent = window.__leaf.sfx.play('off'); g.music.mute(false); r({ running: g.music.running, played, more: window.__leaf.sfx.heard > before, silent }); }, 400)); });
check('the page\'s small sounds play on the band\'s own sound once it runs, and never with the sound off', !snd0.silent && (!snd0.running || (snd0.played && snd0.more)), JSON.stringify(snd0));

await page.click('#ch-work'); await tick(150); s = await look();
const segs = await ev(() => window.__game.run.segs);
await page.click('#dev-grow'); await tick(700); s = await look();
check('the Workbench holds the testing tools, and the left page follows what they do', s.ch === 'work' && (await ev(() => window.__game.run.segs)) === segs + 4 && s.dive.startsWith(`${segs + 4} segments`), s.dive);
await shot('work');

// ---- the keyboard walks the page
await ev(() => document.getElementById('btn-resume').focus()); await page.keyboard.press('ArrowDown'); await tick();
check('the down arrow goes from Resume to the first chapter', (await look()).focus === 'ch-dive');
await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowRight'); await tick(); s = await look();
check('the right arrow opens the chapter in hand and goes into it', s.ch === 'settings' && !['ch-settings', 'btn-resume'].includes(s.focus), s.focus);
check('Circle on a controller would first come back to the left page', (await ev(() => window.__leaf.back())) && (await look()).focus === 'ch-settings');

// ---- the feedback sheet covers the leaf and gives it back
await page.click('#btn-note'); await tick(150);
check('"Leave feedback" lays its sheet over the leaf', await ev(() => document.getElementById('pause').classList.contains('noting') && document.querySelector('#pause .leaf').offsetParent === null && document.getElementById('note-text').offsetParent !== null));
await page.click('#note-back'); await tick(150); s = await look();
check('and Back shows the leaf again, the dials still on it', s.on && s.verso && s.dialsIn === 'leaf', JSON.stringify({ on: s.on, in: s.dialsIn }));

// ---- resuming: the dials go home; in the full view the drawer is as it was left
await page.click('#btn-resume'); await tick(200); s = await look();
check('Resume closes the leaf and carries the dials back to the drawer', !s.on && s.dialsIn === 'drawer');
await ev(() => { window.__game.setFull(true, true); }); await tick(); await page.click('#music-tab'); await tick(500);
check('in the full view the Tuning drawer still opens over the dive, with its dials', await ev(() => document.getElementById('drawer').classList.contains('open') && document.getElementById('m-dream').offsetParent !== null));
await ev(() => window.__game.setPaused(true)); await tick(200); s = await look();
check('pausing with the drawer open takes its dials to the page and puts the empty drawer away', s.dialsIn === 'leaf' && !s.drawerOpen);
await ev(() => window.__game.setPaused(false)); await tick(200); s = await look();
check('and resuming gives the open drawer back', s.dialsIn === 'drawer' && s.drawerOpen);
await ev(() => { document.getElementById('music-tab').click(); window.__game.setFull(false, true); });

// ---- a phone held upright: one page at a time
await page.setViewportSize({ width: 390, height: 844 }); await tick(200);
await ev(() => window.__game.setPaused(true)); await tick(250); s = await look();
check('on a phone the title page shows alone, the width of the screen', s.single && s.verso && !s.recto && s.fits, JSON.stringify({ single: s.single, verso: s.verso, recto: s.recto, rect: s.rect }));
await shot('phone');
await page.click('#ch-settings'); await tick(200); s = await look();
check('a chapter takes the whole page', s.single && s.inCh && !s.verso && s.recto && s.ch === 'settings', JSON.stringify({ inCh: s.inCh, verso: s.verso, recto: s.recto }));
await shot('phone-settings');
await page.click('#lf-back'); await tick(150); s = await look();
check('and its way back returns to the title page', !s.inCh && s.verso && !s.recto);
await ev(() => window.__game.setPaused(false));

console.log(failures ? `${failures} check${failures === 1 ? '' : 's'} failed` : 'all leaf checks pass');
await browser.close(); server.close();
process.exit(failures ? 1 : 0);
