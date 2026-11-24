// The frame gauge: two builder's tools in the pause menu's Testing section, for measuring the dive on a real computer.
//   Show frame time: a small readout in the top-left corner, updated twice a second: the time a frame takes (the average over the last second,
//     and the worst frame in the last five), frames a second, the draw calls and triangles of the last frame (the renderer's own counters),
//     and the frame's work outside drawing (the dive's step).
//   Measure the first band: a tour by itself of six spots of the first band, from the adventure camera and then the plate camera; one second
//     to settle and four measured at each while the fish swims gently on; then a plain-text table, put on the clipboard and shown to copy.
// main.js hands this its renderer and a few things that are not on window.__game, before it sets its animation loop. This wraps that loop
// and, only while one of the tools is on, the renderer's render(): with both off nothing is added to the page and nothing is drawn differently.
// Frame time is from one drawn frame to the next (the browser's frame clock), so it holds what the graphics card takes too, and it cannot go
// below the screen's refresh (16.7 ms at 60 Hz). While the dive is paused it is drawn only now and then, so those gaps are left out.
import { NEST } from './world.js';

export const GAUGE = {
  show: 0.5, // seconds between two updates of the readout
  avg: 1, worst: 5, // seconds the average and the worst frame are taken over
  gap: 2, // outside the tour, a gap between two drawn frames longer than this is not a frame; nor is one either side of which the dive was paused (it is then drawn only now and then)
  settle: 1, measure: 4, // the tour, at each spot: seconds before measuring, and measured
  swim: { amount: 0.55, gentle: true }, // how the fish swims on meanwhile
  spots: ['start', 'bloom', 'sandflat', 'reef', 'kelp', 'keeper'],
  names: { start: 'start', bloom: 'bloom water', sandflat: 'sand flat', reef: 'reef head', kelp: 'kelp forest (lane)', keeper: "Keeper's ground" },
  cams: [['look', 'adventure'], ['point', 'plate']],
};

