// What the audit of a rift's edge does in the page (tools/audit_rift.mjs runs it and prints; tools/test_game.mjs runs it as a check).
// Every piece within reach of the rift's line is measured against the bed as it is drawn (world.drawn) and against the pieces under it. A piece
// `hangs` by the gap between its foot and the highest thing under it; it is `sunk` by how far the bed stands over its top.
export const auditInPage = ([seed, band, reach, hang]) => {
  const g = window.__game; g.startRun(seed); if (band) g.enterFloor(band, false); const w = g.world, r = w.rift; if (!r) return null;
  const every = w.pieces().map((p) => ({ ...p, q: r.in(p.x, p.z) })), all = every.filter((p) => p.q > reach[0] && p.q < reach[1]), near = every.filter((p) => p.q > reach[0] - 6 && p.q < reach[1] + 6); // what is looked at, and what may be holding it up
  const out = { looked: all.length, hanging: [], sunk: [], kinds: {} };
  for (const p of all) {
    const foot = p.y + p.lo * p.sy, top = p.y + p.hi * p.sy, rad = p.half * Math.max(p.sx, p.sz) * 0.7;
    let under = -1e9, over = 1e9; // the bed under it: the highest and the lowest of five places
    for (const [dx, dz] of [[0, 0], [rad, 0], [-rad, 0], [0, rad], [0, -rad]]) { const y = w.drawn(p.x + dx, p.z + dz); under = Math.max(under, y); over = Math.min(over, y); }
    let rest = under;
    const loose = /rubble|pebble|coin|flag|shard|star|brittle|urchin|clam|fragment/.test(p.name), wide = p.half * Math.max(p.sx, p.sz);
    for (const o of near) { if (o === p) continue; const otop = o.y + o.hi * o.sy, ofoot = o.y + o.lo * o.sy, orad = o.half * Math.max(o.sx, o.sz), d = Math.hypot(o.x - p.x, o.z - p.z);
      if (otop <= foot + 0.35 && otop > rest && d < orad + (loose ? rad * 0.5 : wide)) rest = otop; // it stands on that piece: a lintel on the posts at its ends, a slab on its drum
      else if (!loose && otop > foot && ofoot <= foot + 0.05 && d < orad + wide + 0.3) rest = Math.max(rest, foot); } // or it is built or grown against something that stands: a coral on a column, a step in a wall of blocks
    const gap = foot - rest;
    out.kinds[p.name] = (out.kinds[p.name] || 0) + 1;
    if (gap > hang) out.hanging.push({ name: p.name, gap: +gap.toFixed(2), q: +p.q.toFixed(1), x: +p.x.toFixed(1), z: +p.z.toFixed(1), y: +p.y.toFixed(2) });
    else if (over > top + 0.05) out.sunk.push({ name: p.name, by: +(over - top).toFixed(2), q: +p.q.toFixed(1), x: +p.x.toFixed(1), z: +p.z.toFixed(1) });
  }
  return out; };
export const audit = (page, seed, band, { reach = [-9, 9], hang = 0.3 } = {}) => page.evaluate(auditInPage, [seed, band, reach, hang]);
