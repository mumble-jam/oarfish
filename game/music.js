// A small jazz trio that plays the game: drummer, upright bass, electric piano, with a pad underneath.
// Every hunter and every keeper has an instrument of its own (CAST, below) and sits in while it is near the fish.
// Nothing is sampled; every sound is synthesised with Web Audio. The band reads the game state each
// tick (speed, coiling, danger, depth) and answers events at once with cymbals, stabs and fills.
//
// Sliders (all 0..1): volume, dream (reverb, darkness, sustain), energy (tempo, how busy the band is: where it rests
// in empty water; from there it climbs by itself with what is going on round the fish, see `life` below),
// menace (which harmony is used, low brass, toms), react (how hard the game pushes the band around),
// swing (straight to hard swing), band (drummer forward to harmony forward). And three for the turnaround (TURN, below):
// turn (how often: off, every 8, 4 or 2 bars), turnsize (one passing note up to a run of four), turnheight (how far below its
// landing note a walk-up starts), and turnall (0: only the keepers turn round; 1: the other creatures too). And one switch:
// farcarry (1: this band's keeper is heard from afar, and from the side it is on, FAR below; 0: only near, in the middle, as before).

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// chord colours: tones for the bass, a rootless voicing for the piano, a scale for runs
const QUAL = {
  maj9: { tones: [0, 4, 7, 11], voice: [4, 7, 11, 14], scale: [0, 2, 4, 6, 7, 9, 11] },
  m9: { tones: [0, 3, 7, 10], voice: [3, 7, 10, 14], scale: [0, 2, 3, 5, 7, 9, 10] },
  dom13: { tones: [0, 4, 7, 10], voice: [4, 9, 10, 14], scale: [0, 2, 4, 6, 7, 9, 10] },
  sus: { tones: [0, 5, 7, 10], voice: [5, 7, 10, 14], scale: [0, 2, 4, 5, 7, 9, 10] },
  mMaj7: { tones: [0, 3, 7, 11], voice: [3, 7, 11, 14], scale: [0, 2, 3, 5, 7, 9, 11] },
  m7b5: { tones: [0, 3, 6, 10], voice: [3, 6, 10, 17], scale: [0, 2, 3, 5, 6, 8, 10] },
  alt: { tones: [0, 4, 6, 10], voice: [4, 8, 10, 13], scale: [0, 1, 3, 4, 6, 8, 10] },
  phryg: { tones: [0, 5, 7, 10], voice: [1, 5, 7, 10], scale: [0, 1, 3, 5, 7, 8, 10] },
};
// four vamps from sweet to feral; each chord lasts two bars
export const MOODS = [
  { name: 'drifting', bars: [[0, 'maj9'], [9, 'm9'], [5, 'maj9'], [7, 'sus']] },
  { name: 'cool', bars: [[0, 'm9'], [5, 'dom13'], [0, 'm9'], [10, 'maj9']] },
  { name: 'noir', bars: [[0, 'mMaj7'], [8, 'maj9'], [2, 'm7b5'], [7, 'alt']] },
  { name: 'feral', bars: [[0, 'm9'], [1, 'maj9'], [0, 'phryg'], [6, 'alt']] },
];
const KEYS = [2, 0, 10, 9, 7]; // the key sinks as the dive goes down: D, C, B flat, A, G
// where the piano may land in a bar, in swung-eighth ticks (12 to the bar), from sparse to busy
const COMPS = [[[0]], [[0, 5], [5], [2, 8]], [[0, 5, 9], [2, 8], [5, 11], [3, 8]], [[0, 2, 5, 8, 11], [2, 5, 9, 11], [0, 3, 5, 8]]];
const RIDE = [0, 3, 5, 6, 9, 11];
// The cast: who plays what. A creature sits in with the band while it is near the fish, louder and busier the nearer it is.
// The four keepers and the Sum come before the hunters when more than three are near.
export const CAST = {
  biter: { name: 'muted trumpet' }, angler: { name: 'vibraphone' }, hook: { name: 'plucked string' }, drifter: { name: 'woodblock' }, leech: { name: 'bass clarinet' },
  squid: { name: 'pizzicato' }, moonjelly: { name: 'music box' }, nettle: { name: 'bowed bass' }, // the bloom water's three (bloom.js): quiet, and only near
  boxjelly: { name: 'glass' }, // the kelp forest's box jelly (kelpwood.js)
  keeper: { name: 'tuba', lead: true }, shearer: { name: 'tenor saxophone', lead: true }, lamplighter: { name: 'celesta', lead: true }, warden: { name: 'bowed cello', lead: true }, sum: { name: 'organ', lead: true },
};

// This band's keeper heard from afar (George took the marker to the rift away so that players explore, and asked for this in its place:
// swimming toward the keeper is rewarded by ear). Inside `join` it sits in with the band as it always has, as loud as it always was; from
// there out to `reach` it carries on, outside the three that sit in (so it takes nobody's place), at the loudness it joins with and
// fainter by `floor` decibels at `reach`, steadily in decibels between. The first band is 204 m across and repeats at its edges: the far
// side of it from the Keeper is 144 m off, round the edge; main.js measures the nearest copy. Wherever it is heard it is placed to the
// side it is on against the way the camera looks (`pan`, by distance: wide far off, narrow when it is round you), and from behind it is
// a little quieter and darker (`behind`), since two ears cannot tell ahead from behind by side alone. All of it goes with the switch.
export const FAR = {
  join: 26.4, // m: where it sits in today (main.js: 30 m reach, sitting in above 0.12 of it). From here in, nothing changes
  reach: 150, // m: past this, nothing
  floor: -27, // dB at `reach`, against its loudness at `join`
  p: 0.12, // how near its line plays while it is far: as it is where it joins, so the hand-over is seamless
  pan: [[0, 0.15], [5, 0.4], [15, 0.6], [40, 0.7]], // [m, how far to one side at most (1: all the way)], straight between
  behind: { db: -4, hz: 450 }, // straight behind: this much quieter, through a lowpass this low; to the side, none of it
  open: 16000, // Hz: the lowpass ahead and to the side
  smooth: 0.12, // s: how quickly the level, the side and the dark follow the fish and the camera
};

