// Limbs with no bones in them: an arm, a tentacle, a feeler, a streamer. A strand is one piece that hangs on a body by its root and is
// carried through the water after it. Its owner says, every frame, what shape it would hold if the water were still (a line of points,
// in the body's own space); the strand goes after that shape joint by joint, each on a spring, the root stiff and the tip slack, and
// the water holds it back. So it trails when the body moves, swings wide and late when the body turns, runs on a little when the body
// stops, and settles into the shape it was given when all is still. Each joint keeps its distance from the one before it, so a strand
// never stretches unless it is told to.
// Nothing here knows what animal it is. critters.js gives the piece; squid.js hangs ten of them on a squid, and jelly.js the arms and threads of the jellyfish.
//
// The piece is modelled straight along +z from its root at the origin, and bends at its joints (`cuts`, the z of each, root first):
// it is skinned to a row of bones, one to a length, as the oarfish's own oars are. Everything is worked in the space of the body's
// parent (the world, in a dive; the stand, in the specimen library) and the bones are then set in the body's own space, as legs.js does,
// so a body may be any size and may turn any way.
import * as THREE from 'three';
import { clamp, lerp } from './geo.js';

const A = new THREE.Vector3(), B = new THREE.Vector3(), D = new THREE.Vector3(), Q = new THREE.Quaternion(), FWD = new THREE.Vector3(0, 0, 1), STILL = new THREE.Vector3(), M = new THREE.Matrix4(), T = new THREE.Quaternion();

// which bone each corner of a piece goes with: the length it is on, and near a joint the next one too, so that a bend is a curve and not a fold
function weigh(pos, cuts, index, weight, from = 0, to = pos.count, base = 0) {
  const n = cuts.length - 1, long = cuts[n];
  for (let v = from; v < to; v++) { const z = clamp(pos.getZ(v), 0, long - 1e-6); let k = 0; while (k < n - 1 && cuts[k + 1] <= z) k++;
    const t = (z - cuts[k]) / (cuts[k + 1] - cuts[k]), o = v * 4;
    if (t < 0.5) { if (k === 0) { index[o] = base; weight[o] = 1; } else { index[o] = base + k; weight[o] = 0.5 + t; index[o + 1] = base + k - 1; weight[o + 1] = 0.5 - t; } }
    else if (k === n - 1) { index[o] = base + k; weight[o] = 1; } else { index[o] = base + k; weight[o] = 1.5 - t; index[o + 1] = base + k + 1; weight[o + 1] = t - 0.5; } }
}
const row = (cuts) => cuts.slice(0, cuts.length - 1).map((z) => { const b = new THREE.Bone(); b.position.z = z; return b; });

