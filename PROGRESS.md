# The quiet side (branch quiet-side): progress

Phase one of George's "quiet side" expansion: the ground, plants and stone of three new places in band 1 (sand flat, reef head, kelp forest), a colonnade and gate arches. No creatures. Worktree `/home/claude/oarfish-quiet`, logs in `/home/claude/quiet-logs/`, throwaway scripts in `/home/claude/quiet-scripts/`.

## Done
- [x] `game/quiet.js`: the layout (QUIET numbers, layQuiet, laneDistance). Own run of numbers. Searched over 400 worlds (and 300 nursery ones): no fallback needed.
- [x] `world.js`: rand/drand read through randNow/drandNow so the quiet side lends its own runs to the band's builders; buildQuiet; sand flat made level and paler; keepOff generalised (`keeps`), `extras` for plants of kinds the band already scatters; three new models (coralHead, seaRod, giantKelp) registered as components; `world.quiet`.
- [x] `shells.js`: shellSpot/shellSpots exported (same numbers as before) so the stone keeps 3.5 m off where shells lie.
- [x] digest bands 2-5: identical (7 seeds). Band 1: swarms, shells, hunters, keeper, main run of chance unchanged; puzzles, fragments, mural, jars, pilots, chimes, bloom, all earlier sites identical in 60 seeds x (nursery and not).
- [x] shot_map draws it.

## Decisions (and why)
- Kelp forest: grown out of the old field where there is room (most worlds); when pens/ruins block it, it starts further out with a thin run of giant kelp back to the field. Forest alone is up to 2.3x the old field's ground (3.3x with the field); smaller in a few worlds.
- Colonnade to the kelp forest runs along its flank out to the clearing (its arch is next to the town).
- Previous job's notes are below, kept.

## To do
- [ ] pictures, sheet; tune looks
- [ ] main.js Go to buttons; checks; perf; CLAUDE.md; suites; merge

---

# Keeper rework: progress

Running notes so someone else can take over. Brief: make the Keeper's hit model honest (stage A, branch `keeper-shapes`), then make it a tall crab whose legs are the fight (stage B, branch `keeper-tall`, on top of A). George is away; decisions are written here and in the hand-back.

## Where things are
- Worktree: `/home/claude/oarfish-keeper` (branch `keeper-shapes`, from `squid-play`). `node_modules` is a link to the main repo's.
- Logs of suite runs: `/home/claude/keeper-logs/`.
- Baseline before any change (squid-play a2fa245): game suite `all checks passed` (86 PASS), boss suite `all boss checks passed`.

## Commands
- Suites, one at a time, read the LAST line:
  `CHROME=/usr/bin/google-chrome timeout 598 node tools/test_game.mjs 2>&1 | grep -v "toNonIndexed\|agent-proxy\|google.com\|Allowed domains\|README"` (same for test_boss, test_teach, test_library; test_controls takes ~9 min, run alone with a longer timeout).
- Hit shapes over the fight: `CHROME=/usr/bin/google-chrome node tools/shot_shapes.mjs <prefix> [open slam sweep jab charge dig]` -> `out/shots/<prefix>-<moment>-<play|top>.png`. `OARFISH_SRC=<tree>` photographs another copy (the "before" tree is a detached worktree at `/home/claude/oarfish-keeper-before`).
- Tile: `python3 tools/sheet.py <out.png> <cols> <width> <files...>`.

## Stage A
- [x] A1 testing tool "Show hit shapes" (pause menu, Testing): `game/shapes.js` (shapes, meeting tests, line drawing), `guard.shapes(ctx)` in guards.js says what the fight believes. Old model drawn honestly: fish = points, shell = 2.1 m disc, legs = 1.1 m strips seen from above, slam 1.5 m disc, jab 1 m disc, sweep a 4.2 m fan, charge 2.1 m disc, dig 2.4 m disc.
- [x] before pictures (out/shots/before-*, taken from the detached tree at the tool commit)
- [x] A2 fish body width (shapes.js fishBody), A3 crab solid (rig.js -> arena.bend -> guard.bend/pushOut), A4 blows from the claw (crab.js landing/strike/clawNow/solids; guards.js resolves after drawing, S.pending), A5 legs in 3D (legAt), A6 fetch fault (spurned), checks in test_boss.mjs (Keeper section) and test_game.mjs keeperKit (ramLeg aims at the drawn knee).
- [x] Stage A suites: game `all checks passed`, boss `all boss checks passed`, teach `all teaching checks passed`, library `all library checks passed`, controls `all control checks passed`.
- [x] /home/claude/keeper-shapes-sheet.jpg (before | after, play camera and top, 7 moments)
- Tuning (tools/rate_keeper.mjs, 60 tries a blow; before -> after): slam 0.67->0.60, sweep 0.54->0.68, jab 0.95->0.82, run 0.52->~0.45, dig 0.68->0.58, ram on a leg 0.88->~0.65. Changes made to get there: great claw bigger (stout 1.5->2.0, l1 1.05->1.35, l2 .95->1.2, span .95->1.25), small claw longer (l1 .78->1.1, l2 .62->.9, span .6->.75, stout .72->.95), jab reaches 0.3 of its span past its aim, legs longer (1.3/1.6 -> 1.7/2.0), sweep at body height 1.35 (was .28), slam jolt 1.3 m round the fingertips to 1.9 m up, run slack 0.2, dig burst 0.6 past the rim up to 3 m, leg reach 0.5 m from the skin.

