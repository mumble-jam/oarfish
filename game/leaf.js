// The pause menu's leaf: a page of the book laid open over the dive (markup in index.html, #pause; styles beside "The pause menu").
//
// The left page is the title page: Paused, Resume, the chapters, and the ways out. The right page is the chapter chosen: This dive
// (what the fish is and carries), Settings, Keys, The band, and the Workbench (the testing tools and the controller's plumbing, kept
// in one plain place). main.js still owns everything the controls do, and finds them by the ids they always had; this module only
// arranges: which chapter shows, what the chapters' lines say, the note at the foot for the row in hand, the dive's page, and the
// size of the leaf in the window. It reads the game through window.__game and never writes to it.
//
// The band's dials live in the Tuning drawer while the dive runs (full view) and are carried onto the right page while it is paused.

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const INK = '#3b3026', QUIET = '#665848';
export const LEAF = { w: 1280, h: 860, page: 420, margin: 16, tight: 64, single: 0.86 }; // the leaf in CSS px; one page's width when single; below `single` (width over height) one page at a time

// ---------------------------------------------------------------- a sign for every kind of shell, drawn after the game's own models
function spiral() {
  const p = [];
  for (let i = 0; i <= 60; i++) { const u = i / 60, t = u * 2.35 * 2 * Math.PI, r = 0.9 + 7.1 * Math.pow(u, 1.15); p.push(`${(11 + r * Math.cos(t + 1.1)).toFixed(1)} ${(11.2 + r * Math.sin(t + 1.1)).toFixed(1)}`); }
  return 'M' + p.join('L');
}
// each: the outline (filled with the shell's colour), then the engraved lines inside it; all in a 22 by 22 box
export const SHELL_SIGN = {
  spire: ['M11 1.6L15.6 16.2Q16 19.8 11.4 20.4Q6.6 20 6.4 16.4Z', 'M9.7 6.3L12.5 7.4M8.6 10.2L13.7 11.9M7.4 14.2L15 16.3'],
  fan: ['M11 20L2.6 10.6Q3.2 3.6 11 2.8Q18.8 3.6 19.4 10.6Z', 'M11 20L5 6.2M11 20L8 3.9M11 20V2.8M11 20L14 3.9M11 20L17 6.2M8.4 20H13.6'],
  coil: ['M11 2.4A8.7 8.7 0 1 1 10.99 2.4Z', spiral()],
  ring: ['M11 2.2A8.8 8.8 0 1 1 10.99 2.2ZM11 7A4.2 4.2 0 1 0 11.01 7Z', 'M11 2.2V7M17.2 4.8L14 8M19.8 11H15.2M17.2 17.2L14 14M11 19.8V15.2M4.8 17.2L8 14M2.2 11H6.8M4.8 4.8L8 8'],
  horn: ['M2.8 19.2C4.2 12.6 8.8 7.4 14.2 2.6Q19.6 3 20 8.4C15 10.6 9.6 15.2 2.8 19.2Z', 'M14.2 2.6Q17 5.6 20 8.4M11 5.8Q13.6 8.6 16.4 10.6M7.9 9.4Q10 11.8 12.6 13.4M5.4 13.4Q7 15.2 8.8 16'],
  cap: ['M2.2 16.4L10 4.6Q11 3.6 12 4.6L19.8 16.4Q11 20 2.2 16.4Z', 'M11 4.1L6.4 17.8M11 4.1V18.6M11 4.1L15.6 17.8'],
  spine: ['M11 2.4Q15.4 7.6 14 12.8Q13 17 11 20.4Q9 17 8 12.8Q6.6 7.6 11 2.4Z', 'M8.3 6.8L3.4 4.6M7.4 10.8H2.2M8.4 14.6L4 17M13.7 6.8L18.6 4.6M14.6 10.8H19.8M13.6 14.6L18 17'],
  lamp: ['M8.4 2.4H13.6V4.6L16.6 8Q18.2 11.6 16 16L14 18.4V20H8V18.4L6 16Q3.8 11.6 5.4 8L8.4 4.6Z', 'M8.4 4.6H13.6M8 18.4H14M11 4.6V18.4M8.4 4.6Q6.4 11.6 8 18.4M13.6 4.6Q15.6 11.6 14 18.4'],
  tusk: ['M2.6 4C10.2 4.2 16.6 9 19.8 16L15.4 19.6C13 12.8 9 7.8 2.8 5.6Z', 'M7.6 4.9L6.9 7.4M12 7.2L10.6 9.7M15.8 10.8L13.4 12.9M18.4 13.6L14.7 16.8'],
  pearl: ['M2.2 10.6Q11 24.4 19.8 10.6Q11 14.4 2.2 10.6Z', 'M6.4 14.6Q11 17 15.6 14.6'],
};
export function shellMarks(type, colour) {
  const s = SHELL_SIGN[type];
  if (!s) return `<circle cx="11" cy="11" r="7" fill="${colour}" stroke="${INK}" stroke-width="1.1"/>`; // a kind this page has no sign for yet: its colour, as before
  const pearl = type === 'pearl' ? `<circle cx="11" cy="8" r="4.5" fill="#eef4ff" stroke="${INK}" stroke-width="1.1"/><path d="M8.6 6.4Q9.6 5 11 4.9" fill="none" stroke="${INK}" stroke-width="0.8" stroke-linecap="round"/>` : '';
  return `<path d="${s[0]}" fill="${colour}" fill-rule="evenodd" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/><path d="${s[1]}" fill="none" stroke="${INK}" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>${pearl}`;
}
export const shellSign = (type, colour) => `<svg viewBox="0 0 22 22" aria-hidden="true">${shellMarks(type, colour)}</svg>`;

