// How the game's models are made. Everything is flat-shaded triangles with a colour at each corner, as the
// oarfish is, and built the way it was: a skin over cross-sections, fins of rays, an eye with a pupil.
// A face can be marked self-lit (its colour's alpha is 0): photophores, eyes, lures, the light in a plant.

import * as THREE from 'three';

const C = new THREE.Color();
export const tint = (a, b, t) => `#${new THREE.Color(a).lerp(C.set(b), t).getHexString()}`; // a mixed with b
export const dim = (c, k) => `#${new THREE.Color(c).multiplyScalar(k).getHexString()}`;
// a brightness that may pass 1, for a model whose colour comes from its instance: tips paler than the tone itself
export const bright = (k) => [k, k, k];
const isRGB = (c) => Array.isArray(c) && typeof c[0] === 'number';

export function mesher() {
  const pos = [], col = [];
  const lin = (c) => { if (isRGB(c)) return c; C.set(c); return [C.r, C.g, C.b]; };
  const A = new THREE.Vector3(), B = new THREE.Vector3(), N = new THREE.Vector3(), P = new THREE.Vector3();
  const three = (colour) => (Array.isArray(colour) && !isRGB(colour) ? colour : [colour, colour, colour]);
  const m = {
    // one triangle. colour: one colour, or one for each corner
    tri(a, b, c, colour, glow = false) {
      const cs = three(colour);
      [a, b, c].forEach((p, i) => { const k = lin(cs[i]); pos.push(p[0], p[1], p[2]); col.push(k[0], k[1], k[2], glow ? 0 : 1); });
      return m;
    },
    // a triangle that must face away from `from`, a point inside the model
    out(a, b, c, from, colour, glow) {
      A.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); B.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]); N.crossVectors(A, B);
      if (N.lengthSq() < 1e-12) return m; // a sliver where two rings meet at a point
      P.set((a[0] + b[0] + c[0]) / 3 - from[0], (a[1] + b[1] + c[1]) / 3 - from[1], (a[2] + b[2] + c[2]) / 3 - from[2]);
      const cs = three(colour);
      return N.dot(P) >= 0 ? m.tri(a, b, c, cs, glow) : m.tri(a, c, b, [cs[0], cs[2], cs[1]], glow);
    },
    quad(a, b, c, d, colour, glow) { return m.tri(a, b, c, colour, glow).tri(a, c, d, colour, glow); },
    // a skin over rings of points (each ring the same count, going the same way round).
    // paint(i, k, n) colours the face between ring i and ring i + 1 on side k: a colour, or [at ring i, at ring i + 1]
    skin(rings, paint, glow = false) {
      for (let i = 0; i + 1 < rings.length; i++) {
        const R0 = rings[i], R1 = rings[i + 1], n = R0.length, mid = [0, 0, 0];
        for (const p of [...R0, ...R1]) { mid[0] += p[0] / (2 * n); mid[1] += p[1] / (2 * n); mid[2] += p[2] / (2 * n); }
        for (let k = 0; k < n; k++) {
          const a = R0[k], b = R0[(k + 1) % n], c = R1[(k + 1) % n], d = R1[k], p = typeof paint === 'function' ? paint(i, k, n) : paint;
          const [c0, c1] = Array.isArray(p) && !isRGB(p) ? p : [p, p];
          m.out(a, b, c, mid, [c0, c0, c1], glow).out(a, c, d, mid, [c0, c1, c1], glow);
        }
      }
      return m;
    },
    // a tapered limb from a to b with n sides: radius ra at a, rb at b. colour: one, or [at a, at b]. m.last is its far ring
    limb(a, b, ra, rb, n, colour, glow = false) {
      const ax = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize(), u = new THREE.Vector3(1, 0, 0);
      if (Math.abs(ax.x) > 0.8) u.set(0, 0, 1);
      const v = new THREE.Vector3().crossVectors(ax, u).normalize(); u.crossVectors(v, ax);
      const ring = (p, r) => Array.from({ length: n }, (_, k) => { const t = (k / n) * Math.PI * 2, c = Math.cos(t) * r, s = Math.sin(t) * r; return [p[0] + u.x * c + v.x * s, p[1] + u.y * c + v.y * s, p[2] + u.z * c + v.z * s]; });
      const far = ring(b, rb);
      m.skin([ring(a, ra), far], colour, glow); m.last = far;
      return m;
    },
    // closes a ring with a fan, facing the way `toward` points; lift raises (or sinks) the middle
    cap(ring, toward, colour, lift = 0, glow = false) {
      const n = ring.length, mid = [0, 0, 0];
      for (const p of ring) { mid[0] += p[0] / n; mid[1] += p[1] / n; mid[2] += p[2] / n; }
      const from = [mid[0] - toward[0], mid[1] - toward[1], mid[2] - toward[2]], tip = [mid[0] + toward[0] * lift, mid[1] + toward[1] * lift, mid[2] + toward[2] * lift];
      for (let k = 0; k < n; k++) m.out(tip, ring[k], ring[(k + 1) % n], from, colour, glow);
      return m;
    },
    // a fin: a membrane between a root line and a tip line, coloured ray by ray. For two-sided materials
    fin(root, tip, colours, glow = false) {
      const cs = Array.isArray(colours) && !isRGB(colours) ? colours : [colours];
      for (let k = 0; k + 1 < root.length; k++) m.quad(root[k], root[k + 1], tip[k + 1], tip[k], cs[k % cs.length], glow);
      return m;
    },
    // any three.js geometry, placed with a matrix
    add(geo, matrix, colour, glow = false) {
      const g = geo.index ? geo.toNonIndexed() : geo, a = g.attributes.position, k = lin(colour || '#ffffff');
      for (let i = 0; i < a.count; i++) { P.fromBufferAttribute(a, i); if (matrix) P.applyMatrix4(matrix); pos.push(P.x, P.y, P.z); col.push(k[0], k[1], k[2], glow ? 0 : 1); }
      return m;
    },
    // an eye on the side of a head, looking along `n`: a dark ring, an iris, a pupil
    eye(at, n, r, { iris = '#f6d040', pupil = '#1a171f', rim = '#2c2531', glow = false, slit = false } = {}) {
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...n).normalize());
      const disc = (rad, lift, colour, g, sx = 1) => m.add(new THREE.CircleGeometry(rad, 8), new THREE.Matrix4().compose(new THREE.Vector3(at[0] + n[0] * lift, at[1] + n[1] * lift, at[2] + n[2] * lift), q, new THREE.Vector3(sx, 1, 1)), colour, g);
      disc(r * 1.3, 0, rim, false); disc(r, r * 0.12, iris, glow); disc(r * 0.42, r * 0.24, pupil, false, slit ? 0.5 : 1);
      return m;
    },
    geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
      g.computeVertexNormals();
      return g;
    },
    get triangles() { return pos.length / 9; },
  };
  return m;
}

