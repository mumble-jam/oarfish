// Scripted checks of the specimen library and of the components behind it: the library and the game make the same creatures.
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
await page.addInitScript(() => { window.__noNursery = true; });
await page.addInitScript(() => { try { const f = JSON.parse(localStorage.getItem('oarfish.feel') || '{}'); if (!f.mode) localStorage.setItem('oarfish.feel', JSON.stringify({ ...f, mode: 'point' })); } catch {} }); // made on the plate camera, the default when this was written: ask for it, unless a camera was chosen in this page
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
const ev = (fn, arg) => page.evaluate(fn, arg);
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const snap = async (name) => { if (!shots) return; await frame(); await page.screenshot({ path: out(name) }); };
const vis = (sel) => ev((s) => { const el = document.querySelector(s); return !!el && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0; }, sel);

// ---- opening it from the pause menu
await page.keyboard.press('KeyP'); await page.waitForTimeout(200); await page.click('#btn-library'); await frame();
let s = await ev(() => ({ open: window.__game.lib.isOpen, paused: window.__game.paused, list: [...document.querySelectorAll('#lib-list button')].map((b) => b.dataset.id), groups: [...document.querySelectorAll('#lib-list h3')].map((h) => h.textContent), name: document.getElementById('lib-name').textContent, hash: location.hash }));
check('the pause menu opens the specimen library: the oarfish, every creature, shell, plant and piece of stone, and the two colour sets, in their groups', s.open && s.paused && s.list.length === 77 && /* 74, and the quiet side's three: giant kelp, coral head, sea rod */  s.groups.join() === 'The oarfish,Swarms,Company,Rivals,Hunters,Keepers of the rifts,The Sum,Not yet in the dive,Shells,Loose things,Things that grow,On the bed,Stonework,Colours of the world' && s.name === 'The oarfish' && s.hash === '#library/oarfish' && !(await vis('#pause')) && !(await vis('.foot')) && (await vis('#lib-panel')), JSON.stringify(s));
await snap('l-oarfish');

// ---- one playground: the biter
await page.click('#lib-list [data-id="biter"]'); await frame();
s = await ev(() => { const g = window.__game, L = g.lib.state; return { name: document.getElementById('lib-name').textContent, where: document.getElementById('lib-where').textContent, tris: document.getElementById('lib-tris').textContent, states: [...document.querySelectorAll('[data-set="state"] button')].map((b) => b.textContent), band: L.band, speed: L.speed, sw: document.querySelectorAll('#lib-palette input[type=color]').length, home: [...document.querySelectorAll('[data-set="band"] .home')].map((b) => b.textContent).join('') }; });
check('a playground names the creature, says where it lives and how big it is, and offers its states, the light of each depth and its palette', s.name === 'Tail-biter' && /edge of light/.test(s.where) && /0\.9 m long/.test(s.where) && parseInt(s.tris) > 100 && s.states.join() === 'Roaming,Hunting,Stunned' && s.band === 1 && s.speed === 1.2 && s.sw === 8 && s.home === '2345', JSON.stringify(s));
await page.click('[data-set="state"] button:nth-child(2)'); await page.click('[data-set="band"] button:nth-child(4)'); await frame();
s = await ev(() => { const L = window.__game.lib; const a = L.scene.background.getHexString(); const before = L.scene.children.length; return { speed: L.state.speed, slider: document.getElementById('lib-speed').value, water: a, band: L.state.band }; });
check('choosing a state sets its speed, and choosing a depth relights the stage', s.speed === 3.8 && s.slider === '3.8' && s.band === 3 && s.water === '0a2444', JSON.stringify(s));
await snap('l-biter');

// ---- the same component in the game: a change made here is the game's too
s = await ev(() => { const g = window.__game, inp = document.querySelector('#lib-palette input[data-k="fins"]'); inp.value = '#20c0b0'; inp.dispatchEvent(new Event('input', { bubbles: true })); const sz = document.querySelector('#lib-palette input[data-k="scale"]'); sz.value = '1.3'; sz.dispatchEvent(new Event('input', { bubbles: true })); return { saved: localStorage.getItem('oarfish.npc') }; });
await page.waitForTimeout(400); await frame();
await page.click('#lib-copy'); await page.waitForTimeout(100);
const copied = await ev(() => ({ text: document.getElementById('lib-text').value, dot: !!document.querySelector('#lib-list [data-id="biter"] i'), note: document.getElementById('lib-note').textContent }));
await snap('l-biter-teal');
await page.keyboard.press('Escape'); await page.waitForTimeout(150);
s = { ...s, ...copied, ...(await ev(() => { const g = window.__game; const closed = !g.lib.isOpen, msg = document.getElementById('pause-msg').textContent; g.setPaused(false); g.startRun(4242); g.enterFloor(1, false); g.sim(0.2);
  const b = g.foes.biters[0], col = b.actor.body.geometry.attributes.color, want = [0x20 / 255, 0xc0 / 255, 0xb0 / 255].map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))); let hit = 0;
  for (let i = 0; i < col.count; i++) if (Math.abs(col.getX(i) - want[0]) < 0.004 && Math.abs(col.getY(i) - want[1]) < 0.004 && Math.abs(col.getZ(i) - want[2]) < 0.004) hit++;
  return { closed, msg, fins: b.actor.look.palette.fins, scale: +b.mesh.scale.x.toFixed(2), teal: hit, shared: g.foes.biters[1].actor.body.geometry === b.actor.body.geometry }; })) };
