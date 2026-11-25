// The front page's music, made the way the band makes its sound (music.js): nothing sampled, every note synthesised with Web Audio.
// George did not like the page's music (slices of his bass track) and asked for 'something dreamy and slightly romanticized and something
// that will easily transition in the actual game music'. These are three sketches for him to choose from; none is wired into title.js yet.
//
//   a  Lullaby                a music box (the Lamplighter's celesta) rocking in a slow six over a low held note, almost alone
//   b  Slow waltz under water the vibraphone singing over a soft waltz (bass on one, the band's piano on two and three); the cello takes the tune
//   c  The band asleep        the first band's own vamp (Dm9, G13, Dm9, Cmaj9) at half its tempo: brushes, a two-feel bass, the piano, a sleepy tune
//
// One harmony for all three: the notes of C major heard from F (F Lydian, its B the 'little Lydian light') and from D (D Dorian, which is
// the scale the first band plays its first chord in). The band's first chord is D minor nine, and the band's piano voices it without its
// root as F A C E, which is F major seven: so the page's home chord is the band's first chord with its D left out. A press of Dive at any
// moment (dive(), below) drops a D under that and lands: whatever the page was playing stops where it is, its tails ring on in the room,
// the band's own D minor nine (its pad's voicing and its piano's) is held, and a short run up the scale (the fish's eating run, music.js
// `gulp`, is one) rises in the band's tempo into the band's second bar, as the band comes up; then the page fades under it.
//
// The voices are the band's own recipes, copied here so that music.js is not touched (it keeps them inside createMusic): its electric piano,
// celesta, vibraphone, cello, upright bass, pad and brushes; and its room, a tail of darkening noise. Only one is new, `pedal`, a low held
// note that swells and fades. Every number is in DREAM.

import { MOODS } from './music.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------------------------------------------------------------- every number of the page's music
export const DREAM = {
  level: 1.4, // the page against the game's volume (title.js multiplies the game's volume by this, as FRONT.music.gain)
  fadeIn: 3, // s: from nothing at the first touch
  room: { seconds: 4.8, decay: 1.3, wet: 0.5, dry: 0.8 }, // the band's tail (music.js build), longer and darker
  echo: { left: 0.43, right: 0.61, feedback: 0.33, hz: 1700, send: 0.2 }, // a soft echo on the tune only, darkening as it repeats
  water: { hz: 4000, swing: 1000, rate: 0.043, q: 0.45 }, // the lowpass over everything, and its slow shimmer (Hz up and down, cycles a second)
  chorus: { delay: 0.019, depth: 0.0035, rate: 0.31, mix: 0.45, drift: 0.35, driftRate: 0.11 }, // the band's piano chorus and its drift from ear to ear
  low: 0.75, // the low voices (pad, held note, bass) against the tune and the keys
  limit: -6, // dB: a ceiling, as the band's
  // Dive. The band starts when Dive is pressed (title.js: unlockBand, then music.js begin: its first beat 0.12 s later), silent, and is
  // brought up at FRONT.dive.release (1.3 s) over 0.18 s. Its tempo is music.js's: lerp(108, 172, energy) beats a minute, times
  // 1 + 0.1 * intensity (0.3 when it starts); its eighths are swung late by lerp(0.5, 0.74, swing).
  band: { first: 0.12, intensity: 0.3, voicing: [57, 60, 64, 65], pad: [50, 53, 57, 60], root: 38 }, // its first beat after the press; its Dm9 as its piano and pad voice it; a low D
  dive: {
    stop: 0.1, // s: the page's own notes let go this quickly at the press (time constant); their tails ring on in the room
    swell: 0.35, // s: the held chord comes up (time constant)
    fadeAt: 1.25, fadeTc: 0.55, // the page fades under the band from here (s after the press), with this time constant
    land: 1.5, // s: the run lands on the band's first downbeat at least this long after the press (a fresh band: its second bar, at 1.78 s)
    off: 6, // s after the press: the page is silent and stops
  },
  // a: Lullaby. A slow six (two bars of it to every two of the band's at its own tempo, rubato), a music box over a held low note.
  a: {
    eighth: 0.555, rubato: 0.05, ritard: 1.12, // s; each bar wanders this much either way; the last bar of a period is drawn out
    tune: { base: 77, v: 0.9, first: 0.75, attack: 0.05, third: 0.3, grace: 0.18 }, // F5; loudness, and of a phrase's first note (it was 1: at 34.4 s of the first render
    // a phrase's first E over Am9, struck at full loudness out of a near-silence, rose 15.5 dB in 10 ms, the band's steepest being 8.8); the bell's
    // attack in seconds (was 0.014; at 0.03 the steepest was 12.8 dB, a phrase's first G4 struck with the period's pad, held note and chord); how often a phrase is doubled a third under; a grace note on a long note
    pad: 0.4, pedal: 0.45, roll: 0.4, // loudness of the pad, the held note, the broken chord at a period's start
    breath: 4, // every fourth period the tune rests and a few bells fall in its place
    run: { voice: 'celesta', notes: [69, 71, 72, 74, 76], ticks: [6, 8, 9, 11, 12], v: 0.6 }, // A B C D into E, on the band's swung eighths of its first bar, landing on its second
  },
  // b: Slow waltz under water. Three at 72 (one waltz beat to two of the band's), the second beat a touch early as a Viennese waltz's.
  b: {
    beat: 60 / 72, lilt: [0, -0.06, 0.03], stretch: 0.04, // s; where in each beat the three fall (part of a beat); a phrase's last bar drawn out
    tune: { base: 65, v: 0.62, sixth: 0.3, cello: 0.5 }, // F4; how often doubled a sixth under; how often the cello takes the tune for a period
    bass: 0.5, comp: 0.3, pad: 0.45, brush: 0.22,
    run: { voice: 'vibes', notes: [72, 74, 76], ticks: [6, 9, 11, 12], land: 77, v: 0.62 }, // C D E into F, landing on the band's second bar
  },
  // c: The band asleep. The first band's own vamp at half its tempo, swung as it is.
  c: {
    bpm: 72, swing: 0.6, // half the band's 144
    tune: { base: 62, v: 0.55, bells: 0.35 }, // D4, played by the vibraphone; how often the celesta doubles it an octave up for a period
    bass: 0.55, comp: 0.42, pad: 0.4, brush: 0.5, ride: 0.3, walk: 0.5, // walk: how often the bass walks up into the next chord
    run: { voice: 'piano', notes: [62, 64, 65, 67, 69, 72], ticks: [3, 5, 6, 8, 9, 12], v: 0.55 }, // the eating run (music.js gulp) up D dorian, landing on C over the band's second bar
  },
};

