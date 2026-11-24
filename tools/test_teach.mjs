// Scripted checks of the teaching: the nursery's lessons in order, the prompts, skipping, and the setting that rules it all.
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
await page.addInitScript(() => { window.__hold = true; }); // held from before the page starts: on a busy machine the dive ran by itself for seconds between being ready and being held, and the fish drifted through the first hoops before any check had looked
await page.addInitScript(() => { try { const f = JSON.parse(localStorage.getItem('oarfish.feel') || '{}'); if (!f.mode) localStorage.setItem('oarfish.feel', JSON.stringify({ ...f, mode: 'point' })); } catch {} }); // made on the plate camera, the default when this was written: ask for it, unless a camera was chosen in this page
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await page.evaluate(() => { window.__hold = true; });
const ev = (fn, arg) => page.evaluate(fn, arg);
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const snap = async (name) => { if (!shots) return; await frame(); await page.screenshot({ path: out(name) }); };
await ev(() => {
  const g = window.__game, none = { dir: null, amount: 1, vertical: 0, sprint: false };
  window.N = {
    none,
    // swim at a point until the lesson moves on, or time runs out
    to(p, seconds = 20) { const step0 = g.tut.step; for (let t = 0; t < seconds && g.tut.step === step0 && g.tut.on; t += 0.1) { const h = g.rig.snout, dx = p.x - h.x, dz = p.z - h.z, d = Math.hypot(dx, dz) || 1; g.sim(0.1, { ...none, dir: { x: dx / d, y: 0, z: dz / d }, vertical: Math.max(-1, Math.min(1, (p.y - h.y) * 1.5)) }); } return g.tut.step - step0; },
    chip() { const el = document.getElementById('prompt'); return el.classList.contains('on') ? el.textContent : ''; },
    toast() { const el = document.getElementById('toast'); return el.classList.contains('on') ? `${el.className}|${document.getElementById('toast-title').textContent}|${document.getElementById('hint').textContent}` : ''; },
    label() { const t = g.tutTarget(); return t ? t.label : 'the rift'; }, // what the lesson is about, read from the dive and not from the screen (no player sees a marker)
    marker() { const el = document.getElementById('goal'); return !!el && !el.hidden && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0; },
  };
});

// ---- a first dive opens in the nursery
let s = await ev(() => { const g = window.__game, n = g.world.nursery; g.sim(3.6, window.N.none); const h = n.hoops[0], f = g.rig.forward; // once the band's title card has gone
  return { on: g.tut.on, hoops: n.hoops.length, ahead: f.x * h.ux + f.z * h.uz, label: window.N.label(), marker: window.N.marker(), chip: window.N.chip(), skip: !document.getElementById('btn-skip').hidden, shells: g.field.items.filter((i) => !i.taken).length, kept: [0, 1, 2, 5].map((i) => g.world.schools[i].tier).join('') }; });
check('a first dive opens in the nursery, facing the first hoop, with no marker on screen and the swim keys shown', s.on && s.hoops === 3 && s.ahead > 0.95 && /the hoop/.test(s.label) && !s.marker && /W.*swim/.test(s.chip) && s.skip && s.shells === 2 && s.kept === 'sssm', JSON.stringify(s));
s = await ev(() => { const shown = (q) => { const el = document.querySelector(q); return !!el && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0; };
  return { full: document.getElementById('stage').classList.contains('full'), chip: shown('#prompt .in'), skip: shown('#btn-skip'), pause: shown('#btn-pause'), marker: shown('#goal-label'), keys: shown('#keys'), tools: shown('.tools'), tuning: shown('#music-tab') }; });
check('all of it shows in the plain view a dive opens on: the prompt, Skip tutorial and pause, with no marker, no key list and no tools', !s.full && s.chip && s.skip && s.pause && !s.marker && !s.keys && !s.tools && !s.tuning, JSON.stringify(s));
// with no marker, the place itself leads on: the paved way runs from the start past every lesson to the jar, and on from the jar to the rift, never more than a few metres unpaved
s = await ev(() => { const g = window.__game, w = g.world, n = w.nursery, flags = w.pieces().filter((p) => p.name === 'flag'), wr = w.wrap;
  const gap = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, on = flags.map((f) => { const dx = wr(f.x - ax), dz = wr(f.z - az), t = dx * ux + dz * uz; return Math.abs(dx * uz - dz * ux) < 2 && t > -1 && t < L + 1 ? t : null; }).filter((t) => t !== null).sort((a, b) => a - b);
    let most = on.length ? on[0] : L; for (let i = 1; i < on.length; i++) most = Math.max(most, on[i] - on[i - 1]); return { most: +Math.max(most, L - (on[on.length - 1] ?? 0)).toFixed(1), n: on.length, L: +L.toFixed(1) }; };
  const s0 = w.spawn, j = n.jar, G = w.goal, d = Math.hypot(G.x - j.x, G.z - j.z), ux = (G.x - j.x) / d, uz = (G.z - j.z) / d;
  return { toJar: gap(s0.x, s0.z, j.x - Math.sin(n.dir) * 2, j.z - Math.cos(n.dir) * 2), onward: gap(j.x + ux * 2, j.z + uz * 2, G.x - ux * 20, G.z - uz * 20), lessons: [...n.hoops, j].every((o) => Math.hypot(o.x - s0.x, o.z - s0.z) < 60) }; });
