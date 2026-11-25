// The Keeper's strike and the far-carrying tuba, for ears that are not here (music.js: BACK, PICKUP, ENTRY, comeBack, strike; FAR, ear).
// Renders the game's own sound with no sound card (an OfflineAudioContext in headless Chrome), as tools/hear_turn.mjs does.
//   node tools/hear_strike.mjs [--ref <commit>] [--out <dir>] [--table <file.md>] [--wav <dir>]
// What it does:
//   1. The band with the Keeper sitting in, a fight going on round it: its great claw winds up (game.event('windup') -> music.flourish)
//      and comes down 0.95 s later (game.event('slam') -> music.strike, and the drums' 'burst' the game already plays), the blow placed
//      at four places in a bar: on beat 1, just after beat 2, on the swung off-beat of 3, late in beat 4. Once with music.js as it is at
//      --ref ("today") and once as it is now ("after"), from the same seeded start. Every note the tuba and the drums are asked for, from
//      a bar before the blow's bar to two bars after it, goes into the table; and the samples are compared, to find where the two first part.
//      The far-carrying switch is off in these, so that they differ by the strike alone (the Keeper is a few metres ahead: it would be
//      in the middle anyway).
//   2. keeper-strike-{early,late}-{today,after}.wav: ten seconds round the blow on beat 1 (early) and late in beat 4 (late).
//   3. keeper-approach.wav: twenty seconds of the fish swimming a curve from 120 m away to beside the Keeper, far-carrying on, in stereo,
//      with the level of each side second by second; and the table of how loud and how far to one side the tuba is at 150, 100, 60, 30, 10 m.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
const ROOT = path.resolve(import.meta.dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SUFFIX = arg('--suffix', null), REF = arg('--ref', 'HEAD'), OUT = path.resolve(arg('--out', path.join(ROOT, 'out/sound'))), WAV = path.resolve(arg('--wav', OUT)), TABLE = arg('--table', path.join(OUT, 'keeper-strike.md'));
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(WAV, { recursive: true });
// the old file, with only what lets it be read: its drums written down as the new one writes them, and a render step finer than 0.05 s
let old = execFileSync('git', ['show', `${REF}:game/music.js`], { cwd: ROOT, encoding: 'utf8' });
if (!old.includes("'drum:'")) old = old.replace('  function bassNote(', "  for (const k of Object.keys(kit)) { const f = kit[k]; kit[k] = (t, ...r) => { if (st.log) st.log.push({ voice: 'drum:' + k, at: st.where, t, v: r[0] }); return f(t, ...r); }; }\n  function bassNote(");
if (!old.includes('render(seconds, script, step')) old = old.replace('async render(seconds, script) {', 'async render(seconds, script, step = 0.05) {').replace('for (let t = 0; t < seconds; t += 0.05) {', 'for (let t = 0; t < seconds; t += step) {').replace('api.update(0.05, {', 'api.update(step, {');
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<!doctype html><title>hear</title>'); }
  if (u === '/__old/music.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(old); }
  const p = path.join(ROOT, u);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': 'text/javascript' }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
await page.goto(`http://localhost:${server.address().port}/`);

const result = await page.evaluate(async ({ SUFFIX }) => {
  const seed = (n) => { let a = n >>> 0; Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const NEW = await import('/game/music.js'), OLD = await import('/__old/music.js'), SR = 44100, STEP = 0.005;
  const pack = (buf, from, to) => { const out = []; const a = Math.max(0, Math.round(from * SR)), b = Math.min(buf.length, Math.round(to * SR)); for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c).subarray(a, b), i16 = new Int16Array(d.length); for (let i = 0; i < d.length; i++) i16[i] = Math.max(-32768, Math.min(32767, Math.round(d[i] * 32767))); let s = ''; const u8 = new Uint8Array(i16.buffer); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); out.push(btoa(s)); } return out; };
  const rms = (buf, c, from, to) => { const d = buf.getChannelData(c), a = Math.max(0, Math.round(from * SR)), b = Math.min(d.length, Math.round(to * SR)); let e = 0; for (let i = a; i < b; i++) e += d[i] * d[i]; return Math.sqrt(e / Math.max(1, b - a)); };
  // ---- 1. the strike, at four places in a bar
  const PLACES = { on1: 0, after2: 1.12, off3: null, late4: 3.8 }; // in beats from the bar line; off3: the swung off-beat of beat 3, from the swing
  const fight = { cast: { keeper: 1 }, speed: 0.35, danger: 0.6, activity: 0.6 };
  async function strike(M, place, isNew) {
    seed(11); const secs = 19, ctx = new OfflineAudioContext(2, secs * SR, SR), m = M.createMusic({ context: ctx });
    if (isNew) m.set('farcarry', 0);
    m.state.log = []; const beats = new Map(); let plan = null, wound = null, struck = null;
    const buf = await m.render(secs - 1, (t) => {
      for (const b of m.state.beats) beats.set(b.index, b);
      const s = { ...fight };
      if (!plan && t >= 9) { // a bar a couple of seconds ahead, and where in it the claw comes down
        const G = m.state.beats[m.state.beats.length - 1], late = 0.5 + 0.24 * m.params.swing;
        let k = Math.ceil((t + 2.2 - G.at) / G.dur) + G.index; k += (4 - (k % 4)) % 4;
        const bar0 = G.at + (k - G.index) * G.dur, pos = place === 'off3' ? 2 + late : PLACES[place], target = bar0 + pos * G.dur;
        const blow = Math.floor((target - 0.012 - (place === 'on1' ? 0.015 : 0)) / STEP) * STEP; // on beat 1: a hair before it, as a claw would
        plan = { bar: k / 4, bar0, target, blowAt: blow, windAt: blow - 0.95, beat: G.dur };
      }
      if (plan && !wound && t >= plan.windAt - 1e-9) wound = { t, took: m.flourish('keeper', 'fill') };
      if (plan && !struck && t >= plan.blowAt - 1e-9) { struck = { t, at: t + 0.012, took: m.strike ? m.strike('keeper') : null }; s.hits = [['burst']]; }
      return s;
    }, STEP);
    const at = (k) => beats.get(k)?.at, barOf = (time) => { let best = null; for (const [k, b] of beats) if (b.at <= time + 1e-6 && (!best || k > best)) best = k; return best; };
    const from = at((plan.bar - 1) * 4), to = at((plan.bar + 3) * 4) ?? plan.bar0 + 12 * plan.beat;
    const notes = m.state.log.filter((e) => e.t >= from - 1e-6 && e.t < to - 1e-6 && (e.voice === 'tuba' || e.voice.startsWith('drum:'))).map((e) => {
      const k = barOf(e.t), b = beats.get(k), into = (e.t - b.at) / b.dur;
      return { t: +(e.t - struck.at).toFixed(3), bar: Math.floor(k / 4) - plan.bar + 2, beat: (k % 4) + 1 + into, voice: e.voice, m: e.m ?? null, beats: e.dur ? +(e.dur / b.dur).toFixed(2) : null, v: +(+e.v).toFixed(2), tag: e.cut ? 'cut' : e.tag || (e.show ? 'show' : '') };
    });
    const phrase = m.state.log.filter((e) => e.show && e.voice === 'tuba').map((e) => ({ t: e.t, m: e.m, dur: e.dur, v: e.v })); // the fill, as scheduled
    return { buf, notes, phrase, plan: { ...plan, beat: +plan.beat.toFixed(4) }, wound, struck, back: isNew ? m.state.lastBack : null };
  }
  const out = { places: {}, wav: {} };
  for (const place of Object.keys(PLACES)) {
    const a = await strike(OLD, place, false), b = await strike(NEW, place, true), b2 = await strike(NEW, place, true), a2 = await strike(OLD, place, false);
    const first = (x, y) => { let most = 0; const n = Math.min(x.length, y.length); const noise = []; for (let c = 0; c < 2; c++) { const p = x.getChannelData(c), q = y.getChannelData(c); for (let i = 0; i < n; i++) most = Math.max(most, Math.abs(p[i] - q[i])); } return most; };
    const noise = Math.max(first(b.buf, b2.buf), first(a.buf, a2.buf)), tol = Math.max(noise * 10, 2e-3);
    let part = -1; { const p = a.buf.getChannelData(0), q = b.buf.getChannelData(0), p1 = a.buf.getChannelData(1), q1 = b.buf.getChannelData(1); for (let i = 0; i < p.length; i++) if (Math.abs(p[i] - q[i]) > tol || Math.abs(p1[i] - q1[i]) > tol) { part = i / SR; break; } }
    const landToday = a.notes.find((x) => x.tag === 'show' && x.beats > 1);
    const same = a.phrase.length === b.phrase.length && a.phrase.every((x, i) => ['t', 'm', 'dur', 'v'].every((k) => Math.abs(x[k] - b.phrase[i][k]) < 1e-9));
    out.places[place] = { same, phraseLen: a.phrase.length, today: a.notes, after: b.notes, plan: a.plan, wound: [a.wound, b.wound], struck: [a.struck, b.struck], back: b.back, noise, tol, part: part < 0 ? null : +(part - a.struck.at).toFixed(3), landToday: landToday ? landToday.t : null,
      rms: { today: rms(a.buf, 0, 0, 19), after: rms(b.buf, 0, 0, 19) }, stereo: { today: rms(a.buf, 0, 0, 19) > 0 && rms(a.buf, 1, 0, 19) > 0, after: rms(b.buf, 1, 0, 19) > 0 } };
    if (place === 'on1' || place === 'late4') { const name = place === 'on1' ? 'early' : 'late', c = a.struck.at; if (!SUFFIX) out.wav[`keeper-strike-${name}-today`] = { pcm: pack(a.buf, c - 5, c + 5), rmsL: rms(a.buf, 0, c - 5, c + 5), rmsR: rms(a.buf, 1, c - 5, c + 5), hitAt: 5 }; out.wav[`keeper-strike-${name}-${SUFFIX || 'after'}`] = { pcm: pack(b.buf, c - 5, c + 5), rmsL: rms(b.buf, 0, c - 5, c + 5), rmsR: rms(b.buf, 1, c - 5, c + 5), hitAt: 5, part: part < 0 ? null : part - (c - 5) }; }
  }
  if (!NEW.FAR || SUFFIX) return out; // (a music.js from before the far-carrying keeper, or only the strike asked for)
  // ---- 3. the approach: a weaving curve from 120 m to beside the Keeper, the camera looking the way the fish swims, so that the Keeper is
  // now on one side and now on the other; then the same with no keeper at all, from the same seeded start, so that the difference between
  // the two is the Keeper's tuba (and its reverb) alone, to measure which side it is on
  {
    const where = (s) => ({ x: 30 * Math.sin(2 * Math.PI * 1.25 * s) * Math.pow(1 - s, 0.8) + 3 * s, z: 117 * (1 - s) }); // the Keeper at the origin
    const at = (t) => { const s = Math.min(1, t / 20), p = where(s), q = where(Math.min(1, s + 0.002)), o = where(Math.max(0, s - 0.002)); let hx = q.x - o.x, hz = q.z - o.z; const hl = Math.hypot(hx, hz) || 1; hx /= hl; hz /= hl; const dx = -p.x, dz = -p.z, d = Math.hypot(dx, dz); return { d, far: { id: 'keeper', d, side: -dx * hz + dz * hx, ahead: dx * hx + dz * hz } }; };
    const secs = 22, track = [];
    const go = async (withKeeper) => { seed(5); const ctx = new OfflineAudioContext(2, secs * SR, SR), m = NEW.createMusic({ context: ctx }); return m.render(secs - 1, (t) => {
      const { d, far } = at(t);
      if (withKeeper) { const e = m.hearing(far); if (Math.abs(t * 2 - Math.round(t * 2)) < 0.005) track.push({ t: +t.toFixed(1), d: +d.toFixed(1), angle: Math.round(Math.atan2(far.side, far.ahead) * 180 / Math.PI), db: e ? +e.db.toFixed(1) : null, pan: e ? +e.pan.toFixed(2) : null, sitting: m.state.sitting.join() }); }
      return { cast: withKeeper ? { keeper: Math.max(0, 1 - d / 30) } : {}, far: withKeeper ? far : null, speed: 0.5, danger: d < 18 ? 0.4 : 0, activity: 0.6 * Math.max(0, 1 - d / 26) };
    }, 0.01); };
    const buf = await go(true), none = await go(false);
    const per = [], lone = [];
    for (let s = 0; s < 21; s++) { per.push({ t: s, L: +rms(buf, 0, s, s + 1).toFixed(4), R: +rms(buf, 1, s, s + 1).toFixed(4) }); let eL = 0, eR = 0; const a = s * SR, b = (s + 1) * SR, L = buf.getChannelData(0), R = buf.getChannelData(1), L0 = none.getChannelData(0), R0 = none.getChannelData(1); for (let i = a; i < b; i++) { eL += (L[i] - L0[i]) ** 2; eR += (R[i] - R0[i]) ** 2; } lone.push({ t: s, L: +Math.sqrt(eL / SR).toFixed(4), R: +Math.sqrt(eR / SR).toFixed(4), pan: track.find((x) => x.t === s + 0.5)?.pan ?? null, d: track.find((x) => x.t === s + 0.5)?.d ?? null }); }
    out.approach = { track, per, lone, pcm: pack(buf, 0, 21), rmsL: rms(buf, 0, 0, 21), rmsR: rms(buf, 1, 0, 21) };
  }
  // ---- the table of loudness and side
  { const m = NEW.createMusic({ context: new OfflineAudioContext(2, SR, SR) }), rows = [];
    for (const d of [150, 100, 60, 30, 10]) for (const [dir, side, ahead] of [['ahead', 0, 1], ['left', -1, 0], ['behind', 0, -1]]) { const e = m.hearing({ id: 'keeper', d, side: side * d, ahead: ahead * d }); const p = Math.max(0, 1 - d / 30), sits = p > 0.12, v = 0.45 + 0.55 * (sits ? p : m.FAR.p); rows.push({ d, dir, db: +e.db.toFixed(1), line: +(20 * Math.log10(v)).toFixed(1), total: +(e.db + 20 * Math.log10(v)).toFixed(1), pan: +e.pan.toFixed(2), hz: Math.round(e.hz), sits }); }
    const today = [150, 100, 60, 30, 10].map((d) => { const p = Math.max(0, 1 - d / 30); return { d, heard: p > 0.12, total: p > 0.12 ? +(20 * Math.log10(0.45 + 0.55 * p)).toFixed(1) : null }; });
    out.loud = { rows, today, FAR: m.FAR };
  }
  return out;
}, { SUFFIX });
await browser.close(); server.close();