export function createGauge({ renderer, step, focus, ended, levels, game }) {
  const info = renderer.info, own = renderer.render; // (three.js sets render() on each renderer, not on its prototype)
  const frames = []; // { t, ms, work, calls, tris } for every drawn frame in the last `worst` seconds, while a tool is on
  let readout = null, shown = '', shownAt = 0, lastDrawn = 0, wasHeld = false;
  let tour = null; // the tour while it runs
  let cur = null; // what the frame being drawn has done so far
  const $ = (id) => document.getElementById(id);
  const msg = (text) => { const m = $('dev-msg'); if (m) m.textContent = text; };
  const active = () => !!readout || !!tour;

  // ---- the renderer's render, while a tool is on: how long it took, and its counters, summed over the frame
  function timedRender(scene, camera) {
    const c0 = info.render.calls, t0 = info.render.triangles, a = performance.now();
    own.call(renderer, scene, camera);
    if (cur) { cur.render += performance.now() - a; cur.calls += info.autoReset ? info.render.calls : info.render.calls - c0; cur.tris += info.autoReset ? info.render.triangles : info.render.triangles - t0; cur.drew = true; }
  }
  function arm() { renderer.render = active() ? timedRender : own; }

  // ---- the animation loop, wrapped
  const setLoop = renderer.setAnimationLoop.bind(renderer);
  renderer.setAnimationLoop = (cb) => setLoop(cb && ((now) => {
    if (!active()) return cb(now);
    cur = { render: 0, calls: 0, tris: 0, drew: false };
    const a = performance.now();
    if (tour) try { tourFrame(now); } catch (e) { console.error('the tour stopped:', e); if (tour) finish(true); }
    cb(now);
    const work = performance.now() - a - cur.render, f = cur; cur = null;
    if (f.drew) {
      const ms = now - lastDrawn, held = !tour && !!g().paused, real = lastDrawn > 0 && ms > 0 && (tour ? true : !held && !wasHeld && ms < GAUGE.gap * 1000);
      lastDrawn = now; wasHeld = held;
      if (real) { const r = { t: now, ms, work, calls: f.calls, tris: f.tris }; frames.push(r); if (tour?.job && tour.phase === 'measure') tour.job.samples.push(r); }
      else frames.push({ t: now, ms: 0, work, calls: f.calls, tris: f.tris, first: true }); // the first after a gap: counted for the counters, not as a frame time
      while (frames.length && frames[0].t < now - GAUGE.worst * 1000) frames.shift();
    }
    if (readout && now - shownAt >= GAUGE.show * 1000) { shownAt = now; show(now); }
  }));

  // ---- the readout
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  function stats(now) {
    const recent = frames.filter((f) => f.t >= now - GAUGE.avg * 1000 && !f.first), all = frames.filter((f) => !f.first), last = frames[frames.length - 1];
    const avg = recent.length ? recent.reduce((s, f) => s + f.ms, 0) / recent.length : 0, worst = all.reduce((m, f) => Math.max(m, f.ms), 0);
    const work = recent.length ? recent.reduce((s, f) => s + f.work, 0) / recent.length : last ? last.work : 0;
    return { avg, worst, fps: recent.length / GAUGE.avg, calls: last ? last.calls : 0, tris: last ? last.tris : 0, work, idle: !last || now - last.t > 1000 };
  }
  function show(now) {
    const s = stats(now);
    const text = `frame  ${s.avg.toFixed(1)} ms   worst ${s.worst.toFixed(1)} ms\n` + `fps    ${s.fps.toFixed(0)}\n` + `draws  ${fmt(s.calls)}   tris ${fmt(s.tris)}\n` + `step   ${s.work.toFixed(2)} ms` + (s.idle ? '\n(not drawing: paused)' : '');
    if (text !== shown) { shown = text; readout.textContent = text; readout.dataset.calls = s.calls; readout.dataset.tris = s.tris; }
  }
  function setReadout(on) {
    if (on === !!readout) return;
    if (on) {
      readout = document.createElement('pre'); readout.id = 'gauge';
      readout.setAttribute('aria-hidden', 'true');
      readout.style.cssText = 'position:fixed;left:6px;top:6px;z-index:9999;margin:0;padding:5px 7px;font:11px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#b6ffb0;background:rgba(0,0,0,.72);border:1px dashed #b6ffb0;border-radius:3px;pointer-events:none;white-space:pre;contain:content';
      readout.textContent = 'frame  …'; shown = ''; shownAt = 0; frames.length = 0; lastDrawn = 0;
      document.body.appendChild(readout);
    } else { readout.remove(); readout = null; if (!tour) frames.length = 0; }
    arm();
    const b = $('dev-frametime'); if (b) b.setAttribute('aria-pressed', String(on));
  }

  // ---- the tour
  const g = () => game();
  function spotAt(name) { // where the fish is put, and which way it faces and swims, as the "Go to…" tools put it
    const G = g(), w = G.world, Y = (x, z, up) => ({ x, y: w.height(x, z) + up, z });
    if (name === 'start') { const s = w.spawn; return { ...Y(s.x, s.z, 3.3), yaw: w.nursery ? w.nursery.dir : NEST.yaw }; }
    if (name === 'bloom') { const b = w.bloom; if (!b) return null; const dx = b.x - w.spawn.x, dz = b.z - w.spawn.z, d = Math.hypot(dx, dz); return { ...Y(b.x - (dx / d) * (b.R + 9), b.z - (dz / d) * (b.R + 9), 3.3), yaw: Math.atan2(dx, dz) }; }
    if (name === 'sandflat' || name === 'reef') { const q = w.quiet?.[name]; if (!q) return null; const gt = q.gate; return { ...Y(gt.x + Math.sin(gt.yaw) * 7, gt.z + Math.cos(gt.yaw) * 7, 3), yaw: gt.yaw + Math.PI }; }
    if (name === 'kelp') { const lane = w.quiet?.kelpwood?.lanes?.find((l) => l.name === 'main'); if (!lane) return null; const P = lane.points, i = Math.max(0, Math.min(P.length - 2, (P.length >> 1) - 1)), [ax, az] = P[i], [bx, bz] = P[i + 1];
      return { ...Y((ax + bx) / 2, (az + bz) / 2, 2.6), yaw: Math.atan2(bx - ax, bz - az) }; }
    if (name === 'keeper') { const k = G.guard, R = w.rift; if (!k || !R) return null; const dx = w.spawn.x - k.pos.x, dz = w.spawn.z - k.pos.z, d = Math.hypot(dx, dz) || 1; // 13 m from it on the start's side, swimming across in front of it
      return { ...Y(k.pos.x + (dx / d) * 13, k.pos.z + (dz / d) * 13, 3), yaw: Math.atan2(R.tx, R.tz) }; }
    return null;
  }
  function place(job) {
    const G = g(), p = spotAt(job.spot);
    if (!p) { job.missing = true; return false; }
    G.setMode(job.mode, true);
    G.rig.reset(G.rig.pos.clone().set(p.x, p.y, p.z), p.yaw); focus.copy(G.rig.joints[0]);
    Object.assign(G.cam, { yaw: p.yaw + Math.PI, pitch: levels[job.mode], zoom: 1, ease: null }); G.snap();
    G.run.safe = 0; // (safe makes the fish blink, which would change what is drawn: nothing may harm it meanwhile through hush instead)
    job.dir = { x: Math.sin(p.yaw), y: 0, z: Math.cos(p.yaw) };
    return true;
  }
  function tourFrame(now) {
    const T = tour, G = g(), dt = Math.min((now - (T.last || now)) / 1000, 0.05); T.last = now;
    if (!T.job || now >= T.until) { // the next phase
      if (T.job && T.phase === 'settle') { T.phase = 'measure'; T.until = now + T.measure * 1000; }
      else {
        T.job = T.jobs[T.jobs.indexOf(T.job) + 1] || null;
        while (T.job && !place(T.job)) T.job = T.jobs[T.jobs.indexOf(T.job) + 1] || null;
        if (!T.job) return finish(false);
        T.phase = 'settle'; T.until = now + T.settle * 1000; T.started = now;
        if (T.note) T.note.textContent = `Measuring ${T.jobs.indexOf(T.job) + 1} of ${T.jobs.length}: ${GAUGE.names[T.job.spot]}, ${T.job.cam} camera. Any key or click stops it.`;
      }
    }
    G.run.hush = 1; G.run.safe = 0;
    if (G.run.freeze > 0) { G.run.freeze -= dt; return; } // as the game's own tick does
    if (dt > 0) step(dt, { dir: T.job.dir, vertical: 0, sprint: false, coil: 0, tight: false, bite: false, aim: null, ...GAUGE.swim });
  }
  function startTour(opts = {}) {
    const G = g();
    if (tour || ended() || G.lib?.isOpen) return false;
    const r = G.rig;
    const saved = { floor: G.run.floor, mode: G.feel.mode, paused: G.paused, hold: window.__hold, safe: G.run.safe, hush: G.run.hush,
      pos: r.pos.clone(), yaw: r.yaw, pitch: r.pitch, trail: r.trail.map((t) => ({ p: t.p.clone(), roll: t.roll })),
      cam: { yaw: G.cam.yaw, pitch: G.cam.pitch, zoom: G.cam.zoom, ease: G.cam.ease ? { ...G.cam.ease } : null }, seed: G.run.seed };
    const jobs = []; for (const [mode, cam] of GAUGE.cams) for (const spot of GAUGE.spots) jobs.push({ mode, cam, spot, samples: [] });
    if (G.run.floor !== 0) G.enterFloor(0, false);
    tour = { saved, jobs, job: null, phase: null, until: 0, last: 0, settle: opts.settle ?? GAUGE.settle, measure: opts.measure ?? GAUGE.measure, done: null };
    tour.note = document.createElement('div'); tour.note.id = 'gauge-tour';
    tour.note.style.cssText = 'position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:9999;padding:5px 10px;font:12px/1.3 ui-monospace,Menlo,Consolas,monospace;color:#b6ffb0;background:rgba(0,0,0,.72);border:1px dashed #b6ffb0;border-radius:3px;pointer-events:none';
    tour.note.textContent = 'Measuring the first band…'; document.body.appendChild(tour.note);
    window.addEventListener('keydown', interrupt, true); window.addEventListener('pointerdown', interrupt, true);
    lastDrawn = 0; G.setPaused(false); window.__hold = true; // the dive is stepped by the tour (tourFrame), not by the player's input
    arm();
    return new Promise((res) => { tour.done = res; });
  }
  function interrupt(e) { if (!tour) return; e.preventDefault(); e.stopPropagation(); finish(true); }
  function finish(stopped) {
    const T = tour, G = g(), s = T.saved;
    window.removeEventListener('keydown', interrupt, true); window.removeEventListener('pointerdown', interrupt, true);
    T.note.remove(); tour = null; if (!readout) frames.length = 0;
    // back where and how the player was: band, camera, place, body, pause
    if (G.run.floor !== s.floor) G.enterFloor(s.floor, false);
    G.setMode(s.mode, true);
    G.rig.reset(s.pos, s.yaw, s.pitch); if (s.trail.length === G.rig.trail.length) { G.rig.trail = s.trail; G.rig._pose?.(1e-3, G.rig._world); }
    focus.copy(G.rig.joints[0]);
    Object.assign(G.cam, s.cam); G.snap();
    G.run.safe = s.safe; G.run.hush = s.hush;
    window.__hold = s.hold;
    G.setPaused(s.paused);
    arm();
    const result = { stopped, rows: T.jobs.filter((j) => j.samples.length || j.missing).map(row), settle: T.settle, measure: T.measure, text: '' };
    result.text = table(result, s.seed);
    present(result.text, stopped);
    T.done?.(result);
  }
  function row(j) {
    const S = j.samples, n = S.length, avg = (k) => n ? S.reduce((a, f) => a + f[k], 0) / n : 0;
    return { cam: j.cam, spot: j.spot, name: GAUGE.names[j.spot], missing: !!j.missing, frames: n, avg: avg('ms'), worst: S.reduce((m, f) => Math.max(m, f.ms), 0), calls: avg('calls'), tris: avg('tris'), step: avg('work') };
  }

  // ---- what it was measured on
  function gpu() {
    try { const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? `${gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)} (${gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)})` : `${gl.getParameter(gl.RENDERER)} (the browser does not give the card's name)`; } catch { return 'not known'; }
  }
  function browser() {
    const ua = navigator.userAgent, m = (re) => ua.match(re)?.[1];
    const name = m(/Edg\/([\d.]+)/) ? `Edge ${m(/Edg\/([\d.]+)/)}` : m(/OPR\/([\d.]+)/) ? `Opera ${m(/OPR\/([\d.]+)/)}` : m(/Firefox\/([\d.]+)/) ? `Firefox ${m(/Firefox\/([\d.]+)/)}` : m(/Chrome\/([\d.]+)/) ? `Chrome ${m(/Chrome\/([\d.]+)/)}` : m(/Version\/([\d.]+).*Safari/) ? `Safari ${m(/Version\/([\d.]+).*Safari/)}` : 'unknown browser';
    const os = navigator.userAgentData?.platform || (/Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'unknown system');
    return `${name} on ${os}${/HeadlessChrome/.test(ua) ? ' (headless)' : ''}`;
  }
  function version() { return document.querySelector('meta[name="version"]')?.content || window.OARFISH_VERSION || 'not given by the page'; }
  function table(r, seed) {
    const G = g(), c = renderer.domElement, pad = (s, n) => String(s).padEnd(n), lp = (s, n) => String(s).padStart(n);
    const head = [
      `Oarfish dive: the first band, measured ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
      `Graphics: ${gpu()}`,
      `Browser: ${browser()}`,
      `Picture: ${c.width} x ${c.height} pixels drawn, pixel ratio ${+renderer.getPixelRatio().toFixed(2)} (the screen's is ${+(window.devicePixelRatio || 1).toFixed(2)})`,
      `Lighter picture: ${G.light?.on ? 'on' : 'off'}`,
      `Game version: ${version()}`,
      `World: ${seed}`,
      `At each spot: ${r.settle} s to settle, then ${r.measure} s measured while the fish swims gently on. Times in ms; a frame cannot be quicker than the screen's refresh (16.7 ms at 60 Hz). Draw calls and triangles: the average frame. Step: the frame's work outside drawing.`,
      ...(r.stopped ? [`Stopped early by a key or a click: ${r.rows.length} of ${GAUGE.spots.length * GAUGE.cams.length} measured.`] : []),
      '',
      `${pad('camera', 10)} ${pad('spot', 20)} ${lp('avg ms', 7)} ${lp('worst ms', 9)} ${lp('fps', 5)} ${lp('draw calls', 11)} ${lp('triangles', 10)} ${lp('step ms', 8)}`,
    ];
    const rows = r.rows.map((o) => o.missing ? `${pad(o.cam, 10)} ${pad(o.name, 20)} (not in this world)`
      : `${pad(o.cam, 10)} ${pad(o.name, 20)} ${lp(o.avg.toFixed(1), 7)} ${lp(o.worst.toFixed(1), 9)} ${lp(o.avg ? (1000 / o.avg).toFixed(0) : '-', 5)} ${lp(fmt(o.calls), 11)} ${lp(fmt(o.tris), 10)} ${lp(o.step.toFixed(2), 8)}`);
    return [...head, ...rows].join('\n');
  }
  function present(text, stopped) {
    $('gauge-table')?.remove();
    const box = document.createElement('div'); box.id = 'gauge-table';
    box.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:10000;width:min(860px,94vw);padding:10px;background:#111;border:1px dashed #b6ffb0;border-radius:4px;color:#b6ffb0;font:12px/1.4 ui-monospace,Menlo,Consolas,monospace';
    box.innerHTML = '<p id="gauge-said" style="margin:0 0 6px"></p><textarea readonly spellcheck="false" style="width:100%;height:min(60vh,360px);box-sizing:border-box;background:#000;color:#e8ffe6;border:1px solid #444;font:inherit;white-space:pre;overflow:auto"></textarea><div style="margin-top:6px;display:flex;gap:8px;justify-content:flex-end"><button type="button" data-copy>Copy</button><button type="button" data-close>Close</button></div>';
    const ta = box.querySelector('textarea'), said = box.querySelector('#gauge-said');
    ta.value = text;
    const select = () => { ta.focus({ preventScroll: true }); ta.select(); };
    const copy = (fromClick) => {
      const refused = () => { select(); let ok = false; if (fromClick) try { ok = document.execCommand('copy'); } catch {} said.textContent = ok ? 'Copied.' : 'The browser would not let the page copy it. The text is selected: press Ctrl+C (Cmd+C on a Mac).'; };
      try { const p = navigator.clipboard?.writeText(text); if (!p) return refused(); p.then(() => { said.textContent = `${stopped ? 'Stopped early. ' : ''}Copied to the clipboard: paste it into the chat.`; msg('The table is on the clipboard.'); }, refused); } catch { refused(); }
    };
    box.querySelector('[data-copy]').addEventListener('click', () => copy(true));
    box.querySelector('[data-close]').addEventListener('click', () => box.remove());
    document.body.appendChild(box);
    said.textContent = 'Copying…'; select(); copy(false);
  }

  // ---- the two buttons in the testing tools
  $('dev-frametime')?.addEventListener('click', () => { setReadout(!readout); msg(readout ? 'Frame time on: top left. It stays until you turn it off or reload.' : 'Frame time off.'); });
  $('dev-measure')?.addEventListener('click', () => { if (startTour() === false) msg('It can only be measured during a dive.'); });

  return { get armed() { return renderer.render === timedRender; }, get on() { return !!readout; }, set on(v) { setReadout(!!v); }, get touring() { return !!tour; }, tour: startTour, stop: () => tour && finish(true), stats: () => stats(performance.now()), get readout() { return readout; }, spotAt, GAUGE };
}
