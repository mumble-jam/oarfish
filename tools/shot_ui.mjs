// Photographs for the menu kit in ui/ (see ui/README.md): stills of the dive with no interface in them, to put behind
// the menus, and pictures of every menu, both in the standalone copy (ui/index.html) and in the real game.
//   node tools/shot_ui.mjs [stills] [name…]     the stills: ui/bg/<name>.png, 1920 × 1080, nothing but the dive in the picture
//   node tools/shot_ui.mjs page [id…]           every screen and state of ui/index.html: ui/shots/<screen>--<state>.png
//   node tools/shot_ui.mjs game [id…]           the same screens in the real game, laid over the same still: out/ui-compare/<id>.game.png,
//                                               beside the copy's (<id>.copy.png) and a count of the pixels that differ
//   node tools/shot_ui.mjs dump                 what the game writes into its menus by script (key list, binding grid, library…), as JSON
//   node tools/shot_ui.mjs layers [id…]         every state read back as boxes and text, for ui/figma/build.js: out/ui-figma/<id>.json
// add small to any of them for a quick look at 960 × 540 (written to out/ui-trial/ and never into ui/).
// The world is 4242, the one the checks stand in. Chrome: CHROME=/usr/bin/google-chrome, as for the other tools.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
const ROOT = path.resolve(import.meta.dirname, '..'), UI = path.join(ROOT, 'ui');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u.endsWith('/')) u += 'index.html';
  const CDN = '/npm/three@0.170.0/';
  const p = u.startsWith(CDN) ? path.resolve(ROOT, 'node_modules/three', u.slice(CDN.length)) : path.join(ROOT, u);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  if (u === '/index.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(fs.readFileSync(p, 'utf8').replaceAll('https://cdn.jsdelivr.net', '')); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const HOST = `http://localhost:${server.address().port}`;
const args = process.argv.slice(2), small = args.includes('small'), MODES = ['stills', 'page', 'game', 'dump', 'layers'];
const mode = args.find((a) => MODES.includes(a)) || 'stills', picks = args.filter((a) => a !== 'small' && !MODES.includes(a));
const VIEW = small ? { width: 960, height: 540 } : { width: 1920, height: 1080 };
const trial = path.join(ROOT, 'out/ui-trial'), dir = (d) => { fs.mkdirSync(d, { recursive: true }); return d; };
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--force-color-profile=srgb'] });
const frame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

// The game asks Google for its three typefaces. Here they come from the kit's own copies (ui/fonts), so the lettering is the real one
// with or without a connection, and the same files the standalone page uses.
async function fonts(page) {
  const css = fs.readFileSync(path.join(UI, 'fonts/fonts.css'), 'utf8').replaceAll('url(', `url(${HOST}/ui/fonts/`);
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: css }));
  await page.route('https://fonts.gstatic.com/**', (r) => r.abort());
}
// the real game, held still (`__hold`: nothing moves unless this script moves it), in a browser that has never played it
async function game({ touch = false, storage = null, view = VIEW, nursery = false } = {}) {
  const page = await (await browser.newContext({ viewport: view, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch })).newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource|GPU stall|GL Driver|AudioContext/.test(m.text())) console.log('[error]', m.text().slice(0, 300)); });
  await fonts(page);
  await page.addInitScript(([storage, nursery]) => { window.__noNursery = !nursery; window.__hold = true; for (const [k, v] of Object.entries(storage || {})) localStorage.setItem(k, JSON.stringify(v)); }, [storage, nursery]);
  await page.goto(`${HOST}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__ready === true', null, { timeout: 180000 });
  await page.evaluate(() => document.fonts.ready);
  // helpers that live in the page
  await page.evaluate(() => {
    const g = window.__game, none = { dir: null, amount: 0, vertical: 0, sprint: false, gentle: false, coil: 0, tight: false, bite: false };
    const U = window.U = {
      none,
      // a dive in world 4242, in `band`, with a body of `segs` segments, past the band's title card; nothing bites (`hush` does not make the fish blink, as `safe` does)
      begin(band = 0, segs = 10) { g.startRun(4242); g.run.segs = segs; g.run.longest = segs; g.buildFish(segs); if (band) g.enterFloor(band, false); g.run.hush = 1e9; g.sim(3.8, none); },
      bed: (x, z) => g.world.height(x, z),
      // put the fish at x, z, `up` metres over the bed, heading `yaw`
      put(x, z, up, yaw) { g.rig.reset(g.rig.pos.clone().set(x, g.world.height(x, z) + up, z), yaw); g.sim(0.05, none); },
      // swim for `secs`, turning `turn` radians a second, so the body lies in a curve and not in a line; `keep` metres over the bed
      swim(secs, turn = 0, keep = null, amount = 1) { let yaw = g.rig.yaw; for (let t = 0; t < secs; t += 1 / 30) { yaw += turn / 30; const p = g.rig.pos;
        g.sim(1 / 30, { ...none, amount, dir: { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) }, vertical: keep === null ? 0 : Math.max(-1, Math.min(1, (g.world.height(p.x, p.z) + keep - p.y) * 1.2)) }); } },
      idle(secs) { g.sim(secs, none); },
      // the game's own camera, turned to look from `yaw` (0 looks along -z), tilted `pitch`, `zoom` times as far off as usual
      look(yaw, pitch = 0.56, zoom = 1, mode = 'point') { g.setMode(mode, true); g.cam.ease = null; g.cam.yaw = yaw; g.cam.pitch = pitch; g.cam.zoom = zoom; g.snap(); g.sim(1 / 60, none); g.cam.ease = null; g.cam.yaw = yaw; g.cam.pitch = pitch; g.snap(); },
      // the last thing before a picture: the fish is not blinking, and the camera is where it was put
      settle() { g.run.safe = 0; const c = { yaw: g.cam.yaw, pitch: g.cam.pitch }; g.sim(1 / 60, none); g.cam.ease = null; Object.assign(g.cam, c); g.snap(); g.run.safe = 0; },
      // what the plate says at this moment, and where on the screen the marker, the head and the tail are (as parts of its width and height):
      // the standalone page puts these under its menus, so that its lettering fits the still it stands over
      hud() { const $ = (id) => document.getElementById(id), st = $('stage'), w = st.clientWidth, h = st.clientHeight;
        const tr = (el) => { const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el.style.transform || ''); return m ? { x: +(m[1] / w).toFixed(6), y: +(m[2] / h).toFixed(6) } : { x: 0.5, y: 0.5 }; };
        const rot = /rotate\(([-\d.]+)deg\)/.exec($('goal-arrow').style.transform || ''), J = g.rig.joints;
        const P = (v) => { const p = v.clone().project(g.camera); return { x: +(p.x * 0.5 + 0.5).toFixed(4), y: +(-p.y * 0.5 + 0.5).toFixed(4) }; };
        const pr = $('prompt');
        return { floor: g.run.floor, segs: g.run.segs, food: +(+getComputedStyle($('scale')).getPropertyValue('--food') || 0).toFixed(3), state: g.run.state,
          goal: $('goal').style.display === 'none' ? null : { ...tr($('goal')), ang: rot ? +rot[1] : -90, here: $('goal').classList.contains('here'), label: $('goal-label').textContent },
          head: P(J[0]), tail: P(J[J.length - 1]),
          prompt: pr.classList.contains('on') ? { keys: [...pr.querySelectorAll('kbd, i')].map((k) => (k.tagName === 'I' ? 'or' : k.textContent)), verb: pr.querySelector('span').textContent, ...tr(pr) } : null }; },
      at: () => ({ x: +g.rig.pos.x.toFixed(1), y: +g.rig.pos.y.toFixed(1), z: +g.rig.pos.z.toFixed(1), up: +(g.rig.pos.y - g.world.height(g.rig.pos.x, g.rig.pos.z)).toFixed(1), segs: g.run.segs, state: g.run.state }),
    };
  });
  return page;
}

// ------------------------------------------------------------------------------------------------ the stills
// Each is a moment a menu can come up over, taken through the game's own camera (the plate view unless it says otherwise) with every
// piece of the page but the picture put away: the lettering, the scale bar, the marker, the buttons, and the shade the page lays
// over the top and the foot of the picture (#stage::after), which the standalone page lays on again itself.
const BARE = '#stage > :not(canvas) { display: none !important; } #stage::after { display: none !important; }';
const STILLS = {
  // the first moment of a dive: at the nest, as the game's own camera opens on it. The nest remembers a middling record.
  start: { storage: { 'oarfish.nest': { record: 16, shells: ['spire', 'fan', 'ring'], fragments: 1, feats: {} } }, set: () => { const g = window.__game, U = window.U; U.begin(0, 10); U.settle(); return U.at(); } },
  // the first moment of a first dive: the nursery, the paved way and its hoops (a browser that has never played, teaching on)
  nursery: { nursery: true, set: () => { const g = window.__game, U = window.U; U.begin(0, 10); U.settle(); return U.at(); } },
  // open water in the first band, among standing columns
  ruins: { set: () => { const g = window.__game, U = window.U; U.begin(0, 14); U.put(92, 66, 3.4, -1.9); U.swim(1.6, 0.7, 3.4); U.swim(1.4, -0.8, 3.4); U.look(g.rig.yaw + Math.PI + 0.5, 0.5, 1.05); U.settle(); return U.at(); } },
  // a busy moment: a long body most of the way round the great swarm of the first band
  swarm: { set: () => { const g = window.__game, U = window.U; U.begin(0, 22); const s = g.world.schools.find((x) => x.tier === 'h'); const R = 3.4;
      U.put(s.x + R, s.z, s.y - g.world.height(s.x + R, s.z), 0);
      for (let t = 0, a = 0; a < 4.1; t += 1 / 30) { a += (2.6 / R) / 30; const p = g.rig.pos; g.sim(1 / 30, { ...U.none, amount: 0.75, dir: { x: -Math.sin(a), y: 0, z: Math.cos(a) }, vertical: Math.max(-1, Math.min(1, (s.y - p.y) * 1.5)) }); }
      U.look(0.9, 0.62, 0.9); U.settle(); return { ...U.at(), left: s.left }; } },
  // the Keeper's ground at the rift: the crab come over to the fish, the mural behind, the veil over the rift at the top
  keeper: { set: () => { const g = window.__game, U = window.U; U.begin(0, 18); const k = g.guard.pos, r = g.world.rift;
      U.put(k.x - r.nx * 15 + r.tx * 6, k.z - r.nz * 15 + r.tz * 6, 2.6, Math.atan2(r.nx, r.nz) - 0.6); U.swim(0.9, 0.5, 2.6, 0.5); U.idle(2.4); // long enough for it to have come over
      U.look(Math.atan2(-r.nx, -r.nz) + 0.5, 0.5, 1.15); U.settle(); return { ...U.at(), crab: +Math.hypot(g.guard.pos.x - g.rig.pos.x, g.guard.pos.z - g.rig.pos.z).toFixed(1), mood: g.guard.state.state }; } },
  // a deeper, darker band: deep twilight, 800 m down, lit by the fish and by what glows
  deep: { set: () => { const g = window.__game, U = window.U; U.begin(3, 20); U.swim(2.2, 0.6, 3); U.swim(1.6, -0.7, 3); U.look(g.rig.yaw + Math.PI + 0.4, 0.5, 1); U.settle(); return U.at(); } },
  // the end of a dive that went badly: a short body in the twilight zone, as it is when the card comes up
  end: { set: () => { const g = window.__game, U = window.U; U.begin(2, 5); const b = g.foes.biters.filter((x) => x.alive)[0];
      U.put(b.pos.x + 3, b.pos.z + 2, 2.4, 2.4); U.swim(1.6, 0.9, 2.4, 0.7); U.look(g.rig.yaw + Math.PI - 0.6, 0.5, 1); g.run.hush = 0; Object.assign(g.run, { longest: 14, caught: 23, time: 431 }); g.die(); // (what the card will say of it: a body that had been longer, and had eaten) g.sim(1.3, U.none); while (Math.floor(g.run.stateT * 9) % 2) g.sim(1 / 60, U.none); g.snap();
      return { ...U.at(), biters: g.foes.biters.filter((x) => x.alive && Math.hypot(x.pos.x - g.rig.pos.x, x.pos.z - g.rig.pos.z) < 14).length }; } },
  // the end of a dive that went well: the surface, the raft, an empty sky
  surface: { set: () => { const g = window.__game, U = window.U; U.begin(0, 24); U.put(60, 60, 8, 1); Object.assign(g.end, { kind: 'open', turn: g.rig.yaw, swap: 0 }); g.run.state = 'rise'; g.run.stateT = 0;
      Object.assign(g.run, { longest: 26, caught: 96, hauled: 3, time: 2467 }); g.nest.fragments = 7; // what the card will say of it
      let t = 0; while (g.run.state !== 'won' && t < 60) { g.sim(0.25); t += 0.25; } g.sim(1.2, U.none); g.snap();
      document.getElementById('goal').style.display = 'none'; // in a dive played to its end the marker went when the Sum woke; this one was taken straight up from the first band
      return { ...U.at(), t }; } },
  // what stands behind the specimen library: its own stage, a creature on the turntable, set between where the list and the panel go
  library: { css: '#stage > :not(canvas):not(#library) { display: none !important; } #stage::after { display: none !important; } #library { opacity: 0 !important; }',
    set: () => { const g = window.__game; g.startRun(4242); g.openLibrary('keeper'); for (let i = 0; i < 90; i++) g.lib.frame(1 / 30); return { id: g.lib.state.id }; } },
};
async function stills() {
  const out = small ? dir(trial) : dir(path.join(UI, 'bg')), file = path.join(UI, 'bg/stills.js');
  const known = !small && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8').replace(/^[^{]*/, '').replace(/;\s*$/, '')) : {};
  for (const [name, S] of Object.entries(STILLS)) {
    if (picks.length && !picks.includes(name)) continue;
    const page = await game({ storage: S.storage, nursery: S.nursery });
    const at = await page.evaluate(S.set);
    known[name] = name === 'library' ? { library: at.id } : await page.evaluate(() => { const h = window.U.hud(); if (h.state === 'won') h.surface = true; delete h.state; return h; });
    await page.addStyleTag({ content: S.css || BARE });
    await frame(page); await frame(page);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    console.log(name, JSON.stringify(at));
    await page.context().close();
  }
  if (!small) fs.writeFileSync(file, `// Written by \`node tools/shot_ui.mjs stills\` beside the stills: what the game's plate said at the moment each was taken (the band, the\n// body's length in segments, the food on the way to the next) and where on the screen the marker, the head and the tail were, as\n// parts of its width and height. Do not edit by hand: take the stills again.\nwindow.STILLS = ${JSON.stringify(known, null, 1)};\n`);
}

