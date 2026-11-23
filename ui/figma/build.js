// Builds one state of the menus as editable layers in Figma, from what `node tools/shot_ui.mjs layers` read off the standalone page
// (out/ui-figma/<screen>--<state>.json). Run through the Figma MCP tool `use_figma`: the code sent is this file, then
//   const DATA = <the JSON>; const OPT = { parent: '<frame id>', x, y, name, still };  return await build(DATA, OPT);
// It makes a 1920 × 1080 frame named "<Screen> / <State>" with, from the bottom: a rectangle named "Still · <name>" for the picture
// behind (its image is put in afterwards with upload_assets), the shade the game lays over the top and foot of the picture, and
// then every element of the page as it nests in the markup, named by its id or classes (so "#pause", "div.in", "button.main"), text
// as text in the game's own typefaces, panels as shapes with the game's colours, the veils' blur as a background blur.
// Not part of the game, and nothing here goes back into it.
const FAMILY = { 'IM Fell English': 'IM FELL English', 'IM Fell English SC': 'IM FELL English SC', 'Alegreya Sans': 'Alegreya Sans' };
let MONO = null;
function fontOf(t) {
  const fam = FAMILY[t.f] || (/mono|menlo|consolas/i.test(t.f) ? MONO : 'Alegreya Sans');
  if (fam === 'IM FELL English SC') return { family: fam, style: 'Regular' };
  if (fam === 'IM FELL English') return { family: fam, style: t.it ? 'Italic' : 'Regular' };
  if (fam === 'Alegreya Sans') { const w = t.wt >= 650 ? 'Bold' : t.wt >= 450 ? 'Medium' : 'Regular'; return { family: fam, style: t.it ? (w === 'Regular' ? 'Italic' : `${w} Italic`) : w }; }
  return { family: fam, style: 'Regular' };
}
// colours come as [r, g, b, a] (0 to 1) or, in the compact files, as hex 'rrggbb' or 'rrggbbaa'
const rgba = (c) => (typeof c === 'string' ? [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).concat(c.length > 6 ? parseInt(c.slice(6, 8), 16) / 255 : 1) : c);
const solid = (c) => { if (!c) return []; c = rgba(c); return [{ type: 'SOLID', color: { r: c[0], g: c[1], b: c[2] }, opacity: c[3] }]; };
const shadowFx = (s) => { const c = rgba(s.c); return { type: s.in ? 'INNER_SHADOW' : 'DROP_SHADOW', color: { r: c[0], g: c[1], b: c[2], a: c[3] }, offset: { x: s.x, y: s.y }, radius: s.b, spread: s.s || 0, visible: true, blendMode: 'NORMAL' }; };
function gradient(css) {
  // linear-gradient([to bottom,] stop, stop [pos%], …): the page uses only top-to-bottom ones
  const body = css.slice(css.indexOf('(') + 1, css.lastIndexOf(')'));
  const parts = body.split(/,(?![^(]*\))/).map((p) => p.trim()).filter((p) => !/^to |deg$/.test(p));
  const col = (s) => { let m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(s); if (m) return { r: m[1] / 255, g: m[2] / 255, b: m[3] / 255, a: m[4] === undefined ? 1 : +m[4] };
    m = /color\(srgb\s+([-\d.e]+)\s+([-\d.e]+)\s+([-\d.e]+)(?:\s*\/\s*([\d.]+))?\)/.exec(s); if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] }; return { r: 0, g: 0, b: 0, a: 0 }; };
  const stops = parts.map((p, i) => { const pos = /([\d.]+)%\s*$/.exec(p); return { color: col(p), position: pos ? +pos[1] / 100 : i / Math.max(1, parts.length - 1) }; });
  return [{ type: 'GRADIENT_LINEAR', gradientTransform: [[0, 1, 0], [-1, 0, 1]], gradientStops: stops }];
}
function text(t, parent) {
  const n = figma.createText(); parent.appendChild(n);
  n.fontName = fontOf(t); n.name = !t.n || t.n === 'text' ? (t.s || ' ').slice(0, 40) : t.n; n.characters = t.s || ' ';
  n.fontSize = t.sz; n.letterSpacing = { unit: 'PIXELS', value: t.ls || 0 }; n.lineHeight = t.lh ? { unit: 'PIXELS', value: t.lh } : { unit: 'AUTO' };
  n.fills = solid(t.c); if (t.tt === 'uppercase') n.textCase = 'UPPER';
  n.textAlignHorizontal = t.al === 'center' ? 'CENTER' : t.al === 'right' || t.al === 'end' ? 'RIGHT' : 'LEFT';
  if (t.sh) n.effects = [shadowFx(t.sh)];
  if (t.wrap) { n.textAutoResize = 'HEIGHT'; n.resize(Math.max(1, t.w + 1), Math.max(1, n.height)); n.x = t.x; n.y = t.y - (t.lh && t.lh > t.sz * 1.2 ? (t.lh - t.sz * 1.2) / 2 : 0); }
  else { n.textAutoResize = 'WIDTH_AND_HEIGHT'; n.x = t.al === 'center' ? t.x + (t.w - n.width) / 2 : t.al === 'right' || t.al === 'end' ? t.x + t.w - n.width : t.x; n.y = t.y + (t.h - n.height) / 2; }
  return n;
}
function control(f, d) {
  const c = d.ctl;
  if (c.k === 'check') { f.cornerRadius = 3; f.fills = c.on ? solid([0.957, 0.643, 0.725, 1]) : solid([0.23, 0.23, 0.23, 1]); f.strokes = c.on ? [] : solid([0.52, 0.52, 0.52, 1]); f.strokeWeight = 1; f.strokeAlign = 'INSIDE';
    if (c.on) { const v = figma.createNodeFromSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${d.w}" height="${d.h}" viewBox="0 0 17 17"><path d="M4 8.8 L7.2 12 L13 5.5" fill="none" stroke="rgb(6,34,46)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`); v.name = 'tick'; f.appendChild(v); v.x = 0; v.y = 0; } }
  if (c.k === 'range') { f.fills = []; const ac = c.c || [0.957, 0.643, 0.725, 1], cy = d.h / 2, tw = d.w - 16;
    const track = figma.createRectangle(); f.appendChild(track); track.name = 'track'; track.resize(d.w, 4); track.x = 0; track.y = cy - 2; track.cornerRadius = 2; track.fills = solid([0.33, 0.33, 0.33, 1]);
    const fill = figma.createRectangle(); f.appendChild(fill); fill.name = 'fill'; fill.resize(Math.max(1, 8 + tw * c.v), 4); fill.x = 0; fill.y = cy - 2; fill.cornerRadius = 2; fill.fills = solid(ac);
    const th = figma.createEllipse(); f.appendChild(th); th.name = 'thumb'; th.resize(16, 16); th.x = tw * c.v; th.y = cy - 8; th.fills = solid(ac); }
  if (c.k === 'swatch') { const r = figma.createRectangle(); f.appendChild(r); r.name = 'colour'; r.resize(Math.max(1, d.w - 6), Math.max(1, d.h - 6)); r.x = 3; r.y = 3; r.cornerRadius = 2; r.fills = solid(c.c); }
  if (c.k === 'select') { const v = figma.createNodeFromSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="6" viewBox="0 0 10 6"><path d="M1 1 L5 5 L9 1" fill="none" stroke="rgb(${rgba(c.c).slice(0, 3).map((x) => Math.round(x * 255)).join(',')})" stroke-width="1.5"/></svg>`); v.name = 'chevron'; f.appendChild(v); v.x = d.w - 18; v.y = d.h / 2 - 3; }
}
let COUNT = 0;
function node(d, parent) {
  COUNT++;
  if (d.t === 't' || 's' in d) return text(d, parent);
  if (d.t === 'svg') { const v = figma.createNodeFromSvg(d.svg); v.name = d.n; parent.appendChild(v); v.x = d.x; v.y = d.y; if (d.op !== undefined) v.opacity = d.op; return v; }
  const f = figma.createFrame(); parent.appendChild(f); f.name = d.n; f.x = d.x; f.y = d.y; f.resize(Math.max(0.01, d.w), Math.max(0.01, d.h));
  f.fills = d.grad ? gradient(d.grad) : solid(d.fill); f.clipsContent = !!d.clip; if (d.op !== undefined) f.opacity = d.op;
  if (d.r) f.cornerRadius = d.r;
  if (d.stroke) { f.strokes = solid(d.stroke.c); f.strokeAlign = 'INSIDE'; const [t, r, b, l] = [].concat(d.stroke.w).length === 4 ? d.stroke.w : [d.stroke.w, d.stroke.w, d.stroke.w, d.stroke.w]; if (t === r && r === b && b === l) f.strokeWeight = t; else Object.assign(f, { strokeTopWeight: t, strokeRightWeight: r, strokeBottomWeight: b, strokeLeftWeight: l }); }
  const fx = []; if (d.blur) fx.push({ type: 'BACKGROUND_BLUR', radius: d.blur * 2, visible: true }); for (const s of d.fx || []) fx.push(shadowFx(s)); if (fx.length) f.effects = fx;
  if (d.ctl) control(f, d);
  const kids = (d.kids || []).map((k, i) => [k, i]).sort((a, b) => (a[0].z || 0) - (b[0].z || 0) || a[1] - b[1]);
  for (const [k] of kids) node(k, f);
  return f;
}
async function fonts(d, set) { if (d.t === 't' || 's' in d) { const f = fontOf(d); set.set(`${f.family}|${f.style}`, f); } for (const k of d.kids || []) await fonts(k, set); return set; }
async function build(DATA, OPT) {
  if (!MONO) { const all = await figma.listAvailableFontsAsync(); MONO = ['JetBrains Mono', 'Roboto Mono', 'IBM Plex Mono', 'Source Code Pro', 'Inter'].find((m) => all.some((f) => f.fontName.family === m && f.fontName.style === 'Regular')); }
  const need = await fonts(DATA.root, new Map()); await Promise.all([...need.values()].map((f) => figma.loadFontAsync(f)));
  const parent = OPT.parent ? await figma.getNodeByIdAsync(OPT.parent) : figma.currentPage;
  const top = figma.createFrame(); parent.appendChild(top); top.name = OPT.name; top.resize(DATA.w, DATA.h); top.x = OPT.x || 0; top.y = OPT.y || 0; top.clipsContent = true; top.fills = solid([0.043, 0.2, 0.271, 1]);
  const still = figma.createRectangle(); top.appendChild(still); still.name = `Still · ${OPT.still || 'none'}`; still.resize(DATA.w, DATA.h); still.fills = solid([0.043, 0.2, 0.271, 1]); still.locked = true;
  if (DATA.root.after) { const sh = figma.createRectangle(); top.appendChild(sh); sh.name = 'Shade over the picture (#stage::after)'; sh.resize(DATA.w, DATA.h); sh.fills = gradient(DATA.root.after); sh.locked = true; }
  // the stage's own children go straight into the frame: the frame is the stage
  const kids = (DATA.root.kids || []).map((k, i) => [k, i]).sort((a, b) => (a[0].z || 0) - (b[0].z || 0) || a[1] - b[1]);
  for (const [k] of kids) node(k, top);
  return { frameId: top.id, stillId: still.id, nodes: COUNT, mono: MONO, fonts: [...need.keys()] };
}