check('a colour and a size changed in the library are kept, can be copied as a note for Claude, and are what the game makes on the next dive', /"fins":"#20c0b0"/.test(s.saved) && /biter: fins #20c0b0, scale 1\.3/.test(s.text) && s.dot && /Copied/.test(s.note) && s.closed && /next band or dive/.test(s.msg) && s.fins === '#20c0b0' && s.scale === 1.3 && s.teal > 30 && s.shared, JSON.stringify(s).slice(0, 700));

// ---- swarms, the big ones, and resetting
await ev(() => { window.__game.setPaused(true); window.__game.openLibrary('lanternfish'); }); await frame();
await page.click('[data-set="tier"] button:nth-child(4)'); await page.click('[data-set="state"] button:nth-child(2)'); await ev(() => { window.__game.lib.frame(0.5); }); await frame();
s = await ev(() => { const L = window.__game.lib; let inst = 0; L.scene.traverse((o) => { if (o.isInstancedMesh) inst = o.count; }); return { inst, band: L.state.band, name: document.getElementById('lib-name').textContent }; });
check('a swarm is shown as a swarm, at any of its four sizes', s.inst === 70 && s.band >= 2 && s.band <= 3 && s.name === 'Lanternfish', JSON.stringify(s));
await snap('l-lantern');
const everything = await ev(() => [...document.querySelectorAll('#lib-list button')].map((b) => b.dataset.id));
for (const id of everything) { await page.click(`#lib-list [data-id="${id}"]`); await ev(() => { window.__game.lib.frame(0.3); }); await frame(); await snap(`l-${id}`); }
s = await ev(() => { const L = window.__game.lib; let meshes = 0; L.scene.traverse((o) => { if (o.isMesh) meshes++; }); return { id: L.state.id, meshes }; });
await page.click('#lib-all'); await frame();
s = { ...s, ...(await ev(() => ({ saved: localStorage.getItem('oarfish.npc'), dot: !!document.querySelector('#lib-list i'), copy: document.getElementById('lib-copy').disabled }))) };
check('every specimen opens without an error, and Reset all puts the components back as the code has them', s.id === 'stone' && s.meshes >= 2 && s.saved === '{}' && !s.dot && s.copy, JSON.stringify(s));
await page.keyboard.press('ArrowUp'); await frame();
check('the arrow keys step through the list', (await ev(() => window.__game.lib.state.id)) === 'paint');

// ---- things other than creatures: what is changed here is the game's, some of it at once
await page.click('#lib-list [data-id="shell-fan"]'); await frame();
s = await ev(() => { const g = window.__game; g.lib.close(); g.setPaused(false); g.startRun(4242); g.giveShell('fan'); g.sim(0.2); g.setPaused(true); g.openLibrary('shell-fan'); const set = (id, k, v) => { g.lib.pick(id); const i = document.querySelector(`#lib-palette input[data-k="${k}"]`); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); };
  set('shell-fan', 'colour', '#30c080'); set('oarfish', 'finRed', '#2040ff'); set('kelp', 'tone1', '#ff00aa'); set('paint', 'band1', '#00ffcc'); set('stone', 'band1', '#808080'); g.lib.frame(0.3);
  const text = (() => { document.getElementById('lib-copy').click(); return document.getElementById('lib-text').value; })(); g.lib.close();
  const dot = document.querySelector('#scale-shells i').style.background, fin = g.scene.getObjectsByProperty('isSkinnedMesh', true).find((o) => Array.isArray(o.material)).material.find((m) => m.name === 'FinRed').color.getHexString(); // (the fish: the Keeper's feelers are skinned too now, so the first skinned thing in the scene is no longer it)
  g.setPaused(false); g.startRun(4242); g.sim(0.2); let kelp = 0, cap = 0, grey = 0; const hex = (m, i) => { const a = m.instanceColor; return [a.getX(i), a.getY(i), a.getZ(i)].map((x) => Math.round(255 * (x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055)).toString(16).padStart(2, '0')).join(''); };
  g.scene.traverse((o) => { if (!o.isInstancedMesh || !o.instanceColor) return; for (let i = 0; i < Math.min(o.count, 400); i++) { const h = hex(o, i); if (h === 'ff00aa') kelp++; if (h === '00ffcc') cap++; if (h === '808080') grey++; } });
  return { text, dot, fin, kelp, cap, grey, tint: g.guard ? 1 : 0 }; });
