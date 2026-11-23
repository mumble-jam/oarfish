// Draws a band from straight above, to scale, as a plan: nobody can see a whole band at once in the dive.
//   node tools/shot_map.mjs <seed> <band> <out.jpg> [--ref <commit>] [--beside <commit>] [--nursery] [--scale <px per metre>]
//   node tools/shot_map.mjs 4242 0 out/shots/map.jpg                         the first band as it is in this folder (bands count from 0, as in the code)
//   node tools/shot_map.mjs 4242 0 map.jpg --beside main                     the same band as it was at a commit, beside it as it is now, at one scale
// What is on it: the edge of the square the band repeats in; the start and the nest; a ring for how far the player sees through the fog from the
// start; the home water (where swarms and hunters live, when that is less than the band); the rift with its ledges and its drop; the keeper's
// ground; the ground each place has claimed; all stonework and everything solid as its footprint; puzzles and their caches, fragments, shells,
// sealed jars, the mural, hunters' seats, a cleaning station; every swarm as a dot whose area is its count; and a faint dot for each piece of
// natural dressing, so that how thickly the band is grown can be read. The world is built in Node (tools/headless.mjs); the browser only draws.
import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
import { load } from './headless.mjs';

const args = process.argv.slice(2), take = (flag, has = true) => { const i = args.indexOf(flag); if (i < 0) return null; return has ? args.splice(i, 2)[1] : (args.splice(i, 1), true); };
const ref = take('--ref'), beside = take('--beside'), nursery = !!take('--nursery', false), scale = +(take('--scale') || 10) / 2; // the picture has two pixels to each point it is drawn on
const [seed, band, file] = [+(args[0] ?? 4242), +(args[1] ?? 0), args[2] || 'out/shots/map.jpg'];

