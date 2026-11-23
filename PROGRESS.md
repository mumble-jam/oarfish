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
- Next: all five suites on keeper-tall, /home/claude/keeper-tall-sheet.jpg, hand-back.
- Traps met: a comment pasted into the middle of a line swallows the code after it (happened three times: crab.js numb pose, guards.js ring, test helpers). Lost legs are bait now: a check that tears legs and then wants the crab idle must clear them (`b.bait.life = 0`). Each B check starts its own dive (startRun) because torn legs persist.