const wav = ([l, r], file) => {
  const L = Buffer.from(l, 'base64'), R = Buffer.from(r, 'base64'), n = L.length / 2, data = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) { data.writeInt16LE(L.readInt16LE(i * 2), i * 4); data.writeInt16LE(R.readInt16LE(i * 2), i * 4 + 2); }
  const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(44100, 24); h.writeUInt32LE(44100 * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
};
const lines = [];
for (const [name, r] of Object.entries(result.wav)) {
  const file = path.join(WAV, `${name}.wav`); wav(r.pcm, file);
  lines.push(`${r.rmsL > 0.002 && r.rmsR > 0.002 ? 'PASS' : 'FAIL'}  ${path.basename(file)}: 10.0 s, stereo, rms L ${r.rmsL.toFixed(4)} R ${r.rmsR.toFixed(4)}, the blow at 5.00 s${r.part !== undefined ? `; parts from today at ${r.part === null ? 'nowhere' : r.part.toFixed(3) + ' s'}` : ''}`);
}
if (result.approach) { const file = path.join(WAV, 'keeper-approach.wav'), A = result.approach; wav(A.pcm, file);
  const side = A.lone.map((x) => (x.L + x.R > 1e-4 ? +((x.R - x.L) / (x.R + x.L)).toFixed(2) : null));
  const agree = A.lone.filter((x) => x.pan !== null && Math.abs(x.pan) > 0.3 && side[x.t] !== null).every((x) => Math.sign(side[x.t]) === Math.sign(x.pan));
  lines.push(`${A.rmsL > 0.002 && A.rmsR > 0.002 && Math.abs(A.rmsL - A.rmsR) > 1e-4 ? 'PASS' : 'FAIL'}  keeper-approach.wav: 21.0 s, stereo, rms L ${A.rmsL.toFixed(4)} R ${A.rmsR.toFixed(4)}`);
  lines.push(`${agree ? 'PASS' : 'FAIL'}  the Keeper's own sound in it (the render less the same with no keeper), right minus left over right plus left, second by second: ${side.join(' ')}; where it is placed: ${A.lone.map((x) => x.pan).join(' ')}; its level, dB, second by second: ${A.lone.map((x) => (x.L + x.R > 0 ? (20 * Math.log10(Math.hypot(x.L, x.R))).toFixed(0) : '-')).join(' ')}`); }