check('with no marker the nursery leads by the place: a paved way from the start past the hoops and pens to the jar, and on from the jar to the rift\'s edge, no stretch of it more than a few metres bare', s.toJar.most < 4 && s.toJar.n > 20 && s.onward.most < 5 && s.onward.n > 20 && s.lessons, JSON.stringify(s));
await snap('t-start');
s = await ev(() => { const g = window.__game, n = g.world.nursery, got = []; for (let i = 0; i < 3; i++) { const moved = window.N.to(n.hoops[i]); got.push(moved); if (i === 0) { g.sim(1.2, window.N.none); got.push(window.N.chip()); } } g.sim(0.2, window.N.none); return { got, step: g.tut.step, label: window.N.label(), learned: Object.keys(g.teach.learned).join() }; });
check('swimming through each hoop in turn moves the lesson on, and the second hoop asks for the rise key', s.got[0] === 1 && /Space.*rise/.test(s.got[1]) && s.got[2] === 1 && s.got[3] === 1 && s.step === 3 && /the pen/.test(s.label) && /move.*rise.*dive/.test(s.learned), JSON.stringify(s));
s = await ev(() => { const g = window.__game, w = g.world, out = {}; const sc = w.schools[0]; g.rig.reset(g.rig.pos.clone().set(sc.x + 3, sc.y, sc.z), 0); g.sim(0.4, window.N.none); out.chip = window.N.chip();
  const can = () => { g.sim(0.2, window.N.none); return `${+w.schools[1].can}${+w.schools[5].can}`; };
  out.start = can(); w.take(sc); g.addFood(8); out.one = can(); out.afterPen = g.tut.step; out.label = window.N.label(); w.take(w.schools[1]); g.addFood(8); out.two = can(); out.mid = g.tut.step; w.take(w.schools[2]); g.addFood(8); out.three = can(); out.afterPens = g.tut.step; out.label2 = window.N.label(); w.take(w.schools[5]); g.addFood(18); g.sim(0.2, window.N.none); out.afterBig = g.tut.step; out.label3 = window.N.label(); out.segs = g.run.segs; return out; });
check('the pen shows the wrap keys over the swarm; the bigger swarm cannot be taken until the small ones are eaten, and then it can', /Q.*E.*go round/.test(s.chip) && s.start === '10' && s.one === '10' && s.two === '10' && s.three === '11' && s.afterPen === 4 && /small pens/.test(s.label) && s.mid === 4 && s.afterPens === 5 && /bigger swarm/.test(s.label2) && s.afterBig === 6 && /the jar/.test(s.label3), JSON.stringify(s));
await ev(() => { const g = window.__game, j = g.world.nursery.jar, n = g.world.nursery; g.rig.reset(g.rig.pos.clone().set(j.x - Math.sin(n.dir) * 6, j.y + 1.2, j.z - Math.cos(n.dir) * 6), n.dir); g.snap(); g.sim(0.5, window.N.none); });
await snap('t-jar');
s = await ev(() => { const g = window.__game, j = g.world.nursery.jar, n = g.world.nursery, fwd = { ...window.N.none, dir: { x: Math.sin(n.dir), y: 0, z: Math.cos(n.dir) } }; const chip = window.N.chip(), before = g.field.items.filter((i) => !i.taken).length;
  g.sim(0.6, fwd); const bumped = j.broken; g.rig.reset(g.rig.pos.clone().set(j.x - Math.sin(n.dir) * 4, j.y + 1.2, j.z - Math.cos(n.dir) * 4), n.dir); g.sim(0.2, fwd); g.sim(1 / 60, { ...fwd, dashNow: true }); g.sim(0.6, fwd); g.sim(0.3, window.N.none);
  const first = window.N.toast(); g.sim(11, window.N.none);
  return { chip, bumped, broken: j.broken, on: g.tut.on, done: g.teach.done, shells: g.run.shells.length, first, toast: window.N.toast(), label: window.N.label(), skip: !document.getElementById('btn-skip').hidden, saved: JSON.parse(localStorage.getItem('oarfish.teach')).done }; });