// ------------------------------------------------------------------------------------------------ what the game writes by script
// The standalone page keeps none of the game's modules, so the words and lists the game builds its menus from are read off the
// running game and written to ui/game-data.js: the bands, the shells, the actions and their keys, the controller's button names,
// the creatures that can be brought to look at, every specimen of the library, and one line of what the band says it is playing.
async function dump() {
  const page = await game();
  const data = await page.evaluate(async () => {
    const g = window.__game, U = window.U, $ = (id) => document.getElementById(id);
    const { FLOORS } = await import('./game/world.js');
    U.begin(0, 10);
    const out = { from: 'tools/shot_ui.mjs dump', world: 4242 };
    out.floors = FLOORS.map((f) => ({ name: f.name, depth: f.depth, water: f.water }));
    out.shells = Object.fromEntries(Object.entries(g.SHELLS).map(([k, d]) => [k, { name: d.name, colour: d.colour, worn: d.worn, shed: d.shed }]));
    out.bring = [...$('dev-bring').children].map((b) => ({ id: b.dataset.bring, name: b.textContent }));
    g.setPaused(true); $('btn-binds').click();
    out.actions = [...document.querySelectorAll('#bind-grid > span:not(.fixed)')].map((sp) => [sp.nextElementSibling.dataset.a, sp.textContent]);
    out.stick = [...document.querySelectorAll('#bind-grid > span.fixed')].map((sp) => sp.previousElementSibling.dataset.a);
    out.binds = JSON.parse(JSON.stringify(g.binds));
    $('bind-back').click(); g.setPaused(false);
    const kind = g.pad.state.kind; out.padNames = {};
    for (const k of ['ps', 'xbox']) { g.pad.state.kind = k; out.padNames[k] = Array.from({ length: 18 }, (_, i) => g.pad.name(i)); }
    g.pad.state.kind = kind;
    // the band, a few bars in, with the Keeper near enough to sit in
    try { g.music.unlock(); const k = g.guard.pos; U.put(k.x + 8, k.z + 8, 3, 0); for (let i = 0; i < 40; i++) { g.sim(0.25, U.none); await new Promise((r) => setTimeout(r, 30)); }
      const d = g.music.describe(); out.now = d ? { text: `Now: ${d.mood}, in ${d.key}. ${d.bpm} bpm, energy ${Math.round(d.energy * 100)}%, intensity ${Math.round(d.intensity * 100)}%.${d.sitting.length ? ` Sitting in: ${d.sitting.join(', ')}.` : ''}`, energy: Math.round(g.music.energy * 100) } : null; } catch (e) { out.now = null; }
    // the library: every specimen as its panel shows it
    g.openLibrary('keeper');
    const groups = []; for (const el of $('lib-list').children) { if (el.tagName === 'H3') groups.push({ group: el.textContent, ids: [] }); else groups[groups.length - 1].ids.push(el.dataset.id); }
    out.groups = groups; out.specimens = {};
    const seg = (name) => { const el = document.querySelector(`#lib-play .seg[data-set="${name}"]`); return el ? [...el.children] : null; };
    for (const id of groups.flatMap((x) => x.ids)) {
      g.lib.pick(id);
      const band = seg('band'), state = seg('state'), tier = seg('tier'), tone = seg('tone'), speed = $('lib-speed');
      out.specimens[id] = { name: $('lib-name').textContent, role: $('lib-role').textContent, about: $('lib-about').textContent, where: $('lib-where').textContent, tris: $('lib-tris').textContent, hear: $('lib-hear').hidden ? '' : $('lib-hear').textContent,
        band: band.findIndex((b) => b.getAttribute('aria-pressed') === 'true'), home: band.map((b, i) => (b.classList.contains('home') ? i : -1)).filter((i) => i >= 0),
        states: state ? state.map((b) => b.textContent) : [], state: state ? state.findIndex((b) => b.getAttribute('aria-pressed') === 'true') : 0,
        tiers: tier ? tier.map((b) => [b.dataset.v, b.textContent]) : null, tones: tone ? tone.length : 0, speed: speed ? +speed.value : null,
        palette: [...document.querySelectorAll('#lib-palette input[type="color"]')].map((i) => [i.dataset.k, i.value]), scale: document.querySelector('#lib-palette input[type="range"]') ? +document.querySelector('#lib-palette input[type="range"]').value : null };
    }
    out.bands = seg('band').map((b) => b.title);
    return out;
  });
  const file = path.join(UI, 'game-data.js');
  fs.writeFileSync(file, `// Written by \`node tools/shot_ui.mjs dump\` from the running game (world ${data.world}): the words and lists the game builds its menus from.\n// Do not edit by hand. When the game changes, run the tool again and this file follows.\nwindow.GAME = ${JSON.stringify(data, null, 1)};\n`);
  console.log(`ui/game-data.js: ${fs.statSync(file).size} bytes, ${Object.keys(data.specimens).length} specimens, ${data.actions.length} actions; now: ${data.now ? data.now.text : 'the band would not start here'}`);
  await page.context().close();
}