// geometry: the piece. material: the body's own, which may be shared by all its strands. cuts: the z of each joint.
//   stiff  [at the root, at the tip]: how hard each joint goes after its place, as turns a second of a spring
//   drag   [at the root, at the tip]: how much the water takes it along
//   ease   how soon it stops swinging (1: it does not swing at all)
export function createStrand(geometry, material, cuts, feel = {}) {
  const pos = geometry.attributes.position, index = new Uint16Array(pos.count * 4), weight = new Float32Array(pos.count * 4);
  weigh(pos, cuts, index, weight);
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(index, 4)); geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weight, 4));
  const mesh = new THREE.SkinnedMesh(geometry, material), bones = row(cuts); for (const b of bones) mesh.add(b);
  const skeleton = new THREE.Skeleton(bones); mesh.bind(skeleton); mesh.frustumCulled = false; mesh.castShadow = true;
  return strand(mesh, bones, skeleton, cuts, feel);
}
// Many fine strands drawn as one piece: the threads of a jellyfish, which would be too many to draw one by one. Each still has its own row of
// bones and goes its own way; only the drawing is shared. pieces: [{ geometry, cuts, feel }], each modelled as for createStrand (they need the same
// attributes: position, colour, normal). Returns { mesh, geometry, strands, dispose() }: one strand for each piece, in order, to be trailed like any other.
export function createBundle(pieces, material) {
  const names = ['position', 'color', 'normal'].filter((k) => pieces.every((p) => p.geometry.attributes[k])), total = pieces.reduce((t, p) => t + p.geometry.attributes.position.count, 0);
  const geometry = new THREE.BufferGeometry(), index = new Uint16Array(total * 4), weight = new Float32Array(total * 4), bones = [], rows = [];
  for (const k of names) { const size = pieces[0].geometry.attributes[k].itemSize, all = new Float32Array(total * size); let o = 0; for (const p of pieces) { all.set(p.geometry.attributes[k].array, o); o += p.geometry.attributes[k].array.length; } geometry.setAttribute(k, new THREE.Float32BufferAttribute(all, size)); }
  let from = 0; const pos = geometry.attributes.position;
  for (const p of pieces) { const to = from + p.geometry.attributes.position.count, own = row(p.cuts); weigh(pos, p.cuts, index, weight, from, to, bones.length); rows.push(own); bones.push(...own); from = to; }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(index, 4)); geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weight, 4));
  const mesh = new THREE.SkinnedMesh(geometry, material); for (const b of bones) mesh.add(b);
  const skeleton = new THREE.Skeleton(bones); mesh.bind(skeleton); mesh.frustumCulled = false; mesh.castShadow = true;
  return { mesh, geometry, skeleton, strands: pieces.map((p, i) => strand(mesh, rows[i], null, p.cuts, p.feel || {})), dispose() { skeleton.dispose(); geometry.dispose(); } };
}
function strand(mesh, bones, skeleton, cuts, { stiff = [2.6, 0.5], drag = [1.5, 5.5], ease = 0.85 } = {}) {
  const n = cuts.length - 1, long = cuts[n];
  const points = () => cuts.map(() => new THREE.Vector3()), len = bones.map((_, i) => cuts[i + 1] - cuts[i]);
  const feel = cuts.map((z) => { const s = z / long; return { w: 6.2832 * lerp(stiff[0], stiff[1], Math.sqrt(s)), c: lerp(drag[0], drag[1], s) }; });
  const S = { mesh, bones, skeleton, cuts, long, n, shape: points(), joints: points(), vel: points(), was: points(), now: points(), local: points(), fresh: true, stretch: 1,
    // The owner fills S.shape (n + 1 points, in the body's space; the first is where it hangs) and then calls this.
    //   body: the object it hangs on, its matrix up to date; inv: that matrix turned inside out; scale: the body's size
    //   moving: how the body itself is moving, and water: how the water is, both in the parent's space (null: still)
    //   quick: its springs made this many times harder (a tentacle shot out); stretch: its lengths made this many times longer
    //   up: which way the piece's +y is turned where it hangs, in the body's space
    //   twist: it is wound about its own length, this many radians to a unit of it (a ribbon in a spiral)
    trail(dt, body, inv, { scale = 1, moving = STILL, water = null, quick = 1, stretch = 1, up, twist = 0 } = {}) {
      const flow = water || STILL;
      for (let i = 0; i <= n; i++) S.now[i].copy(S.shape[i]).applyMatrix4(body.matrix);
      if (S.fresh || S.now[0].distanceTo(S.was[0]) > 3 * long * scale) { for (let i = 0; i <= n; i++) { S.joints[i].copy(S.now[i]); S.was[i].copy(S.now[i]); S.vel[i].set(0, 0, 0); } S.fresh = false; } // put down for the first time, or picked up and put somewhere else
      const steps = clamp(Math.ceil(dt * 120), 1, 48), h = dt / steps;
      for (let k = 1; k <= steps && dt > 1e-6; k++) { const f = k / steps;
        S.joints[0].lerpVectors(S.was[0], S.now[0], f);
        for (let i = 1; i <= n; i++) { const j = S.joints[i], v = S.vel[i], w = Math.min(feel[i].w * quick, 0.7 / h);
          A.lerpVectors(S.was[i], S.now[i], f).sub(j).multiplyScalar(w * w); // toward its place,
          A.addScaledVector(B.copy(v).sub(moving), -2 * ease * w).addScaledVector(B.copy(v).sub(flow), -feel[i].c); // the spring's own give, and the water
          v.addScaledVector(A, h); A.copy(j).addScaledVector(v, h);
          D.subVectors(A, S.joints[i - 1]); const d = D.length(); if (d < 1e-7) D.copy(FWD); else D.multiplyScalar(1 / d);
          A.copy(S.joints[i - 1]).addScaledVector(D, len[i - 1] * scale * stretch); // and never further from the joint before it than its length
          v.subVectors(A, j).multiplyScalar(1 / h); j.copy(A); } }
      for (let i = 0; i <= n; i++) { S.was[i].copy(S.now[i]); S.local[i].copy(S.joints[i]).applyMatrix4(inv); }
      // the bones, from joint to joint: each turned from the one before it by the least turn that will do, so that the piece does not twist
      if (up) { B.copy(up).normalize(); A.crossVectors(B, FWD).normalize(); Q.setFromRotationMatrix(M.makeBasis(A, B, FWD)); } else Q.identity();
      D.copy(FWD);
      for (let i = 0; i < n; i++) { A.subVectors(S.local[i + 1], S.local[i]); if (A.lengthSq() < 1e-12) A.copy(D); else A.normalize();
        Q.premultiply(T.setFromUnitVectors(D, A)); D.copy(A);
        bones[i].position.copy(S.local[i]); bones[i].quaternion.copy(Q); if (twist) bones[i].quaternion.multiply(T.setFromAxisAngle(FWD, twist * cuts[i])); bones[i].scale.set(1, 1, stretch); }
      S.stretch = stretch;
    },
    // how far its tip is from where it hangs, as a part of its own length: 1, it is out straight; near 0, it is curled right up
    get reach() { return S.local[n].distanceTo(S.local[0]) / (long * S.stretch); },
    dispose() { skeleton?.dispose(); },
  };
  return S;
}
