// The turnaround (TURN in music.js) for ears that are not here: renders a line on its own, and with the band, to WAV files with no
// sound card (the music's own synthesis on an OfflineAudioContext in headless Chrome), writes the line's notes as a table, and checks
// that with the turnaround off the band asks Web Audio for exactly what the commit `--ref` asks for (Math.random seeded alike in both).
//   node tools/hear_turn.mjs [--ref <commit>] [--id keeper] [--bars 8] [--out <dir>] [--table <file.md>]
// Files: <id>-line-today.wav (off), -passing (one passing note), -walkup (as shipped), -run (a run of four), -low and -high (the walk-up's
// height at each end); and <id>-band-today, -passing, -walkup, the same with the band.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
const ROOT = path.resolve(import.meta.dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const REF = arg('--ref', 'HEAD'), ID = arg('--id', 'keeper'), BARS = +arg('--bars', 8), OUT = path.resolve(arg('--out', path.join(ROOT, 'out/sound'))), TABLE = arg('--table', path.join(OUT, `${ID}-line.md`));
fs.mkdirSync(OUT, { recursive: true });
const old = execFileSync('git', ['show', `${REF}:game/music.js`], { cwd: ROOT, encoding: 'utf8' });
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
await page.goto(`http://localhost:${server.address().port}/`);

const result = await page.evaluate(async ({ ID, BARS }) => {
  const seed = (n) => { let a = n >>> 0; Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const NEW = await import('/game/music.js'), OLD = await import('/__old/music.js'), SR = 44100;
  const pack = (buf) => { const out = []; for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c), i16 = new Int16Array(d.length); for (let i = 0; i < d.length; i++) i16[i] = Math.max(-32768, Math.min(32767, Math.round(d[i] * 32767))); let s = ''; const u8 = new Uint8Array(i16.buffer); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); out.push(btoa(s)); } return out; };
  const stats = (buf) => { const d = buf.getChannelData(0); let e = 0, pk = 0; for (const x of d) { e += x * x; pk = Math.max(pk, Math.abs(x)); } return { rms: Math.sqrt(e / d.length), peak: pk, seconds: d.length / SR }; };
  const SETS = { today: { turn: 0 }, passing: { turnsize: 0 }, walkup: {} }, MORE = { ...SETS, run: { turnsize: 1 }, low: { turnheight: 0 }, high: { turnheight: 1 } };
  // the line alone: BARS bars at 120 beats a minute, and two seconds to ring out
  const alone = {}, notes = {};
  for (const [name, set] of Object.entries(MORE)) {
    seed(7); const secs = BARS * 2 + 2.2, ctx = new OfflineAudioContext(2, Math.round(secs * SR), SR), m = NEW.createMusic({ context: ctx });
    for (const [k, v] of Object.entries(set)) m.set(k, v);
    m.state.log = []; m.line(ID, BARS + 1, { bpm: 120, at: 0.1 }); // the bar after, to hear where it lands
    notes[name] = m.state.log.filter((e) => e.at[0] < BARS || e.at[1] === 0).map((e) => ({ bar: e.at[0] + 1, tick: e.at[1], m: e.m, beats: e.dur / 0.5, v: e.v }));
    const buf = await ctx.startRendering(); alone[name] = { pcm: pack(buf), ...stats(buf) };
  }
  // the whole band with this creature near, from a seeded start, so the three differ only by the turnaround
  const band = {}, script = () => ({ cast: { [ID]: 1 }, speed: 0.3, danger: 0.4 });
  const play = async (M, set) => { seed(11); const secs = 20, ctx = new OfflineAudioContext(2, secs * SR, SR), m = M.createMusic({ context: ctx }); for (const [k, v] of Object.entries(set)) m.set(k, v); const buf = await m.render(secs - 1, script); return buf; };
  for (const [name, set] of Object.entries(SETS)) { const buf = await play(NEW, set); band[name] = { pcm: pack(buf), ...stats(buf) }; }
  // off, against the commit before: every call into Web Audio that schedules a sound (a start, a stop, a value set or ramped at a time),
  // in order with its arguments, must be the same; and the samples, which Chrome's renderer does not give back bit for bit from one
  // render to the next (two renders of the same code are compared for that)
  let trace = null; const T = (o, k) => { const f = o[k]; o[k] = function (...a) { if (trace) trace.push(k + a.map((x) => +(+x).toFixed(9)).join(',')); return f.apply(this, a); }; };
  for (const k of ['setValueAtTime', 'exponentialRampToValueAtTime', 'linearRampToValueAtTime', 'setTargetAtTime']) T(AudioParam.prototype, k);
  for (const k of ['start', 'stop']) T(AudioScheduledSourceNode.prototype, k);
  for (const k of ['connect']) { const f = AudioNode.prototype[k]; AudioNode.prototype[k] = function (...a) { if (trace) trace.push(k + this.constructor.name + (a[0]?.constructor?.name || '')); return f.apply(this, a); }; }
  { const d = Object.getOwnPropertyDescriptor(AudioParam.prototype, 'value'); Object.defineProperty(AudioParam.prototype, 'value', { get: d.get, set(x) { if (trace) trace.push('value' + +(+x).toFixed(9)); d.set.call(this, x); } }); }
  const traced = async (M, set) => { trace = []; const buf = await play(M, set); const t = trace; trace = null; return { buf, t }; };
  const a = await traced(OLD, {}), a2 = await traced(OLD, {}), b = await traced(NEW, { turn: 0 }), b2 = await traced(NEW, { turn: 0 }), c = await traced(NEW, {});
  const diff = (x, y) => { let most = 0; for (let ch = 0; ch < 2; ch++) { const p = x.getChannelData(ch), q = y.getChannelData(ch); for (let i = 0; i < p.length; i++) most = Math.max(most, Math.abs(p[i] - q[i])); } return most; };
  const firstDiff = (x, y) => { for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) return i; return -1; };
  return { alone, band, notes, calls: a.t.length, sameCalls: firstDiff(a.t, b.t) === -1, shippedCalls: firstDiff(a.t, c.t), refVsRef: Math.max(diff(a.buf, a2.buf), diff(b.buf, b2.buf)), noise: [diff(a.buf, a2.buf), diff(b.buf, b2.buf)], offVsRef: diff(a.buf, b.buf), onVsRef: diff(a.buf, c.buf) };
}, { ID, BARS });
await browser.close(); server.close();