for (const [place, r] of Object.entries(result.places)) lines.push(`${r.same ? 'PASS' : 'FAIL'}  ${place}: the fill's phrase (${r.phraseLen} tuba notes, from the first quick note to the long note) is scheduled exactly as today: time, pitch, length, loudness`);
for (const [place, r] of Object.entries(result.places)) lines.push(`${r.part === null || r.part >= Math.min(0, r.landToday ?? 0) - 0.02 ? 'PASS' : 'FAIL'}  ${place}: today and after first part ${r.part === null ? 'nowhere' : `${r.part.toFixed(3)} s from the blow`} (today's fill lands its long note at ${r.landToday === null ? '-' : r.landToday.toFixed(3) + ' s'}); tolerance ${r.tol.toExponential(1)} (same code rendered twice differs by ${r.noise.toExponential(1)})`);
for (const l of lines) console.log(l);

// ---- the table
const names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'], nm = (m) => (m == null ? '' : Array.isArray(m) ? m.map(nm).join('+') : names[m % 12] + (Math.floor(m / 12) - 1));
const LABEL = { on1: 'on beat 1', after2: 'just after beat 2', off3: 'on the off-beat of 3', late4: 'late in beat 4' };
const pos = (x) => `${x.bar}:${x.beat.toFixed(2)}`;
const tubaRows = (list) => list.filter((x) => x.voice === 'tuba').map((x) => `| ${x.t.toFixed(3)} | ${pos(x)} | ${nm(x.m)} | ${x.beats} | ${x.v} | ${x.tag} |`).join('\n');
const drumRows = (list) => { const by = new Map(); for (const x of list.filter((y) => y.voice.startsWith('drum:'))) { const k = x.t.toFixed(3); if (!by.has(k)) by.set(k, { x, what: [] }); by.get(k).what.push(x.voice.slice(5) + (x.tag === 'cut' ? ' (taken back)' : '')); } return [...by.values()].map(({ x, what }) => `| ${x.t.toFixed(3)} | ${pos(x)} | ${what.join(', ')} |`).join('\n'); };
let md = `# The Keeper's strike, note by note\n\nWritten by tools/hear_strike.mjs (today: music.js at ${REF}; after: as it is now), from the notes music.js asks for (st.log), rendered offline from the same seeded start. The fight: the Keeper sitting in, danger 0.6, so the band plays at about ${Math.round(60 / result.places.on1.plan.beat)} beats a minute; its great claw winds up (a fill) and comes down 0.95 s later. Times are seconds from the blow (the claw on the bed); a place is bar:beat, bar 2 the blow's bar, beat 3.64 the swung off-beat of beat 3. Length in beats. \`show\` is a note of the keeper's fill; \`hit\` the strike; \`back\` the line coming back.\n\n`;
for (const [place, r] of Object.entries(result.places)) {
  md += `## The blow ${LABEL[place]} (at ${pos(r.today.find(() => true) ? { bar: 2, beat: 1 + (r.struck[0].at - r.plan.bar0) / r.plan.beat } : { bar: 2, beat: 1 })})\n\n`;
  md += `First difference between the two renders: ${r.part === null ? 'none' : `${r.part.toFixed(3)} s from the blow`}.\n\n`;
  for (const [k, list] of [['Today', r.today], ['After', r.after]]) md += `### ${k}: tuba\n\n| s | bar:beat | note | beats | loudness | |\n|---|---|---|---|---|---|\n${tubaRows(list)}\n\n### ${k}: drums\n\n| s | bar:beat | what |\n|---|---|---|\n${drumRows(list)}\n\n`;
}
if (result.loud) md += `## How loud and to which side (FAR)\n\nThe tuba's level in dB against the line right beside it (loudness 1); \`far\` is what the distance and direction take off, \`line\` the line's own loudness (the nearer, the louder, as today), \`pan\` -1 all left to 1 all right, \`dark\` the lowpass it goes through. Today it is heard only inside about 26 m.\n\n| m | where | far, dB | line, dB | total, dB | pan | dark, Hz | today, dB |\n|---|---|---|---|---|---|---|---|\n`;
if (result.loud) for (const x of result.loud.rows) { const t = result.loud.today.find((y) => y.d === x.d); md += `| ${x.d} | ${x.dir} | ${x.db} | ${x.line} | ${x.total} | ${x.pan} | ${x.hz} | ${t.heard ? t.total : 'not heard'} |\n`; }
if (result.approach) md += `\n## The approach (keeper-approach.wav)\n\nEvery second: how far, where (degrees from straight ahead, + to the right), what FAR takes off, where it is placed, whether it sits in, and the Keeper's own sound in the file (the render less the same render with no keeper) on each side.\n\n| s | m | bearing, deg | far, dB | pan | sitting in | its sound L | R |\n|---|---|---|---|---|---|---|---|\n${result.approach.track.filter((x) => Number.isInteger(x.t)).map((x) => { const l = result.approach.lone.find((y) => y.t === x.t) || {}; return `| ${x.t} | ${x.d} | ${x.angle} | ${x.db} | ${x.pan} | ${x.sitting} | ${l.L ?? ''} | ${l.R ?? ''} |`; }).join('\n')}\n`;
fs.writeFileSync(TABLE, md);
fs.writeFileSync(path.join(OUT, 'keeper-strike.json'), JSON.stringify({ places: Object.fromEntries(Object.entries(result.places).map(([k, v]) => [k, { ...v, today: undefined, after: undefined }])), loud: result.loud, approach: result.approach && { track: result.approach.track, per: result.approach.per, lone: result.approach.lone } }, null, 1));
console.log(`table: ${TABLE}`);
