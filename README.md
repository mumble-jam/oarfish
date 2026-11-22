# Oarfish dive

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
| `game/world.js` | One depth band: seabed, ruins, wells, plants, swarms. Seeded. |
| `game/npc.js` | **The cast, as components.** How every creature and thing looks. See below. |
| `game/critters.js` | The models those components are built from. |
| `game/library.js` | The specimen library: a playground for every component. |
| `game/foes.js` | How the hunters behave (biters, anglers, hooks, drifters, leeches) and loose tail pieces. |
| `game/guards.js` | The four keepers of the wells. |
| `game/boss.js` | The Sum, and the palace hall. |
| `game/shells.js` | The ten shells: what each does, and its model. |
| `game/oarfish.js`, `game/rig.js` | The player's fish: its model, and how its body follows its head. |
| `game/kit.js`, `game/geo.js` | Shared tools for building flat-shaded models, and small maths. |
| `game/music.js` | The band: generated jazz that follows the play. |
| `game/pad.js` | Controllers. |
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

## Checks

```
npm install
npx playwright install chromium
npm test
```

Five suites drive the real game in a headless browser: the dive itself, the Sum and the endings, controls, the teaching, and the library. `npm run shots` photographs every model into `out/shots/`.

If you already have Chrome, `CHROME=/path/to/chrome npm test` uses it instead of downloading one.

## Good to know

- three.js comes from a CDN through the import map in `index.html`. The game needs a connection the first time it loads.
- A world is made from a seed, shown in the pause menu as a code you can copy to a friend. Changing how the world is laid out changes what every existing code produces.
- Settings, key bindings, library changes and what has been taught are kept in the browser's storage under keys starting `oarfish.`.
