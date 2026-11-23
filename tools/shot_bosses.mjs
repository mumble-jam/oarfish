// Photographs the Shearer (the sawfish) or the Keeper (the crab) for a contact sheet: every pose on the stand in the specimen library, from the
// side and from as high as the dive's own camera; the model close up; and its fight in a dive, each moment from the high camera the game is played
// from (fifteen metres off, 0.56 of a radian up) with the oarfish beside it, and from nearer. It leans only on what the fight and the library have
// always had, so the same pictures can be taken before a change to how one of them looks and after it.
//   node tools/shot_bosses.mjs <prefix> <saw|crab> [lib|close|dive ...]     writes out/shots/<prefix>-<who>-<what>.png
//   OARFISH_SRC=<a copy of the repository as it was> node tools/shot_bosses.mjs before saw     the same pictures of the game as it was
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
const ROOT = process.env.OARFISH_SRC ? path.resolve(process.env.OARFISH_SRC) : path.resolve(import.meta.dirname, '..'); // (OARFISH_SRC: another copy of the game to photograph, such as the tree as it was before)
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
const [prefix = 'boss', who = 'saw', ...only] = process.argv.slice(2), want = (k) => !only.length || only.includes(k), id = who === 'crab' ? 'keeper' : 'shearer', band = who === 'crab' ? 0 : 1;
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${prefix}-${who}-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 960, height: 640 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource|GPU stall|GL Driver|AudioContext/.test(m.text())) console.log('[error]', m.text().slice(0, 300)); });
await page.addInitScript(() => { window.__noNursery = true; });
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const shot = async (name) => { await frame(); await page.screenshot({ path: out(name) }); };
const PLAY = { d: 12.7, h: 8, fov: 30 }; // the dive's own camera: cam.dist 15 at PLATE_LEVEL 0.56, VIEW.point.fov (main.js)

// ---------------------------------------------------------------- on the stand
// when to look at each pose, in seconds from the moment it is put on the stand (a pose is a movement, and some are a blow played over and over)
const WHEN = {
  shearer: { idle: [2, 3.4, 4.8], sense: [1, 1.5], aim: [0.7, 1.3, 2], charge: [3, 3.55, 4.4], pin: [3.7, 4.1, 5], tired: [2, 2.3, 2.6], stuck: [1.5, 1.7, 1.9], jammed: [1.5, 1.7, 1.9], swipe: [2, 2.3, 2.9], stun: [1, 1.15], gapped: [0.2, 0.5, 3.2], snapped: [0.2, 0.5, 3.2], down: [3, 3.5] },
  keeper: { idle: [2, 3], walk: [2, 2.3, 2.6], wary: [2, 2.8], snap: [3.5, 4.1], sweep: [3.2, 3.45, 4], jab: [1.9, 2.1, 2.5], tuck: [1.5], charge: [1.5, 1.7], dig: [0.6, 1.2, 2.5], feed: [1.5, 1.65, 1.8], stun: [1, 1.2], lame: [2, 3], down: [3] } }[id];
