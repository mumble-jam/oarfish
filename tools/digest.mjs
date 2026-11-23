// A fingerprint of everything a band is built of, to prove that a change has moved nothing in it: run it before and after, and the lines
// that must not change must come out the same to the letter.
//   node tools/digest.mjs [--ref <commit>] [--parts] [seeds] [bands]
//   node tools/digest.mjs --ref main 1,2,3,777,4242 1,2,3,4        the game as it was at a commit (bands count from 0, as in the code)
// One line to a world. What goes into it: the world's size, start and way down; the bed (its height, the height as drawn, and the mesh that is
// drawn, from five places); every piece that is scattered, with its turn and its tint; every other instanced thing, cloud and swarm fish included;
// what is solid; the ground that places claim; swarms, puzzles, fragments, cleaning stations, the mural, jars, pilot fish, chimes, hunters' seats;
// the shells lying about; the hunters; where the keeper or the Sum starts; and where the run of chance has got to when all of it is made.
// --parts prints the fingerprint of each of those too, to see which one moved.
import crypto from 'node:crypto';
import { load } from './headless.mjs';

const args = process.argv.slice(2), take = (flag) => { const i = args.indexOf(flag); return i < 0 ? null : args.splice(i, 2)[1]; };
const ref = take('--ref'), parts = args.includes('--parts'); if (parts) args.splice(args.indexOf('--parts'), 1);
const seeds = (args[0] || '4242').split(',').map(Number), bands = (args[1] || '0,1,2,3,4').split(',').map(Number);
const game = await load({ ref }), { THREE } = game;
const [Foes, Shells, Guards, Boss] = await Promise.all(['foes.js', 'shells.js', 'guards.js', 'boss.js'].map(game.mod));

const sha = (feed) => { const h = crypto.createHash('sha256'); feed(h); return h.digest('hex').slice(0, 16); };
const text = (v) => sha((h) => h.update(JSON.stringify(v, (k, x) => (typeof x === 'number' && !Number.isFinite(x) ? String(x) : x))));
const bytes = (arrays) => sha((h) => { for (const a of arrays) h.update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)); });
const v3 = (p) => p && [p.x, p.y, p.z];
const plain = (o, skip = []) => Object.fromEntries(Object.entries(o).filter(([k, v]) => !skip.includes(k) && (v === null || ['number', 'string', 'boolean'].includes(typeof v))));
const tried = (fn) => { try { return fn(); } catch (e) { return `could not be made here: ${e.message}`; } };