const NATURAL = /^(rock|kelp|stag|finger|table|tuft|pebble|star|brittle|urchin|clam|brain|seaFan|sponge|anemone|lily|glass|worms|lantern|pen)$/;
const LOW = /^(flag|rubble|shard|coin)$/; // stone that lies and does not stand: paving, rubble, sherds, coin
// the ground a piece covers: the corners of its model, sized, turned and put in its place, seen from above, and the outline round them
function footprint(THREE, p) {
  const q = new THREE.Quaternion(...p.turn), v = new THREE.Vector3(), pts = [];
  for (const i of [0, 3]) for (const j of [1, 4]) for (const k of [2, 5]) { v.set(p.box[i] * p.sx, p.box[j] * p.sy, p.box[k] * p.sz).applyQuaternion(q); pts.push([p.x + v.x, p.z + v.z]); }
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), half = (list) => { const h = []; for (const pt of list) { while (h.length > 1 && cross(h[h.length - 2], h[h.length - 1], pt) <= 0) h.pop(); h.push(pt); } h.pop(); return h; };
  return [...half(pts), ...half([...pts].reverse())].flat().map((n) => +n.toFixed(2));
}
// everything the plan needs from one world, as plain numbers
async function survey(from) {
  const game = await load({ ref: from }), { THREE } = game, { scene, world: w, size, spawn, solids, sites } = game.build(seed, band, { nursery: nursery && band === 0 });
  const [Shells, Foes, Guards] = await Promise.all(['shells.js', 'foes.js', 'guards.js'].map(game.mod)), r = w.rift, F = w.floor, P = w.pieces();
  const shells = Shells.createShellField(scene, w, { mesh: () => new THREE.Object3D(), glow: null }, { seed, floor: band, count: w.hall ? 2 : 3, types: Shells.SHELL_TYPES }).items;
  const foes = Foes.createFoes(scene, w, { seed }, {}), seat = (list, pos) => list.map((o) => { const p = pos(o); return [p.x, p.z]; });
  const lines = r && (() => { const at = (u, a) => [r.x + r.tx * u + r.nx * (a + r.mid(u)), r.z + r.tz * u + r.nz * (a + r.mid(u))], ring = (inset) => { const near = [], far = [];
    for (let u = -r.half; u <= r.half + 1e-6; u += 0.5) { const half = r.w(u) - inset; if (half > 0) { near.push(at(u, -half)); far.push(at(u, half)); } } return [...near, ...far.reverse()]; };
    return { edge: ring(0), ledge: ring(r.ledge), drop: ring(r.wall) }; })();
  const keeper = !r ? null : band === 0 ? { x: r.x - r.nx * 24, z: r.z - r.nz * 24, r: Guards.KEEPER_FIGHT.leash, walks: true } : { x: r.x, z: r.z, r: 0, walks: false };
  const wild = P.filter((p) => NATURAL.test(p.name)), built = P.filter((p) => !NATURAL.test(p.name) && !/^(mural|fragment|station)$/.test(p.name));
  const out = { title: `Band ${band + 1} · ${F.name} · seed ${seed}${nursery && band === 0 ? ' · the dive that opens in the nursery' : ''}`, from: from ? `as it was at ${game.name}` : 'as it is in this folder', size, spawn: [spawn.x, spawn.z], goal: [w.goal.x, w.goal.z, w.goal.kind], fog: F.fog[1], home: Math.min(F.home || size, size),
    way: Math.hypot(w.goal.x - spawn.x, w.goal.z - spawn.z), lines, keeper, hall: w.hall && [w.hall.x, w.hall.z, w.hall.R], nest: band === 0 && !nursery ? { yaw: game.W.NEST.yaw } : null,
    sites: sites.map(([x, z, rad, what]) => [x, z, rad, what ? 1 : 0]), solids: solids.filter((c) => !c.off).map((c) => [c.x, c.z, c.r]),
    wild: wild.map((p) => [+p.x.toFixed(2), +p.z.toFixed(2)]), built: built.filter((p) => !LOW.test(p.name)).map((p) => footprint(THREE, p)), low: built.filter((p) => LOW.test(p.name)).map((p) => footprint(THREE, p)),
    swarms: w.schools.filter((s) => !s.of).map((s) => [s.hx, s.hz, s.n, s.kind || '']), puzzles: w.react.puzzles.map((p) => ({ kind: p.kind, x: p.x, z: p.z, cx: p.cache.x, cz: p.cache.z, hoops: (p.hoops || []).map((h) => [h.x, h.z]) })),
    fragments: w.react.fragments.map((f) => [f.x, f.z]), shells: shells.map((it) => [it.x, it.z]), jars: w.urns.map((u) => [u.x, u.z]), mural: w.react.mural && [w.react.mural.x, w.react.mural.z, w.react.mural.yaw], stations: w.react.stations.map((s) => [s.x, s.z]),
    hunters: [...seat(foes.hooks, (h) => h), ...seat(foes.biters, (b) => b.home), ...seat(foes.anglers, (a) => a.home), ...seat(foes.mines, (m) => m.home), ...seat(foes.leeches, (l) => l.home)],
    count: { pieces: P.length, wild: wild.length, solid: solids.length, fish: w.schools.reduce((a, s) => a + s.n, 0), perKm2: Math.round(wild.length / ((size * size) / 1000)) } };
  w.dispose(); return out;
}
const panels = [];
if (beside) panels.push(await survey(beside));
panels.push(await survey(ref));