const wav = ([l, r], file) => {
  const L = Buffer.from(l, 'base64'), R = Buffer.from(r, 'base64'), n = L.length / 2, data = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) { data.writeInt16LE(L.readInt16LE(i * 2), i * 4); data.writeInt16LE(R.readInt16LE(i * 2), i * 4 + 2); }
  const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(44100, 24); h.writeUInt32LE(44100 * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
};
for (const kind of ['alone', 'band']) for (const [name, r] of Object.entries(result[kind])) {
  const file = path.join(OUT, `${ID}-${kind === 'alone' ? 'line' : 'band'}-${name}.wav`); wav(r.pcm, file);
  console.log(`${r.rms > 0.002 ? 'PASS' : 'FAIL'}  ${path.basename(file)}: ${r.seconds.toFixed(2)} s, rms ${r.rms.toFixed(4)}, peak ${r.peak.toFixed(3)}`);
}
console.log(`${result.sameCalls ? 'PASS' : 'FAIL'}  turnaround off: the band asks Web Audio for exactly what ${REF} asks for (${result.calls} calls that make, connect, set or schedule a sound, in order, the same); as shipped they part at call ${result.shippedCalls}`);
console.log(`${result.offVsRef <= Math.max(result.refVsRef * 4, 1e-3) ? 'PASS' : 'FAIL'}  and its samples: largest difference ${result.offVsRef.toExponential(2)} against ${REF}, where two renders of the same code differ by ${result.noise.map((x) => x.toExponential(2)).join(' and ')} (Chrome's reverb is not bit for bit); as shipped, ${result.onVsRef.toFixed(3)}`);
const names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'], nm = (m) => (Array.isArray(m) ? m.map(nm).join('+') : names[m % 12] + (Math.floor(m / 12) - 1));
const place = (t) => `beat ${Math.floor(t / 3) + 1}${['', ' (triplet)', ' and'][t % 3]}`;
const rows = (list) => list.map((x) => `| ${x.bar} | ${x.tick} | ${place(x.tick)} | ${nm(x.m)} (${x.m}) | ${+x.beats.toFixed(2)} | ${+x.v.toFixed(2)} |`).join('\n');
const head = '| bar | tick | place | pitch (midi) | length, beats | loudness |\n|---|---|---|---|---|---|';
fs.writeFileSync(TABLE, `# ${ID}: the line, note by note\n\nWritten by tools/hear_turn.mjs from the notes music.js asks for (st.log), at 120 beats a minute, the line as near as it gets (p = 1, loudness 1).\n\n` + Object.entries(result.notes).map(([k, list]) => `## ${k}\n\n${head}\n${rows(list)}\n`).join('\n'));
console.log(`table: ${TABLE}`);
