// The surface, for the end of a dive that opened the circle: an empty sky, the sea, and a raft whose
// lines still pay out with no one tending them. It answers the same calls as a depth band (world.js),
// so the run can swim the fish in it without special cases.

import * as THREE from 'three';
import { soup, M } from './geo.js';

export const SKY = '#dfe8e6';

export function createSurface(scene, at, raftAt) {
  const F = { name: '', depth: 0, water: SKY, sky: '#ffffff', bed: '#8fc0c4', hemi: 2.1, sun: 1.7, lamp: 0, lampReach: 10, fog: [1.3, 150], fishGlow: 0, finGlow: 0 };
  const time = { value: 0 }, owned = [];
  const add = (o) => { scene.add(o); owned.push(o); return o; };

  // the sea: a faceted sheet that heaves a little, clear enough to show a body just under it
  const SIZE = 360, CELLS = 36;
  const seaGeo = new THREE.PlaneGeometry(SIZE, SIZE, CELLS, CELLS).rotateX(-Math.PI / 2);
  const rest = Float32Array.from(seaGeo.attributes.position.array);
  const sea = add(new THREE.Mesh(seaGeo, new THREE.MeshStandardMaterial({ color: '#4a9aa6', roughness: 0.5, metalness: 0, flatShading: true, transparent: true, opacity: 0.86, side: THREE.DoubleSide, depthWrite: false })));
  sea.frustumCulled = false; sea.renderOrder = 4;
  const deep = add(new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#2c7888' })));
  deep.position.y = -8; deep.frustumCulled = false;

  // the raft: lashed logs, a crate, three poles with reels, and a line from each going down
  const raft = add(new THREE.Group());
  const wood = ['#b9a88a', '#a99676', '#c4b497'], parts = [];
  for (let k = 0; k < 6; k++) parts.push([new THREE.CylinderGeometry(0.2, 0.22, 3.8 + (k % 2) * 0.3, 6), M(0, 0, (k - 2.5) * 0.43, 0, 0, Math.PI / 2), wood[k % 3]]);
  for (const x of [-1.2, 1.2]) parts.push([new THREE.BoxGeometry(0.16, 0.1, 2.7), M(x, 0.24, 0), '#8f7d60']);
  parts.push([new THREE.BoxGeometry(0.7, 0.42, 0.5), M(-0.5, 0.45, 0.25, 0, 0.3, 0), '#9c8a6c']);
  const POLES = [[1.3, -0.9, -0.55], [0.2, 1.0, 0.6], [-1.3, -0.8, -0.5]]; // x, z, lean
  const tips = POLES.map(([x, z, lean]) => new THREE.Vector3(x + 0.15, 0.25 + Math.cos(lean) * 2.1, z + Math.sin(lean) * 2.1));
  POLES.forEach(([x, z, lean]) => parts.push([new THREE.CylinderGeometry(0.035, 0.05, 2.2, 5), M(x + 0.15, 0.25 + Math.cos(lean) * 1.05, z + Math.sin(lean) * 1.05, lean, 0, 0), '#7d6c52']));
  const hull = new THREE.Mesh(soup(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }));
  hull.castShadow = true;
  raft.add(hull);
  const dark = new THREE.MeshStandardMaterial({ color: '#5d5142', roughness: 0.8, flatShading: true });
  const lineMat = new THREE.MeshBasicMaterial({ color: '#3d4a4c' });
  const reelGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.12, 8).rotateZ(Math.PI / 2), lineGeo = new THREE.BoxGeometry(0.025, 18, 0.025).translate(0, -9, 0), knotGeo = new THREE.OctahedronGeometry(0.06);
  const reels = [], knots = [];
  POLES.forEach(([x, z], i) => {
    const reel = new THREE.Mesh(reelGeo, dark); reel.position.set(x + 0.15, 0.5, z); raft.add(reel); reels.push(reel);
    const line = new THREE.Mesh(lineGeo, lineMat); line.position.copy(tips[i]); raft.add(line);
    for (let k = 0; k < 3; k++) { const knot = new THREE.Mesh(knotGeo, lineMat); raft.add(knot); knots.push({ mesh: knot, tip: tips[i], ph: k / 3 + i * 0.17 }); }
  });
  raft.position.set(raftAt.x, 0.06, raftAt.z);
  raft.rotation.y = 0.7;

  function update(dt, focus) {
    time.value += dt;
    const t = time.value, p = seaGeo.attributes.position.array;
    const sx = Math.round(focus.x / 10) * 10, sz = Math.round(focus.z / 10) * 10; // the sheet follows in whole cells, so its swell stays put
    for (let i = 0; i < p.length; i += 3) {
      const x = rest[i] + sx, z = rest[i + 2] + sz;
      p[i + 1] = 0.13 * Math.sin(x * 0.31 + t * 0.9) + 0.09 * Math.sin(z * 0.27 - t * 0.7 + x * 0.11);
    }
    seaGeo.attributes.position.needsUpdate = true;
    sea.position.set(sx, 0, sz); deep.position.set(sx, -8, sz);
    raft.position.x += 0.12 * dt; // adrift
    raft.position.y = 0.06 + 0.05 * Math.sin(t * 1.1);
    raft.rotation.z = 0.035 * Math.sin(t * 0.9); raft.rotation.x = 0.03 * Math.sin(t * 1.15 + 1);
    for (const r of reels) r.rotation.x -= dt * 1.3; // still turning
    for (const k of knots) { const f = (t * 0.16 + k.ph) % 1; k.mesh.position.set(k.tip.x, k.tip.y - f * 9, k.tip.z); } // still paying out
  }
  function dispose() {
    for (const o of owned) scene.remove(o);
    for (const g of [seaGeo, deep.geometry, hull.geometry, reelGeo, lineGeo, knotGeo]) g.dispose();
    for (const m of [sea.material, deep.material, hull.material, dark, lineMat]) m.dispose();
  }
  return {
    update, dispose, time, floor: F, index: -1, raft, hall: null, portal: { level: 1 }, wrap: (d) => d, // the open sea does not come round as a band does
    height: () => -40, ceiling: 1.6, pushOut() {}, // the fish levels off a little under its ceiling, which puts its back at the waterline
    goal: { x: at.x, y: 0, z: at.z, kind: 'none' }, schools: [], take: () => [], atGoal: () => false, spots: { hooks: [], biters: [], anglers: [] },
  };
}