// ---- the drawing, done in the page on one canvas
function draw({ panels, scale }) {
  const INK = '#0b0b0b', INK2 = '#52514e', MUTED = '#898781', HAIR = '#e1e0d9', AXIS = '#c3c2b7', SURFACE = '#fcfcfb', SEA = '#f1f6f7';
  const FOOD = '#2a78d6', TASK = '#eb6834', FIND = '#1baf7a', HARM = '#d03b3b', STONE = '#3c3b38', PAVED = '#b3b1a8', FONT = 'system-ui, -apple-system, "Segoe UI", "DejaVu Sans", sans-serif';
  const PAD = 34, HEAD = 74, FOOT = 56, GAP = 46, LEGEND = 330, tall = Math.max(...panels.map((p) => p.size)) * scale;
  const W = PAD * 2 + panels.reduce((a, p) => a + p.size * scale, 0) + GAP * (panels.length - 1) + GAP + LEGEND, H = HEAD + tall + FOOT + PAD;
  const cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2; cv.style.width = `${W}px`; cv.style.height = `${H}px`; document.body.appendChild(cv);
  const g = cv.getContext('2d'); g.scale(2, 2); g.fillStyle = SURFACE; g.fillRect(0, 0, W, H); g.lineJoin = 'round'; g.lineCap = 'round';
  const text = (s, x, y, { size = 12, color = INK, weight = 400, align = 'left', halo = false } = {}) => { g.font = `${weight} ${size}px ${FONT}`; g.textAlign = align; g.textBaseline = 'middle';
    if (halo) { g.strokeStyle = 'rgba(252,252,251,0.92)'; g.lineWidth = 3.5; g.strokeText(s, x, y); } g.fillStyle = color; g.fillText(s, x, y); };
  const dot = (x, y, r, fill, stroke, lw = 1) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } };
  const dashed = (on, fn) => { g.setLineDash(on); fn(); g.setLineDash([]); };
  // the marks, each drawn about a point: the plan and the legend use the same ones
  const mark = {
    swarm: (x, y, n) => dot(x, y, Math.sqrt(n) * 0.9 + 1.2, FOOD, SURFACE, 1.5),
    puzzle: (x, y) => { g.fillStyle = TASK; g.fillRect(x - 5, y - 5, 10, 10); g.strokeStyle = SURFACE; g.lineWidth = 1.5; g.strokeRect(x - 5, y - 5, 10, 10); },
    cache: (x, y) => { g.fillStyle = SURFACE; g.fillRect(x - 3.5, y - 3.5, 7, 7); g.strokeStyle = TASK; g.lineWidth = 2; g.strokeRect(x - 3.5, y - 3.5, 7, 7); },
    fragment: (x, y) => { g.beginPath(); g.moveTo(x, y - 6.5); g.lineTo(x + 6, y + 4.5); g.lineTo(x - 6, y + 4.5); g.closePath(); g.fillStyle = TASK; g.fill(); g.strokeStyle = SURFACE; g.lineWidth = 1.5; g.stroke(); },
    shell: (x, y) => { g.beginPath(); g.moveTo(x, y - 6.5); g.lineTo(x + 5.5, y); g.lineTo(x, y + 6.5); g.lineTo(x - 5.5, y); g.closePath(); g.fillStyle = FIND; g.fill(); g.strokeStyle = SURFACE; g.lineWidth = 1.5; g.stroke(); },
    jar: (x, y) => dot(x, y, 4, SURFACE, FIND, 2.2),
    hunter: (x, y) => { g.strokeStyle = SURFACE; g.lineWidth = 5; for (const pass of [0, 1]) { g.beginPath(); g.moveTo(x - 4.5, y - 4.5); g.lineTo(x + 4.5, y + 4.5); g.moveTo(x + 4.5, y - 4.5); g.lineTo(x - 4.5, y + 4.5); g.stroke(); g.strokeStyle = HARM; g.lineWidth = 2.2; } },
    station: (x, y) => { dot(x, y, 5.5, SURFACE, FIND, 2); g.strokeStyle = FIND; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x + 3, y); g.moveTo(x, y - 3); g.lineTo(x, y + 3); g.stroke(); },
    mural: (x, y, yaw = 0) => { g.save(); g.translate(x, y); g.rotate(yaw); g.fillStyle = INK; g.fillRect(-7.5, -2.6, 15, 5.2); g.strokeStyle = SURFACE; g.lineWidth = 1.2; g.strokeRect(-7.5, -2.6, 15, 5.2); g.fillStyle = '#eda100'; for (const k of [-4.6, 0, 4.6]) g.fillRect(k - 1.3, -1.3, 2.6, 2.6); g.restore(); },
    start: (x, y) => { dot(x, y, 6.5, SURFACE, INK, 2); g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 10, y); g.lineTo(x + 10, y); g.moveTo(x, y - 10); g.lineTo(x, y + 10); g.stroke(); },
  };
  let ox = PAD;
  for (const p of panels) {
    const S = p.size, px = S * scale, oy = HEAD + (tall - px), X = (x) => ox + x * scale, Y = (z) => oy + (S - z) * scale; // z up the page, so the plan is as seen from above with x to the right
    text(p.title, ox, 22, { size: 15, weight: 600 });
    text(`${S} m across · ${p.from}`, ox, 42, { size: 12, color: INK2 });
    text(`${p.count.pieces.toLocaleString('en')} pieces · ${p.count.perKm2} of natural dressing to 1000 m² · ${p.swarms.length} swarms, ${p.count.fish} fish · ${p.goal[2] === 'rift' ? 'rift' : 'gate'} ${p.way.toFixed(0)} m from the start`, ox, 59, { size: 11.5, color: INK2 });
    g.save(); g.beginPath(); g.rect(ox, oy, px, px); g.clip(); g.fillStyle = SEA; g.fillRect(ox, oy, px, px);
    // everything is drawn on all nine copies of the square and cut to the one, so that what lies across the seam shows where it comes round
    const tiles = (fn) => { for (const i of [-1, 0, 1]) for (const j of [-1, 0, 1]) { g.save(); g.translate(i * px, -j * px); fn(); g.restore(); } };
    const wrap = (v) => ((v % S) + S) % S, sx = p.spawn[0], sz = p.spawn[1];
    // how far from the start: faint rings every 50 m, and the way to the rift
    for (let d = 50; d < S; d += 50) { dot(X(sx), Y(sz), d * scale, null, AXIS, 0.8); text(`${d} m`, X(sx) + d * scale * 0.7071 + 3, Y(sz) + d * scale * 0.7071 + 8, { size: 10, color: MUTED }); }
    tiles(() => { for (const [x, z, rad, what] of p.sites) dot(X(x), Y(z), rad * scale, what ? 'rgba(235,104,52,0.07)' : 'rgba(82,81,78,0.07)', what ? 'rgba(235,104,52,0.35)' : AXIS, 0.8); });
    tiles(() => { g.fillStyle = 'rgba(82,81,78,0.42)'; for (const [x, z] of p.wild) g.fillRect(X(x) - 0.8, Y(z) - 0.8, 1.6, 1.6); });
    if (p.lines) tiles(() => { const poly = (pts, fill, stroke) => { if (pts.length < 3) return; g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Y(z)) : g.moveTo(X(x), Y(z)))); g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); } };
      poly(p.lines.edge, '#cfd6d8', INK2); poly(p.lines.ledge, '#8b979b', null); poly(p.lines.drop, '#16242b', null); });
    if (p.hall) tiles(() => dot(X(p.hall[0]), Y(p.hall[1]), p.hall[2] * scale, 'rgba(22,36,43,0.10)', INK2, 1.2));
    const outline = (f) => { g.beginPath(); for (let i = 0; i < f.length; i += 2) (i ? g.lineTo(X(f[i]), Y(f[i + 1])) : g.moveTo(X(f[i]), Y(f[i + 1]))); g.closePath(); };
    tiles(() => { g.fillStyle = PAVED; for (const f of p.low) { outline(f); g.fill(); } });
    tiles(() => { g.fillStyle = STONE; g.strokeStyle = STONE; g.lineWidth = 0.7; for (const f of p.built) { g.beginPath(); for (let i = 0; i < f.length; i += 2) (i ? g.lineTo(X(f[i]), Y(f[i + 1])) : g.moveTo(X(f[i]), Y(f[i + 1]))); g.closePath(); g.fill(); g.stroke(); } }); // (the hairline keeps a kerb stone from vanishing between pixels)
    tiles(() => { for (const [x, z, rad] of p.solids) dot(X(x), Y(z), Math.max(1.2, rad * scale), null, 'rgba(11,11,11,0.55)', 0.7); });
    // the way, the fog, the home water, the keeper
    g.strokeStyle = MUTED; g.lineWidth = 1; dashed([2, 5], () => { g.beginPath(); g.moveTo(X(sx), Y(sz)); g.lineTo(X(p.goal[0]), Y(p.goal[1])); g.stroke(); });
    if (p.home < S) { g.strokeStyle = FOOD; g.lineWidth = 1.2; dashed([1, 5], () => g.strokeRect(X(sx - p.home / 2), Y(sz + p.home / 2), p.home * scale, p.home * scale)); }
    dashed([7, 5], () => dot(X(sx), Y(sz), p.fog * scale, null, INK2, 1.3));
    if (p.keeper) tiles(() => { if (p.keeper.walks) dashed([4, 3], () => dot(X(p.keeper.x), Y(p.keeper.z), p.keeper.r * scale, 'rgba(208,59,59,0.06)', HARM, 1.3)); });
    // what is set down one at a time
    tiles(() => { for (const q of p.puzzles) { g.strokeStyle = TASK; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(q.x), Y(q.z)); for (const [hx, hz] of q.hoops) g.lineTo(X(hx), Y(hz)); g.lineTo(X(q.cx), Y(q.cz)); g.stroke(); mark.cache(X(q.cx), Y(q.cz)); mark.puzzle(X(q.x), Y(q.z)); }
      for (const [x, z] of p.fragments) mark.fragment(X(x), Y(z)); for (const [x, z] of p.jars) mark.jar(X(x), Y(z)); for (const [x, z] of p.shells) mark.shell(X(x), Y(z)); for (const [x, z] of p.stations) mark.station(X(x), Y(z));
      for (const [x, z] of p.hunters) mark.hunter(X(x), Y(z)); if (p.mural) mark.mural(X(p.mural[0]), Y(p.mural[1]), p.mural[2]);
      for (const [x, z, n] of p.swarms) mark.swarm(X(x), Y(z), n); });
    if (p.nest) { g.save(); g.translate(X(sx), Y(sz)); g.rotate(p.nest.yaw); g.strokeStyle = INK; g.lineWidth = 1.2; g.strokeRect(-1.65 * scale, -0.6 * scale, 5.7 * scale, 8.7 * scale); g.restore(); } // the most ground the nest takes: the line of stones to the left of the body, the shells' places to its right
    mark.start(X(sx), Y(sz));
    // the words on the plan: each tries the places round its mark and takes the first that is clear of the words already there and of the marks that matter
    const taken = [], soft = [], keepOff = (x, y, r) => taken.push([x - r, y - r, x + r, y + r]);
    for (const [x, z, rad] of p.sites) if (rad <= 14) { const k = rad * scale * 0.8; soft.push([X(wrap(x)) - k, Y(wrap(z)) - k, X(wrap(x)) + k, Y(wrap(z)) + k]); } // and of the places themselves, if there is anywhere else to go
    if (p.nest) keepOff(X(sx) + (1.2 * Math.cos(p.nest.yaw) - 3.75 * Math.sin(p.nest.yaw)) * scale, Y(sz) + (1.2 * Math.sin(p.nest.yaw) + 3.75 * Math.cos(p.nest.yaw)) * scale, 4.6 * scale); // the nest's own ground
    keepOff(X(sx), Y(sz), 11); for (const [x, z, n] of p.swarms) keepOff(X(wrap(x)), Y(wrap(z)), Math.sqrt(n) * 0.9 + 3); for (const q of p.puzzles) { keepOff(X(wrap(q.x)), Y(wrap(q.z)), 7); keepOff(X(wrap(q.cx)), Y(wrap(q.cz)), 5); }
    for (const [x, z] of [...p.fragments, ...p.shells, ...p.jars, ...p.hunters, ...p.stations]) keepOff(X(wrap(x)), Y(wrap(z)), 7); if (p.mural) keepOff(X(wrap(p.mural[0])), Y(wrap(p.mural[1])), 9);
    const label = (s, x, z, r, o = {}) => { const cx = X(wrap(x)), cy = Y(wrap(z)), size = o.size || 11.5; g.font = `${o.weight || 500} ${size}px ${FONT}`; const w = g.measureText(s).width, h = size + 3, d = r + 5;
      const tries = [[d, 0, 'left'], [-d, 0, 'right'], [0, -d - h / 2, 'center'], [0, d + h / 2, 'center'], [d * 0.8, -d * 0.8 - h / 2, 'left'], [d * 0.8, d * 0.8 + h / 2, 'left'], [-d * 0.8, -d * 0.8 - h / 2, 'right'], [-d * 0.8, d * 0.8 + h / 2, 'right'], [d + 14, 0, 'left'], [-d - 14, 0, 'right'], [0, -d - h * 1.6, 'center'], [0, d + h * 1.6, 'center']];
      for (const shy of [true, false]) for (const [dx, dy, align] of tries) { const x0 = cx + dx - (align === 'left' ? 0 : align === 'right' ? w : w / 2), box = [x0 - 2, cy + dy - h / 2, x0 + w + 2, cy + dy + h / 2], hits = (t) => box[0] < t[2] && box[2] > t[0] && box[1] < t[3] && box[3] > t[1];
        if (box[0] < ox + 3 || box[2] > ox + px - 3 || box[1] < oy + 3 || box[3] > oy + px - 3) continue;
        if (taken.some(hits) || (shy && !o.onPlace && soft.some(hits))) continue;
        taken.push(box); text(s, cx + dx, cy + dy, { size, weight: o.weight || 500, color: o.color || INK, align, halo: true }); return true; }
      return false; };
    label('Start' + (p.nest ? ' and nest' : ''), sx, sz, 11, { weight: 600, size: 12.5 });
    if (p.goal[2] === 'rift') label('Rift', p.goal[0], p.goal[1], 16 * scale * 0.5, { weight: 600, size: 12.5, onPlace: true }); else label('Palace gate', p.goal[0], p.goal[1], 8, { weight: 600, size: 12.5, onPlace: true });
    if (p.keeper && p.keeper.walks) label('Keeper’s ground', p.keeper.x, p.keeper.z, p.keeper.r * scale, {});
    if (p.mural) label('Mural', p.mural[0], p.mural[1], 9, {});
    for (const q of p.puzzles) label(q.kind[0].toUpperCase() + q.kind.slice(1), q.x, q.z, 7, {});
    for (const [x, z, n, kind] of p.swarms) label(`${n}${kind ? ` (${kind}s)` : ''}`, x, z, Math.sqrt(n) * 0.9 + 1.2, { size: 10.5, color: INK2, onPlace: true });
    label(`sight through the fog: ${p.fog} m`, sx, sz - p.fog, 3, { size: 10.5, color: INK2 });
    if (p.home < S) label(`home water: ${p.home} m`, sx - p.home / 2 + 20, sz + p.home / 2, 4, { size: 10.5, color: INK2 });
    g.restore();
    g.strokeStyle = INK; g.lineWidth = 1.6; g.strokeRect(ox, oy, px, px); // the edge of the square
    text(`the band repeats beyond this edge: ${S} m across`, ox + px, oy + px + 13, { size: 10.5, color: INK2, align: 'right' });
    // scale bar: 50 m in tens
    { const y = oy + px + 22; g.strokeStyle = INK; g.lineWidth = 1.4; g.beginPath(); g.moveTo(ox, y); g.lineTo(ox + 50 * scale, y); for (let m = 0; m <= 50; m += 10) { g.moveTo(ox + m * scale, y - (m % 50 ? 3 : 6)); g.lineTo(ox + m * scale, y); } g.stroke();
      for (const m of [0, 10, 50]) text(`${m}${m === 50 ? ' m' : ''}`, ox + m * scale, y + 12, { size: 10.5, color: INK2, align: m === 50 ? 'left' : 'center' }); text(`${scale * 2} px to a metre`, ox + 50 * scale + 44, y + 12, { size: 10.5, color: MUTED }); }
    ox += px + GAP;
  }
  // ---- the legend, once, in the order the plan is read: the ground, what is built, what is there to be found and done, what is there to eat
  { const x = ox, row = 23; let y = HEAD + 4; const p = panels[panels.length - 1], any = (k) => panels.some((q) => (Array.isArray(q[k]) ? q[k].length : q[k]));
    const head = (s) => { y += 8; text(s, x, y, { size: 11, weight: 600, color: INK2 }); y += row; }, item = (glyph, s, note) => { glyph(x + 14, y); text(s, x + 36, y, { size: 12 }); if (note) { y += 15; text(note, x + 36, y, { size: 10.5, color: MUTED }); } y += row; };
    head('THE GROUND');
    item((cx, cy) => { g.strokeStyle = INK; g.lineWidth = 1.6; g.strokeRect(cx - 9, cy - 7, 18, 14); }, 'Edge of the square', 'the band comes round again beyond it');
    item((cx, cy) => mark.start(cx, cy), p.nest ? 'Start, with the nest beside it' : 'Start');
    item((cx, cy) => dashed([7, 5], () => dot(cx, cy, 9, null, INK2, 1.3)), 'How far the player sees', 'from the start, before fog closes');
    if (panels.some((q) => q.home < q.size)) item((cx, cy) => { g.strokeStyle = FOOD; g.lineWidth = 1.2; dashed([1, 5], () => g.strokeRect(cx - 9, cy - 7, 18, 14)); }, 'Home water', 'swarms and hunters live inside it');
    item((cx, cy) => { g.strokeStyle = AXIS; g.lineWidth = 0.8; g.beginPath(); g.arc(cx - 10, cy + 8, 18, -1.2, 0.1); g.stroke(); g.strokeStyle = MUTED; dashed([2, 5], () => { g.beginPath(); g.moveTo(cx - 10, cy + 5); g.lineTo(cx + 11, cy - 6); g.stroke(); }); }, 'Distance from the start', 'rings every 50 m; dotted, the way down');
    if (any('lines')) item((cx, cy) => { g.fillStyle = '#cfd6d8'; g.fillRect(cx - 11, cy - 8, 22, 16); g.strokeStyle = INK2; g.lineWidth = 1; g.strokeRect(cx - 11, cy - 8, 22, 16); g.fillStyle = '#8b979b'; g.fillRect(cx - 11, cy - 5, 22, 10); g.fillStyle = '#16242b'; g.fillRect(cx - 11, cy - 2.5, 22, 5); }, 'Rift: its ledges, its wall, the deep');
    if (panels.some((q) => q.keeper && q.keeper.walks)) item((cx, cy) => dashed([4, 3], () => dot(cx, cy, 9, 'rgba(208,59,59,0.06)', HARM, 1.3)), 'Keeper’s ground', 'as far as it goes from the middle of it');
    item((cx, cy) => { g.fillStyle = 'rgba(82,81,78,0.42)'; for (const [dx, dy] of [[-8, -4], [-3, 3], [1, -5], [5, 1], [8, 5], [-6, 5], [3, -1]]) g.fillRect(cx + dx - 0.8, cy + dy - 0.8, 1.6, 1.6); }, 'Natural dressing, a dot a piece', 'rock, kelp, coral, grass, pebbles, bed life');
    head('WHAT IS BUILT');
    item((cx, cy) => dot(cx, cy, 9, 'rgba(82,81,78,0.07)', AXIS, 0.8), 'Ground a place has claimed', 'nothing else is put there');
    item((cx, cy) => { g.fillStyle = PAVED; g.fillRect(cx - 4, cy - 4, 8, 8); g.fillStyle = STONE; for (let k = 0; k < 8; k++) g.fillRect(cx + Math.sin(k * 0.785) * 8 - 1.6, cy + Math.cos(k * 0.785) * 8 - 1.6, 3.2, 3.2); }, 'Stonework, at its true size', 'dark what stands; pale what lies (paving, rubble)');
    item((cx, cy) => dot(cx, cy, 5, null, 'rgba(11,11,11,0.55)', 0.9), 'Solid: a body is turned by it');
    if (any('mural')) item((cx, cy) => mark.mural(cx, cy), 'Mural');
    head('TO DO AND TO FIND');
    if (any('puzzles')) item((cx, cy) => { g.strokeStyle = TASK; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - 7, cy); g.lineTo(cx + 9, cy); g.stroke(); mark.puzzle(cx - 7, cy); mark.cache(cx + 9, cy); }, 'Puzzle, and the cache it opens');
    if (any('fragments')) item((cx, cy) => mark.fragment(cx, cy), 'Fragment to haul to the rift');
    if (any('shells')) item((cx, cy) => mark.shell(cx, cy), 'Shell');
    if (any('jars')) item((cx, cy) => mark.jar(cx, cy), 'Sealed jar');
    if (any('stations')) item((cx, cy) => mark.station(cx, cy), 'Cleaning station');
    if (any('hunters')) item((cx, cy) => mark.hunter(cx, cy), 'Hunter’s seat', 'hook, biter, angler, drifter, leech');
    head('TO EAT');
    { const sizes = [8, 18, 36, 70]; let cx = x + 10; for (const n of sizes) { const r = Math.sqrt(n) * 0.9 + 1.2; mark.swarm(cx + r, y + 2, n); text(String(n), cx + r, y + 2 + r + 9, { size: 10.5, color: INK2, align: 'center' }); cx += r * 2 + 16; }
      text('Swarm: its area is its count', cx + 2, y - 4, { size: 12 }); text('the number beside each is its fish', cx + 2, y + 11, { size: 10.5, color: MUTED }); }
  }
  return { W, H };
}

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.setContent('<!doctype html><html><body style="margin:0;background:#fcfcfb"></body></html>');
const { W, H } = await page.evaluate(draw, { panels, scale });
const out = path.resolve(file); fs.mkdirSync(path.dirname(out), { recursive: true });
await page.setViewportSize({ width: Math.ceil(W), height: Math.ceil(H) });
await page.locator('canvas').screenshot({ path: out, type: 'jpeg', quality: 92 });
await browser.close();
for (const p of panels) console.log(`${p.title}, ${p.size} m, ${p.from}: ${p.count.pieces} pieces (${p.count.wild} natural, ${p.count.perKm2} to 1000 m²), ${p.count.solid} solid, swarms at ${p.swarms.map(([x, z]) => Math.hypot(x - p.spawn[0], z - p.spawn[1]).toFixed(0)).join(' ')} m from the start`);
console.log(`wrote ${out} (${Math.ceil(W) * 2} × ${Math.ceil(H) * 2})`);
