// How much of the fish can be seen from the camera as the dive is drawn now: the share of the fish's own pixels that are not covered by
// anything else (the window round the fish, sight.js, is in the picture when it is on: what it cuts away does not cover the fish; it is off
// since skeleton-look, SEE.on). Used by the game suite. Run in the page: `await page.evaluate(seenShare)` after the dive has been stepped and the camera placed.
// It draws the whole scene into a small target, then the fish alone, flat, only where it is the nearest thing (its pixels that are seen), and
// then the fish alone with nothing in front (all its pixels). It counts the second against the third. The ghost tint is left out of it.
export async function seenShare() {
  const THREE = await import('three'), g = window.__game;
  let f = window.__sight?.fish?.();
  if (!f) g.scene.traverse((o) => { // a copy of the game from before sight.js: the fish is the skinned mesh drawn third, with its ghost and its wire beside it
    if (f || !o.isSkinnedMesh || o.renderOrder !== 2) return; const sib = o.parent.children; f = { mesh: o, ghost: sib.find((m) => m.renderOrder === 1), wire: sib.find((m) => m.renderOrder === 3) }; });
  if (!f) return null;
  const r = g.renderer, W = 320, H = Math.round(320 * g.camera.aspect ** -1);
  const rt = (window.__seenRT ||= new THREE.WebGLRenderTarget(W, H, { depthBuffer: true }));
  if (rt.width !== W || rt.height !== H) rt.setSize(W, H);
  const flat = (window.__seenMat ||= new THREE.MeshBasicMaterial({ color: '#ff00ff', fog: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }));
  const probe = (window.__seenMesh ||= new THREE.SkinnedMesh(f.mesh.geometry, flat));
  if (probe.geometry !== f.mesh.geometry || probe.skeleton !== f.mesh.skeleton) { probe.geometry = f.mesh.geometry; probe.bind(f.mesh.skeleton, f.mesh.bindMatrix); }
  probe.frustumCulled = false; probe.matrixWorld.copy(f.mesh.matrixWorld); probe.matrixAutoUpdate = false;
  const ghost = f.ghost.visible, wire = f.wire.visible, bones = f.bones?.visible; f.ghost.visible = false; f.wire.visible = false; if (f.bones) f.bones.visible = false;
  const holder = new THREE.Scene(); holder.add(probe); holder.matrixWorldAutoUpdate = false; probe.matrixWorldAutoUpdate = false;
  const px = new Uint8Array(W * H * 4), count = () => { r.readRenderTargetPixels(rt, 0, 0, W, H, px); let n = 0; for (let i = 0; i < px.length; i += 4) if (px[i] > 250 && px[i + 1] < 5 && px[i + 2] > 250) n++; return n; };
  const auto = r.autoClear, bg = g.scene.background;
  const sv = window.__sight?.SIGHT?.v.value, was = sv && [sv.x, sv.y]; if (sv) sv.set(W, H, sv.z, sv.w); // the window is placed in the target's own pixels
  r.setRenderTarget(rt); r.autoClear = true; r.render(g.scene, g.camera);
  r.autoClear = false; r.render(holder, g.camera); const seen = count();
  r.autoClear = true; holder.background = new THREE.Color('#000000'); r.render(holder, g.camera); const all = count();
  if (sv) sv.set(was[0], was[1], sv.z, sv.w);
  r.setRenderTarget(null); r.autoClear = auto; f.ghost.visible = ghost; f.wire.visible = wire; if (f.bones) f.bones.visible = bones; holder.remove(probe);
  return { seen, all, share: all ? seen / all : 0 };
}

// The skeleton (main.js, `boneMat`): how many pixels the dark wireframe of the fish changes in the picture as the dive is drawn now. It draws
// the whole scene into a small target twice, with the wireframe twin and without it, and counts the pixels that differ (`px`), and how many of
// those are darker (`dark`). Behind a column it should be many; in open water none (it never draws over the fish's own skin).
export async function skeletonShown() {
  const THREE = await import('three'), g = window.__game, f = window.__sight?.fish?.();
  if (!f?.bones) return null;
  const r = g.renderer, W = 320, H = Math.round(320 * g.camera.aspect ** -1);
  const rt = (window.__boneRT ||= new THREE.WebGLRenderTarget(W, H, { depthBuffer: true }));
  if (rt.width !== W || rt.height !== H) rt.setSize(W, H);
  const a = new Uint8Array(W * H * 4), b = new Uint8Array(W * H * 4), was = f.bones.visible, auto = r.autoClear;
  r.setRenderTarget(rt); r.autoClear = true;
  f.bones.visible = true; r.render(g.scene, g.camera); r.readRenderTargetPixels(rt, 0, 0, W, H, a);
  f.bones.visible = false; r.render(g.scene, g.camera); r.readRenderTargetPixels(rt, 0, 0, W, H, b);
  r.setRenderTarget(null); r.autoClear = auto; f.bones.visible = was;
  let px = 0, dark = 0;
  for (let i = 0; i < a.length; i += 4) { const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); if (d > 12) { px++; if (a[i] + a[i + 1] + a[i + 2] < b[i] + b[i + 1] + b[i + 2]) dark++; } }
  return { px, dark, of: W * H };
}
