// A game controller, read through the browser's Gamepad API. Buttons are numbered by the "standard"
// layout, which is what Chrome and Edge report for a DualSense, a DualShock 4 and an Xbox pad alike.
// The browser only hands out snapshots, so poll() is called once a frame.

export const BTN = { cross: 0, circle: 1, square: 2, triangle: 3, l1: 4, r1: 5, l2: 6, r2: 7, create: 8, options: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15 };

// what is printed on the pad, by family
const NAMES = {
  ps: { cross: '✕', circle: '○', square: '□', triangle: '△', l1: 'L1', r1: 'R1', l2: 'L2', r2: 'R2', create: 'Create', options: 'Options', l3: 'L3', r3: 'R3' },
  xbox: { cross: 'A', circle: 'B', square: 'X', triangle: 'Y', l1: 'LB', r1: 'RB', l2: 'LT', r2: 'RT', create: 'View', options: 'Menu', l3: 'LS', r3: 'RS' },
};
const DEAD = 0.16, COUNT = 18;

export function createPad() {
  const s = {
    connected: false, blocked: false, standard: true, name: '', kind: 'ps',
    lx: 0, ly: 0, rx: 0, ry: 0, // sticks after the dead zone, each within the unit circle; y is down, as the browser gives it
    active: false, // something on the pad is being pushed right now
  };
  const now = new Float32Array(COUNT), was = new Float32Array(COUNT);
  let pad = null;
  try { if (document.featurePolicy?.allowsFeature && !document.featurePolicy.allowsFeature('gamepad')) s.blocked = true; } catch { /* not every browser has this */ }

  const stick = (x, y) => { // radial dead zone, then the rest of the travel stretched back to 0..1
    const m = Math.hypot(x, y);
    if (!(m > DEAD)) return [0, 0];
    const k = Math.min(1, (m - DEAD) / (0.94 - DEAD)) / m;
    return [x * k, y * k];
  };

  function drivers() {
    const out = [];
    try {
      for (const g of navigator.getGamepads?.() || []) {
        if (!g || !g.connected) continue;
        const a = g.vibrationActuator, old = g.hapticActuators?.[0];
        if (a && typeof a.playEffect === 'function') out.push({ play: (strong, weak, ms) => a.playEffect('dual-rumble', { startDelay: 0, duration: ms, strongMagnitude: strong, weakMagnitude: weak }), stop: () => a.reset?.() });
        else if (old && typeof old.pulse === 'function') out.push({ play: (strong, weak, ms) => old.pulse(Math.max(strong, weak), ms), stop: () => old.pulse(0, 1) });
      }
    } catch { /* the frame does not let controllers through */ }
    return out;
  }
  return {
    state: s,
    poll() {
      was.set(now);
      pad = null;
      if (!s.blocked) {
        try {
          for (const g of navigator.getGamepads?.() || []) if (g && g.connected && (!pad || (g.mapping === 'standard' && pad.mapping !== 'standard'))) pad = g;
        } catch { s.blocked = true; } // the frame the page runs in does not let controllers through
      }
      s.connected = !!pad;
      if (!pad) { now.fill(0); s.lx = s.ly = s.rx = s.ry = 0; s.active = false; return s; }
      if (s.name !== pad.id) {
        s.name = pad.id;
        s.kind = /xbox|xinput|microsoft|045e/i.test(pad.id) ? 'xbox' : 'ps';
      }
      s.standard = pad.mapping === 'standard';
      const a = pad.axes;
      [s.lx, s.ly] = stick(a[0] || 0, a[1] || 0);
      [s.rx, s.ry] = stick(a[2] || 0, a[3] || 0);
      let any = !!(s.lx || s.ly || s.rx || s.ry);
      for (let i = 0; i < COUNT; i++) {
        const b = pad.buttons[i];
        now[i] = b ? Math.max(b.value || 0, b.pressed ? 1 : 0) : 0;
        if (now[i] > 0.3) any = true;
      }
      s.active = any;
      return s;
    },
    value: (i) => now[i],
    held: (i, min = 0.5) => now[i] > min,
    pressed: (i) => now[i] > 0.5 && was[i] <= 0.5, // went down this frame
    label: (key) => NAMES[s.kind][key] || key,
    // what is printed on button number i
    name(i) {
      if (i == null) return '';
      const key = Object.keys(BTN).find((k) => BTN[k] === i);
      return { up: 'D-pad up', down: 'D-pad down', left: 'D-pad left', right: 'D-pad right' }[key] || NAMES[s.kind][key] || (i === 16 ? 'Home' : i === 17 ? 'Touchpad' : `Button ${i}`);
    },
    // the first button that went down this frame, for the key-binding menu
    anyPressed() { for (let i = 0; i < COUNT; i++) if (now[i] > 0.5 && was[i] <= 0.5) return i; return -1; },
    title: () => s.name.replace(/\s*\(.*$/, '').trim() || 'Controller',
    // Vibration goes to every connected controller the browser gives motors for, not only the one being read:
    // one controller can show up twice (itself, and a copy made by Steam or a driver), and only one of the two may have motors.
    get motors() { return drivers().length > 0; },
    // strong is the heavy motor, weak the light one, each 0..1. A new call replaces whatever is playing
    rumble(strong, weak, ms) { for (const d of drivers()) { try { d.play(Math.min(1, Math.max(0, strong)), Math.min(1, Math.max(0, weak)), ms)?.catch?.(() => {}); } catch { /* not allowed */ } } },
    still() { for (const d of drivers()) { try { d.stop()?.catch?.(() => {}); } catch { /* nothing to stop */ } } },
    // the same, saying what came of it: 'none' (no motors), 'played', or the browser's refusal
    async test(strong, weak, ms) {
      const list = drivers(); if (!list.length) return 'none';
      const got = await Promise.all(list.map(async (d) => { try { return (await d.play(strong, weak, ms)) || 'complete'; } catch (e) { return `refused (${e?.name || 'error'})`; } }));
      return got.some((r) => r === 'complete' || r === 'preempted') ? 'played' : got[0];
    },
    // what the browser says about each connected controller's motors
    report() {
      const out = [];
      try { for (const g of navigator.getGamepads?.() || []) { if (!g || !g.connected) continue; const a = g.vibrationActuator, name = g.id.replace(/\s*\(.*$/, '').trim() || 'Controller';
        out.push(`${name}: ${a && typeof a.playEffect === 'function' ? `motors (${(a.effects && a.effects.join(', ')) || a.type || 'dual-rumble'})` : g.hapticActuators?.length ? 'motors (pulse only)' : 'no motors reported'}`); } } catch { /* blocked */ }
      return out;
    },
  };
}
