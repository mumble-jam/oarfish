// The window round the fish. Whatever stands between the camera and the fish (stone, a lintel, a capital, kelp, tall grass, a coral head)
// is cut away in a soft stippled window round the fish as it is drawn, and anything right in front of the lens is stippled away too, so the
// fish is never lost behind the world and nothing fills the screen. It is a pattern, not a fade: each pixel is kept or dropped by a fixed 4x4
// ordered dither in screen space (the flat look of the game, and nothing to sort). Only what is nearer the camera than the fish is touched,
// so nothing beside or behind it gets a hole; the cut comes in over a metre and a half of depth and over the window's rim, so it does not
// flicker as the camera moves. The shadows are not touched (they are drawn by other materials).
//
// main.js fills SIGHT each frame (`look()`, after the camera is placed); world.js hands its standing materials to `seeThrough`. Every number
// is in SEE.
import * as THREE from 'three';

export const SEE = {
  head: 1.6, body: 1.3, // the window's radius round the head and round the point `along` metres back down the body, in metres at the fish
  along: 3.2, // how far back down the body the window reaches (a capsule from the head to there)
  soft: 0.45, // the outer part of the radius over which the window thins to nothing
  front: 0.7, deep: 1.5, // only what is at least `front` metres nearer the camera than the fish is cut, fully from `front + deep`
  lens: 4.5, lensSoft: 1.2, // anything nearer the lens than `lens` metres is stippled out, fully nearer than `lens - lensSoft`
  lensK: 0.3, // ...or than this part of the way to the fish, when the camera stands farther back (the tall Keeper's fight pulls it back 7 m)
};

// a: the head (x, y in a frame where y runs -1 to 1 up the screen and x as far per unit; z its depth from the camera; w the window's radius
// there in the same units); b: the same for the point down the body; v: the drawing buffer's width and height in pixels, the lens's reach, on
export const SIGHT = { a: { value: new THREE.Vector4() }, b: { value: new THREE.Vector4() }, v: { value: new THREE.Vector4(1, 1, SEE.lens, 0) } };

const HEAD = /* glsl */`
uniform vec4 uSeeA;
uniform vec4 uSeeB;
uniform vec4 uSeeV;
float seeCut(float depth) {
  if (uSeeV.w < 0.5) return 0.0;
  vec2 p = (gl_FragCoord.xy - 0.5 * uSeeV.xy) / (0.5 * uSeeV.y);
  vec2 ab = uSeeB.xy - uSeeA.xy;
  float t = clamp(dot(p - uSeeA.xy, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  float r = mix(uSeeA.w, uSeeB.w, t), d = length(p - (uSeeA.xy + ab * t));
  float win = 1.0 - smoothstep(r * (1.0 - ${SEE.soft.toFixed(3)}), r, d);
  float ahead = smoothstep(${SEE.front.toFixed(3)}, ${(SEE.front + SEE.deep).toFixed(3)}, mix(uSeeA.z, uSeeB.z, t) - depth);
  float lens = 1.0 - smoothstep(uSeeV.z - ${SEE.lensSoft.toFixed(3)}, uSeeV.z, depth);
  return max(win * ahead, lens);
}
float seeDither(vec2 c) {
  vec2 q = mod(floor(c), 4.0);
  float i = q.x + q.y * 4.0;
  // the 4x4 Bayer matrix, read out by index
  float m = i < 8.0 ? (i < 4.0 ? (i < 2.0 ? (i < 1.0 ? 0.0 : 8.0) : (i < 3.0 ? 2.0 : 10.0)) : (i < 6.0 ? (i < 5.0 ? 12.0 : 4.0) : (i < 7.0 ? 14.0 : 6.0)))
                  : (i < 12.0 ? (i < 10.0 ? (i < 9.0 ? 3.0 : 11.0) : (i < 11.0 ? 1.0 : 9.0)) : (i < 14.0 ? (i < 13.0 ? 15.0 : 7.0) : (i < 15.0 ? 13.0 : 5.0)));
  return (m + 0.5) / 16.0;
}
`;
const BODY = /* glsl */`
  { float seeK = seeCut(vViewPosition.z); if (seeK > 0.0 && seeDither(gl_FragCoord.xy) < seeK) discard; }
`;

// Lets the window cut this material. Keeps whatever the material already does to its shaders, and its own cache key.
export function seeThrough(m) {
  if (!m || m.userData.see || !m.isMeshLambertMaterial || m.transparent) return m;
  const before = m.onBeforeCompile, key = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    before?.call(m, sh, r);
    sh.uniforms.uSeeA = SIGHT.a; sh.uniforms.uSeeB = SIGHT.b; sh.uniforms.uSeeV = SIGHT.v;
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', HEAD + 'void main() {')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>' + BODY);
  };
  const was = key === THREE.Material.prototype.customProgramCacheKey ? null : key;
  m.customProgramCacheKey = () => `${was ? was.call(m) : before ? before.toString() : ''}|see`;
  m.userData.see = true; m.needsUpdate = true;
  return m;
}

// Where the window is this frame: the head, and the point `along` metres back down the body, seen from the camera.
const pa = new THREE.Vector3(), pb = new THREE.Vector3();
export function aim(camera, joints, width, height, on = true) {
  SIGHT.v.value.set(width, height, SEE.lens, on ? 1 : 0);
  if (!on || !joints?.length) return;
  let k = 0, run = 0;
  for (; k < joints.length - 1 && run < SEE.along; k++) run += joints[k].distanceTo(joints[k + 1]);
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), asp = camera.aspect;
  for (const [p, j, R, out] of [[pa, joints[0], SEE.head, SIGHT.a.value], [pb, joints[k], SEE.body, SIGHT.b.value]]) {
    p.copy(j).applyMatrix4(camera.matrixWorldInverse);
    const depth = Math.max(0.1, -p.z);
    p.copy(j).project(camera);
    out.set(p.x * asp, p.y, depth, R / (depth * t));
  }
  SIGHT.v.value.z = Math.max(SEE.lens, SEE.lensK * SIGHT.a.value.z);
}
