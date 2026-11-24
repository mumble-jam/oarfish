// Checks of the quiet side's layout (quiet.js, world.quiet), made in Node with no browser (tools/headless.mjs): for the game suite, and on its own:
//   node tools/quiet_fn.mjs [worlds]        prints one line per kind of check, for that many worlds (each with and without the nursery)
// Each check returns the worlds it failed in, and a short reason for the first few.
import { load } from './headless.mjs';
import { pathToFileURL } from 'node:url';

export async function quietAudit({ worlds = 120, ref = '5428c39' } = {}) {
  const game = await load(), was = ref ? await load({ ref }) : null, { laneDistance } = await game.mod('quiet.js'), { shellSpots } = await game.mod('shells.js'), { KEEPER_FIGHT } = await game.mod('guards.js');
  const fail = { place: [], overlap: [], gate: [], lanes: [], stems: [], stayed: [], grow: [], colonnade: [] }, why = [];
  const note = (k, seed, s) => { fail[k].push(seed); if (why.length < 12) why.push(`${k} ${seed}: ${s}`); };
  const stats = { kelpArea: [], columns: [], grow: [] };
  for (let seed = 1; seed <= worlds; seed++) for (const nursery of [false, true]) {
    const tag = `${seed}${nursery ? 'n' : ''}`, { world: w, spawn, wrap, size } = game.build(seed, 0, { nursery }), q = w.quiet, r = w.rift;
    const far = (x, z, cx, cz) => Math.hypot(wrap(x - cx), wrap(z - cz)), keeper = { x: r.x - r.nx * 24, z: r.z - r.nz * 24, r: KEEPER_FIGHT.leash || 14 };
    const homes = w.schools.filter((s) => s.n > 0 && !s.bloom), b = w.bloom;
    // every place and every anchor: inside the square, out of the rift, off the Keeper's ground, out of the bloom, clear of every swarm's home
    const anchors = [];
    for (const p of q.places) anchors.push([p.name, p.x, p.z, 0], [`${p.name} gate`, p.gate.x, p.gate.z, 0]);
    const S = q.sandflat, R = q.reef, K = q.kelpwood;
    anchors.push(['meadow', S.meadow.x, S.meadow.z, S.meadow.r], ['puffer', S.puffer.x, S.puffer.z, S.puffer.r], ...S.tables.map((t, i) => [`table ${i}`, t.x, t.z, t.size]), ...S.burrows.map((o, i) => [`burrow ${i}`, o.x, o.z, 0]));
    anchors.push(['station', R.station.x, R.station.z, 0], ...R.heads.map((o, i) => [`head ${i}`, o.x, o.z, o.r]), ...R.rods.map((o, i) => [`rod ${i}`, o.x, o.z, 0]), ...R.grow.map((o, i) => [`grow ${i}`, o.x, o.z, o.r]));
    anchors.push(['clearing', K.clearing.x, K.clearing.z, K.clearing.r], ['nook', K.nook.x, K.nook.z, K.nook.r], ...K.lanes.flatMap((ln) => ln.points.map((pt, i) => [`${ln.name} ${i}`, pt[0], pt[1], 0])), ...q.colonnade.map((c, i) => [`column ${i}`, c.x, c.z, 0.8]));
    for (const [name, x, z, rad] of anchors) {
      const bad = x - rad < 0 || z - rad < 0 || x + rad > size || z + rad > size ? 'outside the square' : r.in(x, z) > -3 ? 'in the rift' : far(x, z, keeper.x, keeper.z) < keeper.r + 2 ? 'on the Keeper\'s ground'
        : b && far(x, z, b.x, b.z) < b.R + 4 ? 'in the bloom' : homes.some((s) => far(x, z, s.hx, s.hz) < s.ball * 2.6 + 2) ? 'on a swarm\'s home' : null;
      if (bad) { note('place', tag, `${name} ${bad}`); break; } }
    // no place overlaps another, or any ground claimed before it
    { const mine = w.sites.filter((s) => s[3] === 'quiet'), theirs = w.sites.filter((s) => s[3] !== 'quiet' && !(Math.abs(s[0] - K.field.x) < 1e-6 && Math.abs(s[1] - K.field.z) < 1e-6)); // (the forest grows out of the old field: that one it may touch)
      const hit = mine.find((m) => theirs.find((t) => far(m[0], m[1], t[0], t[1]) < m[2] + t[2] - 1e-6));
      const cross = far(S.x, S.z, R.x, R.z) < S.R + R.R;
      const kelpOn = [S, R].some((p) => { const a = K.axis, L = Math.hypot(a.bx - a.ax, a.bz - a.az), dx = p.x - a.ax, dz = p.z - a.az, t = Math.max(0, Math.min(L, dx * a.ux + dz * a.uz)); return Math.hypot(dx - a.ux * t, dz - a.uz * t) < a.half + p.R; });
      if (hit) note('overlap', tag, `quiet ground at ${hit[0].toFixed(1)},${hit[1].toFixed(1)} r${hit[2]} on earlier ground`); else if (cross || kelpOn) note('overlap', tag, 'two places overlap'); }
    // each arch can be threaded: along the line through it, 1.5 to 4 m over the bed, nothing solid within half a metre; and at least 4 m of water under its lintel
    for (const p of q.places) { const g = p.gate, fx = Math.sin(g.yaw), fz = Math.cos(g.yaw);
      if (!(g.under > 4)) { note('gate', tag, `${p.name} lintel only ${g.under?.toFixed(2)} m up`); continue; }
      for (let s = -7; s <= 7; s += 0.25) { const x = g.x + fx * s, z = g.z + fz * s, y0 = w.height(x, z); let stuck = null;
        for (const c of w.solids) { if (c.off) continue; const d = far(x, z, c.x, c.z);
          if (c.top !== undefined) { if (c.top > y0 + 1.5 && d < c.r + 0.5) stuck = c; } else for (const y of [y0 + 1.5, y0 + 2.5, y0 + 3.5]) if (Math.hypot(d, y - c.y) < c.r + 0.5) stuck = c; }
        if (stuck) { note('gate', tag, `${p.name}: something solid ${s.toFixed(1)} m along the way through`); break; } } }
    // each lane can be swum end to end: nothing solid on it, no stem of kelp within its half width, and the main lane runs from the gate to the clearing
    { const stems = w.pieces().filter((pc) => pc.name === 'giantKelp' || pc.name === 'kelp');
      for (const ln of K.lanes) { let bad = null;
        for (let i = 0; i + 1 < ln.points.length && !bad; i++) { const [ax, az] = ln.points[i], [bx, bz] = ln.points[i + 1], L = Math.hypot(bx - ax, bz - az);
          for (let t = 0; t <= L && !bad; t += 0.5) { const x = ax + (bx - ax) * (t / L), z = az + (bz - az) * (t / L), y0 = w.height(x, z);
            for (const c of w.solids) { if (c.off) continue; const d = far(x, z, c.x, c.z); if (c.top !== undefined ? c.top > y0 + 1.5 && d < c.r + 0.4 : Math.hypot(d, y0 + 2.5 - c.y) < c.r + 0.4) { bad = `${ln.name}: solid at ${x.toFixed(1)},${z.toFixed(1)}`; break; } } } }
        const close = stems.find((pc) => laneDistance(ln, pc.x, pc.z) < ln.half);
        if (bad) note('lanes', tag, bad); else if (close) note('stems', tag, `${ln.name}: a stem ${laneDistance(ln, close.x, close.z).toFixed(2)} m from its line`); }
      const m = K.lanes[0].points; if (far(m[0][0], m[0][1], K.gate.x, K.gate.z) > 4 || far(m[m.length - 1][0], m[m.length - 1][1], K.clearing.x, K.clearing.z) > K.clearing.r + 1) note('lanes', tag, 'the main lane does not run from the gate to the clearing'); }
    // at least twelve empty spots for coral, in order, none on a head or a rod
    if (R.grow.length < 12 || R.grow.some((g, i) => g.order !== i && !R.grow.some((h) => h.order === i)) || R.grow.some((g) => R.heads.some((h) => far(g.x, g.z, h.x, h.z) < h.r + 1))) note('grow', tag, `${R.grow.length} spots`);
    // the colonnade: at most forty, each toward a place, 9 to 16 m from the one before it on its line (or one has been left out where the ground is taken)
    { const n = q.colonnade.length; if (n > 40 || n < 6) note('colonnade', tag, `${n} columns`);
      for (const k of ['sandflat', 'reef', 'kelpwood']) { const line = q.colonnade.filter((c) => c.toward === k); for (let i = 1; i < line.length; i++) { const d = far(line[i].x, line[i].z, line[i - 1].x, line[i - 1].z); const mx = (line[i].x + line[i - 1].x) / 2, mz = (line[i].z + line[i - 1].z) / 2, ruin = w.sites.some((st) => st[2] >= 8 && st[3] !== 'quiet' && far(mx, mz, st[0], st[1]) < st[2]); // (a gap where the line crosses a ruin, which has its own columns, is allowed)
          if (d < 9.5 || (d > 32 && !ruin)) note('colonnade', tag, `${k}: ${d.toFixed(1)} m between two`); } } }
    stats.kelpArea.push(Math.round((Math.hypot(K.axis.bx - K.axis.ax, K.axis.bz - K.axis.az) * 2 * K.axis.half + Math.PI * K.axis.half ** 2) / (Math.PI * 121) * 10) / 10 + 1); stats.columns.push(q.colonnade.length); stats.grow.push(R.grow.length);
    // what was there before stands where it stood: swarms, puzzles, fragments, the mural, jars, pilot fish, chimes, the bloom, the shells, every earlier claim
    if (was) { const v = (o) => JSON.stringify(o, (k, x) => (typeof x === 'number' ? +x.toFixed(4) : x)), a = was.build(seed, 0, { nursery }).world;
      const pick = (o) => ({ puzzles: o.react.puzzles.map((p) => [p.kind, p.x, p.z, p.cache.x, p.cache.z]), fragments: o.react.fragments.map((f) => [f.x, f.z]), mural: o.react.mural && [o.react.mural.x, o.react.mural.z], urns: o.urns.map((u) => [u.x, u.z]),
        swarms: o.schools.map((s) => [s.hx, s.hz, s.n]), bloom: o.bloom && [o.bloom.x, o.bloom.z, o.bloom.bells.map((bb) => [bb.x, bb.z])], pilots: o.react.pilots.map((p) => [p.x, p.z]), chimes: o.react.chimes.map((c) => [c.x, c.z]),
        sites: o.sites.filter((s) => s[3] !== 'quiet').map((s) => s.slice(0, 3)), shells: shellSpots(o, { seed, floor: 0, count: 3 }) });
      const A = pick(a), B = pick(w), moved = Object.keys(A).filter((k) => v(A[k]) !== v(B[k])); if (moved.length) note('stayed', tag, moved.join(', ')); a.dispose(); }
    w.dispose();
  }
  return { fail, why, stats };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = +(process.argv[2] || 60), { fail, why, stats } = await quietAudit({ worlds: n });
  for (const [k, v] of Object.entries(fail)) console.log(`${k.padEnd(10)} ${v.length ? `FAILS in ${v.length}: ${v.slice(0, 12).join(' ')}` : 'ok'}`);
  for (const s of why) console.log('  ', s);
  const hist = (a) => Object.entries(a.reduce((o, x) => ((o[x] = (o[x] || 0) + 1), o), {})).map(([k, c]) => `${k}:${c}`).join(' ');
  console.log('kelp forest, with the old field, in old fields:', hist(stats.kelpArea)); console.log('columns:', hist(stats.columns)); console.log('growth spots:', hist(stats.grow));
}
