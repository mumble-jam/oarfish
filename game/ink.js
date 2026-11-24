// Squid ink: what a squid leaves when it is pressed hard. A real squid lets go a blob of ink about its own size and shape that takes the attack
// while the squid leaves (Wikipedia, "Cephalopod ink": the "pseudomorph"); the ink is mucus-bound, so it holds together for a moment and then
// billows, drags out in streamers and thins into the water. George saw the first version, a solid copy of the mantle in dark purple with a halo,
// and said it looked like 'a dark solid object, not a liquid in liquid'. This is the second.
//
// How it is drawn: every cloud is a heap of soft puffs, the same family as the silt (world.js) and the rift's cloud: a low round shape with its
// own colour, see-through, and fading away toward its rim as the face turns from the eye, so no puff has an edge. Nothing writes depth and
// nothing casts a shadow from the sun. At the moment it is left, the puffs are laid along the squid as it is posed: a slice of the mantle
// (fins and all) for each puff down its length, the head, and three long puffs down each arm, so the copy has the squid's outline and is dense
// where the puffs overlap. Then each puff swells and thins, turns round to a ball and loses its stretch, and is carried by a slow curling
// water (an ABC flow, which turns without gathering or spreading), sagging, and drifting with the current. A few unseen leaders set off from
// the arm tips and the mantle's point and drop thin puffs behind them as they go: those are the wisps and tendrils, and they curl because
// their leaders ride the same water. The fish stirs it: a part of the body passing through a puff pushes it aside and along, which tears a
// hole and stretches what it pushes, and a part going quickly through ink drags a streamer after it. A soft faint stain lies on the bed under it.
// All the puffs of all the clouds are one InstancedMesh (one draw call); each cloud adds one flat stain (one more). Every number is in BLOOM.ink.
import * as THREE from 'three';
import { clamp, lerp, glowTexture } from './geo.js';

