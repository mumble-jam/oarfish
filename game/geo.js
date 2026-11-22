// Small shared helpers: maths, flat-shaded geometry soup, glow textures.

import * as THREE from 'three';

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

export function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// flat-shaded triangle soup out of transformed primitives: [geometry, matrix | null, colour | null]
export function soup(parts) {
  const pos = [], col = [];
  const p = new THREE.Vector3(), c = new THREE.Color();
  let coloured = false;
  for (const [geo, matrix, colour] of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const a = g.attributes.position;
    c.set(colour || '#ffffff');
    if (colour) coloured = true;
    for (let i = 0; i < a.count; i++) {
      p.fromBufferAttribute(a, i);
      if (matrix) p.applyMatrix4(matrix);
      pos.push(p.x, p.y, p.z);
      col.push(c.r, c.g, c.b);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (coloured) out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeVertexNormals();
  return out;
}
export const M = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));

function canvasTexture(w, h, alphaAt) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d'), img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
    img.data[o + 3] = clamp(alphaAt(x / (w - 1), y / (h - 1)), 0, 1) * 255;
  }
  g.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(cv);
}
// soft round dot
export const glowTexture = () => canvasTexture(64, 64, (u, v) => Math.pow(Math.max(0, 1 - Math.hypot(u - 0.5, v - 0.5) * 2), 2.2));
// a shaft of light: bright at the top, fading down and to the sides
export const beamTexture = () => canvasTexture(64, 256, (u, v) => Math.pow(1 - Math.abs(u * 2 - 1), 1.6) * Math.pow(1 - v, 0.6) * Math.min(v * 6, 1));

// winding number of the closed polygon poly[0..n) = (x, z) pairs around the point (px, pz); non-zero means inside
export function windingNumber(poly, n, px, pz) {
  let wn = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x0 = poly[i * 2], z0 = poly[i * 2 + 1], x1 = poly[j * 2], z1 = poly[j * 2 + 1];
    const left = (x1 - x0) * (pz - z0) - (px - x0) * (z1 - z0);
    if (z0 <= pz) { if (z1 > pz && left > 0) wn++; }
    else if (z1 <= pz && left < 0) wn--;
  }
  return wn;
}
