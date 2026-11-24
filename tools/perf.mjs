// Triangles and draw calls per band, and the time a frame takes in this (software) renderer, for comparing builds.
//   node tools/perf.mjs [bands…] [--at x,z] [--bloom] [--rift]     --at: stand at that point of band 1 (seed 4242) instead of the start; --bloom: in the middle of its bloom water;
//   --rift: over the middle of each band's rift, its keeper alive (the rift as it is closed), read from the world; --shoal: the closed rift in its second look (seal.js)
//   GAME_ROOT=<another checkout> measures the game there, with this tool (to measure the same spot before a change)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
const ROOT = process.env.GAME_ROOT || path.resolve(import.meta.dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  const CDN = '/npm/three@0.170.0/';
  const p = u.startsWith(CDN) ? path.resolve(import.meta.dirname, '../node_modules/three', u.slice(CDN.length)) : path.join(ROOT, u);
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  if (u === '/index.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(fs.readFileSync(p, 'utf8').replaceAll('https://cdn.jsdelivr.net', '')); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.addInitScript(() => { window.__noNursery = true; });
await page.addInitScript(() => { try { const f = JSON.parse(localStorage.getItem('oarfish.feel') || '{}'); if (!f.mode) localStorage.setItem('oarfish.feel', JSON.stringify({ ...f, mode: 'point' })); } catch {} }); // made on the plate camera, the default when this was written: ask for it, unless a camera was chosen in this page
await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
const args = process.argv.slice(2), flag = (k) => { const i = args.indexOf(k); return i < 0 ? null : args.splice(i, k === '--at' ? 2 : 1)[k === '--at' ? 1 : 0]; };
const seal = args.includes('--shoal') ? (args.splice(args.indexOf('--shoal'), 1), 'shoal') : 'glass';
const at = flag('--at'), bloom = flag('--bloom'), rift = flag('--rift'), spot = at ? at.split(',').map(Number) : null;
const which = args.map(Number); // the bands to measure: all of them, or those named
for (const f of which.length ? which : [0, 1, 2, 3, 4]) {
  const r = await page.evaluate(async ([f, spot, bloom, rift, seal]) => {
    const g = window.__game; if (g.devSee) g.devSee.seal = seal; g.startRun(4242); if (f) g.enterFloor(f, false); g.run.safe = 1e9;
    const p = rift && g.world.rift ? [g.world.goal.x, g.world.goal.z] : bloom && g.world.bloom ? [g.world.bloom.x, g.world.bloom.z] : spot; // stood there, a few metres back along the way it is then swum for two seconds
    if (p) { const x = p[0] - 0.6 * 3.5, z = p[1] - 0.8 * 3.5; g.rig.reset(g.rig.pos.clone().set(x, g.world.height(x, z) + 3, z), Math.atan2(0.6, 0.8)); g.snap(); }
    g.renderer.info.autoReset = false;
    const t0 = performance.now(); g.sim(2, { dir: { x: 0.6, y: 0, z: 0.8 }, amount: 1, vertical: 0, sprint: false }); const simMs = (performance.now() - t0) / 120;
    g.renderer.info.reset(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const i = g.renderer.info;
    const tris = i.render.triangles, calls = i.render.calls;
    // a frame drawn here, where the processor does the graphics card's work: the best of five rounds of five, since other work on the machine only ever adds
    const gl = g.renderer.getContext(), px = new Uint8Array(4); let drawMs = 1e9;
    for (let round = 0; round < 5; round++) { const t1 = performance.now(); for (let k = 0; k < 5; k++) { g.renderer.render(g.scene, g.camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } drawMs = Math.min(drawMs, (performance.now() - t1) / 5); }
    return { floor: f, at: p ? p.map((v) => +v.toFixed(1)).join(',') : 'start', tris, calls, geometries: i.memory.geometries, stepMs: +simMs.toFixed(2), drawMs: +drawMs.toFixed(1) };
  }, [f, spot, bloom, rift, seal]);
  console.log(JSON.stringify(r));
}
await browser.close(); server.close();
