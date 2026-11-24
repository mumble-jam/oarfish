// A game controller, read through the browser's Gamepad API. Buttons are numbered by the "standard"
// layout, which is what Chrome and Edge report for a DualSense, a DualShock 4 and an Xbox pad alike.
// The browser only hands out snapshots, so poll() is called once a frame. A DualSense the page has taken over (the direct line, below)
// is read from its own input reports instead, and its frozen Gamepad entry is passed over while they arrive.

export const BTN = { cross: 0, circle: 1, square: 2, triangle: 3, l1: 4, r1: 5, l2: 6, r2: 7, create: 8, options: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15 };

// what is printed on the pad, by family
const NAMES = {
  ps: { cross: '✕', circle: '○', square: '□', triangle: '△', l1: 'L1', r1: 'R1', l2: 'L2', r2: 'R2', create: 'Create', options: 'Options', l3: 'L3', r3: 'R3' },
  xbox: { cross: 'A', circle: 'B', square: 'X', triangle: 'Y', l1: 'LB', r1: 'RB', l2: 'LT', r2: 'RT', create: 'View', options: 'Menu', l3: 'LS', r3: 'RS' },
};
const DEAD = 0.16, COUNT = 18;

// ---- A DualSense, spoken to directly.
// On Windows no browser drives a DualSense's motors through the Gamepad API: Chrome and Edge read its buttons, but the only PlayStation
// pad they have motor code for is the DualShock 4 (device/gamepad/raw_input_gamepad_device_win.cc), and Firefox only drives Xbox-type
// pads. Chrome and Edge will, though, let a page send a controller its own commands (WebHID) once the player has picked it from the
// browser's list, and the pick is remembered. The command is Sony's output report, laid out as in the Linux driver (hid-playstation.c):
// flags that say "the motor bytes count", then the light motor (right) and the heavy one (left), 0 to 255. Over a cable it is report 2
// and that is all of it. Over Bluetooth it is report 0x31: a counter and a tag in front, a checksum behind. The motors run until told
// otherwise, so whoever starts them must stop them.
const SONY = 0x054c, SENSE = [0x0ce6, 0x0df2]; // the DualSense, and the DualSense Edge
const CRC = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
export function crc32(bytes) { let c = 0xffffffff; for (const b of bytes) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
// strong, weak: 0..1. bt: over Bluetooth. seq: 0..15, one more each time. flags: 'old' (firmware before 2.21), 'new', or 'both' when
// the controller would not say which it is. Returns { id, data } for HIDDevice.sendReport
export function senseReport(strong, weak, bt = false, seq = 0, flags = 'both') {
  const data = new Uint8Array(bt ? 77 : 47), at = bt ? 2 : 0, byte = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  data[at] = 0x02 | (flags === 'new' ? 0 : 0x01); // "not the fine haptics", and the old "the motor bytes count"
  if (flags !== 'old') data[at + 38] = 0x04; // the new "the motor bytes count"
  data[at + 2] = byte(weak); data[at + 3] = byte(strong);
  if (bt) {
    data[0] = (seq & 15) << 4; data[1] = 0x10;
    const sum = crc32([0xa2, 0x31, ...data.subarray(0, 73)]);
    data[73] = sum & 255; data[74] = (sum >>> 8) & 255; data[75] = (sum >>> 16) & 255; data[76] = sum >>> 24;
  }
  return { id: bt ? 0x31 : 0x02, data };
}

// ---- What a DualSense says, read from the controller itself. Once the page holds the controller (the direct line above), the
// browser's Gamepad API can stop seeing it: over Bluetooth, the controller leaves its simple mode as soon as the host reads a feature
// report or sends the full output report, and from then on sends report 0x31 in Sony's own layout, which Chrome on Windows does not
// decode, so the Gamepad entry stays listed with its buttons and sticks frozen. So while the line is open the game reads the controller's
// own input reports. The layout is the Linux driver's (hid-playstation.c, struct dualsense_input_report), counted from the first byte
// after the report's number, which is where WebHID's data starts: over a cable, report 0x01 of 63 bytes, the block at 0; over Bluetooth
// in full mode, report 0x31, one byte (a counter and a tag) and then the block. The block: sticks (0 to 3; 0..255, 128 centred, y down),
// triggers (4, 5), a counter (6), buttons (7 to 9: the hat in 7's low four bits, 0 up and on clockwise in eighths, 8 none; square, cross,
// circle, triangle in its high four; L1 R1 L2 R2 create options L3 R3 in 8; PS, touchpad, mute in 9). Over Bluetooth in simple mode the
// controller sends report 0x01 in a shorter layout (SDL's SDL_hidapi_ps5.c, PS5SimpleStatePacket_t; the Linux driver does not read it):
// sticks 0 to 3, buttons 4 to 6 (the same three bytes), triggers 7 and 8. It is 9 bytes, or 77 where the system pads it, so a 0x01 report
// is the cable's only at exactly 63 bytes.
// Returns { layout: 'cable' | 'bluetooth' | 'simple', axes: [lx, ly, rx, ry] in -1..1, buttons: 18 values 0..1 in the standard layout }
export function senseInput(reportId, view) {
  const n = view?.byteLength || 0, u = (i) => (i < n ? view.getUint8(i) : 0);
  let layout;
  if (reportId === 0x31 && n >= 11) layout = 'bluetooth';
  else if (reportId === 0x01 && n === 63) layout = 'cable';
  else if (reportId === 0x01 && n >= 9) layout = 'simple';
  else return null;
  const at = layout === 'bluetooth' ? 1 : 0, simple = layout === 'simple';
  const axis = (v) => Math.max(-1, Math.min(1, (v - 128) / 127));
  const axes = [axis(u(at)), axis(u(at + 1)), axis(u(at + 2)), axis(u(at + 3))];
  const lt = simple ? u(7) : u(at + 4), rt = simple ? u(8) : u(at + 5);
  const b0 = simple ? u(4) : u(at + 7), b1 = simple ? u(5) : u(at + 8), b2 = simple ? u(6) : u(at + 9);
  const hat = b0 & 15, bit = (b, m) => (b & m ? 1 : 0), b = new Float32Array(COUNT);
  b[0] = bit(b0, 0x20); b[1] = bit(b0, 0x40); b[2] = bit(b0, 0x10); b[3] = bit(b0, 0x80);
  b[4] = bit(b1, 0x01); b[5] = bit(b1, 0x02);
  b[6] = lt ? lt / 255 : bit(b1, 0x04); b[7] = rt ? rt / 255 : bit(b1, 0x08);
  b[8] = bit(b1, 0x10); b[9] = bit(b1, 0x20); b[10] = bit(b1, 0x40); b[11] = bit(b1, 0x80);
  b[12] = +(hat === 7 || hat === 0 || hat === 1); b[13] = +(hat >= 3 && hat <= 5); b[14] = +(hat >= 5 && hat <= 7); b[15] = +(hat >= 1 && hat <= 3);
  b[16] = bit(b2, 0x01); b[17] = bit(b2, 0x02);
  return { layout, axes, buttons: b };
}
// reports newer than this are the controller as it is now; past it, the Gamepad API is read again
const FRESH = 250, SILENT = 1500;

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

  // the direct line to a DualSense, when there is one
  const hid = { device: null, bt: false, flags: 'both', seq: 0, want: null, busy: false, timer: 0, sent: 0, last: '',
    // what the controller itself last said (senseInput), when, since when the line has been open, and what the status lines are told
    axes: [0, 0, 0, 0], btn: new Float32Array(COUNT), layout: '', inAt: 0, openAt: 0, reports: 0, status: 'off', onstatus: null };
  const hidOn = () => !!hid.device && hid.device.opened;
  function onInput(e) {
    if (e.device && e.device !== hid.device) return;
    const got = senseInput(e.reportId, e.data);
    if (!got) return;
    hid.axes = got.axes; hid.btn.set(got.buttons); hid.layout = got.layout; hid.inAt = performance.now(); hid.reports++;
  }
  function letGo() { // the line is closed: nothing the controller said before counts any more
    try { hid.device?.removeEventListener?.('inputreport', onInput); } catch { /* gone already */ }
    hid.device = null; hid.inAt = 0; hid.layout = ''; hid.btn.fill(0); hid.axes = [0, 0, 0, 0]; clearTimeout(hid.timer);
  }
  const hex = (v) => v.toString(16).padStart(4, '0');
  // a Gamepad entry that is this same controller, as the browser lists it ("… Vendor: 054c Product: 0ce6", or "054c-0ce6-…")
  const same = (g) => { const id = (g.id || '').toLowerCase(); return !!hid.device && id.includes(hex(SONY)) && id.includes(hex(hid.device.productId)); };
  function hidSend(strong, weak) {
    hid.want = [strong, weak];
    if (hid.busy || !hidOn()) return;
    hid.busy = true;
    (async () => { // one report at a time, and only ever the latest
      try { while (hid.want && hidOn()) { const [s2, w2] = hid.want; hid.want = null; const r = senseReport(s2, w2, hid.bt, (hid.seq = (hid.seq + 1) & 15), hid.flags); await hid.device.sendReport(r.id, r.data); hid.sent++; } } catch (e) { hid.last = `the controller refused the command (${e?.name || 'error'})`; }
      hid.busy = false;
    })();
  }
  async function adopt(device) {
    if (!device || device.vendorId !== SONY || !SENSE.includes(device.productId)) return false;
    try { if (!device.opened) await device.open(); } catch (e) { hid.last = `could not open it (${e?.name || 'error'}); another program may be holding it`; return false; }
    if (hid.device && hid.device !== device) letGo();
    hid.device = device; hid.last = ''; hid.seq = 0; hid.inAt = 0; hid.reports = 0; hid.openAt = performance.now();
    try { device.addEventListener('inputreport', onInput); } catch { /* it cannot be listened to: the Gamepad API it is */ } // the same listener twice is one
    hid.bt = (device.collections || []).some((c) => (c.outputReports || []).some((r) => r.reportId === 0x31));
    hid.flags = device.productId === 0x0df2 ? 'new' : 'both';
    try { // which flag its firmware wants: the version is in feature report 0x20, as the Linux driver reads it
      const v = await Promise.race([device.receiveFeatureReport(0x20), new Promise((r) => setTimeout(() => r(null), 700))]);
      // some browsers put the report's number in front of what they hand over, some do not
      if (v && v.byteLength >= 46) { const ver = v.getUint16(v.getUint8(0) === 0x20 ? 44 : 43, true), major = ver >> 8; if (major >= 1 && major <= 15) hid.flags = ver >= 0x0215 ? 'new' : 'old'; }
    } catch { /* it would not say: both flags go out */ }
    return true;
  }
  try {
    navigator.hid?.addEventListener('disconnect', (e) => { if (e.device === hid.device) letGo(); });
    navigator.hid?.addEventListener('connect', (e) => { if (!hidOn()) adopt(e.device); }); // only ones the player has already allowed arrive here
  } catch { /* no such thing in this browser */ }

  function drivers() {
    const out = [];
    if (hidOn()) out.push({ play: (strong, weak, ms) => { hidSend(strong, weak); clearTimeout(hid.timer); hid.timer = setTimeout(() => hidSend(0, 0), Math.max(20, ms)); return Promise.resolve('complete'); }, stop: () => { clearTimeout(hid.timer); hidSend(0, 0); } });
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
      const t = performance.now(), on = hidOn();
      if (!on && hid.device) letGo(); // closed without a word
      const live = on && hid.inAt > 0 && t - hid.inAt < FRESH; // the controller is speaking for itself
      const status = !on ? 'off' : live ? 'reading' : hid.reports ? 'stopped' : t - hid.openAt > SILENT ? 'silent' : 'waiting';
      if (status !== hid.status) { const old = hid.status; hid.status = status; try { hid.onstatus?.(status, old); } catch { /* the page's own trouble */ } }
      if (!s.blocked) {
        try {
          // while it speaks for itself, the browser's entry for the same controller is a frozen copy: it is passed over, never added in
          for (const g of navigator.getGamepads?.() || []) if (g && g.connected && !(live && same(g)) && (!pad || (g.mapping === 'standard' && pad.mapping !== 'standard'))) pad = g;
        } catch { s.blocked = true; } // the frame the page runs in does not let controllers through
      }
      s.connected = live || !!pad;
      if (!s.connected) { now.fill(0); s.lx = s.ly = s.rx = s.ry = 0; s.active = false; return s; }
      let name = pad ? pad.id : '';
      if (live) { name = ''; try { for (const g of navigator.getGamepads?.() || []) if (g && same(g)) { name = g.id; break; } } catch { /* blocked */ } name ||= hid.device.productName || 'DualSense Wireless Controller'; }
      if (s.name !== name) {
        s.name = name;
        s.kind = /xbox|xinput|microsoft|045e/i.test(name) ? 'xbox' : 'ps';
      }
      s.standard = !pad || pad.mapping === 'standard';
      // the DualSense read directly and any other controller held at the same time both count: the stick pushed further, the button pushed harder
      const a = pad ? pad.axes : [], d = live ? hid.axes : [0, 0, 0, 0];
      const pick = (p, q) => (Math.hypot(q[0], q[1]) > Math.hypot(p[0], p[1]) ? q : p);
      [s.lx, s.ly] = pick(stick(a[0] || 0, a[1] || 0), stick(d[0], d[1]));
      [s.rx, s.ry] = pick(stick(a[2] || 0, a[3] || 0), stick(d[2], d[3]));
      let any = !!(s.lx || s.ly || s.rx || s.ry);
      for (let i = 0; i < COUNT; i++) {
        const b = pad?.buttons[i];
        now[i] = Math.max(b ? Math.max(b.value || 0, b.pressed ? 1 : 0) : 0, live ? hid.btn[i] : 0);
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
    // The direct line to a DualSense. supported: this browser can do it at all. connect() must be called from a click: the browser
    // shows its list and the player picks the controller. resume() takes up one that was picked on an earlier visit, without asking.
    direct: {
      get supported() { try { return !!navigator.hid; } catch { return false; } },
      // a page shown inside another page (a preview) is usually not let near devices; only the game at its own address is
      get allowed() { try { return !!navigator.hid && document.featurePolicy?.allowsFeature?.('hid') !== false; } catch { return false; } },
      get connected() { return hidOn(); },
      get how() { return hidOn() ? `${hid.bt ? 'Bluetooth' : 'cable'}, ${hid.flags === 'both' ? 'firmware unknown' : hid.flags === 'new' ? 'current firmware' : 'old firmware'}` : ''; },
      get sent() { return hid.sent; },
      // whether the game is reading the buttons and sticks from the controller itself right now, and in which of its layouts
      get reading() { return hidOn() && hid.inAt > 0 && performance.now() - hid.inAt < FRESH; },
      get layout() { return hid.layout; },
      // 'off', 'waiting' (just opened), 'reading', 'stopped' (it was, and no report for a while), 'silent' (it never sent one);
      // onstatus(now, before) is told each change, from poll()
      get status() { return hid.status; },
      set onstatus(fn) { hid.onstatus = fn; },
      get trouble() { return hid.last; },
      async connect() {
        if (!navigator.hid) return 'unsupported';
        let list;
        try { list = await navigator.hid.requestDevice({ filters: SENSE.map((productId) => ({ vendorId: SONY, productId })) }); } catch (e) { return e?.name === 'SecurityError' ? 'blocked' : `refused (${e?.name || 'error'})`; }
        if (!list || !list.length) return 'none';
        for (const d of list) if (await adopt(d)) return 'connected';
        return 'failed';
      },
      async resume() { try { for (const d of (await navigator.hid?.getDevices?.()) || []) if (await adopt(d)) return true; } catch { /* not allowed here */ } return false; },
    },
    // what the browser says about each connected controller's motors
    report() {
      const out = [];
      if (hidOn()) out.push(`DualSense, spoken to directly: motors (${hid.bt ? 'Bluetooth' : 'cable'})`);
      try { for (const g of navigator.getGamepads?.() || []) { if (!g || !g.connected) continue; const a = g.vibrationActuator, name = g.id.replace(/\s*\(.*$/, '').trim() || 'Controller';
        out.push(`${name}: ${a && typeof a.playEffect === 'function' ? `motors (${(a.effects && a.effects.join(', ')) || a.type || 'dual-rumble'})` : g.hapticActuators?.length ? 'motors (pulse only)' : 'no motors reported'}`); } } catch { /* blocked */ }
      return out;
    },
  };
}
