# The kelp forest's life (branch kelpwood-life): progress

Worktree `/home/claude/oarfish-kelp`, from `squid-play` 26b7785. Scratch and logs in `/home/claude/kelp-work/`. Frozen copies of the two "before" commits for cost: `/home/claude/kelp-work/base-9a7` (9a7f568) and `base-26b` (26b7785).

## Steps
- [x] Lighter giant kelp: 35 faces a stem (was 92), every stem turned to one current along the forest, lanes walled and the rest thinned one in two (107 -> 73 stems in 4242). Same draws from the run of chance: `tools/kelp_fn.mjs` says nothing else in band 1 moved.
- [x] `game/kelpwood.js`: KELPWOOD table; box jelly patrol, shies from the body, fenced, sting by joints touching the drawn tentacles, bounded; shell laid as a cache prize; the nook's fragment handed to the world's fragments; nest mark.
- [x] main.js hooks (kelpHooks, create after the shell field, dispose x2, update, Empty the nest, `__game.kelp`); npc.js box jelly to Hunters, band 1.
- [x] checks (game suite: seven kelp checks), existing checks' counts filtered for the forest's own shell and fragment; library checks moved the box jelly; box jelly has an instrument (music.js)
- [x] fill counts (deterministic): kelp fragments down about 60% (plate) / 45% (adventure), faces 9,844 -> 2,275
- [x] frame time under the lock (kelp-work/perf3.txt): look +25%/+14%, plate +27%/+31% over 9a7f568 (was +33%/+27%, +37%/+43%). 15% NOT reached.
- [x] pictures: /home/claude/kelp-sheet.jpg (both cameras)
- [x] CLAUDE.md, CREATURES.md
- [x] game and library suites pass under the lock on eddc9d0 (kelp-work/game3.txt, library3.txt); teach and boss passed on 59c8db9; controls not run (coordinator: merger runs all five)

## Decisions (and why)
- Kelp lowered to 0.7 of its height (4.9-6.7 m) and thinned one row in three away from the lanes; lane walls (2.4 m from a lane's edge) all kept. Blades marked to give light (translucent), so undersides are golden, not dark.
- Judged from the adventure camera first (George's change of default), the plate second.
- The nook's find is a fragment (a fallen column top), not a jar: a sealed jar pays in fish (or a shell, and the clearing already gives one). A fragment pays in the nest when given to the rift.
- The forest's shell and fragment are tagged `kelp: true`; the old checks that count "three shells, two fragments" a band count the band's own.
- Patrol goes corner to opposite corner through the middle (where the shell is), then along a side: it crosses the middle about every ten seconds.
- On patrol it hunts with its tentacles let out (mood drift, beating); going away from the body it beats hard with them drawn up short (mood pulse). That is the tell that it is safe to follow.
- Nest mark: a small square slab with a pale glass cube, behind the squid's slab (0.75 m back of the start line, 2.9 m right). Bright: a clean take; dim: a take with stings.

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
