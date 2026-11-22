// The specimen library: a playground for every component in npc.js. Nothing here knows how any creature looks:
// it asks npc.js for one, exactly as the game does, and puts it on a turntable under the light of a chosen depth.
// Colours and size can be tried here; those changes are npc.js's `tweaks`, which the game reads too.

import * as THREE from 'three';
import { NPC, BANDS, inOrder, make, swarmKit, tweaks, resolve, paintOf, stoneOf } from './npc.js';
import { shellMaterial } from './shells.js';
import { alive, growing, tint } from './kit.js';
import { FLOORS, SWARMS } from './world.js';
import { buildOarfish } from './oarfish.js';
import { clamp, rng } from './geo.js';
import { CAST } from './music.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const words = (k) => k.replace(/([a-z])([A-Z0-9])/g, '$1 $2').toLowerCase();

export function createLibrary({ renderer, root, onClose, onHear }) {
  const $ = (sel) => root.querySelector(sel);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  scene.background = new THREE.Color(); scene.fog = new THREE.Fog(0x000000, 14, 70);
  const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 2), sun = new THREE.DirectionalLight('#fff3d2', 2), lamp = new THREE.PointLight('#ffe6ee', 0, 30, 1);
  sun.position.set(6, 14, 8); scene.add(hemi, sun, lamp);
  const bed = new THREE.Mesh(new THREE.CircleGeometry(60, 40).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#c8c9a6' }));
  scene.add(bed);
  // a measure on the bed: half-metre steps, pale and dark by turns
  const rule = new THREE.Group(), ruleGeo = new THREE.BoxGeometry(0.5, 0.02, 0.07), ruleA = new THREE.MeshBasicMaterial({ color: '#f2faf7' }), ruleB = new THREE.MeshBasicMaterial({ color: '#26414a' });
  scene.add(rule);
  const stand = new THREE.Group(); scene.add(stand); // what is on show
  let fishModel = null;

  const clock = { value: 0 }; // the water's time, for what sways
  const S = { open: false, id: 'oarfish', band: 0, state: 0, speed: 0, tier: 'm', tone: 0, turn: true, wire: false, fish: false, yaw: 0.7, pitch: 0.22, dist: 5, t: 0, lift: 1.4, drag: null, dirty: false, changed: false };
  let shown = null, rebuild = 0; // shown: { actor | kit+mesh+fish | run }, with dispose()
  const v = new THREE.Vector3(), v2 = new THREE.Vector3(), q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), fwd = new THREE.Vector3(0, 0, 1), one = new THREE.Vector3(1, 1, 1), size = new THREE.Vector2();

  function light() {
    const F = FLOORS[S.band];
    scene.background.set(F.water); scene.fog.color.set(F.water);
    hemi.intensity = F.hemi; sun.intensity = F.sun; lamp.intensity = F.lamp * 1.4; lamp.distance = F.lampReach;
    bed.material.color.set(F.bed).lerp(new THREE.Color('#c8c9a6'), 0.55);
  }
  function mount() {
    shown?.dispose(); stand.clear(); rule.clear();
    const spec = NPC[S.id], preview = resolve(S.id), state = spec.states[S.state] || spec.states[0];
    S.lift = clamp(spec.length * 0.5, 1.1, 3.2);
    let tris = 0;
    if (spec.swarm) {
      const kit = swarmKit(S.id, { glow: FLOORS[S.band].fishGlow, preview }), n = SWARMS[S.tier].n, rand = rng(7);
      const mesh = new THREE.InstancedMesh(kit.geometry, kit.material, n), fish = Array.from({ length: n }, () => ({ ph: rand() * 6.28, rho: 0.25 + 0.75 * Math.cbrt(rand()), h: rand() * 2 - 1, sp: 0.7 + rand() * 0.6, p: new THREE.Vector3(), first: true }));
      mesh.frustumCulled = false; const c = new THREE.Color(); fish.forEach((f, i) => mesh.setColorAt(i, c.set(kit.tones[S.tone % 4])));
      stand.add(mesh); tris = kit.geometry.attributes.position.count / 3;
      shown = { kit, mesh, fish, body: mesh, dispose() { mesh.dispose(); kit.dispose(); } };
      S.lift = 1.8;
    } else if (spec.run) { // the Sum: a run of its lengths, in the colours of the districts they were paid in
      const geo = spec.build(preview.palette), mat = spec.flank(), n = 15, mesh = new THREE.InstancedMesh(geo, mat, n), c = new THREE.Color(), rand = rng(3);
      for (let i = 0; i < n; i++) { const a = (i - (n - 1) / 2) * 0.05, tall = 2.2 + rand() * 1.6, thick = 1.1 + rand() * 0.5; mesh.setMatrixAt(i, m4.compose(v.set(Math.sin(a) * 14.4, tall / 2, Math.cos(a) * 14.4 - 14.4), q.setFromAxisAngle(v2.set(0, 1, 0), a + Math.PI / 2), v2.set(thick, tall, 0.72)));
        mesh.setColorAt(i, c.set(i > n - 3 ? preview.palette.own : paintOf(Math.min(4, Math.floor(i / 3))))); }
      mesh.frustumCulled = false; stand.add(mesh); tris = geo.attributes.position.count / 3;
      shown = { mesh, body: mesh, dispose() { mesh.dispose(); geo.dispose(); mat.dispose(); } };
      S.lift = 1.6;
    } else if (spec.kind === 'fish') { // the oarfish itself, at one of its lengths, lying straight as on the plate
      const built = buildOarfish({ seed: 11, scale: 0.4, bones: state.segs || 10, palette: Object.fromEntries(Object.entries(preview.palette).map(([k, val]) => [spec.fishKey(k), val])) });
      built.mesh.frustumCulled = false; built.mesh.geometry.computeBoundingBox(); const box = built.mesh.geometry.boundingBox;
      built.group.position.z = -(box.min.z + box.max.z) / 2; stand.add(built.group); tris = (built.mesh.geometry.index ? built.mesh.geometry.index.count : built.mesh.geometry.attributes.position.count) / 3;
      shown = { body: built.mesh, long: box.max.z - box.min.z, dispose() { built.mesh.geometry.dispose(); for (const mt of [].concat(built.mesh.material)) mt.dispose(); built.skeleton?.dispose?.(); } };
      S.lift = 1.5; S.dist = clamp(shown.long * 1.05 + 2.4, 4, 26);
    } else if (spec.kind === 'tokens') { // a colour set: five columns in a row, one in the stone and the paint of each band
      const parts = [['block', [1.55, 0.5, 1.55], 0], ['base', [1, 1, 1], 0.5], ['shaft', [1.05, 1.1, 1.05], 0.7], ['shaft', [1, 1.1, 1], 1.8], ['shaft', [0.95, 1.1, 0.95], 2.9], ['echinus', [0.97, 1, 0.97], 4], ['block', [1.5, 0.18, 1.5], 4.2]];
      const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true }), meshes = [], c = new THREE.Color();
      parts.forEach(([key, sc, y], pi) => { const mesh = new THREE.InstancedMesh(NPC[key].build(), mat, 5);
        for (let b = 0; b < 5; b++) { const st = stoneOf(b); mesh.setMatrixAt(b, m4.compose(v.set((b - 2) * 2.6, y, 0), q.identity(), v2.set(...sc))); mesh.setColorAt(b, c.set(pi === 6 ? paintOf(b) : st[pi % st.length])); }
        mesh.frustumCulled = false; stand.add(mesh); meshes.push(mesh); tris += mesh.geometry.attributes.position.count / 3; });
      shown = { body: meshes[0], dispose() { for (const mesh of meshes) mesh.dispose(); mat.dispose(); } };
      S.lift = 0; S.dist = 17;
    } else if (spec.kind === 'thing' || spec.kind === 'shell') { // something that stands, lies or drifts: one, or a few of it in its several tints
      const pal = resolve(spec.paletteFrom || S.id).palette, geo = spec.build(pal), show = spec.show || {}, n = show.n || 1, mm = spec.material || {};
      const mat = spec.kind === 'shell' ? shellMaterial() : mm.stone ? new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true, side: mm.double ? THREE.DoubleSide : THREE.FrontSide }) : spec.baked ? alive(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })) : growing(mm, clock);
      const own = Object.keys(pal).filter((k) => /^tone\d+$/.test(k)).map((k) => pal[k]);
      const tones = spec.tintWith === 'paint' ? [paintOf(S.band)] : spec.tintWith === 'clay' ? [tint('#c98f6c', paintOf(S.band), 0.28)] : spec.tintWith ? stoneOf(S.band) : own.length ? own : ['#ffffff'];
      const mesh = new THREE.InstancedMesh(geo, mat, n), c = new THREE.Color(), rand = rng(11), base = [].concat(show.scale ?? 1), sc3 = base.length === 3 ? base : [base[0], base[0], base[0]], k0 = spec.kind === 'shell' ? preview.scale : 1;
      for (let i = 0; i < n; i++) { const a = i * 2.4 + rand(), d = i ? (show.spread || 1) * (0.55 + 0.45 * Math.sqrt(i / n)) * (0.8 + 0.4 * rand()) : 0, k = (i ? 0.7 + 0.35 * rand() : 1) * k0;
        mesh.setMatrixAt(i, m4.compose(v.set(Math.sin(a) * d, 0, Math.cos(a) * d), q.setFromAxisAngle(v2.set(0, 1, 0), i ? rand() * 6.28 : 0), v2.set(sc3[0] * k, sc3[1] * k, sc3[2] * k)));
        mesh.setColorAt(i, c.set(tones[(S.tone + i) % tones.length])); }
      mesh.frustumCulled = false; stand.add(mesh); tris = geo.attributes.position.count / 3;
      shown = { mesh, body: mesh, spin: !!show.spin, tall: spec.length * (show.flat ? 0.15 : 1), tones: tones.length, dispose() { mesh.dispose(); mat.dispose(); if (spec.baked) geo.dispose(); } };
      S.lift = show.lift || 0;
    } else {
      const actor = make(S.id, { preview });
      stand.add(actor.object); tris = actor.rig ? actor.rig.triangles : actor.body.geometry.attributes.position.count / 3;
      const extra = [];
      if (actor.segments) actor.segments(11).forEach((s, i) => { const a = (i + 1) * 0.24; s.position.set(4.2 * Math.cos(a) - 4.2, 0, -4.2 * Math.sin(a) - 0.5); s.rotation.y = a; stand.add(s); extra.push(s); }); // trailing from the head, round the ring it swims
      shown = { actor, body: actor.body, extra, dispose() { actor.dispose(); } };
    }
    stand.position.set(0, spec.id === 'hook' ? S.lift + 0.6 : spec.run ? 0 : S.lift, 0); stand.rotation.set(0, 0, 0);
    for (const o of stand.children) if (o.material && !o.isSprite) o.material.wireframe = S.wire;
    if (shown.actor) shown.actor.body.material.wireframe = S.wire;
    // the measure: as long as the creature, rounded up to the half metre
    const steps = Math.max(2, Math.ceil(spec.length / 0.5));
    if (!spec.swarm && !spec.run && spec.id !== 'warden' && spec.kind !== 'tokens' && !(spec.show?.n > 1)) for (let i = 0; i < steps; i++) { const b = new THREE.Mesh(ruleGeo, i % 2 ? ruleB : ruleA); b.position.set(0, 0.011, (i + 0.5) * 0.5 - steps * 0.25); b.rotation.y = Math.PI / 2; rule.add(b); } // lying under it, nose to tail
    if (fishModel) { fishModel.group.visible = S.fish; fishModel.group.position.set(-clamp(spec.length * 0.35 + 0.9, 1.2, 4), S.lift, 0); }
    $('#lib-tris').textContent = `${Math.round(tris)} triangles`;
    if (state.speed !== undefined && !S.dirty) S.speed = state.speed;
    S.dirty = false;
  }
  function frame(dt) {
    S.t += dt; clock.value = S.t;
    const spec = NPC[S.id], state = spec.states[S.state] || spec.states[0];
    if (rebuild > 0 && (rebuild -= dt) <= 0) { mount(); list(); notes(); } // not the palette itself: a colour may still be being chosen in it
    if (S.turn && !S.drag) S.yaw += dt * 0.3;
    if (shown?.actor) {
      const a = shown.actor, o = a.object;
      if (a.rig) a.rig.show(dt, state, S.speed); // it stands on its own legs
      else { a.tick(dt * (state.rate || 1), S.speed); o.rotation.z = state.wobble ? 0.35 * Math.sin(S.t * 14) : 0; }
      if (spec.spin) { o.rotation.y += dt * spec.spin[1]; o.rotation.x += dt * spec.spin[0]; }
      if (state.sway) o.rotation.y = Math.sin(S.t * 0.4) * 0.6;
      if (a.parts.glow && state.lure !== undefined) a.parts.glow.scale.setScalar(state.lure * (1 + 0.08 * Math.sin(S.t * 5)));
    } else if (shown?.spin) { stand.rotation.y += dt * 0.5; stand.position.y = S.lift + 0.12 * Math.sin(S.t * 1.6); // a thing adrift turns and bobs
    } else if (shown?.fish) {
      const sc = { x: 0, y: 0, z: 0, ball: SWARMS[S.tier].r, pack: state.pack ?? 1, threat: state.threat ?? 0, burst: state.burst || 0 }, kit = shown.kit;
      shown.fish.forEach((f, i) => {
        kit.place(v, f, sc, S.t);
        if (f.first) { f.p.copy(v); f.first = false; }
        v2.subVectors(v, f.p); if (v2.lengthSq() > 1e-9) q.setFromUnitVectors(fwd, v2.normalize());
        f.p.copy(v); shown.mesh.setMatrixAt(i, m4.compose(v, q, one.setScalar(kit.scale)));
      });
      shown.mesh.instanceMatrix.needsUpdate = true; kit.material.userData.swim.value = S.t * kit.beat;
    }
    // the view: turned about the creature, and set aside so it sits in the clear between the list and the panel
    renderer.getSize(size);
    const tx = 0, ty = (shown?.spin ? S.lift : stand.position.y) + (spec.run ? 1.6 : spec.id === 'hook' ? 0.5 : spec.kind === 'tokens' ? 2.2 : shown?.tall !== undefined && !shown.spin && !S.lift ? Math.min(shown.tall, 5) * 0.45 : 0), cp = Math.cos(S.pitch);
    camera.position.set(tx + Math.sin(S.yaw) * cp * S.dist, ty + Math.sin(S.pitch) * S.dist, Math.cos(S.yaw) * cp * S.dist);
    camera.lookAt(tx, ty, 0);
    lamp.position.copy(camera.position).multiplyScalar(0.5).setY(ty + 2.5);
    const left = $('#lib-list').offsetWidth, right = $('#lib-panel').offsetWidth, narrow = size.x < 760;
    camera.aspect = size.x / size.y;
    if (narrow) camera.clearViewOffset(); else camera.setViewOffset(size.x, size.y, (right - left) / 2, 0, size.x, size.y);
    camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ the page round the stage
  function list() {
    let html = '', group = '';
    for (const s of inOrder()) { if (s.group !== group) { group = s.group; html += `<h3>${esc(group)}</h3>`; } html += `<button type="button" data-id="${s.id}" aria-pressed="${s.id === S.id}">${esc(s.name)}${tweaks.of(s.id) ? '<i title="Changed in this browser"></i>' : ''}</button>`; }
    $('#lib-list').innerHTML = html;
  }
  function panel(all = true) {
    const spec = NPC[S.id], look = resolve(S.id), mine = tweaks.of(S.id);
    const seg = (name, items, cur) => `<div class="seg" data-set="${name}">${items.map(([val, label, title, mark]) => `<button type="button" data-v="${val}" aria-pressed="${String(val) === String(cur)}"${title ? ` title="${esc(title)}"` : ''}${mark ? ' class="home"' : ''}>${esc(label)}</button>`).join('')}</div>`;
    if (all) {
      $('#lib-name').textContent = spec.name; $('#lib-role').textContent = spec.role; $('#lib-about').textContent = spec.about;
      $('#lib-where').textContent = `${spec.bands.map((b) => BANDS[b]).join(', ')} · ${spec.swarm ? `${spec.length} m each` : spec.run ? `${spec.length} m to a length` : `${spec.length} m long`}`;
      { const hear = $('#lib-hear'), voice = CAST[spec.id]; hear.hidden = !voice; hear.textContent = voice ? `In the band: ${voice.name}. Hear it` : ''; } // its instrument, where it has one
      $('#lib-play').innerHTML = `<label>Light of</label>${seg('band', BANDS.map((b, i) => [i, i + 1, b, spec.bands.includes(i)]), S.band)}`
        + (spec.states.length > 1 ? `<label>State</label>${seg('state', spec.states.map((s, i) => [i, s.name]), S.state)}` : '')
        + (spec.swarm ? `<label>Swarm</label>${seg('tier', Object.entries(SWARMS).map(([k, s]) => [k, s.n]), S.tier)}` : '')
        + (spec.swarm || shown?.tones > 1 ? `<label>Tint</label>${seg('tone', Array.from({ length: spec.swarm ? 4 : shown.tones }, (_, i) => [i, i + 1]), S.tone % (spec.swarm ? 4 : shown.tones))}` : '')
        + (spec.swim && !spec.swarm ? `<label for="lib-speed">Speed</label><div class="slide"><input type="range" id="lib-speed" min="0" max="10" step="0.1" value="${S.speed}"><output>${S.speed.toFixed(1)} m/s</output></div>` : '')
        + `<label>Show</label><div class="seg many" data-set="show">${[['turn', 'Turning'], ['wire', 'Wireframe'], ['fish', 'Oarfish for scale']].map(([k, l]) => `<button type="button" data-v="${k}" aria-pressed="${!!S[k]}">${l}</button>`).join('')}</div>`;
    }
    $('#lib-palette').innerHTML = Object.entries(look.palette).map(([k, val]) => `<label class="sw${mine?.palette?.[k] ? ' mine' : ''}"><input type="color" data-k="${k}" value="${val}"><span>${esc(words(k))}</span><code>${val}</code></label>`).join('')
      + (spec.fixed ? '' : `<label class="sw size${mine?.scale !== undefined ? ' mine' : ''}"><input type="range" data-k="scale" min="0.6" max="1.6" step="0.02" value="${look.scale}"><span>size</span><code>×${look.scale.toFixed(2)}</code></label>`)
      || '<p class="none">No colours of its own.</p>';
    notes();
  }
  function notes() {
    $('#lib-reset').disabled = !tweaks.of(S.id);
    const n = tweaks.changed().length;
    $('#lib-copy').disabled = !n; $('#lib-all').disabled = !n;
    $('#lib-note').textContent = n ? `${n === 1 ? 'One component is' : `${n} components are`} changed in this browser. The game uses them from the next band or dive. To make them the game’s own for everyone, copy them and paste them to Claude.` : 'Colours and size can be tried here. They are kept in this browser and used by the game too.';
  }
  function pick(id) { if (!NPC[id]) return; $('#lib-text').hidden = true; S.id = id; S.state = NPC[id].kind === 'fish' ? 1 : 0; S.tone = 0; S.dirty = false; const spec = NPC[id]; if (spec.kind === 'thing' || spec.kind === 'shell') S.dist = clamp(Math.max(spec.length, (spec.show?.spread || 0) * 2.4) * 2.2 + 2, 2.4, 22); if (!spec.bands.includes(S.band)) S.band = spec.bands[0]; if (spec.kind !== 'thing' && spec.kind !== 'shell') S.dist = clamp(spec.length * 2.4 + 2.2, 2.6, 26); if (spec.run) S.dist = 16; if (spec.id === 'warden') S.dist = 17; if (spec.swarm) S.dist = SWARMS[S.tier].r * 9 + 3; S.yaw = 0.85; S.pitch = 0.2; light(); mount(); list(); panel(); try { history.replaceState(null, '', `#library/${id}`); } catch { /* not allowed here */ } }

  $('#lib-hear').addEventListener('click', () => onHear?.(S.id));
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.id) return pick(b.dataset.id);
    const set = b.parentElement?.dataset.set;
    if (set === 'band') { S.band = +b.dataset.v; light(); mount(); panel(); }
    else if (set === 'state') { S.state = +b.dataset.v; S.dirty = false; const st = NPC[S.id].states[S.state]; if (st.speed !== undefined) S.speed = st.speed; if (NPC[S.id].kind === 'fish') mount(); panel(); }
    else if (set === 'tier') { S.tier = b.dataset.v; S.dist = SWARMS[S.tier].r * 9 + 3; mount(); panel(); }
    else if (set === 'tone') { S.tone = +b.dataset.v; mount(); panel(); }
    else if (set === 'show') { S[b.dataset.v] = !S[b.dataset.v]; if (S.fish && !fishModel) { fishModel = buildOarfish({ seed: 11, scale: 0.4, bones: 10 }); fishModel.mesh.frustumCulled = false; scene.add(fishModel.group); } mount(); panel(); }
    else if (b.id === 'lib-close') close();
    else if (b.id === 'lib-reset') { tweaks.reset(S.id); S.changed = true; mount(); list(); panel(); }
    else if (b.id === 'lib-all') { tweaks.reset(); S.changed = true; mount(); list(); panel(); }
    else if (b.id === 'lib-copy') { const text = tweaks.text(), box = $('#lib-text'); box.value = text; box.hidden = false; box.select();
      const done = (ok) => { $('#lib-note').textContent = ok ? 'Copied. Paste it to Claude and the game itself will be changed.' : 'Select the text in the box and copy it, then paste it to Claude.'; };
      try { navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); } catch { done(false); } }
    if (e.detail > 0 && b.blur) b.blur();
  });
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'lib-speed') { S.speed = +t.value; S.dirty = true; t.nextElementSibling.textContent = `${S.speed.toFixed(1)} m/s`; return; }
    if (!t.dataset.k) return;
    tweaks.set(S.id, t.dataset.k, t.dataset.k === 'scale' ? +t.value : t.value); S.changed = true;
    t.parentElement.querySelector('code').textContent = t.dataset.k === 'scale' ? `×${(+t.value).toFixed(2)}` : t.value; t.parentElement.classList.add('mine');
    rebuild = 0.12; S.dirty = true; // the model is rebuilt a moment after the last change, not at every step of a drag
  });
  // turning and zooming, on the clear part of the page
  const pad = $('#lib-stage');
  pad.addEventListener('pointerdown', (e) => { S.drag = { x: e.clientX, y: e.clientY }; pad.setPointerCapture?.(e.pointerId); });
  pad.addEventListener('pointermove', (e) => { if (!S.drag) return; S.yaw -= (e.clientX - S.drag.x) * 0.008; S.pitch = clamp(S.pitch + (e.clientY - S.drag.y) * 0.006, -0.5, 1.3); S.drag = { x: e.clientX, y: e.clientY }; });
  const up = () => { S.drag = null; }; pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
  pad.addEventListener('wheel', (e) => { e.preventDefault(); S.dist = clamp(S.dist * Math.exp(e.deltaY * 0.0012), 1.2, 40); }, { passive: false });

  function open(id) { S.open = true; S.changed = false; root.hidden = false; pick(NPC[id] ? id : S.id); $('#lib-close').focus({ preventScroll: true }); }
  function close() { if (!S.open) return; S.open = false; root.hidden = true; shown?.dispose(); shown = null; stand.clear(); try { history.replaceState(null, '', location.pathname + location.search); } catch { /* not allowed here */ } onClose?.(S.changed); }
  const step = (d) => { const all = inOrder(), i = all.findIndex((s) => s.id === S.id); pick(all[(i + d + all.length) % all.length].id); root.querySelector(`#lib-list [data-id="${S.id}"]`)?.scrollIntoView({ block: 'nearest' }); };
  return { scene, camera, open, close, frame, step, pick, state: S, get isOpen() { return S.open; } };
}
