// Stands in for game/main.js and game/library.js, for the menus only. The game writes a good deal of its interface by script (the
// key list, the binding grid, the shells, the messages); this file writes the same things with the same templates, so the page
// reads as the game does, and it answers clicks as far as that is cheap: sections open, dials move, slots take keys. Nothing here
// plays, saves or sends anything. Each part names the lines of the game it was copied from (main.js unless it says otherwise, as of
// the branch this kit was cut from), which is where a change to the wording or the behaviour has to be carried back to.
// The words that come from the game's own modules (bands, shells, actions, specimens) are in game-data.js, written by the tool.
(() => {
  'use strict';
  const G = window.GAME, $ = (id) => document.getElementById(id), stage = $('stage');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const MIN_SEGS = 4, MAX_SEGS = 26, SHED_COST = 3, START_SEGS = 10;                                         // main.js 19
  const LENGTH = { cost: [5, 17], bend: 1.15, toll: { part: 0.4, over: 8, least: 2, keep: 8 } };              // main.js 30
  const riftToll = (segs) => Math.max(LENGTH.toll.least, Math.round((segs - LENGTH.toll.over) * LENGTH.toll.part)); // main.js 42
  const MUSIC_KEYS = ['dream', 'energy', 'menace', 'react', 'swing', 'band'];                                 // main.js 50
  const SHIPPED_MUSIC = { dream: 60, energy: 50, menace: 50, react: 70, swing: 60, band: 50 };                // main.js 51
  const ACTIONS = G.actions, STICK = new Set(G.stick);                                                        // main.js 63 to 70
  const DEFAULT_BINDS = G.binds;                                                                              // main.js 71 to 75
  const KEY_NAMES = { ShiftLeft: 'Shift', ShiftRight: 'R Shift', Space: 'Space', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', Tab: 'Tab', CapsLock: 'Caps', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\' }; // main.js 86
  const keyName = (code) => (!code ? '' : code.startsWith('Key') ? code.slice(3) : code.startsWith('Digit') ? code.slice(5) : KEY_NAMES[code] || code.replace(/^Numpad/, 'Num ')); // main.js 87
  const copy = (o) => JSON.parse(JSON.stringify(o));

  // ---------------------------------------------------------------- what the game knows, as far as the menus show it
  // One plain object. kit.js sets it for each state; the functions below put it on the page.
  const fresh = () => ({
    dev: 'keys',            // what is in the player's hands: 'keys' or 'pad' (main.js `dev`)
    touch: false,           // a touch screen (main.js `touch`, from the media query; the kit can stand in for one)
    mode: 'point',          // 'point' or 'look': the two sets of mouse controls (feel.mode)
    lookFree: false, lookLocked: false, // the adventure camera without, and with, the mouse handed over
    full: false,            // the full view: keys and tools on screen (ui.full, #stage.full)
    paused: false, fs: false, ended: '', // ended: '', 'dead' or 'won'
    surface: false,         // at the sea's surface, where the plate names no band and there is no marker (main.js 660)
    floor: 0, segs: START_SEGS, food: 0, toll: 0, shells: [], // shells: [{ type, seg }]
    tut: false,             // the nursery is teaching (Skip tutorial shows)
    teach: true, light: false, look: 50, rumble: 70, assist: 60,
    pad: null,              // null, or { name, kind: 'ps' | 'xbox', motors: true }
    hid: true,              // the browser can hand a DualSense to the page (Chrome and Edge)
    binds: copy(DEFAULT_BINDS), presets: {}, wait: null,
    run: { time: 431, played: 1290, dives: 3, longest: 18, caught: 41, hauled: 0, fragments: 0, frames: 60, best: 0 },
    music: { started: false, muted: false, volume: 70, all: { ...SHIPPED_MUSIC }, zones: {} },
    note: { open: false, own: false },
    lib: { open: false, id: 'keeper', band: 0, state: 0, tier: 'm', tone: 0, turn: true, wire: false, fish: false, speed: null, tweaks: {}, text: false },
    bring: {},
  });
  let M = fresh();

  // ---------------------------------------------------------------- the key list, written for whatever is in the player's hands (main.js 999 to 1015)
  const padName = (i) => (i == null ? '' : G.padNames[M.pad?.kind || 'ps'][i] || `Button ${i}`);              // pad.js 133 to 137
  const padTitle = () => (M.pad?.name || '').replace(/\s*\(.*$/, '').trim() || 'Controller';                  // pad.js 140
  const kb = (a) => keyName(M.binds.keys[a][0]) || 'an unset key';                                            // main.js 1123
  const pb = (a) => padName(M.binds.pad[a]) || 'an unset button';                                             // main.js 1124
  const K = (...ks) => ks.map((k) => `<kbd>${k}</kbd>`).join('');
  const row = (...parts) => { let h = ''; for (let i = 0; i < parts.length; i += 2) h += `<span class="pair">${parts[i]}<span>${parts[i + 1]}</span></span>`; return `<li class="key">${h}</li>`; };
  function legend() {
    if (M.dev === 'pad') return row(K('Left stick'), 'steer', K(pb('sprint')), 'dash, hold to sprint') + row(K(pb('wrap')), 'wrap, or coil', K(pb('sprint')), 'tight') + row(K(pb('rise')), 'rise', K(pb('dive')), 'dive') + row(K(pb('oarL'), pb('oarR')), 'oars: in turn, on the beat') + row(K(pb('shed')), 'shed tail as bait') + row(K(pb('pause')), 'pause', K(pb('hide')), 'hide this')
      + `<li class="note">The right stick looks around; ${pb('behind')} brings the view behind you. ${pb('zoomIn')} and ${pb('zoomOut')} zoom.</li>`;
    if (M.touch) return '<li class="note">Hold and drag: the fish swims to your finger. Hold on a swarm to wrap it. Pinch to zoom, drag with two fingers to look around.</li>';
    return row(K(kb('up'), kb('left'), kb('down'), kb('right')), 'steer', K(kb('sprint')), 'dash, hold to sprint') + row(K(kb('wrapL'), kb('wrapR')), 'wrap, or coil', K(kb('sprint')), 'tight') + row(K(kb('rise')), 'rise', K(kb('dive')), 'dive') + row(K(kb('oarL'), kb('oarR')), 'oars: in turn, on the beat') + row(K(kb('shed')), 'shed tail as bait') + row(K(kb('pause')), 'pause', K(kb('full')), 'full screen', K(kb('hide')), 'hide this')
      + (M.mode === 'look' ? `<li class="note">The mouse turns the view${M.lookLocked || M.lookFree ? '' : ': click the water to take it'}. Tilt the view up or down and the fish swims that way. Left button wraps, right button dashes and sprints, scroll zooms. On a trackpad a click with two fingers down is the right button; ${kb('wrapL')} and ${kb('wrapR')} wrap from the keys. ${kb('view')} goes back to pointing.</li>`
        : `<li class="note">Mouse: drag with the left button to look around. Hold both buttons to swim where you look, up and down too. Hold the right one to swim to the pointer. Scroll zooms. ${kb('view')} switches to the adventure camera.</li>`);
  }
  function renderLegend() { const h = legend(); $('keys').innerHTML = h; $('pause-keys').innerHTML = h; }
  function setDev(d, quiet) {
    if (M.dev === d) return;
    M.dev = d; stage.dataset.dev = d; renderLegend();
    if (d === 'pad' && !quiet && !M.paused) tell(`${padTitle()} found. Hold ${pb('wrap')} beside a small swarm to wrap round it.`, 6);
  }

  // ---------------------------------------------------------------- the two sets of controls (main.js 1017 to 1037)
  function showMode() {
    $('mode-point').setAttribute('aria-pressed', String(M.mode === 'point')); $('mode-look').setAttribute('aria-pressed', String(M.mode === 'look'));
    $('mode-note').textContent = M.mode === 'point' ? 'Drag with the left mouse button to look around. Hold both buttons and the fish swims where you look; hold the right one alone and it swims to the pointer. The view stays high, as on the plate.'
      : M.lookFree ? 'The keys swim and the mouse turns the view. This page was not allowed to capture the mouse, so the view follows it while it moves over the water, and keeps turning while it rests at the left or right edge. Tilt the view up or down and the fish swims that way.'
        : 'The keys swim and the mouse turns the view, with no button held. Tilt the view up or down and the fish swims that way. Click the water to hand the mouse to the game. Esc takes it back and pauses.';
  }
  function setMode(m, quiet) {
    if (M.touch || m !== 'look') m = 'point';
    const changed = M.mode !== m;
    M.mode = m; stage.dataset.mode = m;
    showMode(); renderLegend();
    if (changed && !quiet && !M.paused) tell(m === 'point' ? 'Point and swim: drag to look around, hold both mouse buttons to swim where you look.' : M.lookFree ? 'Adventure camera: the mouse turns the view.' : 'Adventure camera: click the water and the mouse turns the view.', 5);
  }

  // ---------------------------------------------------------------- pause, full screen, hiding the help (main.js 1058 to 1112)
  function setPaused(on) {
    if (on === M.paused || (on && M.ended)) return;
    M.paused = on;
    stage.classList.toggle('paused', on); $('pause').classList.toggle('on', on);
    $('btn-pause').setAttribute('aria-pressed', String(on)); $('btn-pause').setAttribute('aria-label', on ? 'Resume' : 'Pause');
    newDive(false); $('pause-msg').textContent = ''; openBinds(false); openNote(false);
    if (on) { showMode(); renderLegend(); showDev(); $('btn-resume').focus({ preventScroll: true }); }
    else { if ($('pause').contains(document.activeElement)) document.activeElement.blur(); if (!M.full) closeDrawer(); }
  }
  const note = (text) => { if (M.paused) $('pause-msg').textContent = text; else tell(text, 5); };
  function fullscreen() { // the page does not really go full screen here: only what the menus say about it changes (main.js 1088 to 1092)
    M.fs = !M.fs;
    for (const id of ['btn-fs', 'btn-full']) $(id).setAttribute('aria-pressed', String(M.fs));
    $('btn-full').textContent = M.fs ? 'Leave full screen' : 'Full screen';
    $('btn-fs').setAttribute('aria-label', M.fs ? 'Leave full screen' : 'Full screen');
  }
  function openDrawer(open) { $('drawer').classList.toggle('open', open); $('music-tab').setAttribute('aria-expanded', String(open)); if (open) nowPlaying(); }
  function closeDrawer() { openDrawer(false); }
  function setFull(on, quiet) {
    M.full = !!on;
    stage.classList.toggle('full', M.full);
    $('btn-keys').textContent = M.full ? 'Hide keys and tools on screen' : 'Show keys and tools on screen';
    if (!M.full && !M.paused) closeDrawer();
    if (!M.full && !quiet && !M.paused) tell(M.dev === 'pad' ? `Keys and tools hidden. ${pb('hide')} brings them back.` : M.touch ? 'Keys and tools hidden.' : `Keys and tools hidden. ${kb('hide')} brings them back.`, 4);
  }
  let newT = 0;
  function newDive(arm) { // leaving a dive takes two presses
    clearTimeout(newT);
    const b = $('btn-new');
    b.dataset.armed = arm ? '1' : ''; b.textContent = arm ? 'Leave this dive? Press again' : 'New dive';
    if (arm && !window.KIT_HOLD) newT = setTimeout(() => newDive(false), 4000);
  }

  // ---------------------------------------------------------------- key and button bindings (main.js 1115 to 1174, 1217 to 1230)
  const cleanBinds = (b) => copy(b);
  const sameBinds = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function showBinds(msg) {
    const wait = M.wait, binds = M.binds;
    const head = '<b>Action</b><b>Key</b><b>Or</b><b>Controller</b>';
    $('bind-grid').innerHTML = head + ACTIONS.map(([a, label]) => {
      const slot = (i) => `<button type="button" data-a="${a}" data-k="${i}"${wait && wait.a === a && wait.k === i ? ' class="wait"' : ''}>${wait && wait.a === a && wait.k === i ? 'press a key' : keyName(binds.keys[a][i]) || '–'}</button>`;
      const padSlot = STICK.has(a) ? '<span class="fixed">Left stick</span>' : `<button type="button" data-a="${a}" data-p="1"${wait && wait.a === a && wait.p ? ' class="wait"' : ''}>${wait && wait.a === a && wait.p ? 'press a button' : padName(binds.pad[a]) || '–'}</button>`;
      return `<span>${label}</span>${slot(0)}${slot(1)}${padSlot}`;
    }).join('');
    const names = Object.keys(M.presets).sort(), sel = $('bind-preset');
    const current = sameBinds(binds, DEFAULT_BINDS) ? '' : names.find((n) => sameBinds(binds, M.presets[n])) ?? '*';
    sel.innerHTML = `<option value="">The defaults</option>${names.map((n) => `<option value="${n.replace(/"/g, '&quot;')}">${n.replace(/</g, '&lt;')}</option>`).join('')}${current === '*' ? '<option value="*">Not saved yet</option>' : ''}`;
    sel.value = current;
    $('bind-delete').disabled = !current || current === '*';
    if (msg !== undefined) $('bind-msg').textContent = msg;
    renderLegend();
  }
  function setKey(a, k, code) { // put a key on an action, taking it off whatever had it
    let took = '';
    for (const [o, label] of ACTIONS) { const i = M.binds.keys[o].indexOf(code); if (i >= 0 && !(o === a && i === k)) { M.binds.keys[o].splice(i, 1); took = label; } }
    const list = M.binds.keys[a]; while (list.length < k) list.push(''); list[k] = code;
    M.binds.keys[a] = list.filter(Boolean);
    return took ? `${keyName(code)} was on “${took}” and has moved.` : '';
  }
  function openBinds(on) { M.wait = null; $('pause').classList.toggle('binding', on); if (on) { showBinds('Click a slot, then press the key or the button for it. Backspace empties a slot, Esc leaves it as it was.'); $('bind-back').focus({ preventScroll: true }); } }
  $('bind-grid').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    M.wait = b.dataset.p ? { a: b.dataset.a, p: true } : { a: b.dataset.a, k: +b.dataset.k };
    showBinds(M.wait.p ? 'Press the controller button for it.' : 'Press the key for it.');
  });
  window.addEventListener('keydown', (e) => { // a slot is listening: this key is for it, not for the game
    if (!M.wait) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const w = M.wait; M.wait = null;
    if (e.code === 'Escape') return showBinds('Left as it was.');
    if (e.code === 'Backspace' || e.code === 'Delete') { if (w.p) M.binds.pad[w.a] = null; else M.binds.keys[w.a].splice(w.k, 1); return showBinds('Emptied.'); }
    if (w.p) return showBinds('That slot takes a controller button. Click it again and press one.');
    if (/^(Control|Alt|Meta|OS)/.test(e.code)) return showBinds('Ctrl, Alt and the system key cannot be used.');
    showBinds(setKey(w.a, Math.min(w.k, M.binds.keys[w.a].length), e.code));
  }, true);
  $('btn-binds').addEventListener('click', () => { openBinds(true); changed(); });
  $('bind-back').addEventListener('click', () => { openBinds(false); $('btn-resume').focus({ preventScroll: true }); changed(); });
  $('bind-reset').addEventListener('click', () => { M.binds = cleanBinds(DEFAULT_BINDS); showBinds('Back to the defaults.'); });
  $('bind-preset').addEventListener('change', (e) => {
    const n = e.target.value;
    if (n === '*') return;
    M.binds = cleanBinds(n ? M.presets[n] : DEFAULT_BINDS); showBinds(n ? `Using “${n}”.` : 'Back to the defaults.');
  });
  $('bind-save').addEventListener('click', () => {
    const sel = $('bind-preset').value, n = $('bind-name').value.trim() || (sel && sel !== '*' ? sel : '');
    if (!n) return showBinds('Type a name for this set first.');
    M.presets[n] = cleanBinds(M.binds); $('bind-name').value = '';
    showBinds(`Saved as “${n}” in this browser.`);
  });
  $('bind-delete').addEventListener('click', () => { const n = $('bind-preset').value; if (!n || n === '*') return; delete M.presets[n]; showBinds(`Deleted “${n}”. The keys stay as they are until you change them.`); });

  // ---------------------------------------------------------------- feedback: copied, never sent (main.js 1175 to 1216)
  const bodyMetres = (segs) => (segs * 0.312 + 0.5).toFixed(1);
  function noteFacts() {
    const R = M.run, mins = (s) => (s < 90 ? `${Math.round(s)} s` : `${Math.round(s / 60)} min`), ua = navigator.userAgent;
    const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'a browser';
    const system = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux|CrOS/.test(ua) ? 'Linux' : 'an unknown system';
    const hands = M.dev === 'pad' ? `a controller (${padTitle()}: ${M.pad?.motors === false ? 'no motors reported' : 'motors (dual-rumble)'})` : M.touch ? 'touch' : 'keyboard and mouse';
    const built = new Date(document.lastModified), when = Number.isNaN(+built) ? '' : ` · build of ${built.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
    return [
      `Band ${M.floor + 1} of ${G.floors.length}, ${G.floors[M.floor].name.replace(/^The /, 'the ')}: ${M.ended === 'won' ? 'finished' : M.ended === 'dead' ? 'died there' : 'still diving'}`,
      `This dive ${mins(R.time)}; ${mins(R.played)} played in ${R.dives} ${R.dives === 1 ? 'dive' : 'dives'}. Longest body ${bodyMetres(R.longest)} m, ${R.caught} caught`,
      `${M.mode === 'look' ? 'Adventure camera' : 'Point and swim'}, ${hands}, ${M.full ? 'keys and tools shown' : 'plain view'}`,
      `${browser} on ${system}, ${innerWidth}×${innerHeight}${R.frames ? `, ${R.frames} frames a second` : ''}${when}`,
    ].join('\n');
  }
  const noteBody = () => `Oarfish dive: feedback\n\n${$('note-text').value.trim()}${$('note-facts').checked ? `\n\nHow the dive went\n${noteFacts()}` : ''}\n\n${location.origin}${location.pathname}`;
  function openNote(on, share) {
    if (on === M.note.open) return;
    const p = $('pause'); M.note.open = on;
    if (on) { M.note.own = !M.paused; if (M.note.own) p.classList.add('on'); $('note-facts-text').textContent = noteFacts(); $('note-msg').textContent = ''; $('note-out').hidden = true; $('note-share').hidden = share === undefined ? typeof navigator.share !== 'function' : !share; }
    else if (M.note.own) p.classList.remove('on');
    p.classList.toggle('noting', on); p.scrollTop = 0;
    (on ? $('note-text') : M.note.own ? $('btn-again') : $('btn-note')).focus({ preventScroll: true });
  }
  const noteReady = () => { if ($('note-text').value.trim()) return true; $('note-msg').textContent = 'Write a line first, even a short one.'; $('note-text').focus({ preventScroll: true }); return false; };
  const noteByHand = (text, why) => { const o = $('note-out'); o.hidden = false; o.value = text; o.focus({ preventScroll: true }); o.select(); $('note-msg').textContent = `${why} The whole note is in the box below, selected: copy it from there.`; };
  $('btn-note').addEventListener('click', () => { openNote(true); changed(); });
  $('btn-note-end').addEventListener('click', () => { openNote(true); changed(); });
  $('note-back').addEventListener('click', () => { openNote(false); changed(); });
  $('note-facts').addEventListener('change', () => { $('note-out').hidden = true; });
  $('note-copy').addEventListener('click', async () => {
    if (!noteReady()) return;
    const text = noteBody();
    try { await navigator.clipboard.writeText(text); $('note-out').hidden = true; $('note-msg').textContent = 'Copied. Paste it into a message to whoever sent you the link.'; }
    catch { noteByHand(text, 'Copying was blocked here.'); }
  });
  $('note-share').addEventListener('click', () => { if (noteReady()) $('note-msg').textContent = 'Handed over. Thank you.'; }); // the game opens the device's share sheet here

  // ---------------------------------------------------------------- shells: what is worn, on the scale and in the pause menu (main.js 541 to 548)
  function shellsChanged() {
    const SHELLS = G.shells;
    $('scale-shells').innerHTML = M.shells.map((s) => `<i style="left: calc(var(--tick) * ${s.seg - 0.5}); background: ${SHELLS[s.type].colour}"></i>`).join('');
    $('shell-list').innerHTML = M.shells.length
      ? [...M.shells].sort((a, b) => a.seg - b.seg).map((s) => { const d = SHELLS[s.type]; return `<li><i style="background: ${d.colour}"></i><b>${d.name}</b>, on segment ${s.seg}. ${d.worn} Shed with its segment, ${d.shed}</li>`; }).join('')
      : '<li>None yet. They lie glowing about each band; swim your head over one to take it.</li>';
  }

  // ---------------------------------------------------------------- the heads-up display (main.js 826 to 878)
  // messages: one card over the scale bar (main.js 783 to 789, 829 to 836). kind: 'teach', 'warn', 'shell' or 'note'
  let toastT = 0;
  function tell(text, hold = 4, o = {}) {
    const el = $('toast'), next = { text, hold, kind: 'note', ...o };
    $('hint').textContent = next.text; $('toast-title').textContent = next.title || ''; $('toast-kick').textContent = next.kick || ''; el.className = `on ${next.kind || 'note'}`;
    if (next.tone) el.style.setProperty('--tone', next.tone); else el.style.removeProperty('--tone');
    el.style.setProperty('--left', String(o.left ?? 1));
    clearTimeout(toastT); if (!window.KIT_HOLD) toastT = setTimeout(() => el.classList.remove('on'), hold * 1000);
  }
  function untell() { clearTimeout(toastT); $('toast').classList.remove('on'); }
  // the title card of a band (main.js 775, 337)
  let cardT = 0;
  function card(name, depth) { $('card-name').textContent = name; $('card-depth').textContent = depth; $('card').classList.add('on'); clearTimeout(cardT); if (!window.KIT_HOLD) cardT = setTimeout(() => $('card').classList.remove('on'), 3200); }
  function uncard() { clearTimeout(cardT); $('card').classList.remove('on'); }
  // the plate's lettering and its scale bar, which is the health bar (main.js 335 to 336, 840 to 846)
  function hud() {
    const F = G.floors[M.floor];
    $('zone').textContent = M.surface ? '' : F.name; $('zone-depth').textContent = M.surface ? '' : `${F.depth} m down`;
    const sc = $('scale');
    sc.style.setProperty('--segs', M.segs);
    sc.style.setProperty('--food', M.segs >= MAX_SEGS ? 0 : M.food);
    sc.style.setProperty('--toll', M.toll); sc.classList.toggle('tolled', M.toll > 0);
    sc.classList.toggle('low', M.segs <= MIN_SEGS + 2);
    $('len').textContent = `${bodyMetres(M.segs)} m`;
    $('btn-shed').disabled = M.segs - SHED_COST < MIN_SEGS;
    $('btn-skip').hidden = !M.tut;
  }
  // the marker to the rift (main.js 848 to 869). x, y: where it is, as parts of the stage; ang: which way the arrow points off the edge
  function goal(g) {
    const el = $('goal');
    if (!g) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.style.transform = `translate(${(g.x * stage.clientWidth).toFixed(1)}px, ${(g.y * stage.clientHeight).toFixed(1)}px)`;
    $('goal-arrow').style.transform = `rotate(${(g.here ? -90 : g.ang).toFixed(1)}deg)`;
    el.classList.toggle('here', !!g.here);
    $('goal-label').textContent = g.label;
  }
  // the key for the thing in front of you, hung over the thing itself (main.js 753 to 774)
  function prompt(p) {
    const el = $('prompt');
    if (!p) { el.classList.remove('on'); return; }
    el.innerHTML = `<div class="in">${p.keys.map((k) => (k === 'or' ? '<i>or</i>' : `<kbd>${k}</kbd>`)).join('')}<span>${p.verb}</span></div>`; el.classList.add('on');
    const w = stage.clientWidth, h = stage.clientHeight;
    el.style.transform = `translate(${clamp(p.x * w, 90, w - 90).toFixed(1)}px, ${clamp(p.y * h, 120, h - 170).toFixed(1)}px)`;
  }
  // stamina: a ring by the head, there only while it matters (main.js 870 to 877). left: 0 to 1
  function stamina(s) {
    const el = $('stamina');
    el.classList.toggle('on', !!s); el.classList.toggle('low', !!s && !!s.winded);
    if (!s) return;
    el.style.transform = `translate(${(s.x * stage.clientWidth + 20).toFixed(1)}px, ${(s.y * stage.clientHeight - 50).toFixed(1)}px)`;
    $('stamina-arc').style.strokeDashoffset = (100 * (1 - s.left)).toFixed(1);
  }
  function pulse(kind) { stage.classList.remove('hurt', 'grow'); if (!kind) return; void stage.offsetWidth; stage.classList.add(kind); } // main.js 776
  function fade(on, colour = '') { const el = $('fade'); if (on) el.style.background = colour; el.classList.toggle('on', on); } // main.js 635
  function shed() { // main.js 527 to 539, as far as the page shows it
    if (M.segs - SHED_COST < MIN_SEGS) { tell('Too short to shed your tail.', 3, { kind: 'warn' }); return; }
    M.segs -= SHED_COST; M.shells = M.shells.filter((s) => s.seg <= M.segs); shellsChanged(); hud();
  }

  // ---------------------------------------------------------------- the end of a dive (main.js 584 to 588, 664 to 668, 695 to 702)
  function endScreen(kind) {
    const R = M.run, F = G.floors[M.floor];
    M.ended = kind;
    const m = Math.floor(R.time / 60), sec = String(Math.floor(R.time % 60)).padStart(2, '0');
    const title = kind === 'won' ? 'The dive is over' : 'Taken by the deep';
    const line = kind === 'won' ? `It took ${m}:${sec}.` : `You reached ${F.name.replace(/^The /, 'the ')}, ${F.depth} metres down.`;
    const best = Math.max(R.best, kind === 'won' ? G.floors[G.floors.length - 1].depth : F.depth);
    $('end-title').textContent = title;
    $('end-text').textContent = `${line} Longest body ${bodyMetres(R.longest)} m. ${R.caught} caught.${R.hauled ? ` ${R.hauled} ${R.hauled === 1 ? 'fragment' : 'fragments'} of the ruins given to the rift (${R.fragments} in all).` : ''}`;
    $('end-best').textContent = `Deepest dive so far: ${best} m`;
    $('end').classList.add('on'); $('btn-again').focus({ preventScroll: true });
  }
  function unend() { M.ended = ''; $('end').classList.remove('on'); }

  // ---------------------------------------------------------------- testing tools, in the pause menu (main.js 1391 to 1402)
  const DEV_NOTE = 'For trying things out. A band starts fresh, at the length you have.';
  $('dev-bands').innerHTML = G.floors.map((f, i) => `<button type="button" data-band="${i}" title="${f.name}" aria-pressed="false">${i + 1}</button>`).join('');
  $('dev-bring').innerHTML = G.bring.map((n) => `<button type="button" data-bring="${n.id}"${n.id === 'squid' ? ' id="dev-squid"' : ''} aria-pressed="false">${n.name}</button>`).join('');
  function showDev(msg) { for (const b of $('dev-bands').children) b.setAttribute('aria-pressed', String(+b.dataset.band === M.floor)); for (const b of $('dev-bring').children) b.setAttribute('aria-pressed', String(!!M.bring[b.dataset.bring])); $('dev-keeper').disabled = !!M.keeperDone || M.floor === G.floors.length - 1; $('dev-grow').disabled = M.segs >= MAX_SEGS; $('dev-msg').textContent = msg || DEV_NOTE; }
  $('dev-bands').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b || M.ended) return; M.floor = +b.dataset.band; M.keeperDone = false; hud(); setPaused(false); card(G.floors[M.floor].name, `${G.floors[M.floor].depth} metres down`); changed(); });
  $('dev-grow').addEventListener('click', () => { M.segs = Math.min(MAX_SEGS, M.segs + 4); M.run.longest = Math.max(M.run.longest, M.segs); hud(); showDev(`${M.segs} segments now.`); });
  $('dev-unlock').addEventListener('click', () => showDev('Every kind of shell can be found, from the next dive on.'));
  $('dev-forget').addEventListener('click', () => showDev('The nest remembers nothing: no record, no shells, no fragments, nothing unlocked. It shows from the next dive.'));
  $('dev-bring').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; const id = b.dataset.bring, on = !M.bring[id], name = b.textContent.toLowerCase(), many = id === 'moonjelly'; M.bring[id] = on; b.setAttribute('aria-pressed', String(on));
    showDev(on ? (many ? `6 ${name === 'moon jelly' ? 'moon jellies' : `${name}s`} are in the water just ahead of you. They are only to look at.` : `A ${name} is in the water just ahead of you. It is only to look at.`) : many ? 'They are gone.' : `The ${name} is gone.`); });
  $('dev-keeper').addEventListener('click', () => { M.keeperDone = true; showDev(`The ${['keeper', 'shearer', 'lamplighter', 'warden'][M.floor] || 'keeper'} is beaten: the rift is open.`); });

  // ---------------------------------------------------------------- the feel, teaching, a lighter picture, the controller (main.js 1328 to 1333, 1403 to 1445)
  function padNote() {
    const P = M.pad;
    $('pad-note').textContent = !P ? 'No controller seen yet. To use one, click the page once, then press any button on it.'
      : `${padTitle()} is connected${P.motors !== false ? ', and can vibrate' : `, but the browser reports no vibration motors for it${!/dualsense|054c/i.test(P.name) ? '' : !M.hid ? ': Chrome and Edge can get round that' : ': press “Connect DualSense motors” below'}`}.`;
    $('btn-direct').hidden = !M.hid; $('btn-direct').textContent = M.direct ? 'DualSense motors: connected' : 'Connect DualSense motors';
  }
  function feel() {
    $('f-look').value = M.look; $('f-rumble').value = M.rumble; $('f-assist').value = M.assist;
    $('f-teach').checked = M.teach; $('f-light').checked = M.light;
  }
  $('f-look').addEventListener('input', (e) => { M.look = +e.target.value; });
  $('f-rumble').addEventListener('input', (e) => { M.rumble = +e.target.value; });
  $('f-assist').addEventListener('input', (e) => { M.assist = +e.target.value; });
  $('f-light').addEventListener('change', (e) => { M.light = e.target.checked; });
  function setTeach(on, quiet) {
    M.teach = on; $('f-teach').checked = on;
    if (!on && M.tut) { M.tut = false; if (!quiet) tell('No more teaching. The rift is where the marker points. You can turn it back on in the pause menu.', 7); }
    $('btn-skip').hidden = !M.tut; if (!M.tut) prompt(null);
  }
  $('f-teach').addEventListener('change', (e) => setTeach(e.target.checked));
  $('btn-skip').addEventListener('click', () => setTeach(false));
  $('btn-rumble').addEventListener('click', () => {
    const say = (t) => { $('rumble-msg').textContent = t; }, P = M.pad;
    if (!P) return say('No controller is connected. Press any button on it first.');
    const seen = `${padTitle()}: ${P.motors !== false ? 'motors (dual-rumble)' : 'no motors reported'}`;
    if (P.motors === false) return say(`${seen}. ${!/dualsense|054c/i.test(P.name) ? 'The browser gives this page no motors to drive for this controller.' : M.hid ? 'On Windows the browser has no motor code for a DualSense, whatever the cable. Press “Connect DualSense motors” and pick the controller from the browser’s list: the game then drives the motors itself.' : 'This browser has no motor code for a DualSense and cannot hand the controller to the page either. Chrome and Edge can: open the game in one of them and press “Connect DualSense motors”.'}`);
    if (M.rumble <= 0) return say('Vibration is turned all the way down.');
    say(`${seen}. The browser played all three. If your hands felt nothing, the command is being dropped between the browser and the controller: try a USB cable in place of Bluetooth, and close Steam if it is running.`);
  });
  $('btn-direct').addEventListener('click', () => { $('rumble-msg').textContent = 'No controller was picked. In the browser’s list choose the one called DualSense or Wireless Controller, then press Connect.'; }); // the game asks the browser for the controller here (WebHID)

  // ---------------------------------------------------------------- the model tools of the full view (main.js 1446 to 1453)
  for (const id of ['show-wire', 'show-bones']) $(id).addEventListener('click', (e) => { const b = e.currentTarget; b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); });

  // ---------------------------------------------------------------- the Tuning drawer (main.js 818 to 825, 1455 to 1521)
  const zoneName = (i) => G.floors[i].name.replace(/^The /, 'the ').replace(/,.*/, '');
  const preset = (floor) => ({ ...SHIPPED_MUSIC, ...M.music.all, ...(M.music.zones[floor] || {}) });
  function showPreset() { // put the sliders on whatever applies at this depth
    const p = preset(M.floor), own = !!M.music.zones[M.floor];
    for (const k of MUSIC_KEYS) $(`m-${k}`).value = p[k];
    $('m-volume').value = M.music.volume;
    $('scope-all').setAttribute('aria-pressed', String(!own)); $('scope-zone').setAttribute('aria-pressed', String(own));
    $('scope-note').textContent = own ? `These sliders are set for ${zoneName(M.floor)} only.` : 'These sliders are set for every depth without its own setting.';
    const mute = $('music-mute'); mute.setAttribute('aria-pressed', String(!M.music.muted)); mute.textContent = M.music.muted ? 'Sound off' : 'Sound on';
  }
  const presetCode = () => { const p = preset(M.floor); return `oarfish-music:1:${MUSIC_KEYS.map((k) => `${k}=${Math.round(p[k])}`).join(',')}${M.music.zones[M.floor] ? `,zone=${M.floor + 1}` : ''}`; };
  function applyCode(text) { // returns a sentence saying what happened
    const m = /oarfish-music:1:([a-z0-9=,]+)/i.exec(text || '');
    if (!m) return 'That is not a preset code. A code starts with oarfish-music:1:';
    const got = {}; let zone = null;
    for (const part of m[1].split(',')) { const [k, v] = part.split('='), n = Number(v); if (!Number.isFinite(n)) continue; if (k === 'zone' && n >= 1 && n <= G.floors.length) zone = Math.round(n) - 1; else if (MUSIC_KEYS.includes(k)) got[k] = clamp(Math.round(n), 0, 100); }
    if (!Object.keys(got).length) return 'That code has no settings in it.';
    if (zone === null) Object.assign(M.music.all, got); else M.music.zones[zone] = { ...preset(zone), ...got };
    showPreset();
    if (zone !== null) return `Applied to ${zoneName(zone)} only.`;
    return M.music.zones[M.floor] ? `Applied to every depth. ${zoneName(M.floor)[0].toUpperCase()}${zoneName(M.floor).slice(1)} keeps its own setting.` : 'Applied to every depth.';
  }
  function nowPlaying() { // what the band is playing, for whoever is tuning it. The line and the level are a sample taken from the game
    $('music-now').textContent = M.music.muted ? 'Sound is off.' : M.music.started && G.now ? G.now.text : 'Press any key or click to start the sound.';
    $('energy-live').style.width = `${M.music.started && G.now ? G.now.energy : preset(M.floor).energy}%`;
  }
  $('music-tab').addEventListener('click', () => { openDrawer(!$('drawer').classList.contains('open')); changed(); });
  for (const k of MUSIC_KEYS) $(`m-${k}`).addEventListener('input', (e) => { (M.music.zones[M.floor] || M.music.all)[k] = +e.target.value; });
  $('m-volume').addEventListener('input', (e) => { M.music.volume = +e.target.value; });
  $('scope-all').addEventListener('click', () => { delete M.music.zones[M.floor]; showPreset(); });
  $('scope-zone').addEventListener('click', () => { M.music.zones[M.floor] ||= preset(M.floor); showPreset(); });
  $('preset-copy').addEventListener('click', async () => {
    const code = presetCode(), msg = (t) => { $('preset-msg').textContent = t; };
    try { await navigator.clipboard.writeText(code); msg(`Copied: ${code}`); }
    catch { $('preset-in').value = code; $('preset-in').select(); msg('Copying was blocked here. The code is in the box below, selected: copy it from there.'); }
  });
  $('preset-apply').addEventListener('click', () => { $('preset-msg').textContent = applyCode($('preset-in').value); });
  $('preset-in').addEventListener('keydown', (e) => { if (e.code === 'Enter') { $('preset-msg').textContent = applyCode($('preset-in').value); e.target.blur(); } });
  $('music-mute').addEventListener('click', () => { M.music.muted = !M.music.muted; showPreset(); nowPlaying(); });

  // ---------------------------------------------------------------- the specimen library (library.js 141 to 208; main.js 1962 to 1965)
  // The game turns a model on this stage. Here the stage is a still, so the picture stays the same whichever specimen is picked.
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const words = (k) => k.replace(/([a-z])([A-Z0-9])/g, '$1 $2').toLowerCase();
  const L = () => M.lib, spec = (id = M.lib.id) => G.specimens[id];
  const mine = (id = M.lib.id) => M.lib.tweaks[id];
  const tweaked = () => Object.keys(M.lib.tweaks);
  function libList() {
    let html = '';
    for (const g of G.groups) { html += `<h3>${esc(g.group)}</h3>`; for (const id of g.ids) html += `<button type="button" data-id="${id}" aria-pressed="${id === L().id}">${esc(spec(id).name)}${mine(id) ? '<i title="Changed in this browser"></i>' : ''}</button>`; }
    $('lib-list').innerHTML = html;
  }
  function libPanel(all = true) {
    const S = L(), sp = spec(), my = mine();
    const seg = (name, items, cur) => `<div class="seg" data-set="${name}">${items.map(([val, label, title, mark]) => `<button type="button" data-v="${val}" aria-pressed="${String(val) === String(cur)}"${title ? ` title="${esc(title)}"` : ''}${mark ? ' class="home"' : ''}>${esc(label)}</button>`).join('')}</div>`;
    if (all) {
      $('lib-name').textContent = sp.name; $('lib-role').textContent = sp.role; $('lib-about').textContent = sp.about;
      $('lib-where').textContent = sp.where; $('lib-tris').textContent = sp.tris;
      { const hear = $('lib-hear'); hear.hidden = !sp.hear; hear.textContent = sp.hear; }
      $('lib-play').innerHTML = `<label>Light of</label>${seg('band', G.bands.map((b, i) => [i, i + 1, b, sp.home.includes(i)]), S.band)}`
        + (sp.states.length > 1 ? `<label>State</label>${seg('state', sp.states.map((s, i) => [i, s]), S.state)}` : '')
        + (sp.tiers ? `<label>Swarm</label>${seg('tier', sp.tiers, S.tier)}` : '')
        + (sp.tones > 1 ? `<label>Tint</label>${seg('tone', Array.from({ length: sp.tones }, (_, i) => [i, i + 1]), S.tone % sp.tones)}` : '')
        + (sp.speed !== null ? `<label for="lib-speed">Speed</label><div class="slide"><input type="range" id="lib-speed" min="0" max="10" step="0.1" value="${S.speed ?? sp.speed}"><output>${(S.speed ?? sp.speed).toFixed(1)} m/s</output></div>` : '')
        + `<label>Show</label><div class="seg many" data-set="show">${[['turn', 'Turning'], ['wire', 'Wireframe'], ['fish', 'Oarfish for scale']].map(([k, l]) => `<button type="button" data-v="${k}" aria-pressed="${!!S[k]}">${l}</button>`).join('')}</div>`;
    }
    const scale = my?.scale ?? sp.scale;
    $('lib-palette').innerHTML = sp.palette.map(([k, val]) => { const v = my?.palette?.[k] ?? val; return `<label class="sw${my?.palette?.[k] ? ' mine' : ''}"><input type="color" data-k="${k}" value="${v}"><span>${esc(words(k))}</span><code>${v}</code></label>`; }).join('')
      + (sp.scale === null ? '' : `<label class="sw size${my?.scale !== undefined ? ' mine' : ''}"><input type="range" data-k="scale" min="0.6" max="1.6" step="0.02" value="${scale}"><span>size</span><code>×${scale.toFixed(2)}</code></label>`)
      || '<p class="none">No colours of its own.</p>';
    libNotes();
  }
  function libNotes() {
    $('lib-reset').disabled = !mine();
    const n = tweaked().length;
    $('lib-copy').disabled = !n; $('lib-all').disabled = !n;
    $('lib-note').textContent = n ? `${n === 1 ? 'One component is' : `${n} components are`} changed in this browser. The game uses them from the next band or dive. To make them the game’s own for everyone, copy them and paste them to Claude.` : 'Colours and size can be tried here. They are kept in this browser and used by the game too.';
  }
  const libText = () => { const ids = tweaked(); return ids.length ? `Oarfish NPC changes, to write into npc.js:\n${ids.map((id) => { const o = M.lib.tweaks[id]; return `${id}: ${[...Object.entries(o.palette || {}).map(([k, v]) => `${k} ${v}`), ...(o.scale !== undefined ? [`scale ${o.scale}`] : [])].join(', ')}`; }).join('\n')}` : ''; }; // npc.js 201
  function libPick(id) { if (!spec(id)) return; const S = L(), sp = spec(id); $('lib-text').hidden = true; S.id = id; S.state = sp.state; S.tone = 0; S.speed = null; if (sp.home.length && !sp.home.includes(S.band)) S.band = sp.home[0]; libList(); libPanel(); }
  function openLibrary(id) { if (!M.paused && !M.ended) setPaused(true); stage.classList.add('lib'); M.lib.open = true; $('library').hidden = false; libPick(spec(id) ? id : M.lib.id); $('lib-close').focus({ preventScroll: true }); }
  function closeLibrary() { if (!M.lib.open) return; M.lib.open = false; $('library').hidden = true; stage.classList.remove('lib'); if (tweaked().length) $('pause-msg').textContent = 'The oarfish and the shells have changed already. Everything else shows from the next band or dive.'; $('btn-library').focus({ preventScroll: true }); }
  $('library').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const S = L();
    if (b.dataset.id) return libPick(b.dataset.id);
    const set = b.parentElement?.dataset.set;
    if (set === 'band') { S.band = +b.dataset.v; libPanel(); }
    else if (set === 'state') { S.state = +b.dataset.v; S.speed = null; libPanel(); }
    else if (set === 'tier') { S.tier = b.dataset.v; libPanel(); }
    else if (set === 'tone') { S.tone = +b.dataset.v; libPanel(); }
    else if (set === 'show') { S[b.dataset.v] = !S[b.dataset.v]; libPanel(); }
    else if (b.id === 'lib-close') { closeLibrary(); changed(); }
    else if (b.id === 'lib-reset') { delete S.tweaks[S.id]; libList(); libPanel(); }
    else if (b.id === 'lib-all') { S.tweaks = {}; libList(); libPanel(); }
    else if (b.id === 'lib-copy') { const text = libText(), box = $('lib-text'); box.value = text; box.hidden = false; box.select();
      const done = (ok) => { $('lib-note').textContent = ok ? 'Copied. Paste it to Claude and the game itself will be changed.' : 'Select the text in the box and copy it, then paste it to Claude.'; };
      try { navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); } catch { done(false); } }
  });
  $('library').addEventListener('input', (e) => {
    const t = e.target, S = L();
    if (t.id === 'lib-speed') { S.speed = +t.value; t.nextElementSibling.textContent = `${S.speed.toFixed(1)} m/s`; return; }
    if (!t.dataset.k) return;
    const tw = S.tweaks[S.id] ||= {};
    if (t.dataset.k === 'scale') tw.scale = +t.value; else (tw.palette ||= {})[t.dataset.k] = t.value;
    t.parentElement.querySelector('code').textContent = t.dataset.k === 'scale' ? `×${(+t.value).toFixed(2)}` : t.value; t.parentElement.classList.add('mine');
    libList(); libNotes();
  });
  $('btn-library').addEventListener('click', () => { openLibrary(); changed(); });

  // ---------------------------------------------------------------- the buttons that open and close things (main.js 1378 to 1390)
  $('btn-shed').addEventListener('click', shed);
  $('btn-again').addEventListener('click', () => { startRun(); changed(); });
  $('btn-pause').addEventListener('click', () => { setPaused(!M.paused); changed(); });
  $('btn-resume').addEventListener('click', () => { setPaused(false); changed(); });
  for (const id of ['btn-fs', 'btn-full']) $(id).addEventListener('click', fullscreen);
  $('btn-new').addEventListener('click', () => { if (!$('btn-new').dataset.armed) return newDive(true); setPaused(false); startRun(); changed(); });
  $('mode-point').addEventListener('click', () => setMode('point'));
  $('mode-look').addEventListener('click', () => setMode('look'));
  $('btn-keys').addEventListener('click', () => setFull(!M.full, true));
  function startRun() { // a new dive, as far as the page shows it: the end card goes, the band's title card and the first lesson come (main.js 337 to 342, 349 to 361)
    unend(); M.surface = false; M.floor = 0; M.segs = START_SEGS; M.food = 0; M.toll = 0; M.shells = []; shellsChanged(); hud();
    card(G.floors[0].name, `${G.floors[0].depth} metres down`);
    tell(`${M.dev === 'pad' ? `Hold ${pb('wrap')} beside a small swarm to wrap round it.` : M.touch ? 'Hold a finger on a small swarm, or draw a circle round it.' : M.mode === 'look' ? `Hold ${kb('wrapL')} or ${kb('wrapR')}, or the left mouse button, beside a small swarm to wrap round it.` : `Hold ${kb('wrapL')} or ${kb('wrapR')} beside a small swarm to wrap round it.`} Go most of the way round and it is yours, whole.`, 9, { kind: 'teach' });
  }
  // the keys that work the menus in the game work them here (main.js 1232 to 1263)
  const typing = (e) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target?.tagName);
  window.addEventListener('keydown', (e) => {
    if (M.lib.open) { if (e.code === 'Escape') { e.preventDefault(); closeLibrary(); changed(); } return; }
    if (M.note.open) { if (e.code === 'Escape') { e.preventDefault(); openNote(false); changed(); } return; }
    if (e.metaKey || e.ctrlKey || e.altKey || (typing(e) && e.target.type !== 'range' && e.target.type !== 'checkbox')) return;
    if (M.ended && (e.code === 'Enter' || e.code === 'KeyR')) { startRun(); return changed(); }
    const act = ACTIONS.map(([a]) => a).find((a) => M.binds.keys[a].includes(e.code));
    if (act === 'pause' || e.code === 'Escape') { if (e.repeat || M.ended) return; e.preventDefault(); setPaused(!M.paused); return changed(); }
    if (!e.repeat && act === 'full') { e.preventDefault(); return fullscreen(); }
    if (!e.repeat && act === 'hide') return setFull(!M.full);
    if (!e.repeat && act === 'view' && !M.touch) return setMode(M.mode === 'look' ? 'point' : 'look');
    if (!M.paused && !e.repeat && act === 'shed') shed();
  });

  // ---------------------------------------------------------------- everything put on the page at once, for the kit
  let changed = () => {};
  function show() {
    stage.className = ''; stage.dataset.mode = M.mode; stage.dataset.dev = M.dev;
    stage.classList.toggle('full', M.full); stage.classList.toggle('paused', M.paused);
    $('pause').className = M.paused ? 'on' : ''; $('pause').scrollTop = 0;
    $('btn-pause').setAttribute('aria-pressed', String(M.paused)); $('btn-pause').setAttribute('aria-label', M.paused ? 'Resume' : 'Pause');
    for (const id of ['btn-fs', 'btn-full']) $(id).setAttribute('aria-pressed', String(M.fs));
    $('btn-full').textContent = M.fs ? 'Leave full screen' : 'Full screen';
    $('btn-keys').textContent = M.full ? 'Hide keys and tools on screen' : 'Show keys and tools on screen';
    $('pause-msg').textContent = ''; $('rumble-msg').textContent = ''; $('bind-msg').textContent = ''; $('note-msg').textContent = ''; $('note-text').value = ''; $('note-out').hidden = true; $('note-facts').checked = true;
    $('preset-msg').textContent = 'A preset is the six sliders above as a line of text. Volume is not part of it.'; $('preset-in').value = ''; $('bind-name').value = '';
    $('end').classList.remove('on'); $('library').hidden = true; $('lib-text').hidden = true; $('error').style.display = ''; $('drawer').classList.remove('open'); $('music-tab').setAttribute('aria-expanded', 'false');
    for (const id of ['show-wire', 'show-bones']) $(id).setAttribute('aria-pressed', 'false');
    M.note.open = false; M.lib.open = false; M.wait = null;
    newDive(false); untell(); uncard(); prompt(null); stamina(null); pulse(''); fade(false);
    hud(); shellsChanged(); renderLegend(); showMode(); showDev(); feel(); padNote(); showPreset(); nowPlaying(); showBinds('');
    if (M.paused) $('btn-resume').focus({ preventScroll: true }); else document.activeElement?.blur?.(); // the game puts the keyboard on Resume when it pauses (main.js 1070), and it shows
  }
  window.MENUS = {
    get M() { return M; }, reset() { M = fresh(); return M; }, show, onChange(fn) { changed = fn; },
    setDev, setMode, setPaused, setFull, fullscreen, newDive, openDrawer, openBinds, showBinds, openNote, noteByHand, noteBody, shellsChanged, hud, goal, prompt, stamina, pulse, fade, tell, untell, card, uncard,
    endScreen, unend, showDev, padNote, setTeach, showPreset, nowPlaying, openLibrary, closeLibrary, libPick, libPanel, libList, libNotes, libText, startRun, riftToll, kb, pb, padTitle,
  };
})();