// ------------------------------------------------------------------------------------------------ the standalone page, every screen and state
// The list of screens and states is the page's own (KIT.SCREENS in ui/kit.js). `?bare` is the stage with no switcher bar round it;
// `hold=1` keeps a message from timing out and stops what throbs or fades, so a picture is the same every time it is taken.
const PHONE = { width: 390, height: 844 }, PHONE_WIDE = { width: 844, height: 390 };
async function standalone(view = VIEW, touch = false) {
  const page = await (await browser.newContext({ viewport: view, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch })).newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text().slice(0, 300)); });
  page.on('request', (r) => { if (!r.url().startsWith(HOST) && !r.url().startsWith('data:')) console.log('[asked the network for]', r.url()); }); // the page is meant to ask for nothing but its own files
  return page;
}
async function open(page, screen, state, extra = '') {
  await page.goto(`${HOST}/ui/index.html?bare&hold=1&screen=${screen}&state=${state}${extra}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__kitReady === true', null, { timeout: 30000 });
  await page.evaluate(async () => { await document.fonts.ready; const u = /url\("(.*)"\)/.exec(getComputedStyle(document.getElementById('still')).backgroundImage); if (u) { const im = new Image(); im.src = u[1]; await im.decode(); } });
  await frame(page);
}
const listed = (page) => page.evaluate(() => window.KIT.SCREENS.flatMap((sc) => sc.states.map((st) => ({ id: `${sc.id}--${st.id}`, screen: sc.id, state: st.id, bg: st.bg, touch: !!st.touch, scroll: st.scroll || '', name: `${sc.name} / ${st.name}` }))));
async function shots() {
  const out = small ? dir(trial) : dir(path.join(UI, 'shots'));
  let page = await standalone();
  await open(page, 'pause', 'default');
  const list = await listed(page);
  for (const it of list) { if (picks.length && !picks.some((p) => it.id.startsWith(p))) continue; await open(page, it.screen, it.state); await page.screenshot({ path: path.join(out, `${it.id}.png`) }); console.log(it.id); }
  await page.context().close();
  // the touch layout at the size of a phone, upright and on its side: the game has rules for narrow screens (index.html, lines 154 to 161 and 297 to 323)
  for (const [tag, view] of [['phone', PHONE], ['phone-wide', PHONE_WIDE]]) {
    page = await standalone(view, true);
    for (const id of ['hud--touch', 'pause--touch', 'library--default', 'end--taken']) { if (picks.length && !picks.some((p) => `${id}@${tag}`.startsWith(p))) continue; const [screen, state] = id.split('--'); await open(page, screen, state, '&touch=1'); await page.screenshot({ path: path.join(out, `${id}@${tag}.png`) }); console.log(`${id}@${tag}`); }
    await page.context().close();
  }
}

// ------------------------------------------------------------------------------------------------ the same screens in the real game
// For each: the real game is taken to the moment of the state's still (the same steps that took the still), the menu is opened in it
// as a player would open it, and its own picture is put away behind the still itself, so that the game's page and the standalone
// copy stand over the very same pixels and whatever differs between the two pictures is a difference in the menus.
const fakePad = () => { const pad = { id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 18 }, () => ({ pressed: false, value: 0 })), vibrationActuator: { playEffect: () => Promise.resolve('complete') } };
  Object.defineProperty(navigator, 'getGamepads', { value: () => [pad, null, null, null], configurable: true }); const g = window.__game; pad.buttons[3] = { pressed: true, value: 1 }; g.sim(0.05); pad.buttons[3] = { pressed: false, value: 0 }; g.sim(0.05); };
const RECIPES = {
  'hud--plain': () => {},
  'hud--full': () => { window.__game.setFull(true, true); },
  'hud--full-look': () => { const g = window.__game; g.setFull(true, true); g.setMode('look', true); },
  'hud--shells': () => { const g = window.__game; for (const t of ['spire', 'horn', 'lamp']) g.giveShell(t); g.run.food = 0.6 * g.growCost(g.run.segs, g.mods.food); g.sim(1 / 60, window.U.none); },
  'drawer--default': () => { const g = window.__game; g.setFull(true, true); document.getElementById('music-tab').click(); g.setPaused(true); g.sim(1e-6); g.setPaused(false); }, // (the click starts the band; a paused frame writes what it is playing)
  'pause--default': () => { window.__game.setPaused(true); },
  'pause--lower': () => { window.__game.setPaused(true); },
  'pause--controller': [fakePad, () => { window.__game.setPaused(true); }],
  'pause--shells': () => { const g = window.__game; for (const t of ['spire', 'horn', 'lamp']) g.giveShell(t); g.setPaused(true); },
  'pause--look': () => { const g = window.__game; g.setMode('look', true); g.setPaused(true); },
  'pause--armed': () => { window.__game.setPaused(true); document.getElementById('btn-new').click(); },
  'pause--full': () => { const g = window.__game; g.setFull(true, true); g.setPaused(true); },
  'binds--default': () => { window.__game.setPaused(true); document.getElementById('btn-binds').click(); },
  'binds--waiting': () => { window.__game.setPaused(true); document.getElementById('btn-binds').click(); document.querySelector('#bind-grid button[data-a="wrap"][data-k="0"]').click(); },
  'feedback--empty': () => { window.__game.setPaused(true); document.getElementById('btn-note').click(); },
  // (wait for the end card, as a player must: it comes up on a timer that gives its own button the keyboard)
  'feedback--from-end': async () => { await new Promise((r) => { const t = () => (document.getElementById('end').classList.contains('on') ? setTimeout(r, 50) : setTimeout(t, 50)); t(); }); document.getElementById('btn-note-end').click(); },
  'end--taken': () => {},
  'end--over': () => {},
  'library--default': () => {},
};
const HOLD = '*, *::before, *::after { animation-play-state: paused !important; transition: none !important; caret-color: transparent !important; }';
async function compare() {
  const out = dir(path.join(ROOT, 'out/ui-compare'));
  const copy = await standalone();
  await open(copy, 'pause', 'default');
  const list = await listed(copy);
  const total = [];
  for (const it of list) {
    if (!RECIPES[it.id] || (picks.length && !picks.some((p) => it.id.startsWith(p)))) continue;
    const S = STILLS[it.bg], page = await game({ storage: S.storage, nursery: S.nursery });
    await page.addStyleTag({ content: HOLD }); // from the start, as the copy has it (hold=1): what throbs is stopped at the same point in both
    await page.evaluate(S.set);
    for (const step of [].concat(RECIPES[it.id])) await page.evaluate(step);
    await page.waitForTimeout(1100); // the end card comes up nine tenths of a second after the dive ends, by the clock
    // One frame of the game's own loop, which this script has been holding back: it is what reads the controller and writes the line about
    // it. Only while the dive is paused, when a frame moves nothing in the water. Then the menu is scrolled as the state has it.
    await page.evaluate((scroll) => { const g = window.__game; if (g.paused) g.sim(1e-6); if (scroll === 'end') document.getElementById('pause').scrollTop = 1e6;
      if (g.run.state === 'dead' || g.run.state === 'won') document.getElementById('toast').classList.remove('on'); }, it.scroll || ''); // (a message can still be up under the end card; which one is chance, so it is put away here)
    await page.evaluate(([bg, hold]) => { const st = document.getElementById('stage'), c = st.querySelector('canvas'); c.style.display = 'none';
      const still = document.createElement('canvas'); still.id = 'still'; still.style.background = `url(/ui/bg/${bg}.png) center / cover no-repeat`; st.prepend(still);
      }, [it.bg]);
    await page.evaluate(async () => { const im = new Image(); im.src = /url\("(.*)"\)/.exec(getComputedStyle(document.getElementById('still')).backgroundImage)[1]; await im.decode(); });
    await frame(page); await page.screenshot({ path: path.join(out, `${it.id}.game.png`) });
    await page.context().close();
    await open(copy, it.screen, it.state);
    await copy.screenshot({ path: path.join(out, `${it.id}.copy.png`) });
    // count what differs, and lay the two side by side with the differences marked between them
    const res = await copy.evaluate(async ([a, b]) => {
      const load = async (u) => { const im = new Image(); im.src = u; await im.decode(); return im; }, [A, B] = await Promise.all([load(a), load(b)]), w = A.width, h = A.height;
      const cv = Object.assign(document.createElement('canvas'), { width: w * 3, height: h }), x = cv.getContext('2d', { willReadFrequently: true });
      x.drawImage(A, 0, 0); x.drawImage(B, w * 2, 0);
      const da = x.getImageData(0, 0, w, h).data, db = x.getImageData(w * 2, 0, w, h).data, mid = x.createImageData(w, h);
      let n = 0, far = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let i = 0, p = 0; i < da.length; i += 4, p++) { const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])); const g = (da[i] + da[i + 1] + da[i + 2]) / 9;
        if (d > 2) { n++; if (d > 40) far++; const px = p % w, py = (p / w) | 0; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; mid.data[i] = 255; mid.data[i + 1] = d > 40 ? 0 : 200; mid.data[i + 2] = 0; } else { mid.data[i] = mid.data[i + 1] = mid.data[i + 2] = g; } mid.data[i + 3] = 255; }
      x.putImageData(mid, w, 0);
      return { n, far, share: +(100 * n / (w * h)).toFixed(3), box: n ? [x0, y0, x1, y1] : null, png: cv.toDataURL('image/png') };
    }, [`${HOST}/out/ui-compare/${it.id}.game.png`, `${HOST}/out/ui-compare/${it.id}.copy.png`]);
    fs.writeFileSync(path.join(out, `${it.id}.side.png`), Buffer.from(res.png.split(',')[1], 'base64'));
    total.push({ id: it.id, differ: res.n, share: res.share, far: res.far, box: res.box });
    console.log(`${it.id}: ${res.n} pixels differ (${res.share}%), ${res.far} of them by a lot${res.box ? `, within ${res.box.join(',')}` : ''}`);
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(total, null, 1));
  await copy.context().close();
}

// ------------------------------------------------------------------------------------------------ the layers, for Figma
// The page as it is drawn, read back as boxes and lines of text: every element that shows, where it is, its fill, border, corners,
// blur and shadow, and every run of text with its typeface, size, spacing and colour, nested as the markup nests. ui/figma/build.js
// turns one of these into editable layers in Figma (text as text, panels as shapes, the still as a picture behind). One file per
// state: out/ui-figma/<screen>--<state>.json. The native controls (tick boxes, sliders, text fields, a menu) are drawn as Chrome
// draws them, near enough; the scale bar's ticks, which are a repeating gradient, become one line per segment.
function readLayers() {
  const W = innerWidth, H = innerHeight, cs = (el) => getComputedStyle(el);
  const col = (s) => { if (!s || s === 'transparent') return null; let m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(s);
    if (m) { const a = m[4] === undefined ? 1 : +m[4]; return a < 0.004 ? null : [+(m[1] / 255).toFixed(4), +(m[2] / 255).toFixed(4), +(m[3] / 255).toFixed(4), +a.toFixed(3)]; }
    m = /color\(srgb\s+([-\d.e]+)\s+([-\d.e]+)\s+([-\d.e]+)(?:\s*\/\s*([\d.]+))?\)/.exec(s);
    if (m) { const a = m[4] === undefined ? 1 : +m[4]; return a < 0.004 ? null : [+(+m[1]).toFixed(4), +(+m[2]).toFixed(4), +(+m[3]).toFixed(4), +a.toFixed(3)]; } return null; };
  const shadows = (s, inset = false) => { if (!s || s === 'none') return []; const out = [];
    for (const part of s.split(/,(?![^(]*\))/)) { const c = col(/(rgba?\([^)]*\)|color\([^)]*\))/.exec(part)?.[1]); const n = (part.replace(/(rgba?\([^)]*\)|color\([^)]*\))/, '').match(/-?[\d.]+px/g) || []).map(parseFloat);
      if (!c || n.length < 3) continue; const isIn = /inset/.test(part); if (isIn !== inset && !inset) { if (isIn) out.push({ in: 1, c, x: n[0], y: n[1], b: n[2], s: n[3] || 0 }); continue; } out.push({ in: isIn ? 1 : 0, c, x: n[0], y: n[1], b: n[2], s: n[3] || 0 }); } return out; };
  const fam = (f) => f.split(',')[0].trim().replace(/["']/g, '');
  const name = (el) => (el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}${el.classList.length ? '.' + [...el.classList].join('.') : ''}`);
  const shown = (el, s) => s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.01;
  const textOf = (node, s) => (s.whiteSpace.startsWith('pre') ? node.textContent : node.textContent.replace(/\s+/g, ' '));
  const tstyle = (s) => { const sh = shadows(s.textShadow); return { f: fam(s.fontFamily), wt: +s.fontWeight, it: s.fontStyle === 'italic' ? 1 : 0, sz: parseFloat(s.fontSize), lh: s.lineHeight === 'normal' ? null : parseFloat(s.lineHeight), ls: s.letterSpacing === 'normal' ? 0 : parseFloat(s.letterSpacing), c: col(s.color), op: 1, sh: sh[0] || null, tt: s.textTransform }; };
  function texts(el, s, box, kids) {
    const pure = [...el.childNodes].every((n) => n.nodeType === 3 || n.tagName === 'BR');
    const all = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
    for (const node of all) {
      const r = document.createRange(); r.selectNodeContents(node); const rects = [...r.getClientRects()].filter((q) => q.width > 0);
      if (!rects.length) continue; const u = r.getBoundingClientRect(); const st = tstyle(s);
      if (pure || rects.length === 1) {
        const pad = parseFloat(s.paddingLeft) + parseFloat(s.borderLeftWidth), padR = parseFloat(s.paddingRight) + parseFloat(s.borderRightWidth);
        const wrap = rects.length > 1 || (pure && el.textContent.includes('\n') && s.whiteSpace.startsWith('pre'));
        const x = wrap ? box.left + pad : u.left, w = wrap ? box.width - pad - padR : u.width;
        kids.push({ t: 't', n: el.id ? `${name(el)} text` : 'text', x: x - box.left, y: u.top - box.top, w, h: u.height, s: pure ? [...el.childNodes].map((n) => (n.tagName === 'BR' ? '\n' : textOf(n, s))).join('').trim() : textOf(node, s).trim(), al: s.textAlign, wrap: wrap ? 1 : 0, ...st });
        if (pure) break; continue;
      }
      // a run that starts or ends inside a line of mixed text: one text per line it lies on
      const words = [...node.textContent.matchAll(/\S+\s*/g)]; let line = null; const lines = [];
      for (const wm of words) { const wr = document.createRange(); wr.setStart(node, wm.index); wr.setEnd(node, wm.index + wm[0].length); const q = [...wr.getClientRects()].filter((x) => x.width > 0)[0]; if (!q) continue;
        if (line && Math.abs(q.top - line.top) < 3) { line.s += wm[0]; line.r = Math.max(line.r, q.right); } else { line = { top: q.top, l: q.left, r: q.right, h: q.height, s: wm[0] }; lines.push(line); } }
      for (const ln of lines) kids.push({ t: 't', n: 'text', x: ln.l - box.left, y: ln.top - box.top, w: ln.r - ln.l, h: ln.h, s: ln.s.replace(/\s+/g, ' ').trim(), al: 'left', wrap: 0, ...st });
    }
  }
  function svg(el, box) { const c = el.cloneNode(true); const src = [el, ...el.querySelectorAll('*')], dst = [c, ...c.querySelectorAll('*')];
    src.forEach((n, i) => { const s = cs(n); for (const k of ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity']) { const v = s.getPropertyValue(k); if (v) dst[i].setAttribute(k, k === 'fill' || k === 'stroke' ? (col(v) ? `rgb(${col(v).slice(0, 3).map((x) => Math.round(x * 255)).join(',')})` : 'none') : v); }
      const sv = col(s.stroke); if (sv && sv[3] < 1) dst[i].setAttribute('stroke-opacity', sv[3]); });
    c.setAttribute('width', box.width); c.setAttribute('height', box.height); c.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); return c.outerHTML; }
  function walk(el, pbox) {
    const s = cs(el); if (!shown(el, s)) return null;
    const b = el.getBoundingClientRect(); if (el.id === 'still') return null;
    const node = { t: 'f', n: name(el), x: b.left - pbox.left, y: b.top - pbox.top, w: b.width, h: b.height, op: +s.opacity < 1 ? +s.opacity : undefined, z: s.position !== 'static' && s.zIndex !== 'auto' ? +s.zIndex : undefined, kids: [] };
    if (el.tagName === 'svg') { if (!b.width) return null; return { t: 'svg', n: name(el), x: node.x, y: node.y, w: b.width, h: b.height, svg: svg(el, b), op: node.op }; }
    node.fill = col(s.backgroundColor) || undefined;
    const sides = ['Top', 'Right', 'Bottom', 'Left'].map((k) => [parseFloat(s[`border${k}Width`]) || 0, col(s[`border${k}Color`])]); if (sides.some(([w, c]) => w && c)) { const c = sides.find(([w, c]) => w && c)[1]; node.stroke = { c, w: sides.map(([w, cc]) => (cc ? w : 0)) }; }
    const rad = parseFloat(s.borderTopLeftRadius) || 0; if (rad) node.r = Math.min(rad, b.width / 2, b.height / 2);
    const bf = /blur\(([\d.]+)px\)/.exec(s.backdropFilter); if (bf) node.blur = +bf[1];
    const sh = shadows(s.boxShadow); if (sh.length) node.fx = sh;
    if (s.overflowY !== 'visible' || s.overflowX !== 'visible') node.clip = 1;
    const cp = /polygon\(([^)]*)\)/.exec(s.clipPath); if (cp) { const pts = cp[1].split(',').map((p) => p.trim().split(/\s+/).map((v, i) => (parseFloat(v) / 100) * (i ? b.height : b.width)).join(',')).join(' '); return { t: 'svg', n: name(el), x: node.x, y: node.y, w: b.width, h: b.height, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${b.width}" height="${b.height}" viewBox="0 0 ${b.width} ${b.height}"><polygon points="${pts}" fill="rgb(${(col(s.backgroundColor) || [1, 1, 1]).slice(0, 3).map((x) => Math.round(x * 255)).join(',')})"/></svg>`, op: node.op }; }
    if (/linear-gradient/.test(s.backgroundImage) && el.id !== 'scale-bar') node.grad = s.backgroundImage;
    // native controls
    if (el.tagName === 'INPUT' && el.type === 'checkbox') { node.ctl = { k: 'check', on: el.checked ? 1 : 0 }; return node; }
    if (el.tagName === 'INPUT' && el.type === 'range') { node.ctl = { k: 'range', v: (el.value - el.min) / ((el.max - el.min) || 1), c: col(s.accentColor) }; return node; }
    if (el.tagName === 'INPUT' && el.type === 'color') { node.ctl = { k: 'swatch', c: col(el.value.replace(/^#(..)(..)(..)$/, (m, r, g, bb) => `rgb(${parseInt(r, 16)},${parseInt(g, 16)},${parseInt(bb, 16)})`)) }; return node; }
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
      const v = el.tagName === 'SELECT' ? (el.selectedOptions[0]?.textContent || '') : el.value, ph = !v && el.placeholder;
      const st = tstyle(s); if (ph) { const p = cs(el, '::placeholder'); st.c = col(getComputedStyle(el, '::placeholder').color) || st.c; }
      const pl = parseFloat(s.paddingLeft) + parseFloat(s.borderLeftWidth), pt = parseFloat(s.paddingTop) + parseFloat(s.borderTopWidth);
      node.kids.push({ t: 't', n: ph ? 'placeholder' : 'value', x: pl, y: pt, w: b.width - pl * 2 - (el.tagName === 'SELECT' ? 18 : 0), h: b.height - pt * 2, s: (v || ph || '').trim(), al: 'left', wrap: el.tagName === 'TEXTAREA' ? 1 : 0, ...st });
      if (el.tagName === 'SELECT') node.ctl = { k: 'select', c: col(s.color) };
      return node;
    }
    if (el.id === 'scale-bar') { const tick = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tick')) || 11; const c = col(s.borderBottomColor);
      for (let x = 0; x < b.width - 0.5; x += tick) node.kids.push({ t: 'f', n: 'tick', x, y: 0, w: 1, h: b.height, fill: c, kids: [] }); }
    texts(el, s, b, node.kids);
    for (const ch of el.children) { const k = walk(ch, b); if (k) node.kids.push(k); }
    if (!node.kids.length) delete node.kids;
    return node;
  }
  const stage = document.getElementById('stage'), root = walk(stage, stage.getBoundingClientRect());
  const after = getComputedStyle(stage, '::after'); root.after = after.content !== 'none' && after.display !== 'none' ? after.backgroundImage : null;
  return { w: W, h: H, title: document.title, root };
}
async function layers() {
  const out = dir(path.join(ROOT, 'out/ui-figma')), page = await standalone();
  await open(page, 'pause', 'default');
  const list = await listed(page);
  const want = picks.length ? list.filter((it) => picks.some((p) => it.id.startsWith(p))) : list;
  for (const it of want) { await open(page, it.screen, it.state); const data = await page.evaluate(readLayers); data.id = it.id; data.bg = await page.evaluate(() => (/bg\/(\w+)\.png/.exec(getComputedStyle(document.getElementById('still')).backgroundImage) || [])[1] || null);
    const json = JSON.stringify(data, (k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)); fs.writeFileSync(path.join(out, `${it.id}.json`), json); console.log(it.id, `${json.length} bytes`); }
  await page.context().close();
}

if (mode === 'stills') await stills();
if (mode === 'layers') await layers();
if (mode === 'game') await compare();
if (mode === 'page') await shots();
if (mode === 'dump') await dump();
await browser.close(); server.close();