export function createMusic({ context = null } = {}) {
  const params = { volume: 0.7, dream: 0.6, energy: 0.5, menace: 0.5, react: 0.7, swing: 0.6, band: 0.5, turn: 0.66, turnsize: 0.66, turnheight: 0.2, turnall: 0, farcarry: 1 };
  const st = { intensity: 0.3, pulse: 0, tension: 0, life: 0, harmony: 0, beats: [], chain: 0, heat: 0, solo: { deg: 7, rest: 0, left: 0 }, show: null, licks: 0, cast: {}, sitting: [], turnBy: null, barAt: 0, showEnd: -1, back: null, far: null, ear: null, log: null, where: null, speed: 0, coil: 0, danger: 0, low: false, alive: true, floor: 0, floors: 5, mood: 1, bar: 0, tick: 0, beatStart: 0, started: false, muted: false, duck: 1 };
  let ctx = context, virtual = context ? 0 : null, timer = null;
  let n = null; // audio nodes
  let noiseBuf = null, pad = [], plan = null, lastBass = 40;
  const now = () => (virtual !== null ? virtual : ctx.currentTime);

  // ---------------------------------------------------------------- the room: buses, reverb, the water itself
  function build() {
    const g = (v) => { const x = ctx.createGain(); x.gain.value = v; return x; };
    n = { drums: g(1), bass: g(1), keys: g(1), pad: g(1), cast: g(0.9), dry: g(1), send: g(1), wet: g(0.4), master: g(0), sendOf: {} };
    n.water = ctx.createBiquadFilter(); n.water.type = 'lowpass'; n.water.frequency.value = 9000; n.water.Q.value = 0.4;
    n.comp = ctx.createDynamicsCompressor();
    n.comp.threshold.value = -16; n.comp.ratio.value = 5; n.comp.attack.value = 0.004; n.comp.release.value = 0.2;
    // a long dark tail, made from decaying noise
    const len = Math.floor(ctx.sampleRate * 3.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / ctx.sampleRate, k = 0.25 + 0.6 * Math.exp(-t * 2.2); // the tail darkens as it fades
        lp += k * ((Math.random() * 2 - 1) - lp);
        d[i] = lp * Math.exp(-t / 0.85) * (t < 0.012 ? t / 0.012 : 1);
      }
    }
    n.verb = ctx.createConvolver(); n.verb.buffer = ir;
    // the piano goes through a slow chorus and drifts from ear to ear
    n.keysIn = g(1);
    n.chorus = ctx.createDelay(0.05); n.chorus.delayTime.value = 0.019;
    n.chorusMix = g(0.5);
    const lfo = ctx.createOscillator(), lfoGain = g(0.0035);
    lfo.frequency.value = 0.31; lfo.connect(lfoGain); lfoGain.connect(n.chorus.delayTime); lfo.start();
    n.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : g(1);
    if (n.pan.pan) { const p = ctx.createOscillator(); n.panDepth = g(0.4); p.frequency.value = 0.19; p.connect(n.panDepth); n.panDepth.connect(n.pan.pan); p.start(); }
    n.keysIn.connect(n.pan); n.keysIn.connect(n.chorus); n.chorus.connect(n.chorusMix); n.chorusMix.connect(n.pan); n.pan.connect(n.keys);
    for (const [name, amt] of [['drums', 0.22], ['bass', 0.08], ['keys', 0.6], ['pad', 0.9], ['cast', 0.5]]) {
      n[name].connect(n.dry);
      n.sendOf[name] = g(amt); n[name].connect(n.sendOf[name]); n.sendOf[name].connect(n.send);
    }
    n.send.connect(n.verb); n.verb.connect(n.wet);
    n.dry.connect(n.water); n.wet.connect(n.water);
    n.limit = ctx.createDynamicsCompressor(); // a ceiling, so a crash on top of a loud bar cannot clip
    n.limit.threshold.value = -4; n.limit.knee.value = 0; n.limit.ratio.value = 20; n.limit.attack.value = 0.001; n.limit.release.value = 0.09;
    n.water.connect(n.comp); n.comp.connect(n.master); n.master.connect(n.limit); n.limit.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyParams(0.01);
  }
  // how much treble the water lets through: less with more dream, less with depth, almost none once the fish is gone
  function cutoff() {
    const depth = st.floors > 1 ? st.floor / (st.floors - 1) : 0;
    return Math.exp(lerp(Math.log(16000), Math.log(2200), clamp(params.dream * 0.5 + depth * 0.3, 0, 1))) * (st.alive ? 1 : 0.15);
  }
  // This band's keeper's own way into the cast (FAR, below): how loud from where it is, darker from behind, and to which side. Made the
  // first time it is wanted, so that a band with no keeper heard asks Web Audio for nothing more than before. A mono line through an
  // equal-power panner comes out 3 dB down in the middle, so it is given that back: dead ahead it is as loud as it was.
  function leadBus() {
    if (n.lead) return n.lead;
    const g = (v) => { const x = ctx.createGain(); x.gain.value = v; return x; };
    n.lead = g(1); n.leadDark = ctx.createBiquadFilter(); n.leadDark.type = 'lowpass'; n.leadDark.frequency.value = Math.min(FAR.open, ctx.sampleRate * 0.45); n.leadDark.Q.value = 0.5;
    n.leadPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null; n.leadOut = g(n.leadPan ? Math.SQRT2 : 1);
    n.lead.connect(n.leadDark); n.leadDark.connect(n.leadPan || n.leadOut); if (n.leadPan) n.leadPan.connect(n.leadOut); n.leadOut.connect(n.cast);
    hearFar(0.01);
    return n.lead;
  }
  // What FAR makes of where the keeper is (`f`: its id, `d` metres off, and `side`, `ahead`: where it is against the way the camera looks,
  // in any length): its level in dB against the line as it joins, its place from -1 (left) to 1 (right), the lowpass, how much behind.
  function ear(f) {
    if (!f || !(f.d >= 0)) return null;
    const lerpT = (tab, x) => { if (x <= tab[0][0]) return tab[0][1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) return lerp(tab[i - 1][1], tab[i][1], (x - tab[i - 1][0]) / (tab[i][0] - tab[i - 1][0])); return tab[tab.length - 1][1]; };
    const a = Math.atan2(f.side || 0, f.ahead || 0), behind = Math.max(0, -Math.cos(a));
    const dist = f.d <= FAR.join ? 0 : FAR.floor * Math.min(1, (f.d - FAR.join) / (FAR.reach - FAR.join)), db = dist + FAR.behind.db * behind;
    return { d: f.d, db, gain: f.d > FAR.reach ? 0 : Math.pow(10, db / 20), pan: Math.sin(a) * lerpT(FAR.pan, f.d), hz: Math.exp(lerp(Math.log(FAR.open), Math.log(FAR.behind.hz), behind)), behind, angle: a };
  }
  const carries = () => params.farcarry >= 0.5;
  // the keeper's way in follows where it is (only once it has been made)
  function hearFar(tc = FAR.smooth) {
    if (!n || !n.lead || !st.ear) return;
    const t = now(), e = st.ear;
    n.lead.gain.setTargetAtTime(e.gain, t, tc); n.leadDark.frequency.setTargetAtTime(Math.min(e.hz, ctx.sampleRate * 0.45), t, tc); if (n.leadPan) n.leadPan.pan.setTargetAtTime(clamp(e.pan, -1, 1), t, tc);
  }
  // play what `fn` plays as `id`: through the keeper's own way in if it is this band's keeper and the switch is on, else as before
  function as(id, fn) { const was = castTo; castTo = carries() && st.far && st.far.id === id && n ? leadBus() : null; fn(); castTo = was; }
  function applyParams(tc = 0.25) {
    if (!n) return;
    const t = now(), depth = st.floors > 1 ? st.floor / (st.floors - 1) : 0, P = params;
    const set = (p, v) => p.setTargetAtTime(v, t, tc);
    set(n.master.gain, st.muted ? 0 : P.volume * 1.15 * st.duck);
    set(n.wet.gain, 0.1 + 0.62 * P.dream + 0.12 * depth);
    set(n.water.frequency, cutoff());
    set(n.drums.gain, lerp(1.2, 0.5, P.band) * (1 - 0.25 * P.dream));
    set(n.keys.gain, lerp(0.55, 1.15, P.band));
    set(n.pad.gain, (0.25 + 0.9 * P.dream) * lerp(0.6, 1.1, P.band));
    set(n.bass.gain, 0.95);
    set(n.chorusMix.gain, 0.15 + 0.6 * P.dream);
    if (n.panDepth) set(n.panDepth.gain, 0.1 + 0.6 * P.dream);
  }

  // ---------------------------------------------------------------- instruments
  function env(gain, t, attack, peak, decay) {
    gain.setValueAtTime(0.0001, t);
    gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  function noise(t, { hp, bp, q = 0.7, lp, attack = 0.002, decay, gain, out = n.drums }) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    let node = src;
    const filt = (type, f, qq) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (qq) b.Q.value = qq; node.connect(b); node = b; };
    if (hp) filt('highpass', hp);
    if (bp) filt('bandpass', bp, q);
    if (lp) filt('lowpass', lp);
    const g = ctx.createGain();
    env(g.gain, t, attack, gain, decay);
    node.connect(g); g.connect(out);
    src.start(t, Math.random() * 1.5); src.stop(t + attack + decay + 0.05);
  }
  function tone(t, { type = 'sine', f0, f1 = 0, glide = 0.08, attack = 0.003, decay, gain, out = n.drums }) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + glide);
    env(g.gain, t, attack, gain, decay);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + attack + decay + 0.05);
  }
  const kit = {
    ride(t, v, bell) { const soft = 1 - 0.35 * params.dream; noise(t, { hp: 3600, bp: 6200, q: 0.5, decay: 0.3 + 0.35 * v, gain: 0.62 * v * soft }); tone(t, { type: 'triangle', f0: bell ? 2640 : 3520, decay: bell ? 0.5 : 0.16, gain: (bell ? 0.16 : 0.09) * v * soft }); if (bell) tone(t, { f0: 3962, decay: 0.4, gain: 0.09 * v * soft }); },
    hat(t, v) { noise(t, { hp: 5500, decay: 0.05, gain: 0.42 * v }); },
    brush(t, v) { noise(t, { bp: 2600, q: 0.6, attack: 0.05, decay: 0.22, gain: 0.3 * v }); },
    snare(t, v) { noise(t, { hp: 900, bp: 2100, q: 0.6, decay: 0.09 + 0.07 * v, gain: 0.85 * v }); tone(t, { type: 'triangle', f0: 205, f1: 160, glide: 0.05, decay: 0.07, gain: 0.3 * v }); },
    rim(t, v) { tone(t, { type: 'square', f0: 1650, decay: 0.03, gain: 0.2 * v }); tone(t, { type: 'triangle', f0: 420, decay: 0.05, gain: 0.26 * v }); },
    kick(t, v) { tone(t, { f0: 118, f1: 46, glide: 0.09, attack: 0.002, decay: 0.2, gain: 0.6 * v }); },
    tom(t, v, f = 120) { tone(t, { f0: f * 1.35, f1: f, glide: 0.1, decay: 0.26, gain: 0.5 * v }); noise(t, { bp: f * 6, q: 1, decay: 0.05, gain: 0.05 * v }); },
    crash(t, v) { noise(t, { hp: 3000, attack: 0.004, decay: 1.5, gain: 0.6 * v }); noise(t, { bp: 5200, q: 1.4, decay: 0.9, gain: 0.5 * v }); },
    splash(t, v) { noise(t, { hp: 4200, decay: 0.32, gain: 0.6 * v }); },
    swell(t, v, len = 1.4) { noise(t, { hp: 2600, attack: len, decay: 0.5, gain: 0.55 * v }); },
  };
  // the drums are written down too (st.log), as `drum:<what>`, for the tools and checks that read the band without hearing it
  for (const k of Object.keys(kit)) { const f = kit[k]; kit[k] = (t, ...r) => { if (st.log) st.log.push({ voice: 'drum:' + k, at: st.where, t, v: r[0], tag: st.tag || null }); return f(t, ...r); }; }
  function bassNote(t, midi, dur, v) {
    const f = mtof(midi), filt = ctx.createBiquadFilter(), g = ctx.createGain();
    filt.type = 'lowpass'; filt.Q.value = 1.2;
    filt.frequency.setValueAtTime(600 + 1500 * v, t); filt.frequency.exponentialRampToValueAtTime(380 + 260 * v, t + 0.25);
    for (const [type, level] of [['triangle', 0.55], ['sawtooth', 0.16 + 0.2 * params.menace], ['sine', 0.3]]) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = type; og.gain.value = level;
      o.frequency.setValueAtTime(f * 0.972, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.035); // the finger sliding onto the note
      o.connect(og); og.connect(filt);
      o.start(t); o.stop(t + dur + 0.2);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.34 * v, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.13 * v, t + 0.16);
    g.gain.setValueAtTime(0.13 * v, t + Math.max(dur - 0.02, 0.17));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
    filt.connect(g); g.connect(n.bass);
  }
  // electric piano: one sine bent by another, with a bell on the attack
  function pianoNote(t, midi, dur, v, out = n.keysIn) {
    const f = mtof(midi), car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.frequency.value = f; mod.frequency.value = f;
    mg.gain.setValueAtTime(f * (0.9 + 1.9 * v), t); mg.gain.exponentialRampToValueAtTime(f * 0.18, t + 0.35);
    mod.connect(mg); mg.connect(car.frequency);
    const tail = dur + 0.5 + 1.4 * params.dream;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3 * v, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.13 * v, t + 0.22);
    g.gain.exponentialRampToValueAtTime(0.0001, t + tail);
    car.connect(g); g.connect(out);
    car.start(t); mod.start(t); car.stop(t + tail + 0.05); mod.stop(t + tail + 0.05);
    tone(t, { f0: f * 5.02, decay: 0.09, gain: 0.04 * v, out });
  }
  // low brass: two saws opening and closing a filter, for the nasty moments
  function brass(t, midis, dur, v) {
    const filt = ctx.createBiquadFilter(), g = ctx.createGain();
    filt.type = 'lowpass'; filt.Q.value = 3;
    filt.frequency.setValueAtTime(260, t); filt.frequency.exponentialRampToValueAtTime(900 + 2200 * v, t + 0.05); filt.frequency.exponentialRampToValueAtTime(380, t + dur);
    env(g.gain, t, 0.015, 0.16 * v, dur + 0.1);
    for (const m of midis) for (const cents of [-9, 8]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = cents;
      o.connect(filt); o.start(t); o.stop(t + dur + 0.2);
    }
    filt.connect(g); g.connect(n.keys);
  }
  function padChord(t, midis) {
    for (const p of pad) { p.g.gain.cancelScheduledValues(t); p.g.gain.setTargetAtTime(0, t, 0.9); for (const o of p.os) o.stop(t + 5); }
    pad = midis.map((m) => {
      const g = ctx.createGain(), filt = ctx.createBiquadFilter(), os = [];
      filt.type = 'lowpass'; filt.frequency.value = 1200;
      g.gain.setValueAtTime(0, t); g.gain.setTargetAtTime(0.05, t, 0.8);
      for (const cents of [-7, 7]) { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m); o.detune.value = cents; o.connect(filt); o.start(t); os.push(o); }
      filt.connect(g); g.connect(n.pad);
      return { g, os };
    });
  }
  // a few rising blips, like bubbles, on notes of the chord
  function bubbles(t, midis, v) {
    midis.forEach((m, i) => tone(t + i * 0.06, { f0: mtof(m + 12), f1: mtof(m + 12) * 1.5, glide: 0.07, decay: 0.09, gain: 0.14 * v, out: n.keysIn }));
  }

  // ---------------------------------------------------------------- the cast's instruments
  const osc = (type, f, t, stop) => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(stop); return o; };
  const lowpass = (f, q = 0.8) => { const b = ctx.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = f; b.Q.value = q; return b; };
  // where a cast voice goes: the cast's bus, or, for this band's keeper while it is heard by FAR, its own way in (as(), below)
  let castTo = null; const C = () => castTo || n.cast;
  const held = (t, attack, level, dur) => { const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(level, 0.0002), t + attack); g.gain.setValueAtTime(Math.max(level, 0.0002), t + Math.max(dur, attack + 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, attack + 0.01) + 0.14); g.connect(C()); return g; };
  const voices = {
    trumpet(t, m, dur, v) { // muted: a saw through a narrow nose
      const o = osc('sawtooth', mtof(m) * 0.985, t, t + dur + 0.2), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.frequency.exponentialRampToValueAtTime(mtof(m), t + 0.03);
      f.type = 'bandpass'; f.Q.value = 5; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(1900, t + 0.04); f.frequency.exponentialRampToValueAtTime(1200, t + dur + 0.05);
      env(g.gain, t, 0.012, 0.6 * v, dur + 0.06); o.connect(f); f.connect(g); g.connect(C());
    },
    vibes(t, m, dur, v) { // a metal bar struck soft, with the motor turning
      const g = ctx.createGain(), trem = ctx.createGain(), lfo = osc('sine', 5.2, t, t + dur + 0.3), lg = ctx.createGain();
      for (const [k, level] of [[1, 0.5], [4, 0.14], [10, 0.03]]) { const og = ctx.createGain(); og.gain.value = level; osc('sine', mtof(m) * k, t, t + dur + 0.3).connect(og); og.connect(g); }
      env(g.gain, t, 0.004, 0.5 * v, dur); lg.gain.value = 0.35; trem.gain.value = 0.65; lfo.connect(lg); lg.connect(trem.gain); g.connect(trem); trem.connect(C());
    },
    pluck(t, m, dur, v) { // a string pulled and let go
      const len = Math.max(dur, 0.35), o = osc('sawtooth', mtof(m) * 1.03, t, t + len + 0.2), f = lowpass(3200, 2), g = ctx.createGain();
      o.frequency.exponentialRampToValueAtTime(mtof(m), t + 0.05); f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.25);
      env(g.gain, t, 0.002, 0.55 * v, len); o.connect(f); f.connect(g); g.connect(C());
    },
    block(t, m, dur, v) { tone(t, { f0: mtof(m), decay: 0.05, gain: 0.4 * v, out: C() }); tone(t, { type: 'triangle', f0: mtof(m) * 2.76, decay: 0.03, gain: 0.14 * v, out: C() }); }, // wood, struck
    clarinet(t, m, dur, v, to = 0) { // hollow and low, sliding to its next note
      const o = osc('square', mtof(m), t, t + dur + 0.3), f = lowpass(700 + 700 * v);
      if (to) o.frequency.exponentialRampToValueAtTime(mtof(to), t + dur * 0.85);
      o.connect(f); f.connect(held(t, 0.07, 0.2 * v, dur));
    },
    tuba(t, m, dur, v) { // the bottom of the brass: round, slow to speak
      const f = lowpass(180, 1.5), g = held(t, 0.05, 0.42 * v, dur);
      f.frequency.setValueAtTime(180, t); f.frequency.exponentialRampToValueAtTime(520 + 300 * v, t + 0.09); f.frequency.exponentialRampToValueAtTime(260, t + dur);
      for (const cents of [-6, 6]) { const o = osc('sawtooth', mtof(m), t, t + dur + 0.3); o.detune.value = cents; o.connect(f); }
      osc('sine', mtof(m), t, t + dur + 0.3).connect(f); f.connect(g);
    },
    sax(t, m, dur, v) { // reedy, with a shake in it and breath on the front
      const o = osc('sawtooth', mtof(m) * 0.97, t, t + dur + 0.3), f = lowpass(1500 + 1400 * v, 2.5), vib = osc('sine', 5.6, t, t + dur + 0.3), vg = ctx.createGain();
      o.frequency.exponentialRampToValueAtTime(mtof(m), t + 0.04); vg.gain.value = mtof(m) * 0.008; vib.connect(vg); vg.connect(o.frequency);
      o.connect(f); f.connect(held(t, 0.03, 0.26 * v, dur)); noise(t, { bp: 2200, q: 0.9, attack: 0.01, decay: 0.07, gain: 0.1 * v, out: C() });
    },
    celesta(t, m, dur, v) { // small bells, very high, a long time dying
      const g = ctx.createGain(); env(g.gain, t, 0.003, 0.34 * v, dur); g.connect(C());
      for (const [k, level, cents] of [[1, 0.6, 0], [1, 0.3, 9], [3, 0.1, 0], [5.4, 0.04, 0]]) { const og = ctx.createGain(); og.gain.value = level; const o = osc('sine', mtof(m) * k, t, t + dur + 0.2); o.detune.value = cents; o.connect(og); og.connect(g); }
    },
    cello(t, m, dur, v, to = 0) { // bowed: it leans into the note and slides off it
      const f = lowpass(520 + 500 * v, 1.2), g = held(t, 0.28, 0.24 * v, dur);
      for (const cents of [-5, 5]) { const o = osc('sawtooth', mtof(m), t, t + dur + 0.4); o.detune.value = cents; if (to) { o.frequency.setValueAtTime(mtof(m), t + dur * 0.45); o.frequency.exponentialRampToValueAtTime(mtof(to), t + dur * 0.95); } o.connect(f); }
      f.connect(g);
    },
    organ(t, midis, dur, v) { // every stop out: the whole chord, swelling
      const g = held(t, 0.35, 0.11 * v, dur);
      for (const m of midis) for (const [k, level] of [[1, 1], [2, 0.5], [3, 0.3], [4, 0.18]]) { const og = ctx.createGain(); og.gain.value = level; osc('sine', mtof(m) * k, t, t + dur + 0.4).connect(og); og.connect(g); }
    },
  };
  // every note the cast and the keepers' shows play can be written down (st.log, an array, or null for not), with the bar and tick it
  // was asked for in (and `show` if a keeper's show played it): how the checks and tools/hear_turn.mjs read a line without hearing it
  for (const k of Object.keys(voices)) { const f = voices[k]; voices[k] = (t, m, dur, v, ...r) => { if (st.log) st.log.push({ voice: k, at: st.where, t, m, dur, v, show: !!st.showing, tag: st.tag || null }); return f(t, m, dur, v, ...r); }; }

  // ---------------------------------------------------------------- harmony
  const tonic = () => KEYS[Math.min(st.floor, KEYS.length - 1)];
  function chordAt(bar) {
    const [off, q] = MOODS[st.mood].bars[Math.floor((((bar % 8) + 8) % 8) / 2)];
    return { root: (tonic() + off) % 12, q: QUAL[q] };
  }
  const voicing = (ch, lowest = 55) => ch.q.voice.map((iv) => { let m = 48 + ch.root + iv; while (m < lowest) m += 12; while (m > lowest + 19) m -= 12; return m; }).sort((a, b) => a - b);
  // the octave of pitch class `pc` nearest to `near`, kept inside the bass's range
  function bassPitch(pc, near) {
    let best = 0, bd = 99;
    for (let m = 28 + ((pc - 28 % 12) + 120) % 12; m <= 52; m += 12) if (Math.abs(m - near) < bd) { bd = Math.abs(m - near); best = m; }
    return best;
  }
  function pickMood() {
    const depth = st.floors > 1 ? st.floor / (st.floors - 1) : 0;
    return clamp(Math.round(params.menace * 2.4 + depth * 1.1 + (st.low ? 0.4 : 0) - 0.3), 0, MOODS.length - 1);
  }

  // ---------------------------------------------------------------- the turnaround
  // George liked the Keeper's oom-pah ('it makes him feel big and heavy') but not that every bar went round the same. So every few bars
  // a line turns round at the end of the bar: 'pam-pam, pam-pam, pam-pam, pam-pa-PAM-pam'. It is not a solo: the same instrument and
  // weight, the note on beat three a touch louder (1.12), and the next bar's first note is not touched. One rule for any repeating line;
  // each line says in TURN only what is its own: its instrument, the note its next bar starts on (`land`), the notes it has round beat
  // three if it has any (`before`, `three`), its lowest note (`low`), how long its notes are against the tuba's (`len`), and `slot`.
  //   one note (turnsize 0)   a short passing note on the swung eighth before beat three, the note of the scale nearest halfway between
  //                           the note before it and the beat-three note (the Keeper: root, passing note, fifth). A line with nothing on beat
  //                           three gets instead one short note a step under its landing, on the last swung eighth.
  //   two to four notes       the second half of the bar is a walk-up of the scale into the next bar's first note, the last a step under
  //                           it. turnheight is how many steps under it the walk-up starts: from as close as the notes allow up to seven
  //                           (about an octave), never under `low`. Where the notes fall: TURN_RHYTHM.
  // The notes are the scale of the chord the band is on in that bar, aiming at the note the line plays on the next bar's chord.
  // Bars that are not turnaround bars are played exactly as before; with turn at 0 nothing here is reached at all.
  // A keeper's fill or solo always wins: in a bar where a show sounds, or into which one rings, nothing turns round.
  // Only one line turns round in a bar, the first of `st.sitting` whose bar it is (a keeper before a hunter), and each line's `slot` puts
  // its turnaround on a different odd bar of the interval, so that creatures, when they may (turnall), do not all turn at once.
  const TURN_RHYTHM = { // [tick, length in beats, loudness against the line's own]: PAM on beat three
    2: [[6, 0.9, 1.12], [9, 0.9, 1]],
    3: [[5, 0.3, 0.8], [6, 0.9, 1.12], [9, 0.9, 1]],
    4: [[5, 0.3, 0.8], [6, 0.9, 1.12], [9, 0.55, 0.95], [11, 0.3, 0.9]],
  };
  const lamp = (ch) => voicing(ch, 79), vibe = (ch, b) => { const vo = voicing(ch, 67); return vo[b % vo.length]; }, bell = (ch, b) => { const vo = voicing(ch, 84); return vo[b % vo.length]; };
  const TURN = {
    keeper: { voice: 'tuba', slot: 0, low: 26, land: (nx) => bassPitch(nx.root, 36), before: (ch) => bassPitch(ch.root, 36), three: (ch) => bassPitch(ch.root + 7, 36), threeDur: (beat) => beat * 1.25 },
    shearer: { voice: 'sax', slot: 0, low: 50, len: 0.7, land: (nx) => 55 + nx.root }, // its run starts on the root
    lamplighter: { voice: 'celesta', slot: 0, low: 70, len: 1.4, land: (nx) => lamp(nx)[3] + 12, before: (ch) => lamp(ch)[2], three: (ch) => lamp(ch)[1], threeDur: () => 1.5 },
    warden: { voice: 'cello', slot: 0, low: 36, len: 1.2, land: (nx) => bassPitch(nx.root, 45) },
    sum: { voice: 'organ', slot: 0, low: 31, len: 1.2, land: (nx) => bassPitch(nx.root, 40) },
    biter: { voice: 'trumpet', slot: 1, low: 58, len: 0.5, land: (nx) => 60 + nx.root + nx.q.scale[4] },
    angler: { voice: 'vibes', slot: 2, low: 62, len: 1.3, land: vibe },
    hook: { voice: 'pluck', slot: 3, low: 45, len: 0.8, land: (nx) => bassPitch(nx.root, 46) + 12 },
    drifter: { voice: 'block', slot: 1, low: 74, len: 0.5, land: () => 86 },
    leech: { voice: 'clarinet', slot: 2, low: 38, len: 1, land: (nx) => 43 + nx.root + nx.q.scale[2] },
    squid: { voice: 'pluck', slot: 3, low: 64, len: 0.4, land: (nx) => 72 + nx.root },
    moonjelly: { voice: 'celesta', slot: 1, low: 80, len: 1.6, land: bell },
    nettle: { voice: 'cello', slot: 2, low: 30, len: 1.4, land: (nx) => bassPitch(nx.root + nx.q.tones[1], 40) },
    boxjelly: { voice: 'vibes', slot: 2, low: 72, len: 0.9, land: (nx) => 72 + nx.root + nx.q.scale[6] }, // the kelp forest's box jelly (kelpwood.js): its glassy pair starts on the seventh of the scale
  };
  const inScale = (ch, m) => ch.q.scale.includes((((m - ch.root) % 12) + 12) % 12);
  const stepFrom = (ch, m, k) => { let x = m; for (let i = 0; i < Math.abs(k);) { x += Math.sign(k); if (inScale(ch, x)) i++; } return x; }; // k steps of the chord's scale from m (down for k < 0)
  const turnEvery = () => [0, 8, 4, 2][Math.round(clamp(params.turn, 0, 1) * 3)];
  const turnSize = () => 1 + Math.round(clamp(params.turnsize, 0, 1) * 3);
  function turnBar(id, bar) { // may `id` turn round in this bar?
    const T = TURN[id], every = turnEvery();
    if (!T || !every || !(CAST[id].lead || params.turnall >= 0.5)) return false;
    return (((bar % every) + every) % every) === every - 1 - 2 * (T.slot % (every / 2));
  }
  function nextChord(bar) { // the next bar's chord as planBar will have it (every eight bars the mood may change)
    if ((bar + 1) % 8 !== 0) return chordAt(bar + 1);
    const was = st.mood; st.mood = pickMood(); const nx = chordAt(bar + 1); st.mood = was; return nx;
  }
  // the turnaround of `id` in `bar`: [tick, midi, length in seconds, loudness against the line's]
  function turnNotes(id, bar) {
    const T = TURN[id], ch = chordAt(bar), beat = st.beatDur, size = turnSize(), len = T.len || 1, land = T.land(nextChord(bar), bar + 1);
    if (size === 1) {
      if (!T.three) return [[11, stepFrom(ch, land, -1), 0.3 * beat * len, 0.9]];
      const a = T.before(ch, bar), b = T.three(ch, bar);
      let pass = Math.round((a + b) / 2), best = 99; // the note of the scale nearest halfway between them (if two are, the one nearer beat three)
      for (let x = Math.min(a, b) + 1; x < Math.max(a, b); x++) { const d = Math.abs(x - (a + b) / 2) - (Math.abs(x - b) < Math.abs(x - a) ? 0.01 : 0); if (inScale(ch, x) && d < best) { best = d; pass = x; } }
      return [[5, pass, 0.3 * beat * len, 0.8], [6, b, T.threeDur(beat), 1.12]];
    }
    let h = Math.max(size, Math.round(lerp(2, 7, clamp(params.turnheight, 0, 1))));
    while (h > size && stepFrom(ch, land, -h) < T.low) h--;
    return TURN_RHYTHM[size].map(([tick, beats, k], i) => [tick, stepFrom(ch, land, -(h - Math.round((i * (h - 1)) / (size - 1)))), beats * beat * len, k]);
  }
  const sound = (voice, t, m, dur, v) => (voice === 'organ' ? voices.organ(t, [m, m + 12], dur, v) : voices[voice](t, m, dur, v));

  // what a member of the cast plays on this tick, if anything: p is how near it is (0 to 1); `sure` plays every chance it has.
  // `alone`: it is being heard on its own (the library), so it turns round when its bar comes whoever else is near.
  function playCast(id, p, bar, tick, t, sure = false, alone = false) {
    const ch = chordAt(bar), rnd = Math.random, beat = st.beatDur, v = 0.45 + 0.55 * p;
    const turn = (alone || st.turnBy === id) && turnBar(id, bar) && !(st.show || (!alone && st.showEnd > st.barAt)) ? turnNotes(id, bar) : null;
    if (turn) {
      const mine = turn.find((x) => x[0] === tick);
      if (mine) sound(TURN[id].voice, t, mine[1], mine[2], v * mine[3]);
      if (mine || (turnSize() > 1 && tick >= 5)) return; // the line's own notes give way to it
    }
    const cap = turn ? beat * (turnSize() > 1 ? 1.55 : 3.5) : Infinity; // a long note is let go before the turnaround
    const may = (chance) => sure || rnd() < chance;
    const deg = (d, base) => base + ch.root + ch.q.scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7); // a step of the chord's scale, above `base`
    if (id === 'biter') { // two quick bites off the beat
      if ((tick === 2 || tick === 5 || tick === 8 || tick === 11) && may(0.2 + 0.5 * p)) { const d = 4 + Math.floor(rnd() * 5); voices.trumpet(t, deg(d, 60), 0.09, v); if (may(0.5)) voices.trumpet(t + st.tickLen * 0.5, deg(d - 1, 60), 0.12, v * 0.85); }
    } else if (id === 'angler') { // the lure: two notes of the chord left hanging
      if ((tick === 0 || tick === 6) && may(0.45 + 0.4 * p)) { const vo = voicing(ch, 67), i = (bar + tick / 6) % vo.length | 0; voices.vibes(t, vo[i], beat * 2.6, v); voices.vibes(t + 0.11, vo[(i + 2) % vo.length], beat * 2.4, v * 0.8); }
    } else if (id === 'hook') { // a twang, and the octave under it
      if ((tick === 3 || tick === 9) && may(0.3 + 0.45 * p)) { const m = bassPitch(ch.root + (tick === 3 ? 0 : 7), 46) + 12; voices.pluck(t, m, 0.4, v); voices.pluck(t + 0.13, m - 12, 0.5, v * 0.8); }
    } else if (id === 'drifter') { // tick, tock
      if (tick % 3 === 1 && may(0.18 + 0.42 * p)) voices.block(t, (tick === 1 || tick === 7) ? 86 : 81, 0.05, v);
    } else if (id === 'leech') { // a low note that slides to the one beside it
      if ((tick === 0 || tick === 6) && may(0.5 + 0.3 * p)) { const m = deg(tick === 0 ? 2 : 4, 43); voices.clarinet(t, m, Math.min(beat * 1.7, cap), v, m + (rnd() < 0.5 ? 1 : -1)); }
    } else if (id === 'squid') { // a skitter of short high notes, three to a beat, now and then
      if (tick % 3 !== 0 && may(0.12 + 0.3 * p)) voices.pluck(t, deg(7 + ((bar + tick) % 5), 60), 0.12, v * 0.6);
    } else if (id === 'moonjelly') { // one small bell at the top of the chord, a bar apart, slow as their beating
      if (tick === 0 && may(0.45 + 0.4 * p)) { const vo = voicing(ch, 84); voices.celesta(t, vo[bar % vo.length], 1.6, v * 0.45); }
    } else if (id === 'nettle') { // a long low bowed note every other bar, leaning down a step
      if (tick === 0 && bar % 2 === 0 && may(0.6 + 0.4 * p)) { const m = bassPitch(ch.root + ch.q.tones[1], 40); voices.cello(t, m, beat * 5, v * 0.55, m - 1); }
    } else if (id === 'boxjelly') { // two high glassy notes a step apart, held, on the off-beats: closer, and they come every beat
      if ((tick === 3 || tick === 9 || (p > 0.6 && (tick === 0 || tick === 6))) && may(0.35 + 0.5 * p)) { const m = deg(6, 72); voices.vibes(t, m, beat * 0.9, v * 0.5); voices.vibes(t + 0.06, m + 1, beat * 0.8, v * 0.35); }
    } else if (id === 'keeper') { // oom, pah: the root and its fifth, slow and heavy
      if (tick === 0 || tick === 6) voices.tuba(t, bassPitch(ch.root + (tick === 0 ? 0 : 7), 36), beat * 1.25, v);
    } else if (id === 'shearer') { // a run up the scale, then two jabs
      if (tick <= 3 ? may(0.45 + 0.5 * p) : (tick === 8 || tick === 9) && may(0.3 + 0.5 * p)) voices.sax(t, deg(tick <= 3 ? tick + (bar % 2) * 2 : 6 - (tick - 8), 55), tick === 3 ? beat * 0.9 : 0.16, v);
    } else if (id === 'lamplighter') { // the chord, let fall a note at a time from the top
      if (tick % 3 === 0 && may(0.6 + 0.35 * p)) { const vo = voicing(ch, 79); voices.celesta(t, vo[3 - tick / 3] + (bar % 2 ? 0 : 12 * (tick === 0)), 1.5, v); }
    } else if (id === 'warden') { // one long bowed note to the bar, sliding as it circles
      if (tick === 0) { const m = bassPitch(ch.root + ch.q.tones[bar % 2 ? 2 : 0], 45); voices.cello(t, m, Math.min(beat * 3.7, cap), v, m + (bar % 4 < 2 ? 2 : -1)); }
    } else if (id === 'sum') { // all of it at once
      if (tick === 0) voices.organ(t, [bassPitch(ch.root, 40), ...voicing(ch, 55)], Math.min(beat * 3.8, cap), v);
    }
  }

  // ---------------------------------------------------------------- one bar of decisions, then twelve ticks of playing
  function planBar(bar, t) {
    const I = st.intensity, ch = chordAt(bar), next = chordAt(bar + 1), rnd = Math.random;
    if (bar % 8 === 0) st.mood = pickMood();
    if (bar % 2 === 0 || !pad.length) padChord(t, voicing(chordAt(bar), 50).slice(0, 3).concat(bassPitch(chordAt(bar).root, 43) + 12));
    plan = { bass: [], comp: [], fill: false, roots: voicing(ch) };
    // bass: two in the bar when calm, four when moving, with a lead-in to the next chord
    const root = bassPitch(ch.root, lastBass > 46 ? 40 : lastBass), tones = ch.q.tones;
    const pick = (list) => list[Math.floor(rnd() * list.length)];
    if (I < 0.26) {
      plan.bass.push([0, root, 1.9], [6, bassPitch(ch.root + 7, root), 1.7]);
    } else {
      const b2 = bassPitch(ch.root + pick(ch.q.scale.slice(1, 4)), root);
      const b3 = bassPitch(ch.root + pick(tones.slice(1)), b2);
      const target = bassPitch(next.root, b3);
      const b4 = target + (rnd() < 0.35 + 0.4 * params.menace ? (rnd() < 0.5 ? 1 : -1) : (rnd() < 0.5 ? 2 : -2)); // chromatic or a step away
      plan.bass.push([0, bar % 2 ? bassPitch(ch.root + pick(tones), root) : root, 0.9], [3, b2, 0.9], [6, b3, 0.9], [9, b4, 0.9]);
      if (I > 0.72 && rnd() < 0.5) plan.bass.push([11, b4 + (rnd() < 0.5 ? 12 : 7), 0.3]); // a skip into the next bar
    }
    lastBass = plan.bass[plan.bass.length - 1][1];
    // piano: how often it lands depends on how hot things are
    const level = I < 0.22 ? 0 : I < 0.5 ? 1 : I < 0.78 ? 2 : 3;
    plan.comp = rnd() < 0.12 && level > 0 ? [] : pick(COMPS[level]);
    plan.fill = bar % 4 === 3 && I > 0.42 && rnd() < I;
  }
  function playTick(bar, tick, t) {
    const I = st.intensity, P = params, rnd = Math.random, beat = Math.floor(tick / 3), sub = tick % 3;
    if (tick === 0) { planBar(bar, t); st.barAt = t; st.turnBy = [...st.sitting, ...(farLine() ? [st.far.id] : [])].find((id) => turnBar(id, bar)) ?? null; } // who may turn round in this bar
    st.where = [bar, tick];
    const human = () => (rnd() - 0.5) * 0.012;
    // --- drummer
    const fillNow = plan.fill && tick >= 6;
    if (I < 0.24) { // brushes and almost nothing else
      if (sub === 0) kit.brush(t, 0.6 + 0.4 * (beat % 2));
      if (tick === 0 || tick === 6) kit.ride(t + human(), 0.35);
    } else if (!fillNow && RIDE.includes(tick)) {
      const accent = tick === 3 || tick === 9 ? 1 : sub === 2 ? 0.55 : 0.8;
      kit.ride(t + human(), accent * lerp(0.5, 1, I), I > 0.8 && tick === 0 && rnd() < 0.6);
    }
    if ((tick === 3 || tick === 9) && I > 0.12) kit.hat(t, 0.5 + 0.5 * I);
    if (sub === 0 && I > 0.34 && !fillNow) kit.kick(t, 0.16 + 0.12 * I); // feathered, felt more than heard
    if (!fillNow && I > 0.25) {
      const upbeat = sub === 2;
      if (rnd() < (upbeat ? 0.04 + 0.34 * I : 0.09 * I)) kit.snare(t + human(), 0.18 + 0.4 * I * rnd());
      if (upbeat && rnd() < 0.03 + 0.22 * I * I) kit.kick(t, 0.5 + 0.4 * I); // a bomb
      if (tick === 9 && I > 0.7 && rnd() < 0.5) kit.rim(t, 0.9);
    }
    if (P.menace > 0.55 && I > 0.5 && (tick === 5 || tick === 11) && rnd() < P.menace * 0.7) kit.tom(t, 0.5 * I, tick === 5 ? 92 : 74); // jungle toms when things are ugly
    if (fillNow) { // triplets down the kit into the next bar
      const k = tick - 6, v = 0.45 + 0.09 * k;
      if (k < 2) kit.snare(t, v); else kit.tom(t, v, [150, 150, 112, 84][k - 2]);
    }
    if (tick === 0 && bar % 4 === 0 && st.fillEnded) { kit.crash(t, 0.5 + 0.4 * I); kit.kick(t, 0.9); st.fillEnded = false; }
    if (fillNow && tick === 11) st.fillEnded = true;
    // a press roll that tightens while the fish coils
    if (st.tension > 0.22) {
      const v = 0.1 + 0.42 * st.tension * st.tension;
      kit.snare(t, v);
      if (st.tension > 0.6) kit.snare(t + st.tickLen * 0.5, v * 0.85);
    }
    // --- bass
    for (const [at, midi, beats] of plan.bass) if (at === tick) bassNote(t + human() * 0.5, midi, beats * st.beatDur, lerp(0.55, 1, I));
    // --- piano
    if (plan.comp.includes(tick)) {
      const ch = tick === 11 ? chordAt(bar + 1) : chordAt(bar); // a hit on the last eighth belongs to the next chord
      const long = I < 0.3, v = lerp(0.5, 0.95, I) * (tick === 0 ? 1 : 0.85);
      voicing(ch).forEach((m, i) => pianoNote(t + i * (long ? 0.018 : 0.004) + human(), m, long ? st.beatDur * 2.5 : 0.16 + 0.2 * rnd(), v));
      if (P.menace > 0.6 && I > 0.75 && rnd() < 0.35) brass(t, [bassPitch(ch.root, 40) + 12, bassPitch(ch.root + 6, 46) + 12], 0.22, 0.7);
    }
    // --- the cast: whoever is near sits in; and a keeper that has the floor plays its fill or its solo in place of its part
    // (this band's keeper, far off, plays too, outside the three: FAR); a line that has given way to its own hit, fill or solo comes back
    // where comeBack says, and plays nothing of its own till then
    for (const id of st.sitting) if (!(st.show && st.show.id === id)) as(id, () => lineTick(id, st.cast[id], bar, tick, t));
    if (farLine() && !(st.show && st.show.id === st.far.id)) as(st.far.id, () => lineTick(st.far.id, FAR.p, bar, tick, t));
    if (st.back && bar * 12 + tick > st.back.R) st.back = null; // its line was not playing when it should have come back
    if (st.show) as(st.show.id, () => playShow(bar, tick, t));
    // --- the harmony the fish has rowed up: one held note of the chord for each voice it has, laid again every two beats
    if (st.harmony > 0 && (tick === 0 || tick === 6)) { const ch = chordAt(bar), notes = oarNotes(ch); for (let i = 0; i < st.harmony && i < notes.length; i++) hum(t, notes[i], st.beatDur * 2.4, 0.5 + 0.1 * i); }
    // --- a run of catches: each one in time adds a player, and the third is a solo
    if (st.chain >= 1) playChain(bar, tick, t);
  }
  // The notes the oars build a chord from, in the order they come in: the root, the fifth, then the third, the seventh and the ninth above.
  const oarNotes = (ch) => { const base = 48 + ch.root, t = ch.q.tones; return [base, base + t[2], base + 12 + t[1], base + 12 + t[3], base + 26]; };
  // one held, breathy note: the fish's own voice in the chord
  function hum(t, m, dur, v) {
    const g = ctx.createGain(), f = lowpass(900 + 500 * v, 0.7), level = 0.07 * v * lerp(0.5, 1, params.react);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(level, t + 0.18); g.gain.setValueAtTime(level, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const [type, cents] of [['sine', 0], ['triangle', 6], ['triangle', -6]]) { const o = osc(type, mtof(m), t, t + dur + 0.05); o.detune.value = cents; o.connect(f); }
    f.connect(g); g.connect(n.pad);
  }
  // What the chain adds on this tick. 1: the vibraphone answers the piano, off its hits. 2: two horns riff, the same two bars over and over.
  // 3: a saxophone solos, a line that walks the chord's scale in swung eighths, lands on a chord note when the chord changes, and breathes.
  const RIFF = [[2, 0, 0.5], [5, 1, 0.3], [8, 0, 0.3], [11, 2, 0.9], [17, 1, 0.3], [20, 2, 0.5], [23, 0, 0.3]]; // tick in two bars, which note of the voicing, how long in beats
  // A keeper's showing off (George: the bosses' instruments came in 'in a very monotone way'; each should be able to do 'some sort of a salto', and rarely,
  // the melody staying as steady as it is most of the time). Two kinds, both set off by the fight and not by chance (api.flourish):
  //   fill   a bar or less: a run on its own instrument, swelling, that lands on a long note. For the wind-up of its biggest blow.
  //   solo   two bars and a half that are its own: the line wanders in swung eighths over the chords and comes home. For the moment the fight changes.
  // While it has the floor its ordinary part is left out, and it plays in the band's time, on the band's chords.
  const SHOW = {
    keeper: { voice: 'tuba', base: 36, fill: [7, 5, 4, 2, 0], low: 0, high: 9, len: 0.9 },
    shearer: { voice: 'sax', base: 55, fill: [0, 2, 4, 6, 7, 9], low: 0, high: 14, len: 0.5 },
    lamplighter: { voice: 'celesta', base: 79, fill: [9, 7, 6, 4, 2, 0, 2, 4], low: -2, high: 11, len: 1.2 },
    warden: { voice: 'cello', base: 45, fill: [0, 4, 7], low: 0, high: 9, len: 1.6 },
    sum: { voice: 'tuba', base: 40, fill: [0, 4, 0], low: 0, high: 7, len: 1 },
  };

  // ---------------------------------------------------------------- a keeper's hit, and its line coming back after it
  // George, of the Keeper's tuba: 'I like the sound when it strikes, but it seems to interrupt the main rhythm in a weird manner. Or should I
  // rather say that the rhythm comes back as if it was ignoring the strike sound happened.' It did: the fill's long note landed when its run
  // ran out, and the oom-pah came back on its very next one or three, as if nothing had been played (sometimes a swung eighth after the long
  // note, on top of it). The phrase itself, the run and the long note as one, is as it always was (George, hearing a version that held the
  // long note for the claw: it sounded cut, its end 'replaced with a drum plate'); the claw keeps the drums' burst (main.js) and nothing more.
  // What changed is the joining: whatever a keeper ends a show on (a fill's long note, a solo's last note, which now waits for one or three)
  // rings its whole length, untouched, and its line stays out until a strong beat (one or three) after it, at least `after` beats on and
  // with room for a pickup once the hit has rung (`alone` beats of it at most: a longer one, the Warden's bow, is let ring under it), so never
  // more than about a bar; and comes back ON that beat, led in by a pickup like a turnaround's (TURN), as long as the room allows: the notes a
  // step at a time up the scale into the note the line plays there (ENTRY), with a kick under it. The sounds are as they were.
  const BACK = {
    after: 4 / 3, // beats: the line comes back on the first strong beat at least this far after the hit
    alone: 1.7, // beats: the most of the hit that has to have rung before its pickup may start (the Keeper's is 1.62: all of it)
    on: [0, 6], // the strong beats: one and three (ticks)
    kick: 0.45, // the drums: the kick that brings the line back in
  };
  // the pickup into the line's return: [ticks before it, length in beats, loudness against the line's]; the biggest that fits is played
  const PICKUP = { 1: [[-1, 0.3, 0.9]], 2: [[-3, 0.55, 0.95], [-1, 0.3, 0.9]], 3: [[-4, 0.3, 0.8], [-3, 0.55, 0.95], [-1, 0.3, 0.9]] };
  // the note each keeper's line comes back on, at tick 0 or 6 of `bar`, as its own line plays it there (playCast). A line that has nothing
  // of its own on beat three (the Shearer's run, the Warden's and the Sum's one note to a bar) comes back there on what it plays on one,
  // held to the bar's end, or the top of its run. Returns [note, seconds, the note it slides to].
  const ENTRY = {
    keeper: (ch, bar, tick, beat) => [bassPitch(ch.root + (tick ? 7 : 0), 36), beat * 1.25],
    shearer: (ch, bar, tick, beat) => [55 + ch.root + ch.q.scale[tick ? 4 : (bar % 2) * 2], tick ? beat * 0.9 : 0.16],
    lamplighter: (ch, bar, tick) => [voicing(ch, 79)[3 - tick / 3] + (bar % 2 ? 0 : 12 * (tick === 0)), 1.5],
    warden: (ch, bar, tick, beat) => { const m = bassPitch(ch.root + ch.q.tones[bar % 2 ? 2 : 0], 45); return [m, beat * (tick ? 1.8 : 3.7), m + (bar % 4 < 2 ? 2 : -1)]; },
    sum: (ch, bar, tick, beat) => [bassPitch(ch.root, 40), beat * (tick ? 1.8 : 3.8)],
  };
  const swingLate = () => lerp(0.5, 0.74, params.swing);
  // `id` ends a show on `hit` ({ m, dur, v }) at time T, in the beat G ({ at, index, dur }: a beat's start, its number, bar * 4 + beat, and
  // its length). Plays the hit, sets up the line's return (st.back) and says where it is.
  function comeBack(id, T, G, hit) {
    const D = G.dur, beatT = (k) => G.at + (k - G.index) * D, tickT = (g) => beatT(Math.floor(g / 3)) + [0, 1 / 3, swingLate()][((g % 3) + 3) % 3] * D;
    const rung = Math.min(hit.dur, BACK.alone * D), lead = (1 - swingLate()) * D; // the hit's own time, and the shortest pickup's
    let r = G.index + Math.ceil((T + Math.max(BACK.after * D, rung + lead) - G.at) / D - 1e-6); if (r % 2) r++; // the line's return: one or three
    const R = r * 3;
    let size = 3; while (size > 1 && tickT(R + PICKUP[size][0][0]) < T + rung - 1e-6) size--;
    const dur = hit.dur, S = SHOW[id];
    st.showing = true; voices[S.voice](T, hit.m, dur, Math.min(1.25, hit.v)); st.showing = false; // as say() in playShow played it
    st.licks++; st.showEnd = Math.max(st.showEnd, T + dur); st.show = null;
    st.back = { id, R, size, pickup: PICKUP[size].map(([dt, beats, loud]) => ({ g: R + dt, beats, loud })) };
    st.lastBack = { id, T, R: [Math.floor(r / 4), (r % 4) * 3], at: tickT(R), size, dur };
    return st.lastBack;
  }
  // a line's tick: its own part, or, while it is coming back (st.back), its pickup and then the note it comes back on
  function lineTick(id, p, bar, tick, t) {
    const B = st.back;
    if (!B || B.id !== id) return playCast(id, p, bar, tick, t);
    const g = bar * 12 + tick, v = 0.45 + 0.55 * p, beat = st.beatDur, T = TURN[id], E = ENTRY[id] || ENTRY.keeper;
    const rBar = Math.floor(B.R / 12), rTick = B.R % 12, rCh = rBar === bar ? chordAt(bar) : rBar % 8 === 0 ? nextChord(rBar - 1) : chordAt(rBar);
    const [land, len, to] = E(rCh, rBar, rTick, beat);
    st.tag = 'back';
    if (g < B.R) { // the pickup: a step at a time up the scale of the bar it is in, into the note it comes back on
      const i = B.pickup.findIndex((x) => x.g === g);
      if (i >= 0) { const x = B.pickup[i], ch = chordAt(bar); let m = stepFrom(ch, land, -(B.size - i)); if (m < T.low) m += 12; sound(T.voice, t, m, x.beats * beat * (T.len || 1), v * x.loud); }
    } else { // on the beat
      if (id === 'sum') voices.organ(t, [land, ...voicing(rCh, 55)], len, v); else voices[T.voice](t, land, len, v, to || 0);
      kit.kick(t, BACK.kick);
      st.back = null;
    }
    st.tag = null;
  }
  // this band's keeper is playing from afar: heard (the switch), not sitting in, and still standing (main.js sends no `far` once it has fallen)
  const farLine = () => carries() && st.far && CAST[st.far.id]?.lead && !st.sitting.includes(st.far.id) && st.ear && st.ear.gain > 0;
  function playShow(bar, tick, t) {
    const sh = st.show, S = SHOW[sh.id], ch = chordAt(bar), beat = st.beatDur, rnd = Math.random;
    const deg = (d) => S.base + ch.root + ch.q.scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7), say = (d, dur, v) => { st.showing = true; voices[S.voice](t, deg(d), dur, Math.min(1.25, v)); st.showing = false; st.licks++; st.showEnd = Math.max(st.showEnd, t + dur); };
    if (sh.wait > 0) { if (tick % 3 === 0) sh.wait--; return; } // it comes in on a beat
    const here = () => ({ at: t - [0, 1 / 3, swingLate()][tick % 3] * beat, index: bar * 4 + Math.floor(tick / 3), dur: beat }); // the beat this tick is in
    if (sh.kind === 'fill') {
      const i = sh.i, n = S.fill.length, v = 0.75 + 0.5 * (i / n); // swelling as it goes
      if (i < n - 1) { sh.i++; say(S.fill[i], st.tickLen * 1.1 * S.len, v); return; }
      // its last, long note, on the tick after the run as it always was; its line comes back after it (comeBack)
      comeBack(sh.id, t, here(), { m: deg(S.fill[n - 1]), dur: beat * 1.8 * S.len, v: 1.2 });
      return;
    }
    // the solo: swung eighths (the middle of each triplet left alone), a step or a leap at a time between its low and its high, a breath now and then, and home at the end,
    // on one or three, and its line comes back after it (comeBack)
    sh.left--; const sub = tick % 3;
    if (sh.left <= 0) { if (BACK.on.includes(tick)) comeBack(sh.id, t, here(), { m: deg(sh.id === 'keeper' || sh.id === 'warden' ? 0 : 7), dur: beat * 2.4 * S.len, v: 1.2 }); return; }
    if (sub === 1 || sh.rest-- > 0) return;
    if (rnd() < 0.12) { sh.rest = 1; return; }
    sh.deg = clamp(sh.deg + (rnd() < 0.2 ? (rnd() < 0.5 ? 3 : -3) : rnd() < 0.55 ? 1 : -1) * (sh.left < 8 ? -Math.sign(sh.deg - 3) || 1 : 1), S.low, S.high);
    say(sh.deg, (rnd() < 0.2 ? beat * 0.9 : st.tickLen * 1.5) * S.len, 0.85 + 0.3 * rnd() + (sub === 0 && tick % 6 === 0 ? 0.15 : 0));
  }
  function playChain(bar, tick, t) {
    const ch = tick === 11 ? chordAt(bar + 1) : chordAt(bar), rnd = Math.random, beat = st.beatDur, v = lerp(0.6, 1, params.react);
    const deg = (d, base) => base + ch.root + ch.q.scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    if (!plan.comp.includes(tick) && (tick === 3 || tick === 8 || (tick === 11 && rnd() < 0.5))) { const up = voicing(ch, 67); voices.vibes(t, up[(bar + tick) % up.length], beat * 1.4, 0.55 * v); voices.vibes(t + 0.02, up[(bar + tick + 2) % up.length], beat * 1.2, 0.4 * v); }
    if (st.chain >= 2) for (const [at, i, len] of RIFF) if (at === (bar % 2) * 12 + tick) { const up = voicing(ch, 60); brass(t, [up[i % up.length], up[(i + 2) % up.length]], len * beat, 0.55 * v); }
    if (st.chain >= 3) {
      const so = st.solo, sub = tick % 3;
      if (tick === 0 && bar % 2 === 0 && so.left > 0) so.deg = [7, 9, 11, 13][Math.floor(rnd() * 4)]; // a new chord: start again from one of its notes
      if (sub === 1) return; // swung eighths: the middle of the triplet is left alone
      if (so.rest > 0) { so.rest--; return; }
      if (so.left <= 0) { so.left = 5 + Math.floor(rnd() * 9); so.deg = clamp(so.deg + (rnd() < 0.5 ? 2 : -2), 5, 16); } // a new phrase
      const step = rnd() < 0.16 ? (rnd() < 0.5 ? 3 : -3) : rnd() < 0.5 ? 1 : -1, held = so.left === 1 || rnd() < 0.14;
      so.deg = clamp(so.deg + (so.deg > 15 ? -Math.abs(step) : so.deg < 5 ? Math.abs(step) : step), 3, 18);
      voices.sax(t, deg(so.deg, 53), held ? beat * 1.3 : beat * 0.42, (sub === 0 ? 0.95 : 0.75) * v);
      if (held) so.rest = 2;
      if (--so.left <= 0) so.rest = 2 + Math.floor(rnd() * 4); // a breath
    }
  }

  // ---------------------------------------------------------------- the clock
  // Energy as the band plays it: the slider is where it rests, and life (how much is going on round the fish, 0 to 1,
  // told to update() and smoothed there) carries it the rest of the way to hunting
  const energyNow = () => lerp(params.energy, 1, st.life);
  function schedule(until) {
    if (!st.started) return;
    while (st.nextTime < until) {
      if (st.alive) playTick(st.bar, st.tick, st.nextTime);
      // step to the next swung eighth: three ticks to a beat, the middle one a true triplet, the last pushed late by swing
      if (st.tick % 3 === 0) {
        const bpm = lerp(108, 172, energyNow()) * (1 + 0.1 * st.intensity) * (st.alive ? 1 : 0.6);
        st.beatDur = 60 / bpm;
        st.beats.push({ at: st.nextTime, dur: st.beatDur, index: st.bar * 4 + st.tick / 3, off: lerp(0.5, 0.74, params.swing) * st.beatDur }); // for whoever plays along (see pulse)
        if (st.beats.length > 16) st.beats.shift();
      }
      const late = lerp(0.5, 0.74, params.swing), frac = [0, 1 / 3, late, 1];
      const sub = st.tick % 3;
      st.tickLen = (frac[sub + 1] - frac[sub]) * st.beatDur;
      st.nextTime += st.tickLen;
      if (++st.tick === 12) { st.tick = 0; st.bar++; }
    }
  }
  function begin() {
    if (st.started || !ctx) return;
    build();
    st.started = true; st.bar = 0; st.tick = 0; st.beatDur = 0.42; st.tickLen = 0.14; st.nextTime = now() + 0.12;
    st.mood = pickMood();
    if (virtual === null) timer = setInterval(() => schedule(ctx.currentTime + 0.16), 30);
  }

  // ---------------------------------------------------------------- what the game tells the band
  const api = {
    params, state: st,
    // a keeper takes the floor (playShow). A fill is turned away if anything was shown in the last `gap` seconds, so they stay rare; a solo always goes, and waits for nothing
    flourish(id, kind = 'fill', gap = 10) {
      if (!SHOW[id] || !st.started || !n) return false;
      const at = now(); if (kind === 'fill' && (st.show || at - (st.shownAt ?? -99) < gap)) return false;
      st.shownAt = at; st.show = { id, kind, i: 0, wait: kind === 'solo' ? 1 : 0, left: 30, rest: 0, deg: 4, at }; if (st.back?.id === id) st.back = null; return true;
    },
    // what FAR makes of a keeper `f` metres off ({ id, d, side, ahead }); for the checks and the tools
    hearing: (f) => ear(f), FAR,
    // what the band is doing right now, for the drawer
    describe() { return st.started ? { mood: MOODS[st.mood].name, key: ['D', 'C', 'B flat', 'A', 'G'][Math.min(st.floor, 4)], bpm: Math.round(60 / st.beatDur), intensity: st.intensity, energy: energyNow(), sitting: st.sitting.map((id) => CAST[id].name) } : null; },
    // one creature's instrument on its own, two bars of it, for the library
    // where it would turn round (TURN), four bars ending on its turnaround and the note that lands it
    audition(id) {
      if (!CAST[id] || !api.unlock() || !n) return false;
      const t0 = now() + 0.06, turns = turnEvery() && TURN[id] && (CAST[id].lead || params.turnall >= 0.5);
      let from = st.bar; if (turns) while (!turnBar(id, from + 3)) from++;
      const bars = turns ? 4 : 2, at = (bar, tick) => t0 + ((bar - from) * 12 + tick) * st.tickLen;
      for (let bar = from; bar < from + bars; bar++) for (let tick = 0; tick < 12; tick++) { st.where = [bar, tick]; playCast(id, 1, bar, tick, at(bar, tick), true, true); }
      if (turns) { st.where = [from + 4, 0]; playCast(id, 1, from + 4, 0, at(from + 4, 0), true, true); }
      return true;
    },
    // One creature's line with nothing else playing: `bars` bars from bar `from`, in the band's swing at `bpm`, as near as `p`. It goes
    // through the band's own rules (a keeper's show still wins, see TURN). For tools/hear_turn.mjs and the checks, which read st.log.
    // Returns the time it ends.
    line(id, bars, { from = 0, p = 1, bpm = 120, at = null } = {}) {
      if (!CAST[id]) return null;
      begin(); if (!n) return null;
      st.beatDur = 60 / bpm;
      const late = lerp(0.5, 0.74, params.swing), frac = [0, 1 / 3, late, 1];
      let t = at ?? now() + 0.05;
      for (let bar = from; bar < from + bars; bar++) for (let tick = 0; tick < 12; tick++) {
        if (tick === 0) { st.barAt = t; st.turnBy = turnBar(id, bar) ? id : null; }
        st.where = [bar, tick]; playCast(id, p, bar, tick, t);
        t += (frac[(tick % 3) + 1] - frac[tick % 3]) * st.beatDur;
      }
      return t;
    },
    get energy() { return energyNow(); },
    get muted() { return st.muted; },
    get running() { return st.started && ctx?.state === 'running'; },
    // call from a click or key press: browsers only let sound start from a gesture
    unlock() {
      try {
        if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false; ctx = new AC(); }
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        begin();
        return true;
      } catch { return false; }
    },
    set(name, value) { if (name in params) { params[name] = clamp(value, 0, 1); applyParams(); } },
    mute(m) { st.muted = !!m; applyParams(0.05); },
    duck(k) { st.duck = clamp(k, 0, 1); applyParams(0.18); }, // step back without touching the volume slider: the pause menu
    setScene(floor, floors) { st.floor = floor; st.floors = floors; st.alive = true; applyParams(1.2); },
    update(dt, s) {
      Object.assign(st, { speed: s.speed, coil: s.coil, danger: s.danger, low: !!s.low });
      if (s.alive !== st.alive) { st.alive = s.alive; applyParams(s.alive ? 0.3 : 1.2); }
      const P = params, a = clamp(s.activity || 0, 0, 1);
      st.life += (a - st.life) * (1 - Math.exp(-dt * (a > st.life ? 0.7 : 0.2))); // it gathers in a couple of seconds and lets go over several: a tempo should not flinch
      // the cast: each one's nearness, smoothed; the three nearest sit in, a keeper or the Sum ahead of the hunters
      const near = s.cast || {};
      for (const id of Object.keys(CAST)) { const to = clamp(near[id] || 0, 0, 1), was = st.cast[id] || 0; st.cast[id] = was + (to - was) * (1 - Math.exp(-dt * (to > was ? 1.6 : 0.5))); }
      st.sitting = Object.keys(CAST).filter((id) => st.cast[id] > 0.12).sort((a, b) => (st.cast[b] + (CAST[b].lead ? 1 : 0)) - (st.cast[a] + (CAST[a].lead ? 1 : 0))).slice(0, 3);
      // this band's keeper, wherever it is (main.js: `far`, { id, d, side, ahead }; null once it has fallen, or where there is none; left out
      // while the dive is paused, which keeps the last): FAR
      if (s.far !== undefined) { st.far = s.far && CAST[s.far.id]?.lead ? s.far : null; st.ear = ear(st.far); hearFar(); }
      st.pulse *= Math.exp(-dt / 1.6);
      st.harmony = Math.max(0, Math.min(5, s.harmony | 0)); // voices the fish has rowed up (see main.js, OARS)
      st.chain = Math.max(0, Math.min(3, s.chain | 0)); // catches in a row: 1 the vibraphone joins the piano, 2 the horns riff, 3 a solo over all of it
      st.heat += (st.chain / 3 - st.heat) * (1 - Math.exp(-dt * (st.chain / 3 > st.heat ? 4 : 0.6))); // the band stays warm for a little after the chain is lost
      const target = clamp(0.02 + 0.36 * energyNow() + P.react * (0.4 * s.speed + 0.5 * s.danger + 0.14 * s.coil + (s.low ? 0.1 : 0) + st.pulse + 0.3 * st.heat), 0, 1);
      st.intensity += (target - st.intensity) * (1 - Math.exp(-dt * (target > st.intensity ? 3.2 : 0.55)));
      st.tension += (s.coil * P.react - st.tension) * (1 - Math.exp(-dt * 2.5));
    },
    // A ruin chime, brushed. `i` is the bar's place in its set, 0 the longest; the note is taken from the chord the band is on at
    // this moment (the same voicing the piano comps with), so whatever is rung belongs. Returns the note, or null if the band is not playing.
    chime(i, strength = 1) {
      if (!st.started || !n) return null;
      const t = now() + 0.008, up = voicing(chordAt(st.bar), 72), m = up[i % up.length] + 12 * Math.floor(i / up.length), f = mtof(m), v = 0.35 + 0.65 * clamp(strength, 0, 1);
      for (const [k, level, decay] of [[1, 0.2, 2.0], [2.76, 0.07, 0.75], [5.4, 0.03, 0.28]]) tone(t, { f0: f * k, decay, gain: level * v, out: n.keysIn }); // a struck bar: its own three partials, the high ones gone first
      st.rung = m;
      return m;
    },
    // Where the beat is, for a player rowing along. Returns null if the band is not playing, else how far `at` (the audio clock, now by
    // default) is from the nearest beat and from the nearest swung off-beat, in seconds (negative: early), which beat that is, and its
    // length. What is heard runs a little behind what is scheduled, so the output's own delay is taken off.
    pulse(at = null) {
      if (!st.started || !ctx || st.beats.length < 2) return null;
      const t = (at ?? ctx.currentTime) - (ctx.outputLatency || ctx.baseLatency || 0);
      let best = null, off = null;
      for (const b of st.beats) { const d = t - b.at; if (!best || Math.abs(d) < Math.abs(best.d)) best = { d, index: b.index, dur: b.dur }; const e = t - (b.at + b.off); if (!off || Math.abs(e) < Math.abs(off.d)) off = { d: e, index: b.index }; }
      const last = st.beats[st.beats.length - 1], since = t - last.at; // past the end of what has been scheduled: carry the last beat's length on
      if (since > last.dur * 0.5) { const k = Math.round(since / last.dur), d = since - k * last.dur; if (Math.abs(d) < Math.abs(best.d)) best = { d, index: last.index + k, dur: last.dur }; }
      return { d: best.d, index: best.index, dur: best.dur, offD: off.d, offIndex: off.index, phase: (((t - last.at) / last.dur) % 1 + 1) % 1 };
    },
    // An oar pulled. good: in time, and `level` is the voice it adds (1 to 5), sounded as that note of the chord. perfect: dead on. drive:
    // on the swung off-beat. miss: out of time. surge: both oars on the first beat of the bar, the whole chord at once.
    oar(kind, level = 1) {
      if (!st.started || !n) return null;
      const t = now() + 0.006, ch = chordAt(st.bar), notes = oarNotes(ch), vol = lerp(0.4, 1, params.react), m = notes[clamp(level, 1, notes.length) - 1] + 12;
      if (kind === 'miss') { tone(t, { type: 'triangle', f0: 150, f1: 90, glide: 0.08, decay: 0.09, gain: 0.25 * vol }); noise(t, { bp: 500, q: 1, decay: 0.05, gain: 0.12 * vol }); return null; }
      if (kind === 'drive') { tone(t, { f0: mtof(m + 12), decay: 0.07, gain: 0.1 * vol, out: n.keysIn }); kit.hat(t, 0.35 * vol); return m + 12; }
      if (kind === 'surge') { notes.forEach((x, i) => voices.pluck(t + i * 0.03, x + 12, 0.5, 0.8 * vol)); kit.splash(t, 0.6 * vol); kit.kick(t, 0.8 * vol); return m; }
      voices.pluck(t, m, 0.45, (kind === 'perfect' ? 0.95 : 0.75) * vol);
      if (kind === 'perfect') tone(t, { f0: mtof(m + 24), decay: 0.25, gain: 0.05 * vol, out: n.keysIn }); // dead on: its octave rings over it
      return m;
    },
    // One step of the run of notes that goes with a swarm streaming into the mouth: step k of `of`, up the scale of the chord the band is on,
    // from the middle of the piano; a longer run climbs further. Returns the note.
    gulp(k, of, v = 1) {
      if (!st.started || !n) return null;
      const t = now() + 0.008, ch = chordAt(st.bar), m = 60 + ch.root + ch.q.scale[k % 7] + 12 * Math.floor(k / 7), last = k >= of - 1, vol = lerp(0.35, 1, params.react) * v;
      pianoNote(t, m, last ? 0.5 : 0.16, (0.5 + 0.4 * (k / of)) * vol);
      tone(t, { f0: mtof(m + 12), f1: mtof(m + 12) * 1.25, glide: 0.06, decay: 0.08, gain: 0.07 * vol, out: n.keysIn }); // and a bubble on top of each
      st.gulped = m;
      return m;
    },
    // the notes the chimes may ring right now, low to high
    chimeNotes() { const up = voicing(chordAt(st.bar), 72); return [...up, ...up.map((m) => m + 12)]; },
    // something just happened: answer it now, not on the next bar
    hit(kind, strength = 1) {
      if (!st.started) return;
      const t = now() + 0.012, ch = chordAt(st.bar), v = (0.45 + 0.55 * strength) * lerp(0.35, 1, params.react), up = voicing(ch, 62);
      const low = bassPitch(ch.root, 36);
      st.pulse = Math.min(1, st.pulse + ({ catch: 0.22, crest: 0.4, cache: 0.4, kill: 0.5, bite: 0.6, snag: 0.5, shed: 0.4, loop: 0.08, grow: 0.12, wake: 0.7, open: 0.6, ram: 0.35 }[kind] || 0) * (0.5 + strength * 0.5));
      if (kind === 'loop') { kit.rim(t, 0.8 * v); kit.splash(t, 0.35 * v); }
      else if (kind === 'flit') { kit.rim(t, 0.6 * v); kit.splash(t + 0.03, 0.3 * v); } // a swarm has bolted, or run
      else if (kind === 'part') { kit.rim(t, 0.8 * v); kit.rim(t + 0.09, 0.8 * v); kit.splash(t + 0.09, 0.4 * v); } // one swarm has become two
      else if (kind === 'burst') { kit.splash(t, 0.7 * v); kit.rim(t, v); kit.tom(t + 0.07, 0.6 * v, 112); } // ringed a swarm too big to hold
      else if (kind === 'catch') { // as big as the catch: a small swarm is a cymbal and a chord, a great one is the whole band
        kit.crash(t, 0.75 * v); kit.kick(t, 0.9 * v); up.forEach((m, i) => pianoNote(t + i * 0.012, m + 12, 0.5, 0.8 * v)); st.tension *= 0.3;
        if (strength > 0.45) { kit.snare(t, 0.8 * v); kit.tom(t + 0.09, 0.8 * v, 112); kit.tom(t + 0.18, 0.8 * v, 84); }
        if (strength > 0.65) brass(t, [low + 12, low + 19, low + 24], 0.45, v);
        if (strength > 0.9) { kit.crash(t + 0.27, v); kit.kick(t + 0.27, v); brass(t + 0.27, [low + 24, ...up.slice(0, 2)], 0.9, v); }
      }
      else if (kind === 'chain') { const lvl = Math.round(strength * 3); kit.snare(t, 0.5); kit.snare(t + 0.07, 0.6); kit.snare(t + 0.14, 0.75); kit.ride(t + 0.21, 1, true); if (lvl >= 2) brass(t + 0.21, [up[0], up[2 % up.length]], 0.3, 0.8); if (lvl >= 3) { kit.crash(t + 0.21, 0.9); voices.sax(t + 0.21, up[up.length - 1] + 12, 0.7, 1); } } // a pick-up into the layer that has just come in
      else if (kind === 'cache') { kit.ride(t, 1, true); kit.kick(t, 0.8 * v); [...up, up[0] + 12, up[1] + 12].forEach((m, i) => pianoNote(t + i * 0.07, m + 12, 0.9, 0.75 * v)); kit.crash(t + 0.42, 0.6 * v); } // something sealed has come open: a run up the chord and a cymbal at the top
      else if (kind === 'crest') { kit.swell(t, 0.7, 0.5); kit.crash(t + 0.5, 0.9 * v); brass(t + 0.5, [low + 12, low + 19, ...up.slice(1, 3)], 1.3, v); [...up, up[0] + 12].forEach((m, i) => pianoNote(t + 0.5 + i * 0.06, m + 12, 1.1, 0.8 * v)); } // a new standing: the band gives it a fanfare
      else if (kind === 'kill') { kit.crash(t, v); kit.kick(t, v); kit.snare(t, 0.9 * v); kit.tom(t + 0.11, 0.8 * v, 84); brass(t, [low + 12, low + 19, low + 24], 0.4, v); up.forEach((m) => pianoNote(t, m + 12, 0.6, 0.9 * v)); st.tension *= 0.2; }
      else if (kind === 'grow') { up.forEach((m, i) => pianoNote(t + i * 0.07, m + 12, 0.7, 0.7 * v)); kit.ride(t + 0.28, 0.9 * v, true); }
      else if (kind === 'bite') { kit.snare(t, v); kit.rim(t, v); kit.tom(t + 0.08, 0.9 * v, 70); kit.kick(t, v); brass(t, [low + 12, low + 18, low + 25], 0.5, v); n.water.frequency.cancelScheduledValues(t); n.water.frequency.setTargetAtTime(500, t, 0.03); n.water.frequency.setTargetAtTime(cutoff(), t + 0.22, 0.45); } // the hit muffles everything for a moment
      else if (kind === 'snag') { for (const [f, g] of [[2093, 0.09], [3136 * 1.01, 0.06], [4699, 0.04]]) tone(t, { f0: f, decay: 0.7, gain: g * v, out: n.keysIn }); kit.snare(t, 0.8 * v); kit.tom(t + 0.09, 0.7 * v, 84); }
      else if (kind === 'shed') { kit.splash(t, v); kit.tom(t, 0.8 * v, 112); kit.tom(t + 0.1, 0.8 * v, 84); const f = mtof(low + 24); tone(t, { type: 'triangle', f0: f, f1: f / 3, glide: 0.5, decay: 0.55, gain: 0.3 * v, out: n.bass }); }
      else if (kind === 'descend') { kit.swell(t, 0.9, 0.9); kit.crash(t + 0.9, 0.7); n.water.frequency.cancelScheduledValues(t); n.water.frequency.setTargetAtTime(300, t, 0.3); }
      else if (kind === 'dead') { kit.crash(t, 0.6); kit.tom(t, 1, 60); kit.tom(t + 0.18, 1, 46); brass(t, [low + 12, low + 13, low + 18], 1.6, 0.9); }
      else if (kind === 'win') { kit.crash(t, 0.9); const major = [0, 4, 7, 11, 14, 19].map((iv) => 60 + tonic() + iv); major.forEach((m, i) => pianoNote(t + i * 0.11, m, 2.2, 0.8)); }
      else if (kind === 'start') { st.alive = true; applyParams(0.3); kit.splash(t, 0.5); }
      else if (kind === 'dash') { kit.splash(t, 0.3 * v); }
      else if (kind === 'ram') { kit.kick(t, v); kit.rim(t, v); kit.tom(t + 0.05, 0.9 * v, 70); kit.splash(t, 0.5 * v); }
      // the Sum: it wakes; its circle opens; its circle closes
      else if (kind === 'wake') { kit.swell(t, 0.9, 1.4); kit.crash(t + 1.4, 0.8); kit.tom(t + 1.4, 1, 46); kit.tom(t + 1.62, 1, 40); brass(t + 1.4, [low + 12, low + 13, low + 19], 2.2, 1); }
      else if (kind === 'open') { kit.crash(t, 1); kit.kick(t, 1); kit.snare(t, 0.9); brass(t, [low + 12, low + 19, low + 26], 2.4, 0.9); up.forEach((m, i) => pianoNote(t + 0.5 + i * 0.16, m + 12, 2.4, 0.8)); st.tension = 0; }
      else if (kind === 'close') { kit.swell(t, 0.8, 2.2); [0, 7, 12, 16, 19].map((iv) => 48 + tonic() + iv).forEach((m, i) => pianoNote(t + 2.2 + i * 0.22, m, 3.5, 0.7)); kit.ride(t + 2.2, 0.9, true); }
    },
    // for measuring the band without a speaker: render `seconds` of sound against a scripted game
    async render(seconds, script, step = 0.05) {
      begin();
      for (let t = 0; t < seconds; t += step) {
        virtual = t;
        const s = script(t) || {};
        api.update(step, { speed: 0, coil: 0, danger: 0, low: false, alive: true, ...s });
        for (const h of s.hits || []) api.hit(h[0], h[1] ?? 1);
        schedule(t + 0.1);
      }
      return ctx.startRendering();
    },
  };
  return api;
}