// the body as the plate's scale bar: a tick a segment, a number every five, each shell's sign over the segment it rides on
function ruler(segs, shells, SHELLS, width = 420) {
  const tick = width / Math.max(1, segs), x = (i) => (i * tick + 0.5).toFixed(1);
  let marks = '', nums = '';
  for (let i = 0; i <= segs; i++) marks += `<path d="M${x(i)} ${i % 5 === 0 || i === segs ? 4 : 9}V16" stroke="${INK}" stroke-width="1"/>`;
  for (let i = 0; i <= segs; i += 5) if (segs - i >= 2 || i === segs) nums += `<text x="${x(i)}" y="31" text-anchor="middle" font-family="Old Standard TT, serif" font-size="12" fill="${QUIET}">${i}</text>`;
  if (segs % 5) nums += `<text x="${x(segs)}" y="31" text-anchor="middle" font-family="Old Standard TT, serif" font-size="12" fill="${QUIET}">${segs}</text>`;
  const signs = shells.map((s) => `<g transform="translate(${((s.seg - 0.5) * tick + 0.5 - 10).toFixed(1)} -25) scale(.909)">${shellMarks(s.type, SHELLS[s.type]?.colour || '#ddd')}</g>`).join('');
  const what = shells.length ? `, with ${shells.map((s) => `a ${SHELLS[s.type]?.name || s.type} on segment ${s.seg}`).join(', ')}` : '';
  return `<svg width="${width + 2}" height="60" viewBox="-1 -27 ${width + 2} 60" role="img" aria-label="The body: ${segs} segments${what}"><path d="M.5 16H${width + 0.5}" stroke="${INK}" stroke-width="1"/>${marks}${nums}${signs}</svg>`;
}