check('swimming into the jar does nothing, a dash breaks it, the first shell is inside, and that ends the nursery for good', /Shift.*dash/.test(s.chip) && !s.bumped && s.broken && !s.on && s.done && s.saved && s.shells === 1 && /on shell\|/.test(s.first) && /teach\|That was the nursery/.test(s.toast) && /the rift/.test(s.label) && !s.skip, JSON.stringify(s));
await snap('t-done');
s = await ev(() => { const g = window.__game; g.startRun(4242); g.sim(0.2, window.N.none); const again = !!g.world.nursery; const fwd = (a) => ({ ...window.N.none, dir: { x: Math.sin(a), y: 0, z: Math.cos(a) } });
  // a jar and a side of it with nothing standing in the run-up
  const open = (u, a) => { for (let d = 1.8; d <= 4.4; d += 0.2) { const p = g.rig.pos.clone().set(u.x - Math.sin(a) * d, u.y + 1, u.z - Math.cos(a) * d), q = p.clone(); g.world.pushOut(q, 0.9); if (q.distanceTo(p) > 0.01) return false; } return true; };
  let u = null, a = 0; for (const x of g.world.urns) { if (x.broken) continue; for (let k = 0; k < 8 && !u; k++) if (open(x, k * 0.785)) { u = x; a = k * 0.785; } if (u) break; }
  g.rig.reset(g.rig.pos.clone().set(u.x - Math.sin(a) * 4, u.y + 1, u.z - Math.cos(a) * 4), a); g.sim(0.2, fwd(a)); const food = g.run.caught; g.sim(1 / 60, { ...fwd(a), dashNow: true }); g.sim(0.5, fwd(a)); g.sim(1.5, window.N.none);
  return { again, urns: g.world.urns.length, broken: u.broken, fed: g.run.caught - food }; });
check('the next dive does not open in the nursery, and a sealed jar by the ruins breaks open for food', !s.again && s.urns >= 3 && s.broken && s.fed === 3, JSON.stringify(s));

// ---- the setting, and skipping
await page.keyboard.press('KeyP'); await page.waitForTimeout(150);
s = await ev(() => ({ checked: document.getElementById('f-teach').checked }));
await page.click('#f-teach'); await page.click('#f-teach'); // off, then on again: from the beginning
await page.waitForTimeout(450); await page.keyboard.press('KeyP'); await page.waitForTimeout(200);
s = { ...s, ...(await ev(() => { const g = window.__game; g.startRun(4242); g.sim(0.2, window.N.none); return { on: g.teach.on, done: g.teach.done, learned: Object.keys(g.teach.learned).length, nursery: !!g.world.nursery, skip: !document.getElementById('btn-skip').hidden }; })) };
check('turning the teaching off and on again in the pause menu starts it over', s.checked && s.on && !s.done && s.learned === 0 && s.nursery && s.skip, JSON.stringify(s));
await page.click('#btn-skip');
s = await ev(() => { const g = window.__game; g.sim(0.3, window.N.none); const now = { on: g.teach.on, tut: g.tut.on, label: window.N.label(), chip: window.N.chip(), box: document.getElementById('f-teach').checked, hidden: document.getElementById('btn-skip').hidden, toast: window.N.toast() };
  g.startRun(4242); g.sim(0.2, window.N.none); g.addFood(5); g.sim(0.5, window.N.none); return { ...now, next: !!g.world.nursery, hint: window.N.toast() }; });
check('Skip tutorial ends it at once, unticks the setting, and the next dive has no nursery and no lessons', !s.on && !s.tut && /the rift/.test(s.label) && s.chip === '' && !s.box && s.hidden && /No more teaching/.test(s.toast) && !s.next && !/Eating makes you longer/.test(s.hint), JSON.stringify(s));

// ---- what the game says, and how it looks saying it
s = await ev(() => { const g = window.__game; g.setTeach(true); g.startRun(4242); g.sim(0.2, window.N.none); const it = g.field.drop(g.rig.pos.x, g.rig.pos.z + 2, 'fan', 0.6); g.rig.reset(g.rig.pos.clone().set(it.x, it.y, it.z - 1.5), 0); g.sim(0.8, { ...window.N.none, dir: { x: 0, y: 0, z: 1 } });
  const el = document.getElementById('toast'), r = el.getBoundingClientRect(), foot = document.querySelector('.foot').getBoundingClientRect(); return { cls: el.className, kick: document.getElementById('toast-kick').textContent, title: document.getElementById('toast-title').textContent, text: document.getElementById('hint').textContent, tone: el.style.getPropertyValue('--tone'), above: r.bottom <= foot.top + 2, centred: Math.abs(r.left + r.width / 2 - innerWidth / 2) < 2, w: Math.round(r.width) }; });
check('picking up a shell says so in a card over the scale bar: its name as the title, its colour down the side', /on shell/.test(s.cls) && s.kick === 'A shell' && s.title === 'Fan' && /stamina/.test(s.text) && /Shed the segment/.test(s.text) && s.tone === '#f9cdd6' && s.above && s.centred && s.w <= 500, JSON.stringify(s));
await snap('t-toast');
console.log(failures ? `${failures} check(s) failed` : 'all teaching checks passed');
await browser.close(); server.close();
process.exit(failures ? 1 : 0);