const UPZ = new THREE.Vector3(0, 0, 1), V = new THREE.Vector3(), W = new THREE.Vector3(), Q = new THREE.Quaternion(), M4 = new THREE.Matrix4(), S3 = new THREE.Vector3(), P3 = new THREE.Vector3(), COL = new THREE.Color();
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// The puffs' own shading: see-through by the puff's fade, and thinning to nothing toward the rim. Each corner of the unit ball is its own
// normal, so the normal is turned by the instance's matrix as three.js turns normals (stretched puffs fade at their own rims).
function puffMaterial(look) {
  const m = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, opacity: 1 });
  m.userData.edge = look.edge; // how fast a puff thins toward its rim: the checks read it
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uEdge = { value: look.edge };
    sh.vertexShader = `attribute float fade;\nvarying float vFade;\nvarying float vRim;\n${sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
  { vec3 nrm = position; mat3 im = mat3(instanceMatrix); nrm /= vec3(dot(im[0], im[0]), dot(im[1], im[1]), dot(im[2], im[2]));
    nrm = normalize(normalMatrix * (im * nrm)); vRim = abs(dot(nrm, normalize(-mvPosition.xyz))); vFade = fade; }`)}`;
    sh.fragmentShader = `uniform float uEdge;\nvarying float vFade;\nvarying float vRim;\n${sh.fragmentShader.replace('#include <opaque_fragment>', 'diffuseColor.a *= vFade * pow(smoothstep(0.02, 0.97, vRim), uEdge);\n#include <opaque_fragment>')}`;
  };
  m.customProgramCacheKey = () => 'ink-puff';
  return m;
}

// scene: where it is drawn. look: BLOOM.ink. bed(x, z): the height of the bed as it is drawn. current: { x, z }, which way the water goes.
export function createInk(scene, look, bed, current) {
  const L = look, CAP = L.clouds * (L.body + L.crumbs + L.veil);
  const geo = new THREE.IcosahedronGeometry(1, 1), fade = new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1); geo.setAttribute('fade', fade);
  const mat = puffMaterial(L), mesh = new THREE.InstancedMesh(geo, mat, CAP);
  mesh.name = 'ink'; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.renderOrder = 3; mesh.count = 0; mesh.visible = false;
  mesh.setColorAt(0, COL.set(L.colour)); scene.add(mesh);
  const glow = glowTexture(), stainGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const dark = new THREE.Color(L.colour), pale = new THREE.Color(L.thin);
  const clouds = [], jWas = [];
  let seq = 0;

  // the body as it is posed, in the space of the copy of the band its spot is kept in (off: drawn = kept + off)
  // a: the squid as npc.js made it (a.object, a.body, a.rig.arms); off: { x, z }
  function slices(a) { // the mantle (and fins) cut across into slices: for each, how wide and how tall it is, in the model's own units. Once.
    if (a.body.geometry.userData.inkSlices) return a.body.geometry.userData.inkSlices;
    const pos = a.body.geometry.attributes.position, out = L.slices.map((z) => ({ z, x: 0, y0: 1e9, y1: -1e9 }));
    for (let i = 0; i < pos.count; i++) { const z = pos.getZ(i); for (const s of out) if (Math.abs(z - s.z) < L.slab) { s.x = Math.max(s.x, Math.abs(pos.getX(i))); s.y0 = Math.min(s.y0, pos.getY(i)); s.y1 = Math.max(s.y1, pos.getY(i)); } }
    const keep = out.filter((s) => s.x > 0); a.body.geometry.userData.inkSlices = keep; return keep;
  }
  function puff(c, kind, x, y, z, rx, ry, rz, q, a0, tone, life = 1e9) {
    const p = { kind, p: new THREE.Vector3(x, y, z), v: new THREE.Vector3(), r: new THREE.Vector3(rx, ry, rz), q: q.clone(), a0, tone, age: 0, life, torn: 0, stretch: 0 };
    p.v.set((Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.08); return p;
  }
  // leave a copy of the squid `a` in ink. Returns the cloud.
  function leave(a, off) {
    const o = a.object; o.updateMatrixWorld(true); const sc = o.scale.x, qo = o.quaternion, c = { id: seq++, t: 0, env: 1, fadeFrom: L.fadeFrom, fadeLen: L.life - L.fadeFrom, body: [], crumbs: [], leaders: [], next: 0, at: new THREE.Vector3(), mid: new THREE.Vector3(), spread: 0, ph: Math.random() * 6.28, born: 0 };
    const kept = (v) => v.set(v.x - off.x, v.y, v.z - off.z);
    // the mantle: a slice to a puff, as wide as it is with its fins, as tall as it is, a little longer than the slice so that they overlap
    for (const s of slices(a)) { V.set(0, (s.y0 + s.y1) / 2, s.z).applyMatrix4(o.matrixWorld); kept(V);
      c.body.push(puff(c, 'body', V.x, V.y, V.z, s.x * sc * 1.05, Math.max(0.04, (s.y1 - s.y0) / 2) * sc * 1.15, L.slab * sc * 1.5, qo, L.dense, 0.2 * Math.random())); }
    V.set(0, 0, L.headZ).applyMatrix4(o.matrixWorld); kept(V); c.body.push(puff(c, 'body', V.x, V.y, V.z, 0.13 * sc, 0.12 * sc, 0.14 * sc, qo, L.dense, 0)); // the head
    // the arms: three long puffs down each, laid along it as it lies this moment
    for (const arm of a.rig.arms) { const J = arm.st.joints, n = J.length - 1, step = Math.max(1, Math.round(n / 3)), thick = Math.max(arm.def.thick * 2.2, arm.def.club ? 0.035 : 0.05) * sc;
      for (let k = 0; k < n; k += step) { const to = n - k < step * 1.5 ? n : k + step, A = J[k], B = J[to]; W.subVectors(B, A); const len = W.length(); if (len < 1e-4) continue; // (the short end goes with the last length: no blot at the tip)
        const th = thick * (1 - 0.45 * (k / n)); V.addVectors(A, B).multiplyScalar(0.5); kept(V); Q.setFromUnitVectors(UPZ, W.multiplyScalar(1 / len));
        c.body.push(puff(c, 'body', V.x, V.y, V.z, th, th, len * 0.6, Q, L.dense * (arm.def.club ? 0.7 : 0.85), 0.15 + 0.2 * Math.random())); if (to === n) break; } }
    // where it is: the middle of the puffs
    for (const p of c.body) c.at.add(p.p); c.at.multiplyScalar(1 / c.body.length); c.mid.copy(c.at);
    for (const p of c.body) { W.subVectors(p.p, c.at); const d = W.length() || 1; p.v.addScaledVector(W, L.open / d); } // it opens a little from its middle
    // a thin veil round the whole: the outermost and faintest layer, which spreads widest
    for (let i = 0; i < L.veil; i++) { const a2 = (i / L.veil) * 6.28; c.body.push(puff(c, 'veil', c.at.x + Math.sin(a2) * 0.25 * sc, c.at.y, c.at.z + Math.cos(a2) * 0.25 * sc, L.veilR * sc, L.veilR * sc * 0.7, L.veilR * sc * 1.3, qo, L.veilA, 0.6)); }
    // the leaders of the wisps: from the arm tips and the point of the mantle, out and away, each its own way
    const tips = a.rig.arms.filter((_, i) => i % 2 === 0).map((arm) => arm.st.joints[arm.st.joints.length - 1]);
    V.set(0, 0, -0.95).applyMatrix4(o.matrixWorld); tips.push(V.clone(), V.clone());
    tips.slice(0, L.leaders).forEach((tp, i) => { const p = kept(tp.clone()); W.subVectors(p, c.at).setY((Math.random() - 0.5) * 0.4); W.normalize();
      c.leaders.push({ p, v: W.multiplyScalar(lerp(L.lead[0], L.lead[1], Math.random())).clone(), t: -L.wait - i * 0.12, life: lerp(L.leadLife[0], L.leadLife[1], Math.random()), go: 0, w: lerp(0.7, 1.2, Math.random()) }); });
    const stain = new THREE.Mesh(stainGeo, new THREE.MeshBasicMaterial({ map: glow, color: L.colour, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    stain.name = 'ink-stain'; stain.renderOrder = 1; stain.castShadow = stain.receiveShadow = false; scene.add(stain); c.stain = stain;
    clouds.push(c); return c;
  }
  // a thin puff let go along a line: a wisp behind a leader, or a streamer behind a part of the body
  function crumb(c, x, y, z, dir, speed, across, along, a0, life, v) {
    let p = c.crumbs.length < L.crumbs ? null : c.crumbs[c.next];
    Q.setFromUnitVectors(UPZ, W.copy(dir).normalize());
    if (!p) { p = puff(c, 'crumb', x, y, z, across, across, along, Q, a0, 0.5, life); c.crumbs.push(p); } else { p.p.set(x, y, z); p.r.set(across, across, along); p.q.copy(Q); p.a0 = a0; p.age = 0; p.life = life; p.torn = 0; p.stretch = 0; p.v.set(0, 0, 0); }
    p.v.copy(v || W.multiplyScalar(speed)); c.next = (c.next + 1) % L.crumbs;
  }
  // the slow water it lies in: it turns round on itself and neither gathers nor spreads (Arnold-Beltrami-Childress), different for each cloud
  function flow(c, p, out) { const k = L.curl, x = (p.x - c.at.x) * k + c.ph, y = (p.y - c.at.y) * k + c.ph * 0.7, z = (p.z - c.at.z) * k - c.ph * 1.3, s = 0.12 * c.t;
    return out.set(Math.sin(z + s) + 0.8 * Math.cos(y), 0.6 * Math.sin(x) + Math.cos(z + s), 0.8 * Math.sin(y) + 0.6 * Math.cos(x - s)).multiplyScalar(L.swirl / 1.9); }

  // the fish goes through: a dash bursts it (bloom.js decides when; this is what it looks like). head, way: where the head is and where it is going
  function burst(c, head, way) {
    for (const p of [...c.body, ...c.crumbs]) { W.subVectors(p.p, head); const d = W.length(); if (d > L.burstR) continue; const k = 1 - d / L.burstR;
      p.v.addScaledVector(W.normalize(), L.burstPush * k).addScaledVector(way, L.burstPush * 0.6 * k); p.torn = Math.min(1, p.torn + k); }
    const u = clamp((c.t - c.fadeFrom) / c.fadeLen, 0, 1); c.fadeLen = L.burstFade; c.fadeFrom = c.t - u * c.fadeLen; // it goes from where it is, sooner
  }

  // dt; off: where the band's copy is drawn; joints: the body, in the kept space ({ x, y, z }); live: is the fish there to stir it
  function update(dt, off, joints) {
    // how each joint has moved since the last frame
    const jv = joints.map((j, i) => { const w = jWas[i]; const v = w && dt > 0 ? { x: (j.x - w.x) / dt, y: (j.y - w.y) / dt, z: (j.z - w.z) / dt } : { x: 0, y: 0, z: 0 };
      if (Math.hypot(v.x, v.y, v.z) > 40) v.x = v.y = v.z = 0; jWas[i] = { x: j.x, y: j.y, z: j.z }; return v; }); jWas.length = joints.length;
    let n = 0;
    for (let ci = clouds.length - 1; ci >= 0; ci--) { const c = clouds[ci]; c.t += dt;
      const u = clamp((c.t - c.fadeFrom) / c.fadeLen, 0, 1); c.env = 1 - u * u * u; // thins to nothing: no pop
      if (u >= 1) { scene.remove(c.stain); c.stain.material.dispose(); clouds.splice(ci, 1); continue; }
      const loose = smooth(L.hold, L.round, c.t), stir = smooth(0, L.wake, c.t), grow = 1 + L.grow * (1 - Math.exp(-c.t / L.growT));
      // the leaders draw out the wisps
      for (const ld of c.leaders) { ld.t += dt; if (ld.t < 0 || ld.t > ld.life) continue;
        flow(c, ld.p, V); ld.v.lerp(V.multiplyScalar(L.leadCurl).add(W.set(current.x * L.drift, -L.sag, current.z * L.drift)), 1 - Math.exp(-0.5 * dt)); ld.p.addScaledVector(ld.v, dt);
        ld.go += ld.v.length() * dt; const live = 1 - ld.t / ld.life;
        if (ld.go > L.crumbStep) { ld.go = 0; crumb(c, ld.p.x, ld.p.y, ld.p.z, ld.v, 0.05, L.wisp[0] * ld.w * (0.6 + 0.4 * live), L.wisp[1] * ld.w, L.wispA * (0.4 + 0.6 * live), L.wispLife, W.copy(ld.v).multiplyScalar(0.25)); } }
      // every puff: the water, the sag, the drift, and the fish
      let sx = 0, sz = 0, sy = 0, cnt = 0, far = 0;
      const all = c.body.concat(c.crumbs);
      for (const p of all) { p.age += dt; if (p.age >= p.life) continue;
        // the water's own way (it carries the puff), and the push it has been given (which the water takes off it)
        flow(c, p.p, V).multiplyScalar(stir); V.x += current.x * L.drift * stir; V.z += current.z * L.drift * stir; V.y -= L.sag * stir * (p.kind === 'crumb' ? 0.6 : 1);
        if (p.kind !== 'crumb') { W.subVectors(p.p, c.mid); const d = W.length() || 1; V.addScaledVector(W, (L.billow * Math.exp(-c.t / L.billowT) * stir) / d); } // and it billows out from its middle
        const rad = (p.r.x + p.r.y + p.r.z) / 3 * (p.kind === 'crumb' ? 1 + p.age / p.life : grow);
        for (let j = 0; j < joints.length; j++) { const J = joints[j], dx = p.p.x - J.x, dy = p.p.y - J.y, dz = p.p.z - J.z, d = Math.hypot(dx, dy, dz), reach = rad + L.body2; if (d > reach) continue;
          const v = jv[j], sp = Math.hypot(v.x, v.y, v.z), k = (1 - d / reach) * Math.min(1, sp / 2), id = 1 / (d || 1);
          p.v.x += (v.x * L.drag + dx * id * L.part * sp) * k * dt * 4; p.v.y += (v.y * L.drag + dy * id * L.part * sp) * k * dt * 4; p.v.z += (v.z * L.drag + dz * id * L.part * sp) * k * dt * 4;
          p.torn = Math.min(1, p.torn + k * dt * 3);
          // a part going quickly through it drags a streamer after it
          if (sp > L.streamAt && j % 3 === 0 && p.kind !== 'crumb' && Math.random() < dt * L.streams * k * 4) { W.set(v.x, v.y, v.z);
            crumb(c, J.x - v.x * 0.05, J.y - v.y * 0.05, J.z - v.z * 0.05, W, 0, L.stream[0] * (0.7 + 0.6 * Math.random()), L.stream[1] * Math.min(2, sp / 3), L.streamA * p.a0 / L.dense * Math.min(1, c.env * 1.5), L.streamLife, W.clone().multiplyScalar(L.streamKeep)); } }
        p.p.addScaledVector(p.v, dt).addScaledVector(V, dt); p.v.multiplyScalar(Math.exp(-L.follow * dt)); V.add(p.v); const spd = V.length();
        p.torn = Math.max(0, p.torn - dt * 0.25); p.stretch = lerp(p.stretch, clamp((spd - 0.15) / 0.8, 0, 1), 1 - Math.exp(-3 * dt));
        if (spd > 0.05) { Q.setFromUnitVectors(UPZ, W.copy(V).multiplyScalar(1 / spd)); p.q.slerp(Q, 1 - Math.exp(-spd * (p.kind === 'crumb' ? 1.5 : 0.8) * dt)); } // it is drawn out the way it is going
        // its size: it swells, and loses the stretch it was laid with; how see-through: thinner as it swells, and as the cloud ends
        let a, rx, ry, rz;
        if (p.kind === 'crumb') { const k = p.age / p.life, g = 1 + L.wispGrow * k; rx = p.r.x * g; ry = p.r.y * g; rz = p.r.z * (1 + 0.6 * k);
          a = p.a0 * Math.min(1, p.age / 0.25) * (1 - k) ** 1.4 * c.env; }
        else { const mean = (p.r.x + p.r.y + p.r.z) / 3, g = p.kind === 'veil' ? 1 + L.veilGrow * (1 - Math.exp(-c.t / L.growT)) : grow;
          rx = lerp(p.r.x, mean, loose) * g; ry = lerp(p.r.y, mean * 0.8, loose) * g; rz = lerp(p.r.z, mean * 1.15, loose) * g;
          a = p.a0 * Math.pow(g, -L.thin) * c.env * (p.kind === 'veil' ? Math.min(1, c.t / 0.4) : 1); }
        a *= 1 - 0.55 * p.torn; const st = p.kind === 'crumb' ? 1 : 0.7; rz *= 1 + st * p.stretch; rx *= 1 - 0.3 * p.stretch; ry *= 1 - 0.3 * p.stretch;
        if (a < 0.003 || n >= CAP) continue;
        mesh.setMatrixAt(n, M4.compose(P3.set(p.p.x + off.x, p.p.y, p.p.z + off.z), p.q, S3.set(rx, ry, rz)));
        mesh.setColorAt(n, COL.copy(dark).lerp(pale, clamp(p.tone + 0.45 * loose + 0.3 * (1 - c.env) + 0.35 * p.torn, 0, 1))); fade.array[n] = Math.min(a, L.most); n++;
        if (p.kind !== 'crumb') { sx += p.p.x; sy += p.p.y; sz += p.p.z; cnt++; far = Math.max(far, Math.hypot(p.p.x - c.mid.x, p.p.z - c.mid.z) + rx); } }
      if (cnt) { c.mid.set(sx / cnt, sy / cnt, sz / cnt); c.spread = far; }
      // the stain on the bed: soft and faint, wider and fainter as it spreads
      const st = c.stain, wide = 2 * c.spread + 1.2; st.position.set(c.mid.x + off.x, bed(c.mid.x, c.mid.z) + 0.06, c.mid.z + off.z); st.scale.set(wide, 1, wide);
      st.material.opacity = L.stain * c.env * Math.pow(grow, -0.9) * clamp(1 - (c.mid.y - bed(c.mid.x, c.mid.z)) / 12, 0.3, 1); }
    mesh.count = n; mesh.visible = n > 0; mesh.instanceMatrix.needsUpdate = true; fade.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  // for the checks: how it lies now (the puffs drawn, how far it reaches along its longest and shortest ways, the most see-through it is anywhere)
  function shape(c) { const pts = c.body.filter((p) => p.age < p.life); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of pts) { x0 = Math.min(x0, p.p.x); x1 = Math.max(x1, p.p.x); y0 = Math.min(y0, p.p.y); y1 = Math.max(y1, p.p.y); z0 = Math.min(z0, p.p.z); z1 = Math.max(z1, p.p.z); }
    const ext = [x1 - x0, y1 - y0, z1 - z0].sort((a, b) => b - a); return { long: ext[0], short: ext[2], spread: c.spread, env: c.env, mid: c.mid.clone(), puffs: c.body.length + c.crumbs.length }; }
  function dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); glow.dispose(); stainGeo.dispose(); for (const c of clouds) { scene.remove(c.stain); c.stain.material.dispose(); } clouds.length = 0; }
  return { leave, burst, update, shape, dispose, clouds, mesh, material: mat };
}