// The chords: a root and the notes the piano plays above it (music.js QUAL `voice`), and for the three with B flat, which note moves.
const CH = {
  Fmaj9: { root: 5, voice: [4, 7, 11, 14] }, G69: { root: 7, voice: [4, 7, 9, 14] }, Dm9: { root: 2, voice: [3, 7, 10, 14] },
  Em11: { root: 4, voice: [3, 7, 10, 17] }, Am9: { root: 9, voice: [3, 7, 10, 14] }, Cmaj9: { root: 0, voice: [4, 7, 11, 14] },
  G13: { root: 7, voice: [4, 9, 10, 14] }, Bbmaj9: { root: 10, voice: [4, 7, 11, 14], alter: { 11: 10 } },
  Gm9: { root: 7, voice: [3, 7, 10, 14], alter: { 11: 10 } }, C9sus: { root: 0, voice: [5, 7, 10, 14], alter: { 11: 10 } },
};
// the band's qualities, for sketch c, which plays the band's own vamp (MOODS 'cool' in D: the first band as it starts)
const BANDQ = { m9: 'Dm9', dom13: 'G13', maj9: 'Cmaj9' }, BAND_KEY = 2, BAND_MOOD = 1;
// the scale every tune is written in: C major's notes, counted as steps from F (Lydian) or from D (Dorian)
const LYDIAN = [0, 2, 4, 6, 7, 9, 11], DORIAN = [0, 2, 3, 5, 7, 9, 10];
const stepOf = (base, mode, d) => base + mode[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
const fit = (ch, m) => { const pc = ((m % 12) + 12) % 12; return ch.alter && ch.alter[pc] !== undefined ? m - pc + ch.alter[pc] : m; }; // B to B flat over a B flat chord
// music.js voicing: the chord's notes above its root, kept between `lowest` and an octave and a half above it
const voicing = (ch, lowest = 55) => ch.voice.map((iv) => { let m = 48 + ch.root + iv; while (m < lowest) m += 12; while (m > lowest + 19) m -= 12; return m; }).sort((a, b) => a - b);
const bassOf = (ch, near = 40) => { let m = 24 + ch.root; while (m < near - 6) m += 12; return m; };

// The tunes. Each phrase is two bars: [where (a: eighths of a six; b: beats of a three; c: swung-eighth ticks, 12 to a bar), step of the
// scale, how long (eighths; beats; beats)]. Phrases are picked by a seeded rule, never one of the last two again.
const TUNES = {
  a: {
    ask: [ // the first half of a period
      [[0, 4, 2], [2, 2, 1], [3, 6, 3], [6, 5, 2], [8, 4, 1], [9, 2, 3]], // C A E, D C A: rocking down
      [[0, 1, 2], [2, 2, 1], [3, 3, 3], [6, 4, 4], [10, 2, 2]], // G A B C A: the Lydian B, lit
      [[0, 2, 3], [3, 4, 3], [6, 1, 6]], // A C G, breathing
      [[0, 0, 1], [1, 1, 1], [2, 2, 1], [3, 3, 1], [4, 4, 2], [6, 6, 6]], // F G A B C, E: the eating run, slowed
    ],
    answer: [ // the second half
      [[0, 4, 2], [2, 5, 1], [3, 7, 3], [6, 6, 2], [8, 4, 1], [9, 4, 3]], // C D F, E C C
      [[0, 7, 3], [3, 6, 1], [4, 4, 2], [6, 2, 3], [9, 1, 3]], // F E C A G: home by steps
      [[0, 6, 6], [6, 4, 6]], // E, C: two long bells
      [[0, 5, 2], [2, 4, 1], [3, 2, 2], [5, 1, 1], [6, 0, 6]], // D C A G F: all the way home
    ],
  },
  b: [
    [[0, 4, 2], [2, 5, 1], [3, 6, 3]], // C, D | E
    [[0, 6, 1], [1, 5, 1], [2, 4, 1], [3, 2, 3]], // E D C | A
    [[0, 2, 1], [1, 4, 1], [2, 7, 1], [3, 6, 2], [5, 4, 1]], // A C F | E, C
    [[0, 7, 3], [3, 8, 1], [4, 7, 1], [5, 6, 1]], // F | G F E: reaching up
    [[1, 1, 1], [2, 2, 1], [3, 4, 3]], // . G A | C: the lilt
    [[0, 0, 0.5], [0.5, 1, 0.5], [1, 2, 0.5], [1.5, 3, 0.5], [2, 4, 1], [3, 6, 3]], // F G A B C | E: the eating run
    [[0, 9, 2], [2, 8, 1], [3, 6, 3]], // A, G | E: the high sigh
  ],
  c: [
    [[0, 4, 2.5], [8, 5, 0.5], [9, 6, 1], [12, 4, 4]], // A, B C | A
    [[2, 7, 0.5], [3, 8, 1.5], [9, 6, 1], [12, 7, 3]], // D E, C | D
    [[0, 9, 1.5], [5, 8, 0.5], [6, 7, 1], [9, 6, 1], [12, 5, 2], [18, 4, 2]], // F E D C | B A: down from the top
    [[3, 0, 0.5], [5, 1, 0.5], [6, 2, 0.5], [8, 3, 0.5], [9, 4, 1], [12, 6, 4]], // D E F G A | C: the eating run
    [[0, 6, 1], [3, 8, 3], [12, 7, 1], [15, 6, 3]], // C E | D C
    [[6, 4, 2], [12, 8, 4]], // A | E: nearly asleep
  ],
};
// the periods of the lullaby: four bars over a held note (or a note that moves), and its chords
const A_PERIODS = {
  home: { chords: ['Fmaj9', 'G69', 'Fmaj9', 'Em11'], bass: [41] }, // over F: the Lydian II and back
  low: { chords: ['Dm9', 'Em11', 'Dm9', 'Cmaj9'], bass: [38] }, // over D: the band's chord
  turn: { chords: ['Fmaj9', 'Am9', 'Dm9', 'G13'], bass: [41, 45, 38, 43] },
  drift: { chords: ['Cmaj9', 'G69', 'Am9', 'Fmaj9'], bass: [36, 43, 45, 41] },
};
// the waltz's two progressions of eight bars (the B flats are its romance)
const B_PERIODS = [
  ['Fmaj9', 'Em11', 'Dm9', 'G13', 'Fmaj9', 'Am9', 'Bbmaj9', 'C9sus'],
  ['Dm9', 'G13', 'Cmaj9', 'Fmaj9', 'Bbmaj9', 'Am9', 'Gm9', 'C9sus'],
];

// a seeded run of numbers (mulberry32), so that a sketch varies as it goes and is the same every time from the same seed
function seeded(n) { let a = n >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function createTitleMusic({ context = null, sketch = 'a', seed = 1 } = {}) {
  const rnd = seeded(seed);
  const pick = (list, recent) => { const ok = list.map((_, i) => i).filter((i) => !recent.includes(i)); const i = ok[Math.floor(rnd() * ok.length)]; recent.push(i); if (recent.length > 2) recent.shift(); return i; };
  let ctx = context, n = null, noiseBuf = null, timer = null;
  const st = { playing: false, started: false, dived: false, next: 0, period: 0, recent: [], recent2: [], last: null, pending: [], volume: 0.7, duck: 1, log: [] };

  // ---------------------------------------------------------------- the room
  function build() {
    const g = (v) => { const x = ctx.createGain(); x.gain.value = v; return x; };
    n = { live: g(1), hand: g(0), tune: g(1), keys: g(1), low: g(DREAM.low), drums: g(0.8), dry: g(DREAM.room.dry), send: g(1), wet: g(DREAM.room.wet), master: g(0), fade: g(0) };
    // a long dark tail, from decaying noise (music.js build), drawn from the seeded run so every render is alike
    const R = DREAM.room, len = Math.floor(ctx.sampleRate * R.seconds), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { const t = i / ctx.sampleRate, k = 0.18 + 0.5 * Math.exp(-t * 2.2); lp += k * ((rnd() * 2 - 1) - lp); d[i] = lp * Math.exp(-t / R.decay) * (t < 0.02 ? t / 0.02 : 1); } }
    n.verb = ctx.createConvolver(); n.verb.buffer = ir;
    // the tune's echo: left and right at their own times, each repeat darker
    const E = DREAM.echo; n.echoIn = g(E.send); n.echoL = ctx.createDelay(2); n.echoR = ctx.createDelay(2); n.echoL.delayTime.value = E.left; n.echoR.delayTime.value = E.right;
    n.echoDark = ctx.createBiquadFilter(); n.echoDark.type = 'lowpass'; n.echoDark.frequency.value = E.hz; n.echoBack = g(E.feedback);
    const merge = ctx.createChannelMerger(2);
    n.echoIn.connect(n.echoDark); n.echoDark.connect(n.echoL); n.echoDark.connect(n.echoR); n.echoL.connect(merge, 0, 0); n.echoR.connect(merge, 0, 1);
    n.echoR.connect(n.echoBack); n.echoBack.connect(n.echoDark); merge.connect(n.dry); merge.connect(n.send);
    // the band's piano chorus and its drift from ear to ear, on the tune and the keys
    const C = DREAM.chorus; n.keysIn = g(1); n.chorus = ctx.createDelay(0.05); n.chorus.delayTime.value = C.delay; n.chorusMix = g(C.mix);
    const lfo = ctx.createOscillator(), lg = g(C.depth); lfo.frequency.value = C.rate; lfo.connect(lg); lg.connect(n.chorus.delayTime); lfo.start();
    n.pan = ctx.createStereoPanner(); const p = ctx.createOscillator(), pd = g(C.drift); p.frequency.value = C.driftRate; p.connect(pd); pd.connect(n.pan.pan); p.start();
    n.keysIn.connect(n.pan); n.keysIn.connect(n.chorus); n.chorus.connect(n.chorusMix); n.chorusMix.connect(n.pan);
    n.tune.connect(n.keysIn); n.keys.connect(n.keysIn); n.tune.connect(n.echoIn);
    // what plays: the page's own (live, let go at Dive) and the hand-over (hand); both through the room
    for (const [bus, amt] of [[n.pan, 0.75], [n.low, 0.35], [n.drums, 0.3]]) { bus.connect(n.live); const s = g(amt); bus.connect(s); s.connect(n.send); }
    n.live.connect(n.dry); n.hand.connect(n.dry); const hs = g(0.6); n.hand.connect(hs); hs.connect(n.send);
    n.send.connect(n.verb); n.verb.connect(n.wet);
    // the water: a lowpass over everything whose cutoff drifts slowly up and down
    const W = DREAM.water; n.water = ctx.createBiquadFilter(); n.water.type = 'lowpass'; n.water.frequency.value = W.hz; n.water.Q.value = W.q;
    const w = ctx.createOscillator(), wg = g(W.swing); w.frequency.value = W.rate; w.connect(wg); wg.connect(n.water.frequency); w.start();
    n.dry.connect(n.water); n.wet.connect(n.water);
    n.limit = ctx.createDynamicsCompressor(); n.limit.threshold.value = DREAM.limit; n.limit.knee.value = 0; n.limit.ratio.value = 20; n.limit.attack.value = 0.002; n.limit.release.value = 0.2;
    n.water.connect(n.fade); n.fade.connect(n.master); n.master.connect(n.limit); n.limit.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
    level();
  }
  function level(tc = 0.08) { if (n) n.master.gain.setTargetAtTime(st.volume * DREAM.level * st.duck, ctx.currentTime, tc); }

  // ---------------------------------------------------------------- the voices (music.js's recipes; `pedal` is new)
  // every source is noted with its start, so that at Dive whatever has not started yet can be stopped before it does
  const src = (o, t, stop) => { o.start(t); o.stop(stop); st.pending.push({ o, t }); return o; };
  const osc = (type, f, t, stop) => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); return src(o, t, stop); };
  const lowpass = (f, q = 0.8) => { const b = ctx.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = f; b.Q.value = q; return b; };
  const gain = (out) => { const g = ctx.createGain(); g.connect(out); return g; };
  function env(g, t, attack, peak, decay) { g.setValueAtTime(0.0001, t); g.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack); g.exponentialRampToValueAtTime(0.0001, t + attack + decay); }
  const note = (voice, t, m, dur, v) => st.log.push({ voice, t, m, dur, v });
  const V = {
    piano(t, m, dur, v, out = n.keys) { // the band's electric piano, its bell softened, its tail the band's at dream 0.6
      note('piano', t, m, dur, v); const f = mtof(m), car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = gain(out), tail = dur + 0.5 + 1.4 * 0.6 + 0.6;
      car.frequency.value = f; mod.frequency.value = f; mg.gain.setValueAtTime(f * (0.5 + 1.0 * v), t); mg.gain.exponentialRampToValueAtTime(f * 0.12, t + 0.4);
      mod.connect(mg); mg.connect(car.frequency); car.connect(g);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.26 * v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.11 * v, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + tail);
      src(car, t, t + tail + 0.05); src(mod, t, t + tail + 0.05);
    },
    celesta(t, m, dur, v, out = n.tune) { // the Lamplighter's: small bells, a long time dying
      note('celesta', t, m, dur, v); const g = gain(out); env(g.gain, t, DREAM.a.tune.attack, 0.3 * v, dur);
      for (const [k, level, cents] of [[1, 0.6, 0], [1, 0.3, 9], [3, 0.08, 0], [5.4, 0.025, 0]]) { const og = ctx.createGain(); og.gain.value = level; const o = osc('sine', mtof(m) * k, t, t + dur + 0.2); o.detune.value = cents; o.connect(og); og.connect(g); }
    },
    vibes(t, m, dur, v, out = n.tune) { // the angler's vibraphone, struck softer, its motor turning slowly
      note('vibes', t, m, dur, v); const g = ctx.createGain(), trem = gain(out), lfo = osc('sine', 3.3, t, t + dur + 0.3), lg = ctx.createGain();
      for (const [k, level] of [[1, 0.5], [4, 0.1], [10, 0.015]]) { const og = ctx.createGain(); og.gain.value = level; osc('sine', mtof(m) * k, t, t + dur + 0.3).connect(og); og.connect(g); }
      env(g.gain, t, 0.012, 0.5 * v, dur); lg.gain.value = 0.22; trem.gain.value = 0.78; lfo.connect(lg); lg.connect(trem.gain); g.connect(trem);
    },
    cello(t, m, dur, v, out = n.tune) { // the Warden's: bowed, leaning into the note
      note('cello', t, m, dur, v); const f = lowpass(480 + 420 * v, 1.1), g = gain(out);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2 * v, t + 0.35); g.gain.setValueAtTime(0.2 * v, t + Math.max(dur, 0.36)); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, 0.36) + 0.5);
      const vib = osc('sine', 4.8, t, t + dur + 0.6), vg = ctx.createGain(); vg.gain.value = mtof(m) * 0.004; vib.connect(vg);
      for (const cents of [-5, 5]) { const o = osc('sawtooth', mtof(m), t, t + dur + 0.6); o.detune.value = cents; vg.connect(o.frequency); o.connect(f); }
      f.connect(g);
    },
    bass(t, m, dur, v, out = n.low) { // the band's upright, played softer (its filter opens less)
      note('bass', t, m, dur, v); const f = mtof(m), filt = ctx.createBiquadFilter(), g = gain(out);
      filt.type = 'lowpass'; filt.Q.value = 1; filt.frequency.setValueAtTime(420 + 700 * v, t); filt.frequency.exponentialRampToValueAtTime(320 + 160 * v, t + 0.3);
      for (const [type, lv] of [['triangle', 0.55], ['sawtooth', 0.12], ['sine', 0.4]]) { const o = osc(type, f * 0.985, t, t + dur + 0.3), og = ctx.createGain(); o.frequency.exponentialRampToValueAtTime(f, t + 0.04); og.gain.value = lv; o.connect(og); og.connect(filt); }
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3 * v, t + 0.03); g.gain.exponentialRampToValueAtTime(0.13 * v, t + 0.25);
      g.gain.setValueAtTime(0.13 * v, t + Math.max(dur - 0.02, 0.26)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25); filt.connect(g);
    },
    pad(t, midis, dur, v, out = n.low) { // the band's pad: two triangles a few cents apart under a lowpass, coming and going slowly
      for (const m of midis) {
        note('pad', t, m, dur, v); const g = gain(out), f = lowpass(1100);
        g.gain.setValueAtTime(0, t); g.gain.setTargetAtTime(0.05 * v, t, 0.8); g.gain.setTargetAtTime(0, t + dur, 0.9);
        for (const cents of [-7, 7]) { const o = osc('triangle', mtof(m), t, t + dur + 5); o.detune.value = cents; o.connect(f); }
        f.connect(g);
      }
    },
    pedal(t, m, dur, v, out = n.low) { // new: a low held note, a sine and its octave and a little triangle, swelling in and out
      note('pedal', t, m, dur, v); const g = gain(out), f = lowpass(380, 0.6), up = Math.min(1.6, dur * 0.3);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * v, t + up); g.gain.setValueAtTime(0.16 * v, t + Math.max(dur - 1.2, up + 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.2);
      for (const [type, k, lv] of [['sine', 1, 0.7], ['sine', 2, 0.25], ['triangle', 1, 0.2]]) { const o = osc(type, mtof(m) * k, t, t + dur + 1.3), og = ctx.createGain(); og.gain.value = lv; o.connect(og); og.connect(f); }
      f.connect(g);
    },
    brush(t, v, out = n.drums) { // the band's brush: noise through a band, swept in
      note('brush', t, null, 0.27, v); const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = 2400; b.Q.value = 0.6; const g = gain(out);
      env(g.gain, t, 0.06, 0.26 * v, 0.24); s.connect(b); b.connect(g); s.start(t, rnd() * 1.5); s.stop(t + 0.4); st.pending.push({ o: s, t });
    },
    ride(t, v) { // the band's ride, as the band plays it in empty water, felt more than heard
      note('ride', t, null, 0.4, v); const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const h = ctx.createBiquadFilter(); h.type = 'bandpass'; h.frequency.value = 5200; h.Q.value = 0.5; const g = gain(n.drums);
      env(g.gain, t, 0.004, 0.3 * v, 0.45); s.connect(h); h.connect(g); s.start(t, rnd() * 1.5); s.stop(t + 0.5); st.pending.push({ o: s, t });
    },
  };
  // a chord let fall from the bottom, a few hundredths apart
  const roll = (voice, t, midis, dur, v, gap = 0.045, out) => midis.forEach((m, i) => V[voice](t + i * gap, m, dur - i * gap, v * (1 - 0.06 * i), out));

  // ---------------------------------------------------------------- the sketches: each plays one period from `t` and says how long it was
  const SK = {
    a(t) { // Lullaby
      const A = DREAM.a, k = st.period, breath = k % A.breath === A.breath - 1;
      const others = Object.keys(A_PERIODS).filter((x) => x !== st.last && x !== 'home'), name = k % 3 === 0 ? 'home' : others[Math.floor(rnd() * others.length)]; // home every third period, else another, never the same twice
      st.last = name; const P = A_PERIODS[name];
      const len = [0, 1, 2, 3].map((i) => 6 * A.eighth * (1 + A.rubato * (rnd() * 2 - 1)) * (i === 3 ? A.ritard : 1));
      const at = [t]; for (const L of len) at.push(at[at.length - 1] + L);
      const when = (bar, e) => at[bar] + (e / 6) * len[bar]; // e: eighths into the bar
      const lowest = [53, 55, 57][Math.floor(rnd() * 3)];
      // the held note (or one a bar when it moves), and the pad's chord each bar
      if (P.bass.length === 1) V.pedal(t, P.bass[0], at[4] - t + 0.4, A.pedal);
      else P.bass.forEach((m, i) => V.pedal(at[i], m, len[i] + 0.3, A.pedal));
      P.chords.forEach((c, i) => V.pad(at[i], voicing(CH[c], lowest).slice(0, 3), len[i] + 0.3, A.pad));
      roll('celesta', t, voicing(CH[P.chords[0]], 60), 3.5, A.roll, 0.12); // a broken chord to start the period, low in the music box
      if (breath) { // the tune rests: three bells from the top of the chords fall slowly
        for (let i = 0; i < 4; i++) if (rnd() < 0.8) { const vo = voicing(CH[P.chords[i]], 79); V.celesta(when(i, 1 + Math.floor(rnd() * 3)), vo[Math.floor(rnd() * vo.length)], 3.2, A.tune.v * 0.55); }
      } else {
        const T = TUNES.a, ask = T.ask[pick(T.ask, st.recent)], answer = T.answer[pick(T.answer, st.recent2)];
        const up = k % 5 === 2 ? -12 : 0, third = rnd() < A.tune.third;
        [[ask, 0], [answer, 2]].forEach(([phrase, from]) => {
          for (const [e, d, l] of phrase) {
            const bar = from + Math.floor(e / 6), tt = when(bar, e % 6) + (e === 0 ? 0.04 : 0), ch = CH[P.chords[bar]], dur = Math.max(1.2, (l / 6) * len[bar] * 1.6);
            const m = fit(ch, stepOf(A.tune.base + up, LYDIAN, d));
            if (l >= 3 && rnd() < A.tune.grace) V.celesta(tt - 0.07, fit(ch, stepOf(A.tune.base + up, LYDIAN, d + 1)), 0.4, A.tune.v * 0.4); // a grace note from above
            V.celesta(tt, m, dur, A.tune.v * (e === 0 ? A.tune.first : 0.85));
            if (third) V.celesta(tt + 0.015, fit(ch, stepOf(A.tune.base + up, LYDIAN, d - 2)), dur, A.tune.v * 0.45);
          }
        });
      }
      return at[4] - t;
    },
    b(t) { // Slow waltz under water
      const B = DREAM.b, k = st.period, prog = B_PERIODS[k % 4 === 3 ? 1 : k % 2 === 0 ? 0 : Math.floor(rnd() * 2)];
      const cello = k > 0 && rnd() < B.tune.cello, sixth = rnd() < B.tune.sixth;
      const len = prog.map((_, i) => 3 * B.beat * (i % 2 ? 1 + B.stretch * (i === 7 ? 2 : 1) : 1)), at = [t]; for (const L of len) at.push(at[at.length - 1] + L);
      const when = (bar, b) => { const whole = Math.floor(b); return at[bar] + (b / 3) * len[bar] + (B.lilt[whole] || 0) * B.beat * (b === whole ? 1 : 0); };
      prog.forEach((c, i) => {
        const ch = CH[c], vo = voicing(ch, 55);
        V.bass(when(i, 0), bassOf(ch, 40), B.beat * 2.6, B.bass); // one
        if (i % 4 === 3) V.bass(when(i, 2), bassOf(ch, 40) + 7, B.beat * 0.9, B.bass * 0.8); // and a fifth on three before the phrase turns
        if (rnd() < 0.25) roll('piano', when(i, 0), vo, B.beat * 2.6, B.comp, 0.06); // now and then the chord on one, rolled
        else for (const b of [1, 2]) vo.forEach((m) => V.piano(when(i, b), m, B.beat * 0.7, B.comp * (b === 1 ? 1 : 0.8))); // pah, pah
        V.pad(at[i], voicing(ch, 50).slice(0, 3), len[i] + 0.2, B.pad);
        V.brush(when(i, 0), B.brush);
      });
      for (let p = 0; p < 4; p++) { // four phrases of two bars
        const phrase = TUNES.b[pick(TUNES.b, st.recent)];
        for (const [b, d, l] of phrase) {
          const bar = p * 2 + Math.floor(b / 3), ch = CH[prog[bar]], tt = when(bar, b % 3), dur = l * B.beat * 1.15;
          const m = fit(ch, stepOf(B.tune.base, LYDIAN, d));
          if (cello && p >= 2) V.cello(tt, m - 12, dur, B.tune.v * 1.1); else V.vibes(tt, m, dur + 0.6, B.tune.v);
          if (sixth && l >= 2) V.vibes(tt + 0.02, fit(ch, stepOf(B.tune.base, LYDIAN, d - 5)), dur, B.tune.v * 0.45); // and a sixth under it
        }
      }
      return at[8] - t;
    },
    c(t) { // The band asleep: the band's own vamp, at half its tempo
      const C = DREAM.c, beat = 60 / C.bpm, late = lerp(0.5, 0.74, C.swing), k = st.period;
      const tick = (bar, g) => t + bar * 4 * beat + Math.floor(g / 3) * beat + [0, 1 / 3, late][g % 3] * beat;
      const vamp = MOODS[BAND_MOOD].bars.map(([off, q]) => ({ ...CH[BANDQ[q]], root: (BAND_KEY + off) % 12 }));
      const bells = rnd() < C.tune.bells;
      for (let bar = 0; bar < 8; bar++) {
        const ch = vamp[Math.floor(bar / 2)], next = vamp[Math.floor((bar + 1) / 2) % 4], root = bassOf(ch, 40), human = () => (rnd() - 0.5) * 0.012;
        // the drummer, as the band's in empty water: a brush on every beat, the ride on one and three, both quieter
        for (let b = 0; b < 4; b++) V.brush(tick(bar, b * 3) + human(), C.brush * (0.6 + 0.4 * (b % 2)));
        V.ride(tick(bar, 0) + human(), C.ride); V.ride(tick(bar, 6) + human(), C.ride * 0.7);
        // the bass in two (the band's when it is calm: the root, then its fifth), and now and then walking up into the next chord
        V.bass(tick(bar, 0), root, beat * 1.9, C.bass);
        if (bar % 2 === 1 && rnd() < C.walk) { const to = bassOf(next, 40); [-5, -3, -1].forEach((s, i) => V.bass(tick(bar, [6, 8, 9][i]), to + s, beat * 0.9, C.bass * 0.85)); } // up into the next root, the last a half step under it (as the band's own lead-ins)
        else V.bass(tick(bar, 6), root + 7 > 52 ? root - 5 : root + 7, beat * 1.7, C.bass);
        // the piano: the band's voicing, laid long, once or twice a bar
        if (bar % 2 === 0 || rnd() < 0.5) roll('piano', tick(bar, 0) + human(), voicing(ch), beat * 2.5, C.comp, 0.018);
        if (rnd() < 0.3) roll('piano', tick(bar, 5), voicing(ch), beat * 1.2, C.comp * 0.7, 0.018);
        if (bar % 2 === 0) V.pad(tick(bar, 0), voicing(ch, 50).slice(0, 3).concat(bassOf(ch, 43) + 12), beat * 8 + 0.3, C.pad);
      }
      for (let p = 0; p < 4; p++) { // a phrase over each chord's two bars; the last period of four rests
        if (k % 4 === 3 && p % 2 === 1) continue;
        const phrase = TUNES.c[pick(TUNES.c, st.recent)];
        for (const [g, d, l] of phrase) {
          const m = stepOf(C.tune.base, DORIAN, d), tt = tick(p * 2, g);
          V.vibes(tt, m, l * beat * 1.2 + 0.4, C.tune.v);
          if (bells) V.celesta(tt + 0.01, m + 12, l * beat + 0.8, C.tune.v * 0.4);
        }
      }
      return 8 * 4 * beat;
    },
  };

  // ---------------------------------------------------------------- the clock: a period is played when its start comes within reach
  function schedule(until) {
    while (st.started && !st.dived && st.next < until) { const L = SK[sketch](st.next); st.next += L; st.period++; }
    if (st.pending.length > 400) { const t = ctx.currentTime; st.pending = st.pending.filter((x) => x.t > t); }
  }
  function begin(at) {
    if (st.started || !ctx) return;
    build(); st.started = true; st.next = at + 0.05;
    n.fade.gain.setValueAtTime(0.0001, at); n.fade.gain.exponentialRampToValueAtTime(1, at + DREAM.fadeIn);
  }

  // ---------------------------------------------------------------- Dive: the page lands on the band's chord and hands it the tempo
  // `at`: when Dive was pressed. `grid`: where the band's beats fall on this same clock (music.js grid(): a beat's time, its number,
  // bar * 4 + beat, its length, its swung eighth); `chordOf(bar)`: the band's chord in a bar. The run lands on the first downbeat of the
  // band's at least DREAM.dive.land after the press (a fresh band: its second bar), and the held chord is the chord of the bar before.
  // With no grid (the tools' renders), the band's own numbers: its first beat DREAM.band.first after the press, at the length its
  // sliders give it.
  // `beatAt(index)`, if given, is the band's own beat once it has scheduled it ({ at, dur, late }, or null before): the run's notes then wait
  // for the beat they fall in and are put exactly where the band put it (its tempo can move a little once the dive is let go and the
  // game tells it how things are, so a guess made at the press could drift by some milliseconds over the bar).
  function dive({ at = ctx.currentTime, grid = null, chordOf = null, beatAt = null, energy = 0.5, swing = 0.6 } = {}) {
    if (!st.started || st.dived) return null;
    st.dived = true;
    const D = DREAM.dive, Bd = DREAM.band;
    grid ??= { at: at + Bd.first, index: 0, dur: 60 / (lerp(108, 172, energy) * (1 + 0.1 * Bd.intensity)), late: lerp(0.5, 0.74, swing) };
    const beat = grid.dur, late = grid.late, barAt = (k) => grid.at + (4 * k - grid.index) * beat;
    let k = Math.ceil(grid.index / 4); while (barAt(k) < at + D.land) k++; // the bar the run lands on
    const first = barAt(k - 1), tick = (g) => first + Math.floor(g / 3) * beat + [0, 1 / 3, late][g % 3] * beat; // the band's ticks in the bar before it, 12 to a bar
    const ch = chordOf ? chordOf(k - 1) : CH.Dm9;
    // what had not started yet never will; what is sounding lets go into the room
    for (const x of st.pending) if (x.t > at + 0.005) { try { x.o.stop(at); } catch { /* already stopped */ } }
    st.pending = [];
    n.live.gain.setTargetAtTime(0, at, D.stop);
    n.hand.gain.setValueAtTime(0, at); n.hand.gain.setTargetAtTime(1, at, D.swell);
    // the band's chord, held as its pad and its piano voice it, with its root under it (the first band's first: Dm9 over D)
    const later = []; // what is played on the band's beats: { g: tick in the bar before the landing (12: the landing), play(t) }
    const root = bassOf(ch, 40), pad = voicing(ch, 50).slice(0, 3).concat(bassOf(ch, 43) + 12), keys = voicing(ch), S = DREAM[sketch], hold = D.off;
    V.pad(at, pad, hold, 1, n.hand);
    if (sketch === 'a') V.pedal(at, root, hold - 1.2, DREAM.a.pedal * 1.2, n.hand);
    if (sketch === 'b') { roll('vibes', at + 0.02, keys, 3.5, 0.4, 0.07, n.hand); V.cello(at + 0.05, root + 12, 3, 0.55, n.hand); }
    if (sketch === 'c') { roll('piano', at + 0.02, keys, 3, 0.4, 0.018, n.hand); V.bass(at + 0.02, root, 2.5, 0.5, n.hand); for (let b = 1; b < 4; b++) if (tick(b * 3) > at + 0.05) later.push({ g: b * 3, play: (t) => V.brush(t, 0.35 + 0.1 * b, n.hand) }); } // the brushes pick up the band's beat
    // a run up the scale in the band's tempo, into the downbeat. The lullaby's lands on the chord's ninth (Dm9: E), a step at a time up
    // the white notes; the waltz's and the sleeper's are written for Dm9 (they are for listening to, not shipped)
    const R = S.run, voice = R.voice;
    let notes = R.notes;
    if (sketch === 'a') { let m = 48 + ch.root + ch.voice[3]; while (m < 72) m += 12; while (m >= 84) m -= 12; notes = [m]; while (notes.length < R.notes.length) { let x = notes[0] - 1; while (!LYDIAN.includes((((x - 5) % 12) + 12) % 12)) x--; notes.unshift(fit(ch, x)); } }
    R.ticks.forEach((g, i) => {
      if (tick(g) < at + 0.05) return; // (a grid that leaves too little room: the run starts later)
      const lastOne = i === R.ticks.length - 1, m = R.land && lastOne ? R.land : notes[Math.min(i, notes.length - 1)];
      later.push({ g, play: (t, b) => { V[voice](t, m, lastOne ? 2.8 : b * 0.6, R.v * (0.75 + 0.25 * (i / (R.ticks.length - 1))), n.hand); if (lastOne) st.handover.land = t; } });
    });
    // each on its beat: the band's own, once it has scheduled it; or, with nothing to ask, where the grid says
    const base = (k - 1) * 4;
    st.later = later.map((x) => ({ ...x, index: base + Math.floor(x.g / 3), part: x.g % 3 }));
    st.beatAt = beatAt;
    if (n.fade.gain.cancelAndHoldAtTime) n.fade.gain.cancelAndHoldAtTime(at); n.fade.gain.setTargetAtTime(0, at + D.fadeAt, D.fadeTc); // held where it is (a fade-in cut short stays where it got to), then let go
    st.handover = { at, first, beat, late, land: beatAt ? null : tick(12), guess: tick(12), bar: k, chord: ch, notes: [root, ...pad, ...keys] };
    if (beatAt) hand(); else { for (const x of st.later) x.play(tick(x.g), beat); st.later = []; }
    return st.handover;
  }

  // the hand-over's notes whose beat the band has now scheduled
  function hand() {
    if (!st.later?.length || !st.beatAt) return;
    st.later = st.later.filter((x) => { const b = st.beatAt(x.index); if (!b) return true; x.play(b.at + [0, 1 / 3, b.late][x.part] * b.dur, b.dur); return false; });
  }
  // after a dive: the page's graph is let go (the context is the band's, and goes on)
  function done() { if (timer) { clearInterval(timer); timer = null; } st.playing = false; try { n?.master.disconnect(); } catch { /* gone */ } }
  const api = {
    DREAM, state: st, sketch,
    get playing() { return st.playing; },
    get handover() { return st.handover || null; },
    // at the first touch, on `context` if one is given (title.js gives the band's): start and fade in
    start() {
      try { if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false; ctx = new AC(); } if (ctx.state === 'suspended') ctx.resume().catch(() => {}); } catch { return false; }
      if (st.started) return true;
      begin(ctx.currentTime + 0.05); schedule(ctx.currentTime + 1); st.playing = true;
      timer = setInterval(() => { schedule(ctx.currentTime + 1); hand(); if (st.dived && ctx.currentTime > st.handover.at + DREAM.dive.off) done(); }, 25); // often enough to catch each of the band's beats ahead of it (it schedules 0.16 s ahead)
      return true;
    },
    dive(o) { const h = dive(o); if (h) st.playing = false; return h; },
    stop() { if (!n) return done(); const t = ctx.currentTime; n.fade.gain.cancelScheduledValues(t); n.fade.gain.setTargetAtTime(0, t, 0.05); st.dived = true; setTimeout(done, 400); st.playing = false; },
    setVolume(v, muted = false, duck = st.duck) { st.volume = muted ? 0 : v; st.duck = clamp(duck, 0, 1); level(); },
    duck(k) { st.duck = clamp(k, 0, 1); level(0.18); },
    get gain() { return n ? n.master.gain.value : 0; },
    // for the tools: `seconds` on an OfflineAudioContext, Dive pressed at `diveAt` (or never)
    async render(seconds, { diveAt = null, ...o } = {}) {
      begin(0);
      for (let t = 0; t < seconds; t += 0.1) { schedule(t + 1); if (diveAt !== null && !st.dived && t + 0.1 > diveAt) { dive({ at: diveAt, ...o }); } }
      return ctx.startRendering();
    },
  };
  return api;
}