for (const seed of seeds) for (const band of bands) {
  const { scene, world: w, size, spawn, solids, sites } = game.build(seed, band), r = w.rift, out = {};
  out.frame = text({ size, spawn: v3(spawn), goal: plain(w.goal), hall: w.hall && plain(w.hall), rift: r && { ...plain(r), ins: [-30, -8, 0, 8, 30].flatMap((u) => [-20, -6, 0, 6, 20].map((a) => r.in(r.x + r.tx * u + r.nx * a, r.z + r.tz * u + r.nz * a))), w: [-30, -8, 0, 8, 30].map(r.w), mid: [-30, -8, 0, 8, 30].map(r.mid) } });
  // the bed: as it is meant, as it is drawn, and the mesh itself with its colours (the green patches are colours)
  { const hs = []; for (let x = 0.7; x < size; x += 3.7) for (let z = 1.1; z < size; z += 3.7) hs.push(w.height(x, z), w.drawn(x, z));
    const cam = new THREE.PerspectiveCamera(), meshes = [], grid = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) grid.push([(i + 0.5) * size / 4, (j + 0.5) * size / 4]);
    const everything = []; // every instanced thing, seated for sixteen places across the band so that the small things, which are only drawn near, are all in it
    for (const [x, z] of grid) { const at = new THREE.Vector3(x, w.height(x, z) + 3, z); w.update(0, at, at, cam, null); w.dress(at);
      const bed = scene.children.find((o) => o.isMesh && !o.isInstancedMesh), n = bed.geometry.drawRange.count * 3;
      meshes.push(bed.geometry.attributes.position.array.subarray(0, n), bed.geometry.attributes.color.array.subarray(0, n));
      scene.traverse((o) => { if (!o.isInstancedMesh) return; everything.push(new Float32Array([o.count]), o.instanceMatrix.array.slice()); if (o.instanceColor) everything.push(o.instanceColor.array.slice()); }); }
    out.bed = text(hs) + bytes(meshes); out.instances = bytes(everything); }
  out.pieces = text(w.pieces().map((p) => [p.name, p.x, p.y, p.z, p.sx, p.sy, p.sz, p.tilt])); // (how each is turned, and its tint, are in `instances`)
  out.solids = text(solids.map((c) => [c.x, c.y, c.z, c.r, c.top, !!c.off]));
  out.sites = text(sites);
  out.swarms = text(w.schools.map((s) => [s.tier, s.kind, s.n, s.hx, s.hz, s.hy, s.r, s.ph, s.clock, s.tone, s.ball, s.slack, s.tall, s.gap]));
  const R = w.react;
  out.things = text({ puzzles: R.puzzles.map((p) => ({ ...plain(p), cache: plain(p.cache), hoops: p.hoops && p.hoops.map((h) => plain(h)) })), fragments: R.fragments.map((f) => plain(f)), stations: R.stations.map((s) => ({ ...plain(s), fish: s.fish.map((f) => [v3(f.p), f.ph, f.slot, f.side, f.yaw]) })),
    mural: R.mural && plain(R.mural), urns: w.urns.map((u) => plain(u)), pilots: R.pilots.map((p) => plain(p)), chimes: R.chimes.map((c) => ({ ...plain(c), bars: c.bars.map((b) => plain(b)) })),
    spots: { ...w.spots, pens: [...(w.spots.pens || [])] }, grown: Object.fromEntries(Object.entries(R.grown).map(([k, v]) => [k, v.length])), stats: w.stats, greatest: R.greatest, nursery: !!w.nursery });
  const count = w.hall ? 2 : 3, kit = { mesh: () => new THREE.Object3D(), glow: null };
  out.shells = tried(() => text(Shells.createShellField(scene, w, kit, { seed, floor: band, count, types: Shells.SHELL_TYPES }).items.map((it) => [it.type, it.x, it.y, it.z, it.ph])));
  out.hunters = tried(() => { const f = Foes.createFoes(scene, w, { seed }, {}); return text({ biters: f.biters.map((b) => [v3(b.pos), v3(b.home), b.wig]), hooks: f.hooks.map((h) => [h.x, h.z, h.y0, h.ph]), anglers: f.anglers.map((a) => [v3(a.pos), v3(a.home), a.yaw, a.ph]), mines: f.mines.map((m) => [v3(m.pos), m.ph]), leeches: f.leeches.map((l) => [v3(l.pos)]) }); });
  out.keeper = tried(() => (w.hall ? (() => { const s = Boss.createSum(scene, w, { seed }, {}); return text({ hp: v3(s.debug.hp), home: s.debug.home, n: s.debug.N }); })() : (() => { const g = Guards.createGuard(scene, w, { seed, floor: band }, {}); return text({ kind: g.kind, pos: v3(g.pos), yaw: g.yaw }); })()));
  out.chance = text([w.rand(), w.rand(), w.rand(), w.openSpot(), w.openSpot(10)]);
  const failed = Object.entries(out).filter(([, v]) => v.startsWith('could not')).map(([k, v]) => `${k} ${v}`);
  console.log(`seed ${seed} band ${band + 1}  ${size} m  ${text(out)}  (${w.pieces().length} pieces, ${solids.length} solid, ${w.schools.length} swarms)${failed.length ? `  NOT IN IT: ${failed.join('; ')}` : ''}`);
  if (parts) console.log('   ' + Object.entries(out).map(([k, v]) => `${k} ${v}`).join('  '));
  w.dispose();
}
