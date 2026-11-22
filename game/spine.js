// A swimming body that bends. kit.js already makes a body swim (a wave that runs down its length). This adds, in the same
// shader, a neck: everything ahead of it can turn and nod on it, and everything behind it can curve aside, so one model can
// sweep its head, cock it back for a blow, or lie along the curve it is swimming, without being cut into pieces.
// The material has to be flat-shaded (as the keepers' is): its faces then find their own light, however they are bent.
import * as THREE from 'three';

const BEND = `
  { // what is ahead of the neck turns (uHead.x, toward the animal's left) and nods (uHead.y, upward) about it; what is behind curves aside
    float f = smoothstep(uNeck - 0.45, uNeck + 0.45, position.z), a = uHead.x * f, b = uHead.y * f;
    float zz = transformed.z - uNeck, back = max(0.0, uNeck - position.z);
    float ca = cos(a), sa = sin(a), cb = cos(b), sb = sin(b);
    float x1 = transformed.x * ca + zz * sa; zz = zz * ca - transformed.x * sa;
    float y1 = transformed.y * cb + zz * sb; zz = zz * cb - transformed.y * sb;
    transformed.x = x1 + uCurve * back * back; transformed.y = y1; transformed.z = uNeck + zz;
  }`;

// neck: where along the body (z, nose toward +z) the head turns. The material gets userData.head (a Vector2: turn, nod, in
// radians) and userData.curve ({ value }: how far aside the body lies, in metres a metre squared back from the neck).
export function bendy(material, { neck }) {
  const u = { uHead: { value: new THREE.Vector2() }, uNeck: { value: neck }, uCurve: { value: 0 } };
  const before = material.onBeforeCompile, key = material.customProgramCacheKey ? material.customProgramCacheKey() : '';
  material.onBeforeCompile = (sh, renderer) => {
    before?.(sh, renderer); Object.assign(sh.uniforms, u);
    sh.vertexShader = `uniform vec2 uHead;\nuniform float uNeck;\nuniform float uCurve;\n${sh.vertexShader.replace('#include <project_vertex>', `${BEND}\n#include <project_vertex>`)}`;
  };
  material.customProgramCacheKey = () => `${key}|bendy`;
  material.userData.head = u.uHead.value; material.userData.curve = u.uCurve;
  return material;
}