check('a shell and the oarfish change in the running dive; kelp, the district paint and the stone change in the next one; all of it copies as one note', /shell-fan: colour #30c080/.test(s.text) && /oarfish: finRed #2040ff/.test(s.text) && /kelp: tone1 #ff00aa/.test(s.text) && /paint: band1 #00ffcc/.test(s.text) && /rgb\(48, 192, 128\)/.test(s.dot) && s.fin === '2040ff' && s.kelp > 3 && s.cap > 10 && s.grey > 10, JSON.stringify(s).slice(0, 600));
await ev(() => { const g = window.__game; g.setPaused(true); g.openLibrary('stone'); document.getElementById('lib-all').click(); });

// ---- a link straight to one specimen
await page.goto(`${url}#library/angler`, { waitUntil: 'domcontentloaded' }); await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 }); await frame();
s = await ev(() => ({ open: window.__game.lib.isOpen, id: window.__game.lib.state.id, lure: !!window.__game.lib.scene.getObjectByProperty('isSprite', true) }));
check('a link ending in #library/angler opens the library on the angler, lure and all', s.open && s.id === 'angler' && s.lure, JSON.stringify(s));
// what answers the fish shows that answer on the stand: the anemone shut, the kelp leaning; and the pilot fish is a creature like the rest
s = await ev(async () => { const g = window.__game, L = g.lib, held = () => { let v = null; L.scene.traverse((o) => { if (o.isInstancedMesh && o.material.userData.near) v = o.material.userData.near.value; }); return v; }, out = {};
  for (const id of ['anemone', 'kelp']) { L.pick(id); const states = [...document.querySelectorAll('[data-set="state"] button')]; out[id] = { states: states.map((b) => b.textContent), open: held() }; states[1].click(); for (let i = 0; i < 40; i++) L.frame(1 / 30); out[id].near = held(); document.querySelector('[data-set="state"] button').click(); for (let i = 0; i < 150; i++) L.frame(1 / 30); out[id].back = held(); }
  const N = await import('/game/npc.js'), tuck = N.NPC.anemone.build().attributes.tuck; let most = 0; for (let i = 0; i < tuck.count; i++) most = Math.max(most, tuck.getW(i));
  L.pick('pilot'); out.pilot = { name: document.getElementById('lib-name').textContent, states: [...document.querySelectorAll('[data-set="state"] button')].map((b) => b.textContent), tris: parseInt(document.getElementById('lib-tris').textContent, 10) };
  L.pick('chime'); out.chime = document.getElementById('lib-name').textContent;
  return { ...out, most, kelpTuck: !!N.NPC.kelp.build().attributes.tuck, give: N.NPC.kelp.material.give, shy: N.NPC.anemone.material.shy }; });
check('on the stand, an anemone can be shown shut and kelp leaning, each opening again slowly; the pilot fish and the chime are there with the rest',
  s.anemone.states.length === 2 && s.anemone.open === 0 && s.anemone.near > 0.95 && s.anemone.back < 0.05 && s.kelp.near > 0.95 && s.most > 0.8 && !s.kelpTuck && s.give > 0 && s.shy === 1 && s.pilot.name === 'Pilot fish' && s.pilot.states.length === 2 && s.pilot.tris > 60 && s.pilot.tris < 200 && s.chime === 'Chime', JSON.stringify(s));
// ---- the squid: a rival in the first band, the only one of its group. On the stand each arm is a piece of its own and trails by itself; a shoal of five lives in the first band and in no other
s = await ev(async () => { const g = window.__game, L = g.lib, N = await import('/game/npc.js'), M = await import('/game/music.js'); L.pick('squid'); L.frame(0.3);
  const btn = document.querySelector('#lib-list [data-id="squid"]'); let head = btn.previousElementSibling; while (head && head.tagName !== 'H3') head = head.previousElementSibling;
  const out = { name: document.getElementById('lib-name').textContent, where: document.getElementById('lib-where').textContent, group: head?.textContent, first: btn.previousElementSibling?.tagName === 'H3', states: [...document.querySelectorAll('[data-set="state"] button')].map((b) => b.textContent).join(),
    tris: parseInt(document.getElementById('lib-tris').textContent, 10), cast: !!M.CAST.squid, bands: N.NPC.squid.bands.length, pieces: 0 };
  L.scene.traverse((o) => { if (o.isSkinnedMesh) out.pieces++; });
  // one of its own, run through its states as the stand runs them. Everything is read off the rig: where each arm's tip is, as the body sees it (+z ahead of the head)
  const a = N.make('squid'), R = a.rig, arms = R.arms.filter((x) => !x.def.club), long = R.arms.filter((x) => x.def.club), tip = (x) => x.st.local[x.st.n], mean = (l) => l.reduce((t, v) => t + v, 0) / l.length;
  const wide = () => mean(arms.map((x) => Math.hypot(tip(x).x, tip(x).y))), reach = () => mean(arms.map((x) => x.st.reach)), state = (id) => N.NPC.squid.states.find((x) => x.id === id);
  const run = (id, secs, each) => { const st = state(id); for (let k = 0; k < Math.round(secs * 60); k++) { R.show(1 / 60, st, st.speed || 0); each?.(); } };
  run('hover', 4); const was = arms.map((x) => tip(x).clone()); let ripple = 0; run('hover', 1.5, () => { ripple = Math.max(ripple, R.pose.ripple); });
  const moved = arms.map((x, i) => tip(x).clone().sub(was[i])); let differ = 0; for (let i = 0; i < moved.length; i++) for (let j = 0; j < i; j++) differ = Math.max(differ, moved[i].distanceTo(moved[j]));
  out.hover = { wide: wide(), reach: reach(), differ, least: Math.min(...moved.map((v) => v.length())), ripple, fold: R.pose.fold };
  let lo = 9, hi = -9, fold = 0, close = 9, straight = 0, ahead = 0; run('jet', 2); run('jet', 2, () => { lo = Math.min(lo, R.pose.pulse); hi = Math.max(hi, R.pose.pulse); fold = Math.max(fold, R.pose.fold); close = Math.min(close, wide()); straight = Math.max(straight, reach()); ahead = Math.max(ahead, Math.min(...arms.map((x) => tip(x).z))); }); out.jet = { wide: close, reach: straight, lo, hi, fold, ahead };
  let left = 9, right = -9; run('turn', 6, () => { const x = mean(arms.map((v) => tip(v).x)); left = Math.min(left, x); right = Math.max(right, x); }); out.turn = { swing: right - left };
  let pale = 0, pink = 9; run('alarm', 2, () => { pale = Math.max(pale, R.pose.blanch); pink = Math.min(pink, R.pose.blanch); }); out.alarm = { wide: wide(), pale, pink };
  let dark = 0, open = 0; run('bluff', 2, () => { dark = Math.min(dark, R.pose.blanch); open = Math.max(open, wide()); }); out.bluff = { dark, wide: open };
  let flee = 0; run('flee', 2, () => { flee = Math.max(flee, R.pose.blanch); }); out.flee = { pale: flee, fold: R.pose.fold };
  let shot = 0, club = 0, armsOut = 0; run('reach', 6.4, () => { shot = Math.max(shot, ...long.map((x) => tip(x).z)); club = Math.max(club, R.pose.club); armsOut = Math.max(armsOut, ...arms.map((x) => tip(x).z)); }); out.reach = { shot, club, armsOut };
  a.dispose();
  // and in the dive: a shoal of them in the first band, and none in the others
  L.close(); g.setPaused(false); out.dive = []; for (let f = 0; f < 5; f++) { g.startRun(4242); if (f) g.enterFloor(f, false); g.sim(0.2); let n = 0; g.scene.traverse((o) => { if (o.name === 'squid') n++; }); out.dive.push(n); }
  return out; });