## Bugs met (so nobody meets them twice)
- guards.js has a `struck` of its own inside createGuard (the Shearer's); the shapes.js one is imported as `takes`.
- A comment written mid-line in crab.js swallowed `T1.copy(l.tip)` once: the numb leg was drawn with a stale tip.

## Traps
- `tools/test_boss.mjs` was only the Sum (last band); the Keeper's checks live in `tools/test_game.mjs` (`keeperKit`).

## Stage B (branch keeper-tall, on top of keeper-shapes)
- [x] B1 tall: KEEPER.scale 1.3, ride 2.8, three-length legs (l3 spike), feet 10-11 m apart, belly ~3 m, knees 4.5-5 m; claws longer; camera stands back `view` 7 m while near (main.js cam.dist).
- [x] B2 legs: whole/cracked/numb/off; planted armoured, lifted knocked (stumble); stomp (tell, strike, stuck foot counts double); wrap+haul (topple); self-shed; fallen legs are bait and food (game.fed); lameness (list, slow slam, no run, slow turn).
- [x] B3 belly: linger -> heave -> drop -> grounded.
- [x] B4 wave tempo ladder + first bluff.
- [x] B5 legs 4, rage 2 kept; every number in KEEPER_FIGHT.
- [x] B6 checks in test_boss.mjs (Keeper made tall); test_game keeperKit updated.
- [x] Notes in CLAUDE.md.
- tools/shot_tall.mjs; old-crab picture: OARFISH_SRC=/home/claude/oarfish-keeper-a (detached keeper-shapes) node tools/shot_tall.mjs old size
- [x] All five suites on keeper-tall (final): game, boss, teach, library, controls all passed. keeper-shapes head b1e68fa re-run: game and boss passed (teach, library, controls passed one commit earlier; the last commit only added notes, a tool and a debug helper).
- [x] /home/claude/keeper-tall-sheet.jpg
- Done; handed back. Not played by a person.
- Traps met: a comment pasted into the middle of a line swallows the code after it (happened three times: crab.js numb pose, guards.js ring, test helpers). Lost legs are bait now: a check that tears legs and then wants the crab idle must clear them (`b.bait.life = 0`). Each B check starts its own dive (startRun) because torn legs persist.

# Sand flat batch: progress

Branch `sand-flat-models`, from `squid-play`. Models only; nothing goes in the dive.

| Creature | Model | Rig | Library | Bring tool | CREATURES.md | Checks |
|---|---|---|---|---|---|---|
| Hermit crab | done, ~1460 tris | `hermit.js` | 8 poses | line of four by an empty shell | done | library suite |
| Trumpetfish | done, ~810 | `trumpet.js` | 6 poses | hangs; lies along the swimming fish | done | library suite |
| Goby + pistol shrimp | done, ~1330 with sand | `burrow.js` | 5 poses | at its hole, flicks and goes down | done | library suite |
| Garden eel | done, 180 per eel, 20 instanced | `gardeneel.js` | 5 poses | colony that sinks near the body | done | library suite |
| Puffer + sand circle | done, ~690 / ~2470 | `puffer.js` | 5 + 6 poses | puffer ploughing its circle; three circles | done | library suite |

Done. All five suites pass (library, game, boss, teach, controls, each run alone on the final code). Contact sheet: `/home/claude/sand-flat-sheet.jpg` (`node tools/shot_sand.mjs s lib near`, `… s dive`, then `python3 tools/sand_sheet.py s`).

## Decisions (made without George, with the reason)
- Hermit crab enlarged: the model as made is a crab of about 0.4 m across with its shell (about four times a hand-sized hermit crab), and the line runs from that to twice it (`HERMIT.sizes`). At true size it was specks from the dive's camera.
- The game's shells are worn at about a third of the size the oarfish carries them, each fitted by a table (`HERMIT_WEAR`): the mouth to the crab, the rest lying back. Shells with no mouth (fan, ring, cap, lamp, pearl) are carried like a roof.
- The bring tool's behaviour lives in a new file, `sandpets.js`; `main.js` only got three small hooks, to stay out of the way of the other jobs.
- Trumpetfish kept at 1 m, the real one's greatest length: it reads as a stick from the high camera.
- Goby and shrimp made four times their size, garden eels three times, the puffer two and a half times and its circle one and a half times (so the fish is a little big for its circle). The trumpetfish shown 1.4 times the real one's greatest length after the dive's camera showed it as a hair beside the oarfish.
- Goby and shrimp are one component: their poses are halves of one another. The puffer's circle is its own component, since it stays where it was made and is a thing to show at a stage.
- The sand patches (burrow, eel colony, circle) take the bed's own sand colours and no light of their own, are tilted to the bed's slope where brought, and have an edge that sinks below the bed; on the stand a skirt hides what goes down the holes.
- Garden eels: the brief's "two thirds out" is the most; the reading says about a third, which is the strong-current pose.
- The commit attribution lines are the ones the session's system gave (Claude Opus 5.5), not the ones in the brief.