const SIDE = { shearer: [1.05, 0.2, 15, [0, 0, 0.2]], keeper: [0.75, 0.3, 15, [0, 0.3, 0]] }[id], HIGH = { shearer: [0.9, 0.56, 16, [0, 0, 0.2]], keeper: [0.75, 0.56, 16, [0, 0.3, 0]] }[id];
if (want('lib') || want('close')) {
  await page.addStyleTag({ content: '#library > * { display: none !important; }' });
  await page.evaluate((id) => { const g = window.__game; g.setPaused(true); g.openLibrary(id); window.__hold = true; g.lib.state.turn = false; }, id);
  const states = await page.evaluate(async (id) => (await import('/game/npc.js')).NPC[id].states.map((s) => s.id), id);
  // put it on the stand afresh in pose `sid`, in its own band's light, and let `secs` go by; then more
  const pose = (sid, secs) => page.evaluate(([id, sid, secs, band, states]) => { const L = window.__game.lib, S = L.state; S.band = band; L.pick(id); S.band = band;
    const i = states.indexOf(sid); if (i > 0) document.querySelectorAll('[data-set="state"] button')[i].click(); S.turn = false; for (let k = 0; k < Math.round(secs * 60); k++) L.frame(1 / 60); }, [id, sid, secs, band, states]);
  const more = (secs) => page.evaluate((secs) => { const L = window.__game.lib; for (let k = 0; k < Math.round(secs * 60); k++) L.frame(1 / 60); }, secs);
  const view = (yaw, pitch, dist, at = [0, 0, 0]) => page.evaluate(([yaw, pitch, dist, at]) => { const L = window.__game.lib, c = L.camera, y = L.state.lift, cp = Math.cos(pitch);
    c.clearViewOffset(); c.position.set(at[0] + Math.sin(yaw) * cp * dist, y + at[1] + Math.sin(pitch) * dist, at[2] + Math.cos(yaw) * cp * dist); c.lookAt(at[0], y + at[1], at[2]); c.updateProjectionMatrix(); }, [yaw, pitch, dist, at]);
  if (want('lib')) for (const sid of states) { const when = WHEN[sid] || [1.5, 2, 2.5]; let t = 0;
    for (let m = 0; m < when.length; m++) { if (m === 0) await pose(sid, when[0]); else await more(when[m] - t); t = when[m];
      await view(...SIDE); await shot(`lib-${sid}-${m}`); await view(...HIGH); await shot(`libtop-${sid}-${m}`); } }
  if (want('close')) {
    const closes = id === 'shearer' ? [['idle', 2.6, 'head', [0.75, 0.5, 5.2, [0, 0.1, 1.6]]], ['idle', 2.6, 'saw', [0.9, 0.42, 4.6, [0, -0.1, 3.0]]], ['idle', 2.6, 'under', [1.0, -0.62, 7, [0, 0, 1.0]]], ['idle', 2.6, 'tail', [1.9, 0.25, 6.5, [0, 0.2, -2.0]]], ['idle', 2.6, 'back', [2.5, 0.75, 11, [0, 0, 0]]],
      ['tired', 2.0, 'spent-a', [0.75, 0.5, 6.5, [0, 0.1, 1.0]]], ['tired', 2.3, 'spent-b', [0.75, 0.5, 6.5, [0, 0.1, 1.0]]], ['tired', 2.0, 'spent-under-a', [1.0, -0.62, 7, [0, 0, 1.0]]], ['tired', 2.3, 'spent-under-b', [1.0, -0.62, 7, [0, 0, 1.0]]],
      ['gapped', 3.2, 'gapped', [0.9, 0.42, 5.2, [0, -0.1, 2.8]]], ['snapped', 3.2, 'snapped', [0.9, 0.42, 5.2, [0, -0.1, 2.6]]], ['down', 3.2, 'down', [0.9, 0.5, 9, [0, 0, 0.6]]]]
      : [['idle', 2.4, 'face', [0.45, 0.2, 5.2, [0, 0.5, 1.3]]], ['idle', 2.4, 'bigclaw', [-0.6, 0.3, 5.5, [-1.2, 0.3, 2.2]]], ['idle', 2.4, 'smallclaw', [0.9, 0.3, 4.4, [1.1, 0.2, 1.9]]], ['idle', 2.4, 'shell', [0.7, 0.95, 8, [0, 0.8, 0]]], ['idle', 2.4, 'legs', [1.45, 0.16, 7, [2.2, 0, 0]]], ['idle', 2.4, 'back', [3.6, 0.5, 11, [0, 0.4, 0]]],
        ['wary', 2.5, 'wary-face', [0.45, 0.25, 6.5, [0, 0.8, 1.3]]], ['feed', 1.6, 'feed-face', [0.45, 0.2, 5.2, [0, 0.5, 1.3]]], ['stun', 1.1, 'stun-face', [0.45, 0.2, 5.2, [0, 0.5, 1.3]]], ['lame', 2.5, 'lame', [0.75, 0.75, 11, [0, 0.5, 0]]], ['down', 3.2, 'down', [0.75, 0.7, 10, [0, 0.8, 0]]]];
    for (const [sid, secs, name, v] of closes) { if (!states.includes(sid)) continue; await pose(sid, secs); await view(...v); await shot(`close-${name}`); }
  }
  await page.evaluate(() => { window.__hold = false; window.__game.lib.close(); });
}