check('the squid is in the library, among the rivals, with ten arms that are each a piece and each move their own way: loose and curled when it hovers, together and streaming when it jets, swinging when it turns, thrown wide and pale when alarmed, the two long ones shot out to reach; bluffing it spreads wide and darkens, fleeing it jets pale. A shoal of five lives in the first band, and no other band has one',
  s.name === 'Squid' && /sunlight zone/.test(s.where) && s.group === 'Rivals' && s.first && s.states === 'Hovering,Jetting,Turning,Alarmed,Reaching,Bluffing: big and dark, giving ground,Pale, jetting away' && s.pieces === 10 && s.tris > 800 && s.tris < 1800 && s.cast && s.bands === 1
  && s.bluff.dark < -0.6 && s.bluff.wide > s.hover.wide * 1.5 && s.flee.pale > 0.8 && s.flee.fold > 0.3
  && s.hover.reach < 0.9 && s.hover.wide > 0.3 && s.hover.differ > 0.08 && s.hover.least > 0.01 && s.hover.ripple > 0.3 && s.hover.fold < 0.2
  && s.jet.reach > 0.93 && s.jet.wide < s.hover.wide * 0.6 && s.jet.ahead > 0.7 && s.jet.lo < -0.18 && s.jet.hi > 0.1 && s.jet.fold > 0.8
  && s.turn.swing > 0.3 && s.alarm.wide > 0.6 && s.alarm.pale > 0.8 && s.alarm.pink < 0.3 && s.reach.shot > 1.9 && s.reach.shot > s.reach.armsOut + 0.5 && s.reach.club > 0.8 && s.dive.join() === '5,0,0,0,0', JSON.stringify(s, (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v)));