// ---------------------------------------------------------------- small sounds for the page: paper, and the pins of a music box
// Made as they are played, on the band's own audio context, never louder than a fraction of the band's volume dial, and silent
// with "Sound off". Nothing is made before the page has been touched (the band's context does not run until then).
export const SFX = { level: 0.55, move: 0.03, turn: 0.075, pin: 0.06, dial: 0.03, knock: 0.085, gap: 0.045 }; // each against the volume dial; `gap`: least seconds between two of a kind
function makeSfx(g) {
  let out = null, noise = null, heard = 0;
  const last = {};
  const ctxOf = () => { const c = g.music?.context; return c && c.state === 'running' && !g.music.muted ? c : null; };
  function bus(c) {
    if (!out || out.context !== c) {
      out = c.createGain(); out.connect(c.destination);
      noise = c.createBuffer(1, Math.floor(c.sampleRate * 0.5), c.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    out.gain.value = SFX.level * (+($('m-volume')?.value ?? 70) / 100);
    return out;
  }
  function pin(c, to, t, f, gain, dur = 0.16) { // a pin of the music box: a sine with its octave over it, struck and let go
    for (const [mul, k] of [[1, 1], [2, 0.3], [3.01, 0.08]]) {
      const o = c.createOscillator(), a = c.createGain(); o.type = 'sine'; o.frequency.value = f * mul;
      a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * k), t + 0.004); a.gain.exponentialRampToValueAtTime(0.0001, t + dur * (mul === 1 ? 1 : 0.6));
      o.connect(a).connect(to); o.start(t); o.stop(t + dur + 0.02);
    }
  }
  function paper(c, to, t, dur, gain, f0, f1) { // paper: a breath of noise through a band that slides
    const s = c.createBufferSource(), f = c.createBiquadFilter(), a = c.createGain(); s.buffer = noise; s.loop = true;
    f.type = 'bandpass'; f.Q.value = 0.9; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(gain, t + dur * 0.25); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(a).connect(to); s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
  }
  function knock(c, to, t) { // asked twice: two low knocks
    for (const dt of [0, 0.11]) {
      const o = c.createOscillator(), a = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(150, t + dt); o.frequency.exponentialRampToValueAtTime(90, t + dt + 0.08);
      a.gain.setValueAtTime(0.0001, t + dt); a.gain.exponentialRampToValueAtTime(SFX.knock, t + dt + 0.005); a.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.1);
      o.connect(a).connect(to); o.start(t + dt); o.stop(t + dt + 0.12);
    }
  }
  const N = { d5: 587.33, a5: 880, b5: 987.77, d6: 1174.66, e6: 1318.51, fs6: 1479.98, b6: 1975.53 };
  // kinds: move (the place changes), turn (a chapter, or another sheet), back, on, off, choose, dial (v: 0 to 1), open, close, arm, press
  function play(kind, v) {
    const c = ctxOf(); if (!c) return false;
    const now = performance.now(); if (now - (last[kind] || -1e9) < SFX.gap * 1000) return false; last[kind] = now;
    const to = bus(c), t = c.currentTime + 0.005, P = SFX.pin;
    if (kind === 'move') paper(c, to, t, 0.045, SFX.move, 2600, 3800);
    else if (kind === 'turn') { paper(c, to, t, 0.22, SFX.turn, 900, 3200); pin(c, to, t + 0.05, N.a5, P * 0.6, 0.2); }
    else if (kind === 'back') paper(c, to, t, 0.16, SFX.turn * 0.8, 2600, 1000);
    else if (kind === 'on') { pin(c, to, t, N.e6, P); pin(c, to, t + 0.07, N.b6, P, 0.22); }
    else if (kind === 'off') pin(c, to, t, N.b5, P, 0.2);
    else if (kind === 'choose') { pin(c, to, t, N.fs6, P * 0.9, 0.14); pin(c, to, t + 0.06, N.d6, P * 0.9, 0.18); }
    else if (kind === 'dial') pin(c, to, t, 700 * Math.pow(2, (v ?? 0.5) * 1.5), SFX.dial, 0.06);
    else if (kind === 'open') { paper(c, to, t, 0.34, SFX.turn, 500, 2400); pin(c, to, t + 0.12, N.d5, P * 0.7, 0.4); pin(c, to, t + 0.2, N.a5, P * 0.6, 0.4); }
    else if (kind === 'close') { paper(c, to, t, 0.2, SFX.turn * 0.8, 2400, 700); pin(c, to, t + 0.02, N.a5, P * 0.6, 0.18); pin(c, to, t + 0.09, N.d6, P * 0.7, 0.3); }
    else if (kind === 'arm') knock(c, to, t);
    else if (kind === 'press') { paper(c, to, t, 0.03, SFX.move * 1.4, 1800, 2600); pin(c, to, t, N.d6, P * 0.5, 0.08); }
    else return false;
    heard++; return true;
  }
  return { play, get heard() { return heard; } };
}