// the cross-section of a swimming thing at z: n points, from the back round by the animal's left (+x)
export const ringZ = (z, w, up, dn = up, y = 0, n = 6, x = 0) => Array.from({ length: n }, (_, k) => {
  const a = (k / n) * Math.PI * 2, c = Math.cos(a);
  return [x + Math.sin(a) * w, y + (c >= 0 ? up : dn) * c, z];
});
// the same about an upright axis: n points at height y, radius r. star < 1 pulls every other point in (flutes)
export const ringY = (y, r, n = 8, { star = 1, turn = 0, x = 0, z = 0, squash = 1 } = {}) => Array.from({ length: n }, (_, k) => {
  const a = (k / n) * Math.PI * 2 + turn, rad = r * (k % 2 ? star : 1);
  return [x + Math.sin(a) * rad, y, z + Math.cos(a) * rad * squash];
});
// back, flank and belly: the top two faces of a ring take the first colour, the bottom two the last
export const shaded = (back, flank, belly) => (i, k, n) => (k === 0 || k === n - 1 ? back : k === n / 2 - 1 || k === n / 2 ? belly : flank);

// Teaches a lit material two things: faces whose colour has alpha 0 give off their own light, and, if `swim`
// is given, the body bends in a wave that grows from nose to tail. swim: { amp, waves, nose, length } in the
// model's own units; the wave's phase is material.userData.swim.value, which the owner advances.
const VERT_SWIM = `#include <begin_vertex>
  {
    float sw = clamp((uSwimShape.z - position.z) * uSwimShape.w, 0.0, 1.0);
    #ifdef USE_INSTANCING
      float sph = uSwim + instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3 + instanceMatrix[3].y;
    #else
      float sph = uSwim;
    #endif
    transformed.x += sin(sph - sw * uSwimShape.y) * uSwimShape.x * (0.1 + 0.9 * sw * sw);
  }`;
export function alive(material, { glow = 1, swim = null } = {}) {
  const u = { uGlow: { value: glow }, uSwim: { value: 0 }, uSwimShape: { value: new THREE.Vector4(swim?.amp || 0, swim?.waves || 0, swim?.nose || 0, swim ? 1 / swim.length : 0) } };
  material.userData.swim = u.uSwim; material.userData.glow = u.uGlow;
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    if (swim) sh.vertexShader = `uniform float uSwim;\nuniform vec4 uSwimShape;\n${sh.vertexShader.replace('#include <begin_vertex>', VERT_SWIM)}`;
    sh.fragmentShader = `uniform float uGlow;\n${sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR_ALPHA\n  totalEmissiveRadiance += vColor.rgb * (1.0 - vColor.a) * uGlow;\n#endif')}`;
  };
  material.customProgramCacheKey = () => `alive${swim ? 1 : 0}`;
  return material;
}

// The material of everything that grows. It may sway with the water (each one at its own place in the swell, taken from
// where it stands), and faces marked for it give off light. time: { value } in seconds, the owner's clock.
export function growing({ sway = 0, glow = 0, double = true } = {}, time) {
  const m = new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true, side: double ? THREE.DoubleSide : THREE.FrontSide }), amp = { value: sway }, lit = { value: glow };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time; sh.uniforms.uSway = amp; sh.uniforms.uGlow = lit;
    sh.vertexShader = 'uniform float uTime;\nuniform float uSway;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  #ifdef USE_INSTANCING
    float kph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.53;
    float kb = position.y * position.y * uSway;
    transformed.x += sin(uTime * 1.1 + kph + position.y * 2.4) * 0.17 * kb;
    transformed.z += cos(uTime * 0.9 + kph * 1.7 + position.y * 2.0) * 0.13 * kb;
  #endif`);
    sh.fragmentShader = 'uniform float uGlow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR_ALPHA\n  totalEmissiveRadiance += vColor.rgb * (1.0 - vColor.a) * uGlow;\n#endif');
  };
  m.customProgramCacheKey = () => 'growing';
  return m;
}