// ---- the four jellyfish: the moon jelly and the sea nettle live in the first band, the other two are models to look at. Every arm and tentacle goes its own way, the bell really squeezes, and each has a way of its own
s = await ev(async () => { const g = window.__game, L = g.lib, N = await import('/game/npc.js'), M = await import('/game/music.js'), out = {};
  const mean = (l) => l.reduce((t, v) => t + v, 0) / l.length, far = (v) => Math.hypot(v.x, v.z);
  for (const id of ['moonjelly', 'nettle', 'helmetjelly', 'boxjelly']) { g.setPaused(true); if (!L.isOpen) g.openLibrary(id); L.pick(id); L.frame(0.3);
    const btn = document.querySelector(`#lib-list [data-id="${id}"]`); let head = btn.previousElementSibling; while (head && head.tagName !== 'H3') head = head.previousElementSibling;
    const o = out[id] = { name: document.getElementById('lib-name').textContent, where: document.getElementById('lib-where').textContent, group: head?.textContent, states: [...document.querySelectorAll('[data-set="state"] button')].map((b) => b.textContent).join(),
      tris: parseInt(document.getElementById('lib-tris').textContent, 10), cast: !!M.CAST[id], bands: N.NPC[id].bands.length, drawn: 0, clear: 0 };
    L.scene.traverse((x) => { if (x.isSkinnedMesh) o.drawn++; if (x.isMesh && x.material.transparent && !x.material.depthWrite && x.geometry.attributes.veil) o.clear++; });
    // one of its own, run through its states as the stand runs them. Everything is read off the rig: the stroke, and where each strand hangs and where its tip is, as the body sees it (+y the top of the bell)
    const a = N.make(id), R = a.rig, P = R.pose, all = R.strands, T = all.filter((x) => x.def.kind === 't' || x.def.kind === 'f'), tip = (x) => x.st.local[x.st.n], root = (x) => x.st.local[0], state = (k) => N.NPC[id].states.find((x) => x.id === k);
    const run = (k, secs, each) => { const st = state(k); for (let i = 0; i < Math.round(secs * 60); i++) { R.show(1 / 60, st, st.speed || 0); each?.(); } };
    o.strands = all.length;
    run('drift', 5); const was = all.map((x) => tip(x).clone()); let lo = 9, hi = -9, push = 0, rimIn = 9, rimOut = 0;
    run('drift', 4, () => { lo = Math.min(lo, P.pulse); hi = Math.max(hi, P.pulse); push = Math.max(push, P.thrust); const r = mean(T.map((x) => far(root(x)))); rimIn = Math.min(rimIn, r); rimOut = Math.max(rimOut, r); });
    const moved = all.map((x, i) => tip(x).clone().sub(was[i])); let differ = 0; for (let i = 0; i < moved.length; i++) for (let j = 0; j < i; j++) differ = Math.max(differ, moved[i].distanceTo(moved[j]));
    o.drift = { lo, hi, push, rim: rimIn / rimOut, differ: differ / N.NPC[id].length, wide: mean(T.map((x) => far(tip(x)))), up: mean(T.map((x) => tip(x).y - root(x).y)) };
    let straight = 0, slack = 9, rate = 0; run('pulse', 4); run('pulse', 4, () => { const r = mean(T.map((x) => x.st.reach)); straight = Math.max(straight, r); slack = Math.min(slack, r); rate = Math.max(rate, P.rate); });
    o.pulse = { straight, slack, rate, wide: mean(T.map((x) => far(tip(x)))), up: mean(T.map((x) => tip(x).y - root(x).y)), stretch: P.tStretch, lean: a.object.rotation.x };
    if (id === 'moonjelly') { let rest = 9, pushed = 0; run('rest', 5, () => { rest = Math.min(rest, P.pulse); }); run('rest', 2, () => { pushed = Math.max(pushed, P.thrust); }); o.rest = { flat: rest, pushed }; }
    if (id === 'nettle') { run('fish', 9); o.fish = { wide: mean(T.map((x) => far(tip(x)))), down: mean(T.map((x) => tip(x).y)) }; let l = 9, r = -9; run('turn', 9, () => { const x = mean(T.map((v) => tip(v).x)); l = Math.min(l, x); r = Math.max(r, x); }); o.turn = r - l; }
    if (id === 'helmetjelly') { let lit = 0; run('lit', 3, () => { lit = Math.max(lit, P.lit); }); o.lit = { lit, wide: mean(T.map((x) => far(tip(x)))) }; run('reach', 6); o.reach = mean(T.map((x) => tip(x).y - root(x).y)); run('drift', 3); o.dark = P.lit; }
    if (id === 'boxjelly') { let l = 9, r = -9; run('turn', 7, () => { l = Math.min(l, a.object.rotation.y); r = Math.max(r, a.object.rotation.y); }); o.turn = r - l; let pushed = 0; run('fish', 5); run('fish', 2, () => { pushed = Math.max(pushed, P.thrust); }); o.fish = { over: a.object.rotation.x, stretch: P.tStretch, pushed, above: mean(T.map((x) => x.st.joints[x.st.n].y - x.st.joints[0].y)) }; } // (how far its tips are over where they hang, as the world sees it: it is upside down)
    a.dispose(); }
  // in the dive: every band, and not one of them; then brought by the testing tool, where they live beside the fish and are taken away again
  L.close(); g.setPaused(false); out.dive = []; const all = () => { let n = 0; g.scene.traverse((x) => { if (x.name.startsWith('jelly-') || x.name === 'squid') n++; }); return n; };
  for (let f = 0; f < 5; f++) { g.startRun(4242); if (f) g.enterFloor(f, false); g.sim(0.2); const o = {}; g.scene.traverse((x) => { if (x.name.startsWith('jelly-')) o[x.name] = (o[x.name] || 0) + 1; if (x.name.startsWith('crowd-') && !x.userData.shadowOnly) o[x.name] = (o[x.name] || 0) + x.count; }); /* (the bloom's moon jellies are one instanced crowd: counted by its bells) */ out.dive.push(Object.entries(o).sort().map(([k, v]) => `${k}:${v}`).join(' ')); }
  g.startRun(4242); g.run.safe = 1e9; g.sim(0.5); const base = all(), count = () => all() - base; // (the first band has its own, at the bloom water: those are not counted)
  const SANDP = (await import('/game/sandpets.js')).SAND_PETS, buttons = [...document.querySelectorAll('#dev-bring button')], segs = g.run.segs; out.tool = { buttons: buttons.map((b) => b.textContent).join(), each: {} };
  for (const b of buttons.filter((x) => !SANDP[x.dataset.bring])) { /* (the sand flat's creatures are checked further down) */ const id = b.dataset.bring; b.click(); const list = g.pets[id].list, from = list.map((x) => x.pos.clone()), e = out.tool.each[id] = { n: list.length, here: count(), pressed: b.getAttribute('aria-pressed'), msg: document.getElementById('dev-msg').textContent };
    let near = 0, low = 9, beat = 0, path = 0; const at = list[0].pos.clone(); for (let i = 0; i < 40; i++) { g.sim(0.5); path += list[0].pos.distanceTo(at); at.copy(list[0].pos); for (const x of list) { near = Math.max(near, Math.hypot(x.pos.x - g.rig.pos.x, x.pos.z - g.rig.pos.z)); low = Math.min(low, x.pos.y - g.world.height(x.pos.x, x.pos.z)); if (x.a.rig.pose.thrust > 0.3) beat++; } }
    e.went = Math.min(...list.map((x, i) => x.pos.distanceTo(from[i]))); e.near = near; e.low = low; e.beat = beat; e.path = path; b.click(); e.gone = count() === 0 && !g.pets[id] && b.getAttribute('aria-pressed') === 'false'; }
  // left far behind, it is there again beside the fish
  g.bring('boxjelly', true); g.pets.boxjelly.list[0].pos.x += 80; g.sim(0.3); out.tool.back = Math.hypot(g.pets.boxjelly.list[0].pos.x - g.rig.pos.x, g.pets.boxjelly.list[0].pos.z - g.rig.pos.z); g.bring('boxjelly', false);
  out.tool.segs = g.run.segs === segs; out.tool.squid = !!g.bringSquid && g.pet === null;
  return out; });
{ const J = s, m = J.moonjelly, n = J.nettle, h = J.helmetjelly, b = J.boxjelly, each = [m, n, h, b], t = J.tool;
  check('the four jellyfish are in the library, the moon jelly among the company and the sea nettle and the box jelly among the hunters of the first band, the helmet jelly not yet in the dive; each a bell part clear over what is inside it, its arms and tentacles pieces of their own that go their own ways; the bell squeezes and fills, and the rim, with what hangs from it, is drawn in',
    [m.name, n.name, h.name, b.name].join() === 'Moon jelly,Sea nettle,Helmet jelly,Box jelly' && m.group === 'Company' && n.group === 'Hunters' && b.group === 'Hunters' && [m, n, b].every((o) => /sunlight zone/.test(o.where) && o.cast && o.bands === 1) && [h].every((o) => /In no band yet/.test(o.where) && o.group === 'Not yet in the dive' && !o.cast && o.bands === 0) && each.every((o) => o.clear === 1 && /^Drifting,Pulsing,/.test(o.states) && o.tris > (o === m ? 300 : 400) && o.tris < 1500
      && o.drift.hi > 0.35 && o.drift.lo < 0.08 && o.drift.push > 0.3 && o.drift.rim < 0.93 && o.drift.differ > 0.004)
    && m.strands === 20 && m.drawn === 2 && n.strands === 28 && n.drawn === 2 && h.strands === 12 && h.drawn === 1 && b.strands === 20 && b.drawn === 1, JSON.stringify(each.map((o) => ({ ...o, pulse: 0, drift: o.drift })), (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v)));
  check('each jellyfish has a way of its own: the moon jelly lies flat and still at rest; the sea nettle’s train streams out on the stroke and falls slack after it, swings when it turns, and hangs wide as a net when it fishes; the helmet jelly carries its horns up and ahead, throws them wide and lights when touched, and can turn them down; the box jelly beats fastest with its tentacles drawn short, comes right round, and to fish tips over and lets them out',
    m.rest.flat < -0.5 && m.rest.pushed === 0
    && n.pulse.straight > 0.9 && n.pulse.straight - n.pulse.slack > 0.02 && n.pulse.wide < 0.55 && n.fish.wide > n.pulse.wide * 1.6 && n.fish.wide > 0.9 && n.fish.down < -0.8 && n.turn > 0.4
    && h.drift.up > 0.2 && h.pulse.up > h.drift.up + 0.05 && h.pulse.wide < h.drift.wide * 0.75 && h.lit.lit > 0.8 && h.lit.wide > h.drift.wide * 1.1 && h.reach < -0.25 && h.dark < 0.1
    && b.pulse.rate > 1.4 && b.pulse.rate > 1.8 * Math.max(m.pulse.rate, n.pulse.rate, h.pulse.rate) && b.pulse.stretch < 0.62 && b.turn > 1.6 && b.fish.over > 2.4 && b.fish.stretch > 1.35 && b.fish.pushed === 0 && b.fish.above > 0.6,
    JSON.stringify({ moon: m.rest, nettle: { pulse: n.pulse, fish: n.fish, turn: n.turn }, helmet: { drift: h.drift, pulse: h.pulse, lit: h.lit, reach: h.reach, dark: h.dark }, box: { pulse: b.pulse, turn: b.turn, fish: b.fish } }, (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v)));
  const e = t.each;
  check('only the first band has jellyfish: at the bloom water seventy moon jellies (every one whole, all in one crowd) and three sea nettles, and one box jelly in the kelp forest; no helmet jelly anywhere. The pause menu’s testing tools still bring each detailed creature, and take it away again: six moon jellies, one of each other; brought, they beat, move by their beating, keep off the bed and near the fish, and do it no harm',
    J.dive.join('|') === 'crowd-moon:70 jelly-box:1 jelly-nettle:3||||' && t.buttons === 'Moon jelly,Hermit crab,Goby and pistol shrimp,Garden eels,White-spotted puffer,A puffer’s sand circle,Squid,Trumpetfish,Sea nettle,Box jelly,Helmet jelly' /* (in the library's order: the sand flat's four are Company now, the trumpetfish among the Rivals, the box jelly among the Hunters) */ && e.squid.n === 1 && e.moonjelly.n === 6 && e.nettle.n === 1 && e.helmetjelly.n === 1 && e.boxjelly.n === 1
    && Object.entries(e).every(([id, x]) => x.here === x.n && x.pressed === 'true' && x.gone && x.near < 30 && /only to look at/.test(x.msg) && (id === 'squid' || (x.went > 0.25 && x.low > 1 && x.beat > 3)))
    && /6 moon jellies/.test(e.moonjelly.msg) && e.boxjelly.path > 3 * e.helmetjelly.path && t.back < 12 && t.segs && t.squid, JSON.stringify({ dive: J.dive, tool: t }, (k, v) => (typeof v === 'number' ? +v.toFixed(2) : v))); }
