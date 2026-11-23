// Builds a band's world in Node: no browser, nothing drawn. For the tools that count, compare and map what a band holds
// (tools/digest.mjs, tools/shot_map.mjs).
//   const game = await load();                      the game as it is in this folder
//   const game = await load({ ref: 'main' });       the game as it was at a commit: unpacked under out/headless/, which git ignores
//   const b = game.build(4242, 0);                  { THREE, scene, world, size, spawn, wrap, solids, sites }
// A world made before the size belonged to the world (world.size) is read through the module's own T and SPAWN, and one made before
// `solids` and `sites` were handed out has them handed out in the unpacked copy; nothing else in an old copy is touched.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { pathToFileURL } from 'node:url';
const ROOT = path.resolve(import.meta.dirname, '..');

// the game paints three small textures on a canvas; here a canvas is a thing that holds nothing
if (!globalThis.document) globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) };

export async function load({ ref = null } = {}) {
  let dir = path.join(ROOT, 'game'), name = 'this folder';
  if (ref) {
    const sha = execFileSync('git', ['-C', ROOT, 'rev-parse', '--short=12', `${ref}^{commit}`]).toString().trim(), base = path.join(ROOT, 'out', 'headless', sha);
    dir = path.join(base, 'game'); name = `${ref} (${sha})`;
    if (!fs.existsSync(path.join(dir, 'world.js'))) {
      fs.mkdirSync(base, { recursive: true });
      execFileSync('tar', ['-x', '-C', base], { input: execFileSync('git', ['-C', ROOT, 'archive', '--format=tar', sha, 'game'], { maxBuffer: 1 << 28 }) });
      const file = path.join(dir, 'world.js'), src = fs.readFileSync(file, 'utf8');
      if (!/\bsolids\b/.test(src)) { // an older world: hand out what stands in the way and what ground is claimed, as the newer ones do
        const at = '  return { update, react, pushOut,';
        if (!src.includes(at)) throw new Error(`cannot read what is solid in the world of ${name}: its last line is not the one expected`);
        fs.writeFileSync(file, src.replace(at, '  return { solids: colliders, sites, update, react, pushOut,'));
      }
    }
  }
  const mod = (file) => import(pathToFileURL(path.join(dir, file)).href);
  const THREE = await import('three'), W = await mod('world.js');
  function build(seed, band, opts = {}) {
    const scene = new THREE.Scene(), world = W.createWorld(scene, { seed, floor: band, nest: null, ...opts });
    const size = world.size ?? W.T, spawn = world.spawn ?? W.SPAWN, wrap = world.wrap ?? W.wrapD;
    return { THREE, scene, world, size, spawn, wrap, solids: world.solids, sites: world.sites };
  }
  return { THREE, W, mod, build, name, dir };
}
