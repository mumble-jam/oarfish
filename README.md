# Oarfish dive

**Play it:** https://mumble-jam.github.io/oarfish/ (this is whatever is on `main`; it updates by itself a minute or two after a merge).

A low-poly roguelike played as an oarfish in sunken ruins. You swim down through five depth bands, growing by wrapping your body round swarms of small fish. Your length is your health, your reach and your currency: hunters bite it off, and you can shed your own tail as bait. Each band's well is kept by a guard; at the bottom is the palace, and the Sum.

It runs in a browser from plain files. There is no build step and nothing to compile.

## Run it

Browsers won't load JavaScript modules from a `file://` address, so the game needs a server, however small:

```
npm start
```

then open http://localhost:8080. Any static server pointed at this folder does the same job (`python3 -m http.server`, the VS Code Live Server extension, GitHub Pages).

`npm install` is only needed for the checks below, not to play.

## What is where

| File | What it is |
| --- | --- |
| `index.html` | The page: all markup and all CSS. The HUD, pause menu, key bindings, specimen library. |
| `game/main.js` | The game itself: the loop, input, camera, HUD, messages, teaching, settings. Start here. |
| `game/world.js` | One depth band: seabed, the rift that leads down, ruins, plants, swarms. |
| `game/npc.js` | **The cast, as components.** How every creature and thing looks. See below. |
| `game/critters.js` | The models those components are built from. |
| `game/library.js` | The specimen library: a playground for every component. |
| `game/foes.js` | How the hunters behave (biters, anglers, hooks, drifters, leeches) and loose tail pieces. |
| `game/guards.js` | The four keepers of the rifts. |
| `game/legs.js` | Legs that walk by themselves: feet that plant and step in two groups, and a body that rides on them and leans with the ground. Not tied to any one animal. |
| `game/crab.js` | The Keeper put together: its shell, eight legs and two claws, and the poses that say what it is about to do. |
| `game/spine.js` | A swimming body that bends: a neck that turns and nods, a body that lies along its turn. Not tied to any one animal. |
| `game/sawfish.js` | The Shearer in motion: how it holds its saw for each thing it does. |
| `game/strands.js` | Limbs with no bones in them: an arm or a tentacle that hangs on a body and trails through the water after it. Not tied to any one animal. |
| `game/squid.js` | The squid in motion: ten arms hung on it, each trailing by itself, and how it looks hovering, jetting, alarmed and reaching. Not in the dive yet. |
| `game/jelly.js` | The four jellyfish in motion: a bell that squeezes and fills, part clear over what is inside it, and every arm and tentacle trailing by itself. Not in the dive yet. |
| `game/boss.js` | The Sum, and the palace hall. |
| `game/shells.js` | The ten shells: what each does, and its model. |
| `game/oarfish.js`, `game/rig.js` | The player's fish: its model, and how its body follows its head. |
| `game/kit.js`, `game/geo.js` | Shared tools for building flat-shaded models, and small maths. |
| `game/music.js` | The band: generated jazz that follows the play. Each hunter and keeper has an instrument of its own (`CAST`) that sits in while it is near. |
| `game/pad.js` | Controllers: reading them, and their motors. A DualSense's motors are driven directly (WebHID), since on Windows no browser drives them. |
| `game/surface.js` | The sea surface, for the ending. |
| `tools/` | Scripted checks and screenshot tools. Not part of the game. |

## Changing how something looks

Everything about a creature's or a thing's appearance lives in one place, its component in `game/npc.js` (shells register theirs from `shells.js`, plants and stonework from `world.js`). The game and the specimen library both build from those components, so a change shows in both.

There are three ways to change one:

1. **In the game.** Pause → *Specimen library*. Pick anything, change its colours or size. The change is saved in your browser and the game uses it. Press *Copy changes for Claude* to get it as text.
2. **By asking Claude.** Paste that text, or just describe what you want ("give the biter a longer jaw"). Shapes can only be changed this way.
3. **By hand.** Edit the `palette` of the component in `npc.js`.

Two components are colour sets rather than things: **District paint** (one colour per band, used on column tops, well curbs, the guards and the Sum) and **Stone** (the ruins of each band). Change one and everything built from it follows.

## Working on it together

- `main` is the game as it is played. If GitHub Pages is turned on for this repository, `main` is what it serves.
- Do your work on a branch of your own, and merge it into `main` when the checks pass.
- `CLAUDE.md` tells Claude how this project is put together and what to be careful of. Keep it true.
- `CREATURES.md` is the playbook for making a creature: start from the real animal, give it one trait, let the world move its body, and give every mood a pose. The Keeper and the Shearer were built by it.

## Checks

```
npm install
npx playwright install chromium
npm test
```

Five suites drive the real game in a headless browser: the dive itself, the Sum and the endings, controls, the teaching, and the library. `npm run shots` photographs every model into `out/shots/`; `node tools/shot_rift.mjs` photographs each band's rift; `node tools/shot_react.mjs` photographs the world answering the fish (plants pulling in, silt, pilot fish, chimes); `node tools/shot_puzzles.mjs` the body puzzles; `node tools/perf.mjs` counts triangles and times a frame in each band, for comparing before and after. `thumbnail.jpg` is the picture a shared link shows; `node tools/shot_thumbnail.mjs && python3 tools/thumbnail.py out/shots/thumbnail.png thumbnail.jpg` takes it again from the running game. The favicon is drawn by `tools/favicon.py` (`favicon.svg`); `node tools/shot_favicon.mjs` renders `favicon.ico` and `apple-touch-icon.png` from it.

If you already have Chrome, `CHROME=/path/to/chrome npm test` uses it instead of downloading one.

## Good to know

- three.js comes from a CDN through the import map in `index.html`. The game needs a connection the first time it loads.
- Every dive draws a new world. There is nothing to copy or paste: the number a world is built from is not shown to players.
- Settings, key bindings, library changes and what has been taught are kept in the browser's storage under keys starting `oarfish.`.
