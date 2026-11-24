// The kelp forest was made lighter (fewer stems of giant kelp, a lighter model, every stem turned to one current: world.js, buildQuiet). This checks
// that nothing else in the first band moved: every piece that is not giant kelp, every solid, every claimed site, every swarm, the quiet side's plan,
// the band's run of chance at the end, against the commit before (26b7785), in Node with no browser (tools/headless.mjs).
//   node tools/kelp_fn.mjs [seeds]        prints one line per world, and what moved if anything did
import { load } from './headless.mjs';
import { pathToFileURL } from 'node:url';

export async function kelpLayout({ seeds = [1, 2, 3, 777, 4242], ref = '26b7785' } = {}) {
  const now = await load(), was = await load({ ref }), out = [];
  const v = (o) => JSON.stringify(o, (k, x) => (typeof x === 'number' ? +x.toFixed(6) : x));
  const pick = (w, kelp) => ({ pieces: w.pieces().filter((p) => p.name !== 'giantKelp').map((p) => [p.name, p.x, p.y, p.z, p.sx, p.sy, p.sz]), solids: w.solids.map((c) => [c.x, c.y, c.z, c.r, c.top]), sites: w.sites,
    swarms: w.schools.map((s) => [s.hx, s.hz, s.n]), quiet: { ...w.quiet, places: undefined, sandflat: w.quiet.sandflat, reef: w.quiet.reef, kelpwood: w.quiet.kelpwood }, urns: w.urns.map((u) => [u.x, u.z, u.size]),
    fragments: w.react.fragments.map((f) => [f.x, f.z, f.yaw]), chance: [w.rand(), w.rand(), w.openSpot()], kelp: kelp ? w.pieces().filter((p) => p.name === 'giantKelp').length : 0 });
  for (const seed of seeds) for (const nursery of [false, true]) {
    const a = was.build(seed, 0, { nursery }).world, b = now.build(seed, 0, { nursery }).world, A = pick(a, true), B = pick(b, true);
    const moved = Object.keys(A).filter((k) => k !== 'kelp' && v(A[k]) !== v(B[k]));
    out.push({ seed, nursery, moved, kelp: [A.kelp, B.kelp] }); a.dispose(); b.dispose();
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const seeds = (process.argv[2] || '1,2,3,777,4242').split(',').map(Number);
  for (const r of await kelpLayout({ seeds })) console.log(`seed ${r.seed}${r.nursery ? ' (nursery)' : ''}: giant kelp ${r.kelp[0]} -> ${r.kelp[1]}; ${r.moved.length ? `MOVED: ${r.moved.join(', ')}` : 'nothing else moved'}`);
}