export function mountLeaf() {
  const pause = $('pause'), stage = $('stage'), leaf = pause.querySelector('.leaf'), drawer = $('drawer'), bandHost = $('lf-band');
  if (!leaf || !window.__game) return null;
  const g = window.__game, sfx = makeSfx(g);
  const rows = [...leaf.querySelectorAll('.lf-contents button')];
  const isOpen = () => pause.classList.contains('on') && !pause.classList.contains('noting');
  let want = null, docked = false, drawerWasOpen = false, timer = 0, lastSig = '', hush = false;

  // ---- which chapter shows
  function apply(ch) {
    if (pause.dataset.ch === 'keys' && ch !== 'keys' && pause.classList.contains('binding')) $('bind-back').click(); // leave the listening, as Done does
    if (isOpen() && !hush && pause.dataset.ch !== ch) sfx.play('turn');
    pause.dataset.ch = ch;
    for (const b of rows) if (b.dataset.ch) b.setAttribute('aria-current', String(b.dataset.ch === ch));
    refresh(true);
  }
  function show(ch, into) {
    if (!was) want = ch; // asked for before the leaf has seen itself opened (the front page asks in the same breath as it pauses): open on it
    apply(ch);
    pause.classList.toggle('in-ch', !!into);
    if (into) firstIn(ch)?.focus({ preventScroll: true });
  }
  const chapter = (ch) => leaf.querySelector(`.ch[data-ch="${ch}"]`);
  const usable = (el) => !el.disabled && el.offsetParent !== null;
  const firstIn = (ch) => [...chapter(ch).querySelectorAll('button, input, select')].find(usable);
  for (const b of rows) if (b.dataset.ch) b.addEventListener('click', () => show(b.dataset.ch, true));
  $('lf-back').addEventListener('click', () => { sfx.play('back'); pause.classList.remove('in-ch'); rows.find((b) => b.dataset.ch === pause.dataset.ch)?.focus({ preventScroll: true }); });
  // ○ on a controller, from inside a chapter: back to its line on the left page (main.js asks before it resumes)
  function back() {
    const at = document.activeElement;
    if (!isOpen() || !at || !leaf.querySelector('.recto').contains(at)) return false;
    pause.classList.remove('in-ch'); sfx.play('back');
    rows.find((b) => b.dataset.ch === pause.dataset.ch)?.focus({ preventScroll: true });
    return true;
  }

  // ---- a choice of two shows the one chosen; pressing it takes the other
  for (const c of document.querySelectorAll('#pause .chooser, #drawer .chooser')) {
    c.addEventListener('click', (e) => {
      if (!leaf.contains(c)) return; // in the drawer both are shown, as buttons
      const on = c.querySelector('button[aria-pressed="true"]'), other = [...c.querySelectorAll('button')].find((b) => b !== on);
      if (!other || e.target === other || e.__leaf) return;
      e.stopPropagation(); e.preventDefault();
      const again = new MouseEvent('click', { bubbles: true }); again.__leaf = true; other.dispatchEvent(again); sfx.play('choose');
      setTimeout(() => { c.querySelector('button[aria-pressed="true"]')?.focus({ preventScroll: true }); note(c.closest('.rw, .scope')); }, 0);
    }, true);
  }

  // ---- the note at the foot: the long explanation, only for the row in hand
  let cur = null;
  function note(row) {
    if (!row || !leaf.contains(row)) return;
    const ch = row.closest('.ch'), foot = ch?.querySelector('.lf-foot > p'); if (!foot || foot.id) return; // the keys chapter's foot is the game's own line
    const text = (row.querySelector(':scope > p, :scope > .fn') || {}).textContent || '';
    if (cur && cur !== row) cur.classList.remove('cur');
    cur = row; row.classList.toggle('cur', !!text);
    foot.textContent = text ? `* ${text}` : '';
  }
  const rowOf = (el) => el?.closest?.('.dial, .sw, .rw, .scope');
  let lastAt = null;
  leaf.addEventListener('focusin', (e) => { note(rowOf(e.target)); if (e.target !== lastAt && isOpen() && !hush) sfx.play('move'); lastAt = e.target; });
  // what was pressed answers: a pearl set or lifted, a dial's tick, the two knocks of "asked twice", a plain press
  leaf.addEventListener('change', (e) => { if (e.target.type === 'checkbox') sfx.play(e.target.checked ? 'on' : 'off'); });
  leaf.addEventListener('input', (e) => { const el = e.target; if (el.type === 'range') sfx.play('dial', (el.value - el.min) / Math.max(1, el.max - el.min)); });
  leaf.addEventListener('click', (e) => {
    const b = e.target.closest?.('button'); if (!b || e.__leaf) return;
    if (b.matches('.sw, #music-mute')) setTimeout(() => sfx.play(b.getAttribute('aria-pressed') === 'true' ? 'on' : 'off'), 30);
    else if (b.closest('.lf-leave')) setTimeout(() => { if (b.dataset.armed) sfx.play('arm'); }, 0);
    else if (b.id === 'btn-library' || b.id === 'btn-note') sfx.play('turn');
    else if (b.closest('.ch[data-ch="work"], .lf-acts, .preset, #bind-grid')) sfx.play('press');
  });
  $('bind-back').addEventListener('click', () => { rows.find((b) => b.dataset.ch === 'keys')?.focus({ preventScroll: true }); }); // Done: back to the chapter's line
  leaf.addEventListener('pointerover', (e) => { if (e.pointerType !== 'touch') note(rowOf(e.target)); });

  // ---- arrows move through what is on the page, as the D-pad does (main.js, moveFocus)
  pause.addEventListener('keydown', (e) => {
    if (!isOpen() || e.altKey || e.ctrlKey || e.metaKey || leaf.querySelector('#bind-grid .wait')) return;
    const at = document.activeElement, typing = at && (at.tagName === 'SELECT' || (at.tagName === 'INPUT' && at.type === 'text'));
    if (typing) return;
    if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
      const items = [...leaf.querySelectorAll('button, input, select')].filter(usable), i = items.indexOf(at), d = e.code === 'ArrowDown' ? 1 : -1;
      items[i < 0 ? (d > 0 ? 0 : items.length - 1) : (i + d + items.length) % items.length]?.focus({ preventScroll: true });
      e.preventDefault(); e.stopPropagation();
    } else if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && at?.closest?.('.chooser') && leaf.contains(at)) {
      at.click(); e.preventDefault(); e.stopPropagation();
    } else if (e.code === 'ArrowLeft' && at && leaf.querySelector('.recto').contains(at) && at.type !== 'range') {
      if (back()) { e.preventDefault(); e.stopPropagation(); }
    } else if (e.code === 'ArrowRight' && at?.dataset?.ch && rows.includes(at)) {
      show(at.dataset.ch, true); e.preventDefault(); e.stopPropagation();
    }
  }, true);

  // ---- the band's dials: in the drawer while the dive runs, on the right page while it is paused
  function dock(on) {
    if (on === docked) return;
    docked = on;
    const from = on ? drawer : bandHost, to = on ? bandHost : drawer;
    if (on) { drawerWasOpen = drawer.classList.contains('open'); drawer.classList.remove('open'); }
    while (from.firstChild) to.append(from.firstChild);
    if (!on && drawerWasOpen && stage.classList.contains('full')) drawer.classList.add('open');
    $('music-tab').setAttribute('aria-expanded', String(drawer.classList.contains('open')));
  }

  // ---- the lesser actions keep a lozenge between them, whoever adds one (title.js adds "Front page")
  const leave = leaf.querySelector('.lf-leave');
  function lozenges() {
    for (const z of leave.querySelectorAll('.lz')) z.remove();
    const bs = [...leave.querySelectorAll('button')];
    bs.forEach((b, i) => { b.classList.add('fx'); if (i) { const z = document.createElement('i'); z.className = 'lz'; z.setAttribute('aria-hidden', 'true'); b.before(z); } });
  }
  let tidy = false;
  new MutationObserver(() => { if (tidy) return; tidy = true; lozenges(); queueMicrotask(() => { tidy = false; }); }).observe(leave, { childList: true });
  lozenges();
  $('btn-resume').classList.add('fx');
  for (const b of leaf.querySelectorAll('.lf-acts button, .preset button')) b.classList.add('fx');
  // an empty slot in the table is a dash, not a key
  const grid = $('bind-grid');
  const slots = () => { for (const b of grid.querySelectorAll('button')) b.classList.toggle('none', b.textContent === '–'); };
  new MutationObserver(slots).observe(grid, { childList: true });

  // ---- what the pages say of the dive
  const cap = (k) => `<b class="kc">${esc(k)}</b>`;
  const minutes = (t) => (t < 60 ? 'under a minute' : `${Math.floor(t / 60)} min`);
  function refresh(force) {
    if (!isOpen()) return;
    const run = g.run, SH = g.SHELLS, shells = [...(run.shells || [])].sort((a, b) => a.seg - b.seg);
    const dev = stage.dataset.dev, hasPad = [...(navigator.getGamepads?.() || [])].some(Boolean);
    const muted = $('music-mute').getAttribute('aria-pressed') !== 'true';
    const sig = [run.segs, run.caught, run.longest, Math.floor(run.time / 60), shells.map((s) => s.type + s.seg).join(), dev, hasPad, muted, $('btn-resume').textContent, pause.dataset.ch].join('|');
    if (!force && sig === lastSig) return;
    lastSig = sig;
    pause.classList.toggle('has-pad', hasPad);
    $('btn-resume').classList.toggle('long', $('btn-resume').textContent.length > 9);
    $('v-dive').textContent = `${run.segs} segments, ${shells.length === 1 ? '1 shell' : `${shells.length || 'no'} shells`}`;
    $('v-keys').textContent = dev === 'pad' ? g.pad.title() : dev === 'touch' ? 'touch' : 'keyboard and mouse';
    $('v-band').textContent = muted ? 'sound off' : 'sound on';
    $('lf-hints').innerHTML = pause.classList.contains('single') ? '' : dev === 'pad'
      ? `<span>${cap(g.pad.name(9) || 'Options')} resume</span><span>${cap(g.pad.name(0) || '✕')} choose</span><span>${cap(g.pad.name(1) || '○')} back</span>`
      : `<span>${cap('Esc')} resume</span><span>${cap('↑')}${cap('↓')} choose</span><span>${cap('Enter')} open</span>`;
    $('lf-time').textContent = minutes(run.time);
    $('lf-caught').textContent = String(run.caught);
    $('lf-longest').textContent = `${(run.longest * 0.312 + 0.5).toFixed(1)} m`;
    $('lf-len').textContent = `${(g.rig.length + 0.5).toFixed(1)} m`;
    $('lf-ruler').innerHTML = ruler(run.segs, shells, SH);
    leaf.querySelector('.lf-th').classList.toggle('none', !shells.length);
    $('lf-shells').innerHTML = shells.length
      ? shells.map((s) => { const d = SH[s.type]; return `<li><div class="sh"><div class="hd">${shellSign(s.type, d.colour)}<b>${esc(d.name)}</b><i class="ld"></i></div><p><i>Worn:</i> ${esc(d.worn[0].toLowerCase() + d.worn.slice(1))}<br><i>Shed:</i> ${esc(d.shed)}</p></div><div class="sg">${s.seg}</div></li>`; }).join('')
      : '<li class="none"><p>None yet. They lie glowing about each band; swim your head over one to take it.</p></li>';
  }

  // ---- the leaf in the window: whole if it fits, smaller if not, one page at a time when the window is narrow or upright
  function fit() {
    const W = stage.clientWidth, H = stage.clientHeight, single = W / H < LEAF.single || W < 720;
    pause.classList.toggle('single', single);
    const k = single ? Math.min(1.25, W / LEAF.page) : Math.min(1, (W - 2 * LEAF.margin) / LEAF.w, (H - 2 * LEAF.margin) / LEAF.h);
    pause.style.setProperty('--k', k.toFixed(4));
    if (single) pause.style.setProperty('--ph', `${Math.ceil(H / k)}px`); else pause.style.removeProperty('--ph');
    stage.classList.toggle('leaf-tight', single || (H - LEAF.h * k) / 2 < LEAF.tight);
    stage.classList.toggle('leaf-single', single); // one page fills the window: the corner buttons step aside, the page has its own Resume
  }
  addEventListener('resize', fit);
  new ResizeObserver(fit).observe(stage);
  fit();

  // ---- opening and closing follow the game's own class on #pause
  let was = false;
  function sync() {
    const on = isOpen();
    if (on === was) return;
    was = on;
    if (on) {
      dock(true); fit(); hush = true; sfx.play('open');
      pause.classList.remove('in-ch');
      if (cur) { cur.classList.remove('cur'); cur = null; }
      for (const f of leaf.querySelectorAll('.lf-foot > p:not([id])')) f.textContent = '';
      apply(want || 'dive'); want = null;
      setTimeout(() => { hush = false; }, 120);
      slots();
      clearInterval(timer); timer = setInterval(refresh, 500);
    } else {
      clearInterval(timer);
      sfx.play(pause.classList.contains('on') ? 'turn' : 'close');
      if (!pause.classList.contains('on')) dock(false); // under the feedback sheet the page is only covered
    }
  }
  new MutationObserver(sync).observe(pause, { attributes: true, attributeFilter: ['class'] });
  leaf.addEventListener('click', () => setTimeout(refresh, 0));
  sync();

  const api = { show, back, refresh, fit, sfx, get chapter() { return pause.dataset.ch; }, get docked() { return docked; } };
  window.__leaf = api;
  return api;
}
