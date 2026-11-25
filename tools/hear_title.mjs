// The front page's music sketches (game/titlemusic.js) for ears that are not here: each sketch rendered with no sound card (an
// OfflineAudioContext in headless Chrome, as tools/hear_turn.mjs does), Dive pressed at --press seconds, and the band (music.js) coming in
// exactly as title.js brings it in: started at the press, silent (duck 0), brought up at FRONT.dive.release (1.3 s) by duck(1); the band
// not told anything about the dive until then (main.js is held while the page is up), then the fish idling at the start of the first
// band with the Keeper 100 m ahead. The two are summed, as two AudioContexts are by the speakers.
//   node tools/hear_title.mjs [--press 50] [--after 12] [--out /home/claude] [--sketches abc] [--seed 1]
// Writes title-dream-<sketch>.wav (stereo, 44.1 kHz, 16 bit) and prints and writes (title-dream-measure.json) what was measured.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
const ROOT = path.resolve(import.meta.dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PRESS = +arg('--press', 50), AFTER = +arg('--after', 12), OUT = path.resolve(arg('--out', '/home/claude')), WHICH = arg('--sketches', 'abc').split(''), SEED = +arg('--seed', 1), SR = 44100;
const RELEASE = 1.3; // FRONT.dive.release in title.js
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<!doctype html><title>hear</title>'); }
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

const results = {};
for (const sk of WHICH) {
  const r = await page.evaluate(async ({ sk, PRESS, AFTER, SR, RELEASE, SEED }) => {
    const seed = (n) => { let a = n >>> 0; Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
    const B = await import('/game/music.js'), T = await import('/game/titlemusic.js');
    const pack = (f32) => { const u8 = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
    // the page, pressed at PRESS
    const pctx = new OfflineAudioContext(2, Math.round((PRESS + AFTER) * SR), SR), tm = T.createTitleMusic({ context: pctx, sketch: sk, seed: SEED });
    const pbuf = await tm.render(PRESS + AFTER, { diveAt: PRESS });
    // the band, from the press: started silent, brought up at the release
    seed(11);
    const bctx = new OfflineAudioContext(2, Math.round(AFTER * SR), SR), band = B.createMusic({ context: bctx });
    band.duck(0); let up = false; const beats = new Map();
    const bbuf = await band.render(AFTER - 0.2, (t) => {
      for (const b of band.state.beats) beats.set(b.index, b);
      if (t < RELEASE) return { speed: 0.357 }; // held behind the page: its intensity stays where it starts (0.3)
      if (!up) { up = true; band.duck(1); }
      return { speed: 0.12, low: false, activity: 0.05, far: { id: 'keeper', d: 100, side: 0, ahead: 100 } };
    }, 0.01);
    const d = band.describe(), mood = B.MOODS.find((m) => m.name === d.mood);
    const bt = [...beats.values()].sort((a, b) => a.index - b.index).slice(0, 9).map((b) => ({ index: b.index, at: +b.at.toFixed(4), dur: +b.dur.toFixed(4) }));
    return { L: pack(pbuf.getChannelData(0)), R: pack(pbuf.getChannelData(1)), bL: pack(bbuf.getChannelData(0)), bR: pack(bbuf.getChannelData(1)), hand: tm.state.handover, band: { mood: d.mood, key: d.key, bpm: d.bpm, first: mood.bars[0], beats: bt }, notes: tm.state.log.length, periods: tm.state.period, log: tm.state.log.filter((x) => x.t < PRESS) };
  }, { sk, PRESS, AFTER, SR, RELEASE, SEED });
  results[sk] = r;
}
await browser.close(); server.close();

// ---------------------------------------------------------------- the mix and the measures
const f32 = (b64) => { const b = Buffer.from(b64, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.length / 4); };
function biquad(x, [b0, b1, b2, a0, a1, a2]) { const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; }
const shelf = (() => { const A = Math.pow(10, 4 / 40), w = 2 * Math.PI * 1500 / SR, c = Math.cos(w), al = Math.sin(w) / (2 / Math.SQRT2), sA = Math.sqrt(A); return [A * ((A + 1) + (A - 1) * c + 2 * sA * al), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - 2 * sA * al), (A + 1) - (A - 1) * c + 2 * sA * al, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - 2 * sA * al]; })();
const hpf = (fc, q) => { const w = 2 * Math.PI * fc / SR, c = Math.cos(w), al = Math.sin(w) / (2 * q); return [(1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + al, -2 * c, 1 - al]; };
const seg = (x, a, b) => x.subarray(Math.round(a * SR), Math.round(b * SR));
// loudness: K-weighted (ITU BS.1770 filters), ungated, both channels
const lufs = (L, R) => { let e = 0; for (const ch of [L, R]) { const y = biquad(biquad(ch, shelf), hpf(38, 0.5)); let s = 0; for (const v of y) s += v * v; e += s / y.length; } return -0.691 + 10 * Math.log10(e); };
const rmsDb = (L, R) => { let s = 0; for (let i = 0; i < L.length; i++) s += L[i] * L[i] + R[i] * R[i]; return 10 * Math.log10(s / (2 * L.length)); };
// how much of the energy lies above 4 kHz, and the spectral centroid, from 4096-point frames
function spectrum(L) {
  const N = 4096, re = new Float64Array(N), im = new Float64Array(N); let hi = 0, all = 0, cen = 0;
  for (let o = 0; o + N <= L.length; o += N) {
    for (let i = 0; i < N; i++) { re[i] = L[o + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); im[i] = 0; }
    for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= N; len <<= 1) { const a = -2 * Math.PI / len; for (let i = 0; i < N; i += len) for (let k = 0; k < len / 2; k++) { const c = Math.cos(a * k), s = Math.sin(a * k), xr = re[i + k + len / 2] * c - im[i + k + len / 2] * s, xi = re[i + k + len / 2] * s + im[i + k + len / 2] * c; re[i + k + len / 2] = re[i + k] - xr; im[i + k + len / 2] = im[i + k] - xi; re[i + k] += xr; im[i + k] += xi; } }
    for (let k = 1; k < N / 2; k++) { const p = re[k] * re[k] + im[k] * im[k], f = k * SR / N; all += p; cen += p * f; if (f >= 4000) hi += p; }
  }
  return { hf: hi / all, centroid: cen / all };
}
// onsets: the 10 ms loudness (dB) step by step; how steep the steepest rises are
function onsets(L, R) {
  const W = Math.round(0.01 * SR), lv = [];
  for (let o = 0; o + W <= L.length; o += W) { let s = 0; for (let i = o; i < o + W; i++) s += L[i] * L[i] + R[i] * R[i]; lv.push(10 * Math.log10(s / (2 * W) + 1e-12)); }
  const rise = []; for (let i = 1; i < lv.length; i++) if (lv[i] > -60) rise.push(lv[i] - lv[i - 1]);
  rise.sort((a, b) => a - b); const q = (p) => rise[Math.min(rise.length - 1, Math.floor(p * rise.length))];
  let at = 0, best = -1; for (let i = 1; i < lv.length; i++) if (lv[i] > -60 && lv[i] - lv[i - 1] > best) { best = lv[i] - lv[i - 1]; at = i * 0.01; }
  return { p99: q(0.99), max: rise[rise.length - 1], per10s: rise.filter((x) => x > 6).length / (L.length / SR / 10), at };
}
const step = (L, R) => { let m = 0; for (const x of [L, R]) for (let i = 1; i < x.length; i++) m = Math.max(m, Math.abs(x[i] - x[i - 1])); return m; };
const db = (x) => 20 * Math.log10(x);
const names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'], nm = (m) => names[m % 12] + (Math.floor(m / 12) - 1);
const report = {};
for (const [sk, r] of Object.entries(results)) {
  const pL = f32(r.L), pR = f32(r.R), bL = f32(r.bL), bR = f32(r.bR), n = pL.length, L = new Float32Array(n), R = new Float32Array(n), off = Math.round(PRESS * SR);
  L.set(pL); R.set(pR); for (let i = 0; i < bL.length && off + i < n; i++) { L[off + i] += bL[i]; R[off + i] += bR[i]; }
  let peak = 0, clip = 0; for (const x of [L, R]) for (const v of x) { const a = Math.abs(v); peak = Math.max(peak, a); if (a >= 0.999) clip++; }
  // the WAV
  const data = Buffer.alloc(n * 4); for (let i = 0; i < n; i++) { data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767))), i * 4); data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[i] * 32767))), i * 4 + 2); }
  const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  const file = path.join(OUT, `title-dream-${sk}.wav`); fs.writeFileSync(file, Buffer.concat([h, data]));
  // the page (from the end of its fade-in to the press) against the band alone once it is up (2 s after the press to the end)
  const P0 = 4, P1 = PRESS - 0.5, b0 = 2.2, b1 = AFTER - 0.3;
  const pg = [seg(L, P0, P1), seg(R, P0, P1)], bd = [seg(bL, b0, b1), seg(bR, b0, b1)];
  const sp = spectrum(pg[0]), sb = spectrum(bd[0]), op = onsets(...pg), ob = onsets(...bd);
  const around = [seg(L, PRESS - 0.05, PRESS + 3), seg(R, PRESS - 0.05, PRESS + 3)], pageMid = [seg(L, P0, P1), seg(R, P0, P1)], bandMid = [seg(L, PRESS + 3, PRESS + AFTER - 0.2), seg(R, PRESS + 3, PRESS + AFTER - 0.2)];
  // the step right at the press (20 ms either side) too
  const atPress = [seg(L, PRESS - 0.02, PRESS + 0.02), seg(R, PRESS - 0.02, PRESS + 0.02)];
  const H = r.hand, firstBeat = r.band.beats[0], bar1 = r.band.beats.find((b) => b.index === 4);
  report[sk] = {
    file, seconds: +(n / SR).toFixed(2), press: PRESS, periods: r.periods, notes: r.notes,
    peakDb: +db(peak).toFixed(2), clipped: clip, pagePeakDb: +db(Math.max(...pg.map((x) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0)))).toFixed(2),
    pageRmsDb: +rmsDb(...pg).toFixed(1), pageLufs: +lufs(...pg).toFixed(1), bandLufs: +lufs(...bd).toFixed(1),
    hfPage: +(sp.hf * 100).toFixed(2), hfBand: +(sb.hf * 100).toFixed(2), centroidPage: Math.round(sp.centroid), centroidBand: Math.round(sb.centroid),
    onsetP99Page: +op.p99.toFixed(2), onsetP99Band: +ob.p99.toFixed(2), onsetMaxPage: +op.max.toFixed(1), onsetMaxAt: +(op.at + P0).toFixed(2), onsetNotes: r.log.filter((x) => Math.abs(x.t - (op.at + P0)) < 0.06).map((x) => `${x.voice} ${x.m == null ? '' : nm(x.m)} at ${x.t.toFixed(3)} v ${(+x.v).toFixed(2)}`), onsetMaxBand: +ob.max.toFixed(1), sharpPer10sPage: +op.per10s.toFixed(1), sharpPer10sBand: +ob.per10s.toFixed(1),
    stepAtPress: +step(...atPress).toFixed(4), stepHandover: +step(...around).toFixed(4), stepPage: +step(...pageMid).toFixed(4), stepBand: +step(...bandMid).toFixed(4),
    handChord: H.notes.map(nm).join(' '), bandFirstChord: `${r.band.mood} in ${r.band.key}: ${r.band.first[1]} on the tonic`, bandBpm: r.band.bpm,
    predictedFirst: +(H.first - PRESS).toFixed(4), actualFirst: firstBeat ? firstBeat.at : null, predictedBeat: +H.beat.toFixed(4), actualBeat: firstBeat ? firstBeat.dur : null,
    runLands: +(H.land - PRESS).toFixed(4), bandBar2: bar1 ? bar1.at : null,
  };
  console.log(sk, JSON.stringify(report[sk]));
}
fs.writeFileSync(path.join(OUT, 'title-dream-measure.json'), JSON.stringify(report, null, 1));
