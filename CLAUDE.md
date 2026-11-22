# Oarfish dive: notes for Claude

A browser game in plain ES modules. No build step, no framework, no bundler. three.js r170 from a CDN via the import map in `index.html`. Read `README.md` for the file map.

## The people

Two people work on this, both through Claude. They are designers, not engineers. Explain what changed in terms of what the player sees. Keep the casual register; say plainly what is unverified.

## How to work

- Work on a branch. Do not commit to `main` or push unless asked. Branches are merged into `main` on request, after the checks pass.
- Before saying something works: run `npm test` (five suites, about ten minutes in a software renderer) and look at the result yourself with the screenshot tools. Passing checks are not the same as it looking right.
- `node tools/shot_models.mjs <prefix> [filter…]` photographs models into `out/shots/`; `python3 tools/sheet.py <out.png> <cols> <width> <files…>` tiles them into one sheet to look at.
- In this sandbox there may be no downloaded Chromium: `CHROME=/usr/bin/google-chrome npm test`.
- One control check ("holding the left button coils") depends on real-time state and fails now and then. Re-run before believing it.

## How it is built

- **Everything is flat-shaded triangles with a colour at each corner.** Models are made with `mesher()` in `game/kit.js`: a skin over cross-sections, fins of rays, eyes with pupils. A face whose colour has alpha 0 gives off its own light. Match this; do not bring in textures or imported models.
- **Appearance is a component.** `game/npc.js` holds one spec per creature or thing: palette, model, body motion, attachments, states. The game calls `make(id)`; the library calls the same. Never put a colour or a model for a creature anywhere else. Shells register from `shells.js`, plants and stonework from `world.js`, with `register()`.
- **Behaviour is not in the component.** How a biter hunts is in `foes.js`; the component only says how it looks and how its body moves.
- **World things are instanced.** `world.js` scatters white models tinted per instance. A thing's tints come from its component (`tonesOf(id)`); stone and paint come from the two colour sets (`stoneOf(band)`, `paintOf(band)`).
- **Two views of the dive.** A dive opens on the plain view: the plate, the scale bar, the marker, the key prompts, the message card, Skip tutorial and a pause button. H, or the pause menu, turns on the full view (`#stage.full`, kept in `localStorage['oarfish.ui']`), which adds the key list, the tuning drawer and the model tools. Whatever a player needs in order to play has to work in the plain view; whatever is for looking things up or tuning belongs to the full one.
- **Library edits are an overlay.** `tweaks` in `npc.js` stores colour and size changes in `localStorage['oarfish.npc']`; `resolve(id)` lays them over the defaults. To make a pasted "Oarfish NPC changes" note permanent, write the values into the component's `palette` (or its scale) in the code.

## Things that break quietly

- **Two streams of chance in `world.js`.** `rand` decides where everything that matters stands; `drand` is for dressing only. Adding a `rand()` call, or changing how many a builder makes, moves every world made from every seed. Use `drand`/`dr`/`dpick` for anything decorative. If the layout really must change, say so: seed codes people have shared will give different worlds.
- **Tints lists keep their length.** `pick(tones)` draws from `rand`; a list of a different length shifts the stream.
- **The nursery** (the tutorial opening) rebuilds the start of band 1. The checks turn it off with `window.__noNursery = true`; `tools/test_teach.mjs` is the one suite that runs it.
- **Browser features need a click and may be refused**: pointer lock, full screen, clipboard, audio. Every call is in a click handler and catches refusal. Storage is wrapped in try/catch and may come back empty.
- **`window.__game`** is the hook the checks drive. `sim(seconds, forced)` advances the dive without real time. Keep it working when you change `main.js`.

## Words on screen

Short, concrete, no jargon. A lesson is shown by the place first, a key prompt second, a sentence last. Messages go through `tell()` / `say()` and appear in the card over the scale bar; give them a kind (`teach`, `warn`, `shell`, `note`).

## Where the story is

The plot ("The Closed Circle") lives outside this repository, in a Claude Doc. The comments in `world.js` and `boss.js` carry the parts the code depends on.
