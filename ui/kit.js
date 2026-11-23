// The kit's own script: which screens and states there are, how each is put on the page, and the switcher bar. None of this is the
// game's and none of it goes back into the game. The menus themselves are index.html, menus.css and menus.js.
//
// One page, two ways of opening it.
//   index.html?bare&screen=pause&state=controller&bg=keeper     the stage alone, filling the window: for pictures, and for links
//   index.html?screen=pause&state=controller&bg=keeper&size=1440x900     the same stage in a frame of a chosen size, under a bar
// The bar is the same page, loaded a second time as `?bare` in a frame, so that the width the menus feel is the width chosen
// and the game's own rules for narrow screens apply as they do in the game.
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search), U = window.MENUS, G = window.GAME, STILLS = window.STILLS || {};
  const $ = (id) => document.getElementById(id);

  // ------------------------------------------------------------------------------------------------ the screens and their states
  // id and name are what the pictures, the inventory in README.md and the frames in Figma are called by. bg is the still a state
  // stands over unless the address says otherwise. A state is put up in two steps over a quiet dive at that still: set() changes what
  // the game would know (M, in menus.js), and then() opens or says what comes on top. T is what was read off the game at the
  // moment the still was taken (bg/stills.js): the band, the body's length, where the marker and the fish are on the screen.
  const pad = () => ({ name: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)', kind: 'ps', motors: true });
  const loop = (M) => `${M.dev === 'pad' ? `Hold ${U.pb('wrap')} beside a small swarm to wrap round it.` : M.touch ? 'Hold a finger on a small swarm, or draw a circle round it.' : `Hold ${U.kb('wrapL')} or ${U.kb('wrapR')} beside a small swarm to wrap round it.`} Go most of the way round and it is yours, whole.`;
  const SCREENS = [
    { id: 'hud', name: 'Heads-up display', states: [
      { id: 'opening', name: 'A dive opens: the band’s title card and the first lesson', bg: 'start', then: ({ M, F }) => { U.card(F.name, `${F.depth} metres down`); U.tell(loop(M), 9, { kind: 'teach' }); } },
      { id: 'nursery', name: 'A first dive: the nursery, with Skip tutorial and a key prompt', bg: 'nursery', set: ({ M }) => { M.tut = true; }, then: ({ T }) => U.prompt(T.prompt || { keys: ['W', 'A', 'S', 'D'], verb: 'swim', x: T.head.x, y: T.head.y - 0.05 }) },
      { id: 'plain', name: 'The plain view, nothing happening', bg: 'ruins' },
      { id: 'toast-teach', name: 'A message: a lesson', bg: 'swarm', then: () => U.tell('That swarm is too big to wrap yet. Its ring turns pale when your body is long enough.', 8, { kind: 'teach', left: 0.7 }) },
      { id: 'toast-warn', name: 'A message: a warning, with a title', bg: 'keeper', then: () => U.tell('It took that bite for you.', 4, { kind: 'warn', title: 'The Cap broke', left: 0.8 }) },
      { id: 'toast-shell', name: 'A message: a shell taken', bg: 'ruins', set: ({ M }) => { M.shells = [{ type: 'spire', seg: 12 }]; }, then: () => { const d = G.shells.spire; U.tell(`${d.worn}\nShed the segment it rides on, and ${d.shed}`, 10, { kind: 'shell', kick: 'A shell', title: d.name, tone: d.colour, left: 0.9 }); } },
      { id: 'toast-note', name: 'A message: a note', bg: 'ruins', then: () => U.tell('Point and swim: drag to look around, hold both mouse buttons to swim where you look.', 5, { left: 0.6 }) },
      { id: 'hunted', name: 'Hunted: the stamina ring and a key prompt', bg: 'deep', then: ({ T }) => { U.stamina({ x: T.head.x, y: T.head.y, left: 0.45 }); U.prompt({ keys: [U.kb('shed')], verb: 'shed your tail', x: T.tail.x, y: T.tail.y - 0.06 }); U.tell('Sprinting only tires you while something hunts you. The ring by your head is what you have left.', 7, { kind: 'teach', left: 0.5 }); } },
      { id: 'low', name: 'Nearly too short: the scale bar in alarm', bg: 'end', then: ({ T }) => { U.stamina({ x: T.head.x, y: T.head.y, left: 0.12, winded: true }); U.tell('You are nearly too short to survive another bite. Feed.', 7, { kind: 'warn', left: 0.85 }); } },
      { id: 'rift-toll', name: 'Over an open rift: the toll marked on the scale bar', bg: 'keeper', set: ({ M }) => { M.toll = U.riftToll(M.segs); }, then: () => U.tell('A rift takes part of your tail as you go down it. The dark end of your scale is what this one will take.', 9, { kind: 'teach', left: 0.75 }) },
      { id: 'shells', name: 'Shells riding on the scale bar, food on the way', bg: 'swarm', set: ({ M }) => { M.shells = [{ type: 'lamp', seg: 15 }, { type: 'horn', seg: 18 }, { type: 'spire', seg: 21 }]; M.food = 0.6; } },
      { id: 'flash-hurt', name: 'Bitten: the flash round the edge', bg: 'end', freeze: true, then: () => U.pulse('hurt') },
      { id: 'flash-grow', name: 'Grown: the flash round the edge', bg: 'swarm', freeze: true, then: () => U.pulse('grow') },
      { id: 'full', name: 'The full view: keys and tools on screen', bg: 'ruins', set: ({ M }) => { M.full = true; } },
      { id: 'full-look', name: 'The full view, adventure camera', bg: 'ruins', set: ({ M }) => { M.full = true; M.mode = 'look'; } },
      { id: 'controller', name: 'The full view, a controller in hand', bg: 'ruins', set: ({ M }) => { M.full = true; M.pad = pad(); M.dev = 'pad'; }, then: () => U.tell(`${U.padTitle()} found. Hold ${U.pb('wrap')} beside a small swarm to wrap round it.`, 6, { left: 0.8 }) },
      { id: 'touch', name: 'A touch screen: the four buttons at the right', bg: 'ruins', touch: true, set: ({ M }) => { M.full = true; } },
    ] },
    { id: 'drawer', name: 'Tuning drawer', states: [
      { id: 'default', name: 'The band playing, sliders for all depths', bg: 'swarm', set: ({ M }) => { M.full = true; M.music.started = true; }, then: () => U.openDrawer(true) },
      { id: 'this-depth', name: 'Sliders set for this depth only', bg: 'keeper', set: ({ M }) => { M.full = true; M.music.started = true; M.music.zones[M.floor] = { dream: 72, energy: 40, menace: 65, react: 70, swing: 60, band: 35 }; }, then: () => U.openDrawer(true) },
      { id: 'muted', name: 'Sound off', bg: 'swarm', set: ({ M }) => { M.full = true; M.music.started = true; M.music.muted = true; }, then: () => U.openDrawer(true) },
      { id: 'silent', name: 'Sound not started (seldom seen: the click that opens the drawer starts it)', bg: 'swarm', set: ({ M }) => { M.full = true; }, then: () => U.openDrawer(true) },
    ] },
    { id: 'pause', name: 'Pause menu', states: [
      { id: 'default', name: 'Keyboard and mouse, plain view', bg: 'ruins', set: ({ M }) => { M.paused = true; } },
      { id: 'lower', name: 'The same, scrolled to the end', bg: 'ruins', scroll: 'end', set: ({ M }) => { M.paused = true; } },
      { id: 'controller', name: 'A controller connected (scrolled to the end, where it shows)', bg: 'ruins', scroll: 'end', set: ({ M }) => { M.paused = true; M.pad = pad(); M.dev = 'pad'; } },
      { id: 'shells', name: 'Three shells worn', bg: 'swarm', set: ({ M }) => { M.paused = true; M.shells = [{ type: 'lamp', seg: 15 }, { type: 'horn', seg: 18 }, { type: 'spire', seg: 21 }]; } },
      { id: 'look', name: 'Adventure camera chosen', bg: 'ruins', set: ({ M }) => { M.paused = true; M.mode = 'look'; } },
      { id: 'armed', name: 'New dive pressed once', bg: 'ruins', set: ({ M }) => { M.paused = true; }, then: () => U.newDive(true) },
      { id: 'full', name: 'With keys and tools on screen', bg: 'ruins', set: ({ M }) => { M.paused = true; M.full = true; } },
      { id: 'tuning', name: 'With the Tuning drawer open over it', bg: 'keeper', set: ({ M }) => { M.paused = true; M.music.started = true; }, then: () => U.openDrawer(true) },
      { id: 'touch', name: 'On a touch screen', bg: 'ruins', touch: true, set: ({ M }) => { M.paused = true; } },
    ] },
    { id: 'binds', name: 'Key bindings', states: [
      { id: 'default', name: 'The defaults', bg: 'swarm', set: ({ M }) => { M.paused = true; }, then: () => U.openBinds(true) },
      { id: 'waiting', name: 'A slot waiting for a key', bg: 'swarm', set: ({ M }) => { M.paused = true; }, then: ({ M }) => { U.openBinds(true); M.wait = { a: 'wrap', k: 0 }; U.showBinds('Press the key for it.'); } },
      { id: 'saved', name: 'A saved set in use', bg: 'swarm', set: ({ M }) => { M.paused = true; M.binds.keys.wrap = ['KeyR']; M.binds.keys.shed = ['KeyG']; M.presets = { 'Left hand': JSON.parse(JSON.stringify(M.binds)) }; }, then: () => { U.openBinds(true); U.showBinds('Using “Left hand”.'); } },
    ] },
    { id: 'feedback', name: 'Leave feedback', states: [
      { id: 'empty', name: 'Opened from the pause menu', bg: 'deep', set: ({ M }) => { M.paused = true; }, then: () => U.openNote(true, false) },
      { id: 'copied', name: 'A note written and copied', bg: 'deep', set: ({ M }) => { M.paused = true; }, then: () => { U.openNote(true, false); $('note-text').value = 'I liked how the swarm streams into the mouth. I got stuck at the crab: I could not tell when it was safe to go for a leg.'; $('note-msg').textContent = 'Copied. Paste it into a message to whoever sent you the link.'; } },
      { id: 'by-hand', name: 'Copying blocked: the note shown to copy by hand', bg: 'deep', set: ({ M }) => { M.paused = true; }, then: () => { U.openNote(true, false); $('note-text').value = 'I liked how the swarm streams into the mouth.'; U.noteByHand(U.noteBody(), 'Copying was blocked here.'); getSelection()?.removeAllRanges(); $('note-out').setSelectionRange(0, 0); $('note-out').blur(); } },
      { id: 'share', name: 'Where the device can share: a third button', bg: 'deep', set: ({ M }) => { M.paused = true; }, then: () => U.openNote(true, true) },
      { id: 'from-end', name: 'Opened from the end of a dive', bg: 'end', set: ({ M }) => { Object.assign(M.run, { longest: 14, caught: 23, best: 450 }); }, then: () => { U.endScreen('dead'); U.openNote(true, false); } },
    ] },
    { id: 'end', name: 'End of a dive', states: [
      { id: 'taken', name: 'Taken by the deep', bg: 'end', set: ({ M }) => { Object.assign(M.run, { longest: 14, caught: 23, best: 450 }); }, then: () => U.endScreen('dead') },
      { id: 'over', name: 'The dive is over', bg: 'surface', set: ({ M }) => { Object.assign(M.run, { time: 2467, longest: 26, caught: 96, hauled: 3, fragments: 7, best: 1000 }); }, then: () => U.endScreen('won') },
    ] },
    { id: 'library', name: 'Specimen library', states: [
      { id: 'default', name: 'The Keeper on the stand', bg: 'library', set: ({ M }) => { M.paused = true; }, then: () => U.openLibrary('keeper') },
      { id: 'changed', name: 'A colour and the size changed, and the changes copied out', bg: 'library', set: ({ M }) => { M.paused = true; M.lib.tweaks = { keeper: { palette: { tone: '#f2b8a0' }, scale: 1.12 } }; }, then: () => { U.openLibrary('keeper'); $('lib-text').value = U.libText(); $('lib-text').hidden = false; $('lib-note').textContent = 'Copied. Paste it to Claude and the game itself will be changed.'; } },
    ] },
    { id: 'error', name: 'The dive could not start', states: [
      { id: 'default', name: 'No WebGL, or the 3D library did not load', bg: 'none', then: () => { $('error').style.display = 'grid'; } },
    ] },
  ];
  const BGS = ['start', 'nursery', 'ruins', 'swarm', 'keeper', 'deep', 'end', 'surface', 'library', 'none'];
  const SIZES = { '1920x1080': [1920, 1080], '1440x900': [1440, 900], '1280x720': [1280, 720], phone: [390, 844], 'phone-wide': [844, 390], window: null };
  const find = (screen, state) => { const sc = SCREENS.find((s) => s.id === screen) || SCREENS.find((s) => s.id === 'pause'); return [sc, sc.states.find((s) => s.id === state) || sc.states[0]]; };
  window.KIT = { SCREENS, BGS, SIZES };

  // ------------------------------------------------------------------------------------------------ the stage alone (?bare)
  function bare() {
    const html = document.documentElement; html.classList.add('kit-bare');
    const [sc, st] = find(Q.get('screen'), Q.get('state'));
    const bg = BGS.includes(Q.get('bg')) ? Q.get('bg') : st.bg, T = STILLS[bg] || STILLS.ruins || { floor: 0, segs: 10, food: 0, goal: null, head: { x: 0.5, y: 0.5 }, tail: { x: 0.45, y: 0.55 } };
    const touch = Q.has('touch') ? Q.get('touch') === '1' : !!st.touch || matchMedia('(hover: none), (pointer: coarse)').matches;
    const hold = Q.get('hold') === '1'; // for pictures: nothing fades, throbs or times out
    html.classList.toggle('kit-touch', touch); html.classList.toggle('kit-hold', hold || !!st.freeze);
    $('still').style.backgroundImage = bg === 'none' ? 'none' : `url(bg/${bg}.png)`;
    const M = U.reset(); M.touch = touch;
    Object.assign(M, { floor: T.floor ?? 0, segs: T.segs ?? 10, food: T.food ?? 0, surface: !!T.surface });
    const ctx = { M, T, F: G.floors[M.floor] };
    window.KIT_HOLD = true;            // while a state is being put up nothing arms a timer, so what it shows stays
    if (st.set) st.set(ctx);           // first what the game would know in this state,
    U.show();                          // then everything the game writes on the page from that,
    U.goal(sc.id === 'error' || M.surface ? null : T.goal);
    if (st.then) st.then(ctx);         // then what is opened or said on top of it
    if (st.scroll === 'end') $('pause').scrollTop = 1e6;
    window.KIT_HOLD = hold;
    document.title = `${sc.name} · ${st.name}`;
    // tell the bar, if there is one round this frame, what has been opened or closed by hand, and hand it the key that hides it
    const where = () => { const m = U.M; return m.lib.open ? 'library' : m.note.open ? 'feedback' : $('pause').classList.contains('binding') ? 'binds' : m.ended ? 'end' : m.paused ? 'pause' : $('drawer').classList.contains('open') ? 'drawer' : 'hud'; };
    U.onChange(() => { try { parent.postMessage({ kit: 'at', screen: where() }, '*'); } catch { /* alone */ } });
    window.addEventListener('keydown', (e) => { if (e.code === 'Backquote' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) && !U.M.wait) { try { parent.postMessage({ kit: 'bar' }, '*'); } catch { /* alone */ } } });
    window.addEventListener('resize', () => U.goal(sc.id === 'error' || U.M.surface ? null : T.goal));
    window.__kitReady = true;
  }

  // ------------------------------------------------------------------------------------------------ the bar, and the frame under it
  function shell() {
    const html = document.documentElement; html.classList.add('kit-shell');
    let [sc, st] = find(Q.get('screen'), Q.get('state'));
    const S = { screen: sc.id, state: st.id, bg: BGS.includes(Q.get('bg')) ? Q.get('bg') : '', size: SIZES[Q.get('size')] !== undefined ? Q.get('size') : '1920x1080', touch: Q.get('touch') || '' };
    const opt = (v, t, cur) => `<option value="${v}"${v === cur ? ' selected' : ''}>${t}</option>`;
    const bar = document.createElement('div'); bar.id = 'kit-bar';
    const desk = document.createElement('div'); desk.id = 'kit-desk';
    const frame = document.createElement('iframe'); frame.id = 'kit-frame'; frame.title = 'The menus'; desk.appendChild(frame);
    document.body.append(bar, desk);
    const address = (bareToo) => { const q = new URLSearchParams(); if (bareToo) q.set('bare', ''); q.set('screen', S.screen); q.set('state', S.state); if (S.bg) q.set('bg', S.bg); if (!bareToo) q.set('size', S.size); const t = S.touch || (S.size.startsWith('phone') ? '1' : ''); if (t) q.set('touch', t); return `${location.pathname}?${q.toString().replace('bare=&', 'bare&')}`; };
    function fit() {
      const size = SIZES[S.size], W = desk.clientWidth, H = desk.clientHeight;
      if (!size) { Object.assign(frame.style, { width: `${W}px`, height: `${H}px`, transform: 'none' }); $('kit-scale').textContent = `${W} × ${H}`; return; }
      const k = Math.min(1, (W - 24) / size[0], (H - 24) / size[1]);
      Object.assign(frame.style, { width: `${size[0]}px`, height: `${size[1]}px`, transform: `scale(${k})` });
      $('kit-scale').textContent = `${size[0]} × ${size[1]}${k < 1 ? `, shown at ${Math.round(k * 100)}%` : ''}`;
    }
    function draw(load = true) {
      [sc, st] = find(S.screen, S.state); S.screen = sc.id; S.state = st.id;
      bar.innerHTML = `<b>KIT</b><span>not part of the design</span>
        <label>Screen <select id="kit-screen">${SCREENS.map((s) => opt(s.id, s.name, S.screen)).join('')}</select></label>
        <label>State <select id="kit-state">${sc.states.map((s) => opt(s.id, s.name, S.state)).join('')}</select></label>
        <label>Still <select id="kit-bg">${opt('', `as the state has it (${st.bg})`, S.bg)}${BGS.map((b) => opt(b, b, S.bg)).join('')}</select></label>
        <label>Size <select id="kit-size">${Object.keys(SIZES).map((k) => opt(k, k === 'window' ? 'this window' : k === 'phone' ? 'phone, 390 × 844' : k === 'phone-wide' ? 'phone on its side, 844 × 390' : k.replace('x', ' × '), S.size)).join('')}</select></label>
        <label>Touch <select id="kit-touch">${opt('', 'as the size and state have it', S.touch)}${opt('1', 'yes', S.touch)}${opt('0', 'no', S.touch)}</select></label>
        <i id="kit-scale"></i><a id="kit-open" href="${address(true)}" target="_blank" rel="noopener">open alone</a><kbd>\`</kbd><span>hides this bar</span>`;
      for (const [id, key] of [['kit-screen', 'screen'], ['kit-state', 'state'], ['kit-bg', 'bg'], ['kit-size', 'size'], ['kit-touch', 'touch']]) $(id).addEventListener('change', (e) => { S[key] = e.target.value; if (key === 'screen') S.state = ''; draw(); });
      try { history.replaceState(null, '', address(false)); } catch { /* a file opened from disk may not allow it */ }
      if (load) frame.src = address(true);
      fit();
    }
    const toggle = () => { html.classList.toggle('kit-nobar'); fit(); };
    window.addEventListener('message', (e) => { if (e.source !== frame.contentWindow || !e.data) return; if (e.data.kit === 'bar') toggle(); if (e.data.kit === 'at' && e.data.screen !== S.screen && SCREENS.some((s) => s.id === e.data.screen)) { const sel = $('kit-screen'); if (sel) { sel.value = e.data.screen; $('kit-state').innerHTML = '<option>as clicked</option>'; } } });
    window.addEventListener('keydown', (e) => { if (e.code === 'Backquote' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) toggle(); });
    window.addEventListener('resize', fit);
    draw();
  }
  if (Q.has('bare')) bare(); else shell();
})();