// ---------------------------------------------------------------- in a dive
if (want('dive')) {
  await page.addStyleTag({ content: '#stage > :not(canvas) { display: none !important; }' });
  await page.evaluate((band) => { const g = window.__game; g.setPaused(false); window.__hold = true; g.startRun(4242); if (band) g.enterFloor(band, false); g.run.segs = 14; g.buildFish(14); g.run.hush = 1e9;
    for (const h of g.foes.hooks) h.pos.y += 500; for (const b of g.foes.biters) { b.alive = false; b.mesh.visible = false; } }, band);
  const none = '{ dir: null, amount: 1, vertical: 0, sprint: false }';
  const sim = (secs) => page.evaluate(`window.__game.sim(${secs}, ${none})`);
  // let it run until the keeper is in `state` and at least `k` of the way through it (or `secs` have gone by)
  const until = (state, k = 0, secs = 9) => page.evaluate(`(() => { const g = window.__game, S = g.guard.state; let t = 0; while (t < ${secs} && !(S.state === ${JSON.stringify(state)} && (S.T > 0 ? 1 - S.t / S.T : 1) >= ${k})) { g.sim(1 / 60, ${none}); t += 1 / 60; } return S.state; })()`);
  // The two views: from the dive's camera and from nearer, looking at a point between the keeper and the fish's head (mix 0: the keeper itself). `a` is the way
  // round it is first looked at from (0: from out on the shelf, the rift behind it); if a column or a lintel stands in the way it is looked at from the next way
  // round that is clear, and a strip of moments keeps the way its first picture found (a new stage begins again).
  const look = (name, { mix = 0.35, a = 0.5, near = [8.2, 3.6], lift = 0 } = {}) => page.evaluate(([mix, a, near, lift, P]) => { const g = window.__game, G = g.guard, w = g.world, r = w.rift, base = Math.atan2(-r.nx, -r.nz), p = G.pos, f = g.rig.pos, q = p.clone(), from = p.clone(), to = p.clone();
    if (Math.hypot(f.x - p.x, f.z - p.z) > 9.5) mix = 0; // the fish is not beside it: look at the keeper
    const x = p.x + (f.x - p.x) * mix, z = p.z + (f.z - p.z) * mix, y = Math.max(p.y + (f.y - p.y) * mix - 0.4, Math.max(w.height(x, z), r.ledgeY ?? -1e9)) + lift;
    const open = (ang) => { from.set(x + Math.sin(ang) * P.d, y + P.h, z + Math.cos(ang) * P.d); for (const end of [to.set(x, y, z), p, f]) for (let k = 0.06; k < 0.95; k += 0.04) { q.lerpVectors(from, end, k); if (w.inStone(q, 0.5, 1.0)) return false; } return true; };
    const first = window.__lookA ?? base + a; let ang = first; for (const t of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.7, -1.7, 2.3, -2.3, 3.14]) if (open(first + t)) { ang = first + t; break; } window.__lookA = ang;
    window.__views = { play: [[x + Math.sin(ang) * P.d, y + P.h, z + Math.cos(ang) * P.d], [x, y, z], P.fov], near: [[p.x + Math.sin(ang) * near[0], p.y + near[1], p.z + Math.cos(ang) * near[0]], [p.x, p.y - 0.1, p.z], 34] }; }, [mix, a, near, lift, PLAY])
    .then(async () => { for (const v of ['play', 'near']) { await page.evaluate((v) => { const g = window.__game, [from, to, fov] = window.__views[v]; g.camera.fov = fov; g.camera.updateProjectionMatrix(); g.camera.position.set(...from); g.camera.lookAt(...to); }, v); await shot(`dive-${name}-${v}`); } console.log('dive', name, await page.evaluate(() => { const S = window.__game.guard.state; return `${S.state}${S.stuck ? '!' : ''} hp ${S.hp}`; })); });
  const again = () => page.evaluate(() => { window.__lookA = undefined; });

  if (id === 'shearer') {
    // An open place on the shelf, a little way back from the rift, with nothing standing within ten metres of it (the nearest such to the rift's middle): the fish is
    // laid there along the rift, `up` metres over the bed, and the Shearer brought to the rift's side of it, eight metres off. Where there is none so wide, the widest.
    const spot = await page.evaluate(() => { const g = window.__game, w = g.world, r = w.rift, q = g.guard.pos.clone();
      const room = (x, z, R) => { for (let i = -R; i <= R; i += 1) for (let j = -R; j <= R; j += 1) if (i * i + j * j <= R * R) { q.set(x + i, w.height(x + i, z + j) + 0.6, z + j); if (w.inStone(q, 0.4, 1.0)) return false; } return true; };
      for (const R of [10, 8.5, 7, 5.5]) { let best = null; for (let u = -14; u <= 14; u += 1) for (let d = 13; d <= 20; d += 1) { const x = r.x + r.tx * u - r.nx * d, z = r.z + r.tz * u - r.nz * d; if ((!best || Math.abs(u) + d < best.cost) && room(x, z, R)) best = { x, z, u, d, R, cost: Math.abs(u) + d }; } if (best) return (window.__spot = best); }
      return (window.__spot = { x: r.x - r.nx * 16, z: r.z - r.nz * 16, R: 0 }); });
    console.log('the open place:', JSON.stringify(spot));
    const stage = (up, o = {}) => page.evaluate(([up, o]) => { const g = window.__game, G = g.guard, S = G.state, w = g.world, r = w.rift, c = window.__spot, x = c.x - r.nx * 1.5, z = c.z - r.nz * 1.5; window.__lookA = undefined;
      g.run.segs = 14; g.buildFish(14); g.rig.reset(g.rig.pos.clone().set(x + r.tx * 2.5, w.height(x, z) + up, z + r.tz * 2.5), Math.atan2(r.tx, r.tz)); g.run.hush = 1e9; g.sim(0.2, { dir: null, amount: 1, vertical: 0, sprint: false });
      S.ang = Math.atan2(-r.nx, -r.nz); G.pos.set(c.x + r.nx * 6.5 - r.tx * 2, w.height(c.x, c.z) + 2.6, c.z + r.nz * 6.5 - r.tz * 2); G.debug.set('idle'); Object.assign(S, { cool: 0, stun: 0, swipeT: 9, chain: 0, baited: false }, o); }, [up, o]);
    const live = () => page.evaluate(() => { window.__game.run.safe = 0; window.__game.run.hush = 0; }), safe = () => page.evaluate(() => { window.__game.run.safe = 0; window.__game.run.hush = 1e9; }); // (hush, not safe: a fish made safe blinks, and half the pictures would have no fish in them)
    const SIDE_ON = { a: 1.9, mix: 0.3 }, hold = () => page.evaluate(() => { const G = window.__game.guard; G.state.stun = 0; G.debug.set('tired', 30); });
    await stage(3.2, { cool: 99 }); await sim(1.3); await look('search', { mix: 0.5 });
    await stage(3.2); await live(); await until('sense', 0.5); await look('sense');
    await until('aim', 0.62); await look('aim'); await until('aim', 0.95); await look('aimed');
    await until('charge', 0.2); await look('slash'); await until('charge', 0.6); await look('slash2');
    await until('tired', 0.3); await safe(); await again();
    // (for the pictures of it spent and hurt the fish is brought round beside it, on the side they are taken from: nothing can bite it meanwhile)
    await page.evaluate((a) => { const g = window.__game, G = g.guard, r = g.world.rift, yaw = G.yaw, ang = Math.atan2(-r.nx, -r.nz) + a, lx = Math.cos(yaw), lz = -Math.sin(yaw), s = lx * Math.sin(ang) + lz * Math.cos(ang) >= 0 ? 1 : -1;
      g.rig.reset(g.rig.pos.clone().set(G.pos.x + lx * s * 3.6 + Math.sin(yaw) * 2.2, G.pos.y - 0.5, G.pos.z + lz * s * 3.6 + Math.cos(yaw) * 2.2), yaw); g.run.hush = 1e9; }, SIDE_ON.a); await sim(0.3);
    await look('spent-a', SIDE_ON); await sim(0.3); await look('spent-b', SIDE_ON); await sim(0.3); await look('spent-c', SIDE_ON);
    // hurt: rammed in the flank while it is spent, a row of teeth goes; and again; then the saw snapped, and it is beaten
    await hold(); await sim(0.4);
    await page.evaluate(() => { window.__game.guard.debug.tooth(1, 1.5); }); await sim(0.12); await look('tooth-0', SIDE_ON); await sim(0.22); await look('tooth-1', SIDE_ON); await sim(0.5); await look('stun', SIDE_ON);
    await hold(); await sim(2.6); await look('gapped1', SIDE_ON);
    await page.evaluate(() => { window.__game.guard.debug.tooth(1, 1.5); }); await hold(); await sim(3); await look('gapped2', SIDE_ON);
    await page.evaluate(() => { const G = window.__game.guard; G.state.hp = 4; G.state.lost = 1; G.wrapped(); }); await sim(0.15); await look('snap-0', SIDE_ON); await sim(0.3); await look('snap-1', SIDE_ON);
    await hold(); await sim(3.2); await look('snapped', SIDE_ON);
    await page.evaluate(() => { window.__game.guard.debug.fall(); }); await sim(3.4); await look('down', SIDE_ON);
    await page.evaluate(() => { const g = window.__game; g.enterFloor(1, false); g.run.hush = 1e9; for (const h of g.foes.hooks) h.pos.y += 500; for (const b of g.foes.biters) { b.alive = false; b.mesh.visible = false; } }); // the band again, its keeper whole
    await stage(0.5); await live(); await until('aim', 0.8); await look('stoop'); await until('charge', 0.25); await look('stoop2');
    await until('tired', 0.12); await safe(); await look('stuck-a'); await sim(0.25); await look('stuck-b');
    // a body right by its head: the saw goes back, and across
    await stage(3.2, { swipeT: 0, cool: 99 }); await sim(0.6); await page.evaluate(() => { const g = window.__game, G = g.guard, yaw = G.yaw; g.rig.reset(g.rig.pos.clone().set(G.pos.x + Math.sin(yaw) * 2.6 - Math.cos(yaw) * 2, G.pos.y, G.pos.z + Math.cos(yaw) * 2.6 + Math.sin(yaw) * 2), yaw + Math.PI / 2); g.run.safe = 0; g.run.hush = 0; G.state.cool = 0; });
    await until('cock', 0.8, 4); await look('cock', { mix: 0.15 }); await until('swipe', 0.35, 3); await look('swipe', { mix: 0.15 }); await safe();
    // led onto a column: the nearest thing standing by the open place, charged at from it
    const col = await page.evaluate(() => { const g = window.__game, G = g.guard, w = g.world, r = w.rift, p = G.pos.clone(); let best = null;
      const c = window.__spot; window.__lookA = undefined; for (let i = -16; i <= 16; i += 1) for (let j = -16; j <= 16; j += 1) { p.set(c.x + i, 0, c.z + j); p.y = w.height(p.x, p.z) + 1.4; if (w.inStone(p, 0.2, 1.6) && r.in(p.x, p.z) < -4 && (!best || i * i + j * j < best[3])) best = [p.x, p.y, p.z, i * i + j * j]; }
      if (!best) return null; const [x, y, z] = best, l = Math.hypot(c.x - x, c.z - z) || 1, ox = (c.x - x) / l, oz = (c.z - z) / l; // it comes at the column from the open place
      G.debug.set('idle'); G.state.cool = 99; G.state.stun = 0; G.pos.set(x + ox * 7, y + 0.4, z + oz * 7); g.rig.reset(g.rig.pos.clone().set(x + ox * 4 - oz * 4, y + 0.8, z + oz * 4 + ox * 4), Math.atan2(ox, oz)); g.run.hush = 1e9; g.sim(0.3, { dir: null, amount: 1, vertical: 0, sprint: false });
      G.debug.charge(x, y + 0.3, z); return best; });
    if (col) { await until('tired', 0.1, 3); await look('jammed-a', { mix: 0.2, a: 1.9 }); await sim(0.2); await look('jammed-b', { mix: 0.2, a: 1.9 }); } else console.log('no column found for the jammed pose');
  } else {
    // as tools/shot_crab.mjs stages the fight: the fish lying across the crab's front, and the crab made ready for the blow that is wanted
    const fish = (far, tail = 0) => page.evaluate(([far, tail]) => { const g = window.__game, G = g.guard, r = g.world.rift, x = G.pos.x - r.nx * far, z = G.pos.z - r.nz * far, yaw = Math.atan2(r.nx, r.nz) + (tail ? Math.PI : 0);
      g.rig.reset(g.rig.pos.clone().set(x, g.world.height(x, z) + 1.3, z), yaw); g.run.hush = 1e9; }, [far, tail]);
    const ready = (o = {}) => page.evaluate((o) => { const g = window.__game, G = g.guard, S = G.state; window.__lookA = undefined; G.debug.set('stalk'); Object.assign(S, { cool: 0, stun: 0, jabT: 9, chargeT: 9, digT: 9, last: '' }, o); g.run.hush = 1e9; g.run.segs = 16; g.buildFish(16); }, o);
    const lie = (far, side = 0) => page.evaluate(([far, side]) => { const g = window.__game, G = g.guard, yaw = G.mesh.rotation.y + side * 1.1, fx = Math.sin(yaw), fz = Math.cos(yaw), half = g.rig.length / 2, x = G.pos.x + fx * far + fz * half, z = G.pos.z + fz * far - fx * half;
      g.rig.reset(g.rig.pos.clone().set(x, g.world.height(x, z) + 1.6, z), yaw + Math.PI / 2); }, [far, side]);
    const V = { mix: 0.18, a: 3.4, near: [9.5, 4.2] }; // from the rift's side of it
    const home = () => page.evaluate(() => { const g = window.__game, G = g.guard, r = g.world.rift, wx = r.x - r.nx * 24, wz = r.z - r.nz * 24; G.pos.set(wx + Math.sin(2.7) * 6, 0, wz + Math.cos(2.7) * 6); G.pos.y = g.world.height(G.pos.x, G.pos.z) + 0.9; G.state.ang = 2.7; }); // back to the same place on its ground
    await page.evaluate(() => { const g = window.__game, G = g.guard, r = g.world.rift, S = G.state; S.ang = 2.7; const wx = r.x - r.nx * 24, wz = r.z - r.nz * 24; G.pos.set(wx + Math.sin(S.ang) * 8.6, 0, wz + Math.cos(S.ang) * 8.6); G.pos.y = g.world.height(G.pos.x, G.pos.z) + 0.9; });
    await fish(34); await sim(3); await look('walk', { ...V, mix: 0 });
    await home(); await page.evaluate(() => { Object.assign(window.__game.guard.state, { cool: 99, chargeT: 99 }); }); await fish(7); await sim(2); await again(); await look('wary', V);
    await fish(9); await sim(0.6);
    await ready(); await lie(3.6); await until('slam', 0.45); await look('slam-follow', V); await until('slam', 0.9); await look('slam-aimed', V); await until('stuck', 0.15, 3); await look('stuck', V);
    await home(); await ready({ last: 'slam' }); await lie(3.0); await until('sweep', 0.85); await look('sweep', V); await until('sweeping', 0.5, 3); await look('sweeping', V); await until('rest', 0.4, 3); await look('spent', V);
    await home(); await ready({ jabT: 0 }); await lie(1.9, 1); await until('jab', 0.7); await look('jab', V); await until('rest', 0.1, 3); await look('jabbed', V);
    await home(); await ready({ chargeT: 0 }); await lie(8.5); await until('charge', 0.7); await look('tuck', V); await until('run', 0.3, 3); await look('run', V);
    // open, and what a ram does to a leg: numb, then off; two off and it rages
    await home(); await ready(); await lie(9); await sim(0.3); await page.evaluate(() => { const G = window.__game.guard; G.debug.set('rest', 9); G.debug.numb(2); }); await sim(0.5); await look('numb-a', { ...V, a: 2.2 }); await sim(0.3); await look('numb-b', { ...V, a: 2.2 });
    await page.evaluate(() => { const G = window.__game.guard; G.debug.tear(2, false); }); await sim(1.4); await look('torn', { ...V, a: 2.2 });
    await page.evaluate(() => { const G = window.__game.guard; G.state.stun = 0; G.debug.set('rest', 9); G.debug.numb(5); G.debug.tear(5, true); }); await sim(1.6); await look('two', { ...V, a: 0.9 });
    await ready(); await page.evaluate(() => { Object.assign(window.__game.guard.state, { cool: 99, chargeT: 99 }); }); await fish(7); await sim(2.2); await look('raging', V);
    await home(); await ready({ digT: 0, chargeT: 0 }); await lie(8.5); await until('dig', 0.6); await look('dig', V); await until('rise', 0.6, 5); await look('rise', V); await until('rest', 0.3, 3); await look('risen', V);
    await home(); await ready(); await lie(3.6); await sim(0.3); await page.evaluate(() => { const g = window.__game; g.run.hush = 0; g.run.safe = 0; g.shed(); g.run.hush = 1e9; }); await until('feed', 0.25, 7); await look('feed-a', V); await sim(0.2); await look('feed-b', V);
    await home(); await ready(); await lie(8); await sim(0.3); await page.evaluate(() => { const G = window.__game.guard; G.state.stun = 0; G.debug.set('rest', 9); G.debug.tear(0, false); }); await sim(1.5); await look('three', V);
    await page.evaluate(() => { window.__game.guard.debug.fall(); }); await sim(3); await look('down', V);
  }
}
await browser.close(); server.close();
