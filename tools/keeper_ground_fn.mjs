// (review polish, also: a crown on each gate arch, and the coral on the first band's capitals was varied by its order (capCoral) and the giant kelp turned, mirrored and sized by
// its index; both are left out of the comparison here as `polished`, and the kelp is checked by tools/kelp_fn.mjs.)
// The Keeper's ground in the first band was cleared of standing columns (and the lintels on them), and its tall sea grass kept low (world.js,
// KEEPER_GROUND, keeperReach, leaveOut). This checks that nothing else moved: against the commit before (2ff5016), band 1 of each world is built
// in Node (tools/headless.mjs) and every piece more than `margin` metres outside the Keeper's reach must be the same to the last digit, every
// piece in it must be one that was there before (the grass only lower), and the solids, sites, swarms, the quiet side's plan, jars, fragments,
// puzzles, the mural and the run of chance must be as they were, except the solids of what was left out.
//   node tools/keeper_ground_fn.mjs [seeds]        one line per world: what was left out, and what moved if anything did
import { load } from './headless.mjs';
import { pathToFileURL } from 'node:url';

// what the review polish changed on purpose in the first band, outside the Keeper's ground: giant kelp, and coral on top of a column
export function polished(world) {
  const bases = world.pieces().filter((p) => p.name === 'base'), cell = new Map(), at = (x, z) => `${Math.floor(x)},${Math.floor(z)}`;
  for (const b of bases) for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) { const k = at(b.x + dx, b.z + dz); if (!cell.has(k)) cell.set(k, []); cell.get(k).push(b); }
  const gates = (world.quiet?.places || []).map((pl) => pl.gate).filter(Boolean);
  const crown = (p) => p.name === 'block' && gates.some((g) => Math.hypot(g.x - p.x, g.z - p.z) < 0.5 && p.y > world.height(p.x, p.z) + 4); // the crowns on the gate arches
  return (p) => crown(p) || p.name === 'giantKelp' || ((p.name === 'stag' || p.name === 'table') && (cell.get(at(p.x, p.z)) || []).some((b) => Math.hypot(b.x - p.x, b.z - p.z) < 0.8 && p.y > b.y + 1.2));
}
export async function keeperGround({ seeds = [1, 2, 3, 777, 4242], ref = '2ff5016', margin = 1.5 } = {}) {
  const now = await load(), was = await load({ ref }), out = [];
  const v = (o) => JSON.stringify(o, (k, x) => (typeof x === 'number' ? +x.toFixed(6) : x));
  // (worlds without the nursery only: the nursery's way was turned away from the rift after this commit, so in a first dive what is laid after it moved with it)
  for (const seed of seeds) for (const nursery of [false]) {
    const a = was.build(seed, 0, { nursery }).world, b = now.build(seed, 0, { nursery }).world, K = b.keeperGround;
    const near = (p) => K.reach(p.x, p.z, margin + 1.6), key = (p, grass) => v([p.name, p.x, p.y, p.z, ...(grass && p.name === 'kelp' ? [] : [p.sx, p.sy, p.sz])]);
    const pa = polished(a), pb = polished(b), A = a.pieces().filter((p) => !pa(p)), B = b.pieces().filter((p) => !pb(p)), moved = [];
    if (v(A.filter((p) => !near(p)).map((p) => key(p))) !== v(B.filter((p) => !near(p)).map((p) => key(p)))) moved.push('pieces outside its ground');
    const had = new Map(); for (const p of A.filter(near)) had.set(key(p, true), (had.get(key(p, true)) || 0) + 1);
    for (const p of B.filter(near)) { const k = key(p, true), n = had.get(k) || 0; if (!n) { moved.push(`a new ${p.name} on its ground`); break; } had.set(k, n - 1); }
    const left = {}; for (const [k, n] of had) if (n) { const name = JSON.parse(k)[0]; left[name] = (left[name] || 0) + n; }
    const lower = B.filter((p) => near(p) && p.name === 'kelp').filter((p) => p.sy < A.find((q) => key(q, true) === key(p, true))?.sy - 1e-9).length;
    const sol = (w) => w.solids.map((c) => v([c.x, c.y, c.z, c.r, c.top]));
    const kept = new Set(sol(b)); const gone = sol(a).filter((c) => !kept.has(c));
    if (sol(b).some((c) => !new Set(sol(a)).has(c))) moved.push('a new solid');
    if (gone.some((c) => { const [x, , z] = JSON.parse(c); return !K.reach(x, z, 2.5); })) moved.push('a solid off its ground');
    const R = (w) => ({ sites: w.sites, swarms: w.schools.map((s) => [s.hx, s.hz, s.n]), quiet: w.quiet && { ...w.quiet, places: undefined }, urns: w.urns.map((u) => [u.x, u.z, u.size]),
      fragments: w.react.fragments.map((f) => [f.x, f.z, f.yaw]), puzzles: w.react.puzzles.map((p) => [p.kind, p.x, p.z]), mural: w.react.mural && [w.react.mural.x, w.react.mural.z], chance: [w.rand(), w.rand(), w.openSpot()] });
    const ra = R(a), rb = R(b); for (const k of Object.keys(ra)) if (v(ra[k]) !== v(rb[k])) moved.push(k);
    const onIt = b.react.puzzles.filter((p) => K.reach(p.x, p.z)).map((p) => p.kind).concat(b.react.fragments.filter((f) => K.reach(f.x, f.z)).map(() => 'fragment'));
    out.push({ seed, nursery, moved, left, solidsGone: gone.length, lower, onIt }); a.dispose(); b.dispose();
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const seeds = (process.argv[2] || '1,2,3,777,4242').split(',').map(Number);
  for (const r of await keeperGround({ seeds })) console.log(`seed ${r.seed}${r.nursery ? ' (nursery)' : ''}: left out ${JSON.stringify(r.left)}, ${r.solidsGone} solids, ${r.lower} grass kept low${r.onIt.length ? `; standing on its ground and left: ${r.onIt.join(', ')}` : ''}; ${r.moved.length ? `MOVED: ${r.moved.join(', ')}` : 'nothing else moved'}`);
}