// ---- the sand flat's batch: models to look at, like the squid. Each is read off its own rig, run through its states as the stand runs them
s = await ev(async () => { const g = window.__game, L = g.lib, N = await import('/game/npc.js'), P = await import('/game/sandpets.js'), M = await import('/game/music.js'), out = {};
  const IDS = ['hermit', 'trumpet', 'burrow', 'gardeneel', 'puffer', 'sandcircle'];
  g.setPaused(true); if (!L.isOpen) g.openLibrary('hermit');
  for (const id of IDS) { L.pick(id); L.frame(0.3); const btn = document.querySelector(`#lib-list [data-id="${id}"]`); let head = btn.previousElementSibling; while (head && head.tagName !== 'H3') head = head.previousElementSibling;
    out[id] = { group: head?.textContent, where: document.getElementById('lib-where').textContent, tris: parseInt(document.getElementById('lib-tris').textContent, 10), states: N.NPC[id].states.length, bands: N.NPC[id].bands.length, cast: !!M.CAST[id] }; }
  const run = (a, id, st, secs, each) => { const S = N.NPC[id].states.find((x) => x.id === st); for (let i = 0; i < Math.round(secs * 30); i++) { a.rig.show(1 / 30, S, S.speed || 0); each?.(); } };
  { const a = N.make('hermit'), R = a.rig, o = out.hermit; let steps = R.walker.body.steps; run(a, 'hermit', 'walk', 4); o.steps = R.walker.body.steps - steps; // it walks on its own legs
    run(a, 'hermit', 'in', 2); o.in = R.pose.in; o.legsHidden = R.legs.every((l) => !l.upper.visible); run(a, 'hermit', 'walk', 3); o.out = R.pose.in;
    const kinds = new Set(); let naked = 0; run(a, 'hermit', 'change', 19, () => { kinds.add(R.worn.kind); if (R.tail.visible) naked++; }); o.kinds = kinds.size; o.naked = naked; // out of its shell and into others, its soft half showing between
    let tris = 0; for (const k of ['snail', 'spire', 'fan', 'coil', 'ring', 'horn', 'cap', 'spine', 'lamp', 'tusk', 'pearl']) { R.wear(k); run(a, 'hermit', 'walk', 0.1); tris = Math.max(tris, R.triangles); } o.most = tris; a.dispose(); }
  { const a = N.make('trumpet'), R = a.rig, o = out.trumpet; run(a, 'trumpet', 'hang', 2); o.hang = a.object.rotation.x; run(a, 'trumpet', 'shadow', 6); let curve = 0, gape = 0, spines = 0; run(a, 'trumpet', 'shadow', 8, () => { curve = Math.max(curve, Math.abs(R.pose.curve)); });
    run(a, 'trumpet', 'strike', 6, () => { gape = Math.max(gape, R.pose.gape); spines = Math.max(spines, R.pose.spines); }); Object.assign(o, { curve, gape, spines, pieces: R.spines.length + R.fins.length }); a.dispose(); }
  { const a = N.make('burrow'), R = a.rig, o = out.burrow; let low = 9, pitch = 0, far = 0, touch = 9; run(a, 'burrow', 'gone', 7, () => { if (R.goby.position.y < low) { low = R.goby.position.y; pitch = R.goby.rotation.x; } });
    run(a, 'burrow', 'work', 6, () => { far = Math.max(far, Math.hypot(R.shrimp.position.x, R.shrimp.position.z)); const f = R.feelers.find((x) => x.long > 0.1 && x.side > 0).st, tip = f.local[f.n].clone().applyMatrix4(R.shrimp.matrix); touch = Math.min(touch, tip.distanceTo(R.contact)); });
    let flick = 0; run(a, 'burrow', 'flick', 2, () => { flick = Math.max(flick, R.pose.flick); }); let cock = 0; run(a, 'burrow', 'snap', 2.4, () => { cock = Math.max(cock, R.pose.cock); }); Object.assign(o, { low, pitch, far, touch, flick, cock }); a.dispose(); }
  { const a = N.make('gardeneel'), R = a.rig, o = out.gardeneel, mean = () => R.eels.reduce((t, e) => t + e.out, 0) / R.eels.length; run(a, 'gardeneel', 'feed', 8); o.feed = mean(); run(a, 'gardeneel', 'down', 2); o.down = Math.max(...R.eels.map((e) => e.out));
    let lo = 9, hi = 0; run(a, 'gardeneel', 'feed', 8); run(a, 'gardeneel', 'wave', 6, () => { const v = R.eels.map((e) => e.out); lo = Math.min(lo, Math.min(...v)); hi = Math.max(hi, Math.max(...v)); }); Object.assign(o, { lo, hi, one: R.one, n: R.eels.length, instanced: R.mesh.isInstancedMesh }); a.dispose(); }
  { const a = N.make('puffer'), o = out.puffer; run(a, 'puffer', 'swim', 1); o.flat = a.rig.pose.puff; run(a, 'puffer', 'puffed', 3); o.puff = a.rig.pose.puff; a.dispose(); }
  // and in the dive: no band has any of them; the testing tool brings each, beside the fish, and takes it away
  L.close(); g.setPaused(false); const names = ['hermit', 'trumpet', 'burrow', 'gardeneels', 'puffer', 'sandcircle'], count = () => { let n = 0; const walk = (x) => { if (x.name === 'sandflat') return; if (names.includes(x.name)) n++; x.children.forEach(walk); }; walk(g.scene); return n; }; // (what lives at the sand flat is under its own group, and not counted)
  out.dive = 0; out.flat = []; for (let f = 0; f < 5; f++) { g.startRun(4242); if (f) g.enterFloor(f, false); g.sim(0.2); out.dive += count(); const flat = g.scene.children.find((x) => x.name === 'sandflat'); const k = {}; flat?.traverse((x) => { if (names.includes(x.name)) k[x.name] = (k[x.name] || 0) + 1; }); out.flat.push(k); }
  g.startRun(4242); g.run.safe = 1e9; g.sim(0.5); out.tool = {}; const there = count(), extra = () => count() - there; // (what lives in the band already, the reef head's trumpetfish, is not the tool's)
  for (const id of IDS) { const b = document.querySelector(`#dev-bring [data-bring="${id}"]`); if (!b) { out.tool[id] = null; continue; } b.click(); const pet = g.pets[id], e = out.tool[id] = { here: extra(), msg: document.getElementById('dev-msg').textContent, pressed: b.getAttribute('aria-pressed'), n: pet?.list.length };
    g.sim(4); e.near = Math.hypot(pet.centre.x - g.rig.pos.x, pet.centre.z - g.rig.pos.z); b.click(); e.gone = extra() === 0 && !g.pets[id] && b.getAttribute('aria-pressed') === 'false'; }
  return out; });
{ const S = s, h = S.hermit, t = S.trumpet, b = S.burrow, e = S.gardeneel, f = S.puffer, T = S.tool, all = ['hermit', 'trumpet', 'burrow', 'gardeneel', 'puffer', 'sandcircle'];
  check('the sand flat’s batch is in the library, with no instrument: a hermit crab, a goby with its pistol shrimp, garden eels, a white-spotted puffer and its sand circle under Company, in the first band (the sand flat); the trumpetfish among the Rivals of the first band (the reef head); each with its poses',
    all.every((id) => (id === 'trumpet' ? S[id].group === 'Rivals' && /sunlight zone/.test(S[id].where) : S[id].group === 'Company') && S[id].bands === 1 && !S[id].cast && S[id].states >= 5)
    && h.tris > 800 && h.tris < 2000 && t.tris > 400 && t.tris < 1500 && b.tris > 800 && b.tris < 2000 && f.tris > 300 && f.tris < 1200 && e.one < 250, JSON.stringify(Object.fromEntries(all.map((id) => [id, { tris: S[id].tris, states: S[id].states }]))));
  check('each has the parts that move by themselves: the hermit crab walks on its legs, draws right in, and climbs out of its shell into others, its soft half showing; the trumpetfish hangs head down, bends along a body, and strikes with its mouth open and spines up; the goby goes down the hole head first and flicks, while the shrimp works out of the hole with a feeler on it and cocks its claw; the eels rise, go down, and sink and rise as something passes; the puffer blows up',
    h.steps > 4 && h.in > 0.95 && h.legsHidden && h.out < 0.3 && h.kinds >= 2 && h.naked > 10 && h.most < 2000
    && t.hang > 1 && t.curve > 0.1 && t.gape > 0.8 && t.spines > 0.9 && t.pieces === 14
    && b.low < -0.2 && b.pitch > 1 && b.far > 0.15 && b.touch < 0.12 && b.flick > 0.8 && b.cock > 0.9
    && e.feed > 0.5 && e.down < 0.05 && e.lo < 0.1 && e.hi > 0.5 && e.instanced && e.n === 20 && f.flat < 0.05 && f.puff > 0.9, JSON.stringify({ h, t, b, e, f }, (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v)));
  check('only the first band has them: at its sand flat four hermit crabs, two burrows, the eel colonies, a puffer and its circle; at its reef head the trumpetfish, three of them hanging there; the pause menu’s testing tool brings each into the water beside the fish (four hermit crabs in a line, three circles) and takes it away again',
    S.dive === 3 && S.flat[0].hermit === 4 && S.flat[0].burrow === 2 && S.flat[0].gardeneels >= 10 && S.flat[0].puffer === 1 && S.flat[0].sandcircle >= 1 && !S.flat[0].trumpet && S.flat.slice(1).every((k) => !Object.keys(k).length) && all.every((id) => T[id] && T[id].here >= 1 && T[id].pressed === 'true' && T[id].gone && T[id].near < 15 && /only to look at/.test(T[id].msg)) && T.hermit.n === 4 && T.sandcircle.n === 3, JSON.stringify({ dive: S.dive, flat: S.flat, tool: T }, (k, v) => (typeof v === 'number' ? +v.toFixed(2) : v))); }
console.log(failures ? `${failures} check(s) failed` : 'all library checks passed');
await browser.close(); server.close();
process.exit(failures ? 1 : 0);
