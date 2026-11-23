// How the creatures of the sand flat live when the pause menu's testing tool brings them ("Bring one to look at"). This is not their behaviour
// in the dive, which has not been decided: it is only enough life for each model to be seen where it would live, beside the fish, doing the
// things its poses are for. Nothing here is a rule, nothing is harmed, and nothing is kept.
//   hermit      a short line of four, smallest to biggest, by an empty shell a size up: the biggest feels the shell, the others hold on to the shell
//               ahead. A body coming within a couple of metres sends them in; when it has gone they peer out, and then come out again.
//   trumpet     hangs head-down by the fish while it is still; when the fish swims, it comes and lies close along its body and goes with it,
//               and now and then darts out ahead and strikes at nothing
//   burrow      the goby on watch at its hole and the shrimp working; a body near makes the goby flick, nearer sends both down the hole
//   gardeneel   a colony of them in a patch of sand, each in its own hole, facing the current; they sink as a body comes near and rise again after
//   puffer      over its finished circle, ploughing in along a valley and out again; a body very near and it puffs up
//   sandcircle  three circles side by side, at three stages of building
// main.js calls bringSand(id, ctx) and then pet.step(dt) every frame, and pet.dispose() to take it away. ctx: { make, scene, rig, wrapD, world, time }.
import * as THREE from 'three';
import { HERMIT } from './critters.js';
import { clamp, damp } from './geo.js';

export const SAND_PETS = {
  hermit: { here: 'A line of four hermit crabs, smallest to biggest, is on the sand just ahead of you, by an empty shell. They are only to look at.', gone: 'The hermit crabs are gone.' },
};
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// how near the nearest part of the fish's body is to (x, z), across the bed
function nearest(ctx, x, z) { let d = Infinity; for (const j of ctx.rig.joints) d = Math.min(d, Math.hypot(ctx.wrapD(j.x - x), ctx.wrapD(j.z - z))); return d; }
// a spot on the bed ahead of the fish and to one side, and the way across its path there
function spot(ctx, ahead, aside) {
  const r = ctx.rig, l = Math.hypot(r.forward.x, r.forward.z) || 1, fx = r.forward.x / l, fz = r.forward.z / l;
  return { x: r.pos.x + fx * ahead + fz * aside, z: r.pos.z + fz * ahead - fx * aside, fx, fz, ax: fz, az: -fx };
}

export function bringSand(id, ctx) { return MAKERS[id](ctx); }
const MAKERS = {
  hermit(ctx) {
    const w = ctx.world, ground = (p) => { p.y = w.drawn(p.x, p.z); return p; }, at = spot(ctx, 5, 1.5), sizes = HERMIT.sizes, kinds = ['snail', 'spire', 'coil', 'snail'];
    // along a line across the fish's path, the biggest nearest the empty shell, each facing the one ahead of it
    const yaw = Math.atan2(at.ax, at.az); let d = 0;
    const list = sizes.map((k, i) => { const a = ctx.make('hermit'); a.object.scale.setScalar(k); a.rig.wear(kinds[i]); ctx.scene.add(a.object);
      if (i) d += 0.24 * (k + sizes[i - 1]); const pos = new THREE.Vector3(at.x + at.ax * d, 0, at.z + at.az * d); return { a, k, pos, mood: 'pick', t: 1 + i, away: 9, n: i }; });
    const big = list[list.length - 1], end = d + 0.19 * big.k;
    const empty = { x: at.x + at.ax * end, z: at.z + at.az * end }; big.a.rig.lay(big.a.rig.shells[1], 'horn', empty.x, empty.z, yaw + Math.PI, ground, 1.3);
    const look = new THREE.Vector3(), grip = new THREE.Vector3();
    return { list, centre: new THREE.Vector3(at.x + at.ax * d * 0.6, w.drawn(at.x + at.ax * d * 0.6, at.z + at.az * d * 0.6) + 0.2, at.z + at.az * d * 0.6),
      step(dt) { const t = ctx.time;
        list.forEach((s, i) => { const near = nearest(ctx, s.pos.x, s.pos.z); s.away = near < 2.2 + 0.4 * s.k ? 0 : s.away + dt; // a body within a couple of metres, and it is in
          const inn = s.away < 2.5, peer = inn && s.away > 0.6; let act = null, aim = null;
          if (!inn) { if (s === big) { act = 'probe'; aim = grip.set(empty.x - at.ax * 0.12 * s.k, w.drawn(empty.x, empty.z) + 0.03, empty.z - at.az * 0.12 * s.k); } else { const ahead = list[i + 1]; act = Math.sin(t * 0.3 + i * 2) > -0.3 ? 'hold' : 'pick'; aim = grip.copy(ahead.a.object.position).addScaledVector(new THREE.Vector3(at.ax, 0, at.az), -0.16 * ahead.k); } }
          const j = ctx.rig.joints[0]; look.set(j.x, j.y, j.z);
          s.a.rig.update(dt, { x: s.pos.x, z: s.pos.z, yaw, vx: 0, vz: 0, ground, time: t + i * 1.7, in: inn, peer, act, look: peer ? look : null, at: aim }); }); },
      dispose() { for (const s of list) { ctx.scene.remove(s.a.object); s.a.dispose(); } } };
  },
};
