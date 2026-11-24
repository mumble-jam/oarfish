# The reef head's life (branch reef-life): progress

Brief: a cleaning station at the reef's middle, trumpetfish that ride the oarfish, coral that grows from dive to dive. All behaviour in `game/reef.js` (`REEF` table); hooks in main.js and npc.js are one block each. Worktree `/home/claude/oarfish-reef`; logs `/home/claude/reef-logs/`; sheet `/home/claude/reef-sheet.jpg`.

## Done
- [x] reef.js: station, trumpetfish, coral; main.js hook (one import, one hooks block, one line in enterFloor, one in the step, one extra Empty-the-nest listener, one line exposing it to the checks); npc.js block moving the trumpetfish to the first band (Rivals) and the cleaner to band 0 too.
- [x] tools/shot_reef.mjs: pictures from the dive's camera.

## To do
- [x] checks in test_game.mjs (three); library checks updated for the moved trumpetfish; CLAUDE.md, CREATURES.md.
- [x] perf before/after (see CLAUDE.md, *The reef's cost*); sheet /home/claude/reef-sheet.jpg.
- [ ] final run of all five suites after the last code change (trumpetfish pieces no longer cast; empty coral meshes hidden).

## Decisions (and why)
- Station rule without tail-biters: it mends, it does not feed. It gives back only what this dive has lost (body shorter than this dive's longest); a whole fish gets nothing (no ring, cleaners stay on the coral), and nothing goes to the crest. Uses, rest, time, reach and stillness are CLEAN's own numbers. Not solid (a low brain coral the fish hovers over), so world.js's colliders are untouched. It is reef.js's own station, not one of world.react.stations, so the deeper bands' station check and the truce code are untouched.
- Trumpetfish strike when the loop round a swarm is half closed (sc.progress >= 0.5), not after it closes: the catch happens in main.js before reef.update runs, so taking the fish at the close would mean editing the catch loop. Halfway round is still 'closing a loop' to the eye.
- Coil shake-off counts only coiling round nothing (no swarm being ringed), since wrapping a swarm is itself a coil. rig.coiling also counts hard turns, so a sharp turn shakes it too (the report's 'a coil, a sharp turn or a dash').
- New coral grows in the first time the fish comes within 30 m of the reef in a later dive, not at the very start of the dive (the reef is 80 m from the start, so a growing-in at the start would never be seen).
- Goals counted: every carving won on any band's mural (world.react.earn answering true), wrapped inside reef.js. The mural is unchanged.
- The reef disposes itself when its world is disposed (it wraps world.dispose), so main.js's three dispose lines are not touched (other branches edit them).
- Trumpetfish hang by the rods nearest the way in from the arch, so they are met on arrival; tilted 0.95 rad head down (straight down is a dot from the camera); drawn 1.2 times the model (which is already 1.4 times the real fish) because at 1.0 the hanging ones could not be found in the pictures.

---

# The quiet side (branch quiet-side): progress

Phase one of George's "quiet side": ground, plants and stone for the sand flat, reef head, kelp forest, colonnade and gate arches in band 1. No creatures. Worktree `/home/claude/oarfish-quiet`; logs `/home/claude/quiet-logs/`; sheet `/home/claude/quiet-side-sheet.jpg`.

## Done
- [x] `game/quiet.js` layout (own run of numbers); `world.js` builds it (`buildQuiet`, `randNow`/`drandNow`, `keeps`, `extras`, level pale sand, three new models); `shells.js` `shellSpots`; `world.quiet` documented in CLAUDE.md.
- [x] Go to buttons (index.html, main.js); `tools/shot_quiet.mjs`, `tools/quiet_fn.mjs`; shot_map draws it.
- [x] Checks in the game suite: go-to and swim-through, layout audit over 80 worlds, bands 2-5 digest vs 5428c39. Library count 74 -> 77.
- [x] Merged squid-play (9a7f568, moon jellies) in; conflicts in CLAUDE.md and test_game.mjs resolved by keeping both.
- [x] All five suites pass after the merge (game 99, boss 30, teach 9, library 17, controls 55).
- [x] Cost vs 9a7f568: start +8% tris, +2% calls; sand flat +10%, reef +10%, kelp +11% tris and +39% frame time there.

## Decisions (and why)
- Kelp forest grows out of the old field where there is room; else starts further out with a thin run back. Usually 2.3x the field's ground (3.3x with it); smaller in some worlds.
- Kelp colonnade runs along the forest's flank to the clearing (its arch is next to the town).
- Colonnade columns stand beside the way (3.5 m to the right), not on the line, so they never block the approach.
- Arches 4.3 m columns (about 5 m under the lintel), lower than first built, so the plate camera clears them more.
- Giant kelp 7-9.5 m, golden brown, blades streaming one way (looked like bamboo when tall, green and symmetric).
- Coral heads: pillar-coral style, each head its own colour round the ring (round lumps read as boulders).
- Hooks can move (about 1 world in 7): openSpot keeps off the new ground.

---

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
