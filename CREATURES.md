# How a creature is made here

A playbook, for whoever builds or rebuilds a creature: a person, or Claude in any session. It is the method the Keeper (the crab) and the Shearer (the sawfish) were made by. Follow it in order. The two of them are the reference: when this page and their code disagree, their code is what was looked at and approved.

The aim is a creature that a player can read: what it is, what it is about to do, and that it is in the world and not laid over it.

## 1. Start from the real animal

Before any modelling, look up how the real one lives. Three questions, and take one thing from each:

- **How does it find things?** (The sawfish feels electric fields with its saw. So the Shearer does not look at you: its teeth light.)
- **How does it move?** (A crab plants its feet and walks sideways. A sawfish is a ray in front and a shark behind.)
- **How does it hit, and what does it do afterwards?** (A sawfish swipes sideways at prey in the water and pins prey on the bottom. So the Shearer has two blows, chosen by where your tail is.)

Write what you took, and where from, at the top of the creature's file. Do not invent an animal when a real one already has better ideas. Do not copy numbers you have not read yourself.

## 2. One trait that reads from across the screen

Pick the one thing that makes it this animal and make everything else quieter than it. The crab: one claw far bigger than the other. The sawfish: the saw, a quarter of its length, with lit teeth. If a player cannot name the trait from a still at game distance, it is not big enough yet.

## 3. The body is moved by the world

Nothing slides and nothing hovers. Whatever carries the body has to be seen carrying it.

- **Walkers** stand on their feet. `legs.js` (`createWalker`) plants each foot, steps it when the body has left it behind, and sets the body's height and tilt from where the feet are. Feet land on `world.footing()`; the body is kept out of columns with `world.steer()`.
- **Swimmers** bend. `spine.js` (`bendy`) gives one model a neck that turns and nods, and a body that lies along its turn. The rig banks it into a turn and points its nose the way it is going, from how it really moved since the last frame, not from what the behaviour meant it to do.
- **Soft limbs** trail. `strands.js` (`createStrand`) hangs an arm or a tentacle on a body as a piece of its own. The rig says what shape it would hold in still water; the strand goes after that shape through the water, late and loose toward the tip. So it streams behind a body that moves and curls by one that is still.
- Reuse these. A new way of moving goes in a file of its own, knowing nothing about the animal, so the next creature can have it too.

## 4. Every mood is a pose

List what the behaviour can be doing, and give each one a pose that differs in silhouette, not only in a number.

- **A tell before every blow**, at least 0.6 s, that says which blow is coming and where. (Saw cocked to one side: a slash. Nose down overhead: a stoop.)
- **A spent state after every blow**, which is when it can be hurt, and which looks like it. (Teeth dark and saw drooping. Or saw stuck in the bed, tail in the air.)
- **Noticing** is its own pose, before the tell. (The sweep stops; the saw swings to you; the teeth tingle.)
- Being hit, and being beaten, are poses too. Beaten should show something not seen before. (The crab's legs curl. The sawfish goes belly up, and its face is underneath.)
- Idle is never still: a sweep, a fidget, a small claw picking at the ground.

## 5. What can be hit stays simple

The rig is for looking at. What the player can hit, and what can hit the player, is still a point and a radius in the behaviour (`guard.pos`, `tailNear`, `sawNear`). Change it on purpose or not at all, and say so. A new blow needs a way out that the player can find without being told: the slash is dodged by leaving its level, the stoop by moving along the bed.

## 6. Where each part lives

| What | Where | Rule |
|---|---|---|
| The pieces and their measures | `game/critters.js` (`KEEPER`, `SHEARER`, …) | Models only. Colours come in as the palette. Nothing here is called by the game. |
| The rig: how it stands, bends and poses | a file of its own (`crab.js`, `sawfish.js`) | Exposes `update(dt, s)` for the game and `show(dt, state, speed)` for the library. Takes where it is and what mood it is in; decides nothing. |
| The component | `game/npc.js` | Palette, `build`, `assemble` (which calls the rig), and one `states` entry per pose. |
| What it does and when | `game/guards.js`, `game/foes.js`, `game/boss.js` | Gives the rig a mood, never a pose. No colours, no models. |
| What the world offers a body | `game/world.js` | `height`, `footing`, `steer`, `rift`. |

Flat-shaded triangles with a colour at each corner, no textures, no imported models. Lit faces (eyes, teeth, lures) are marked in the model and driven by the material's glow.

## 7. It is not done until it has been looked at

- `node tools/shot_poses.mjs <prefix> <id>` photographs every pose on the stand. Do this first and look at it.
- A strip of each blow in the game, from where the player's camera would be (`tools/shot_crab.mjs`, `tools/shot_shearer.mjs`: write one like them).
- A check for the claim in section 3 (feet on the ground and the shell leaning; the saw sweeping and the body banking), and one for each blow, in `tools/test_game.mjs`. Checks read the rig's own numbers, so a pose cannot quietly stop happening.
- All five suites. Then say plainly what was only seen in stills.

## 8. Budget

One material a creature. The Keeper is about 700 triangles in 21 pieces; the Shearer is one piece. A keeper may cost that much; something there are twenty of may not: a swarm fish stays a single instanced model, and gets its character from how the swarm moves.

## 9. What grows, and what only answers

Not creatures, but the first rule holds: look at the real thing. A touched anemone draws its crown in, a tube worm is gone down its tube before anything reaches it, a sea pen folds and sinks into the bed, kelp only leans.

A thing that grows answers the fish in one of two ways, chosen where it is registered in `world.js`:

- `give`: it leans out of the way, by that part of its own height at the most. Nothing to mark in the model. Keep it small for what is tall: a lean is a part of the height, so 0.25 on a kelp of six metres is a metre and a half at the tip. It leans only for a body within about a metre and a half, and by how near the nearest part of that body is, not by how much of the body is about. (What shuts, shuts from further off: 2.6 m.)
- `shy`: it pulls in. In the model, say what pulls in and to where with `m.tuck(home)` before making those parts, and `m.tuck()` after: a tentacle to its root, a plume to a point inside its tube. Only what is marked moves, so the tube stays and the plume goes.

The library shows the answer as a second pose without being asked. None of this may ever matter to the rules: the fish swims through all of it as before.

## Where each creature stands

| Creature | Real animal | Trait | State |
|---|---|---|---|
| The Keeper | a crab | one great claw | Done: walks, leans, fights (four blows and a dig, legs that come off), fifteen poses |
| The Shearer | a sawfish | the saw, with lit teeth | Done: bends, fights (line, cut, swipes, teeth that go, a saw that snaps), fifteen poses |
| The Lamplighter | an anglerfish | to be found | To do |
| The Warden | a moray | to be found | To do |
| The Sum | made of oarfish tails | to be found | To do |
| Tail-biter | | | Being redrawn in the soft style, in another branch: leave it |
| Angler, Hook, Spined drifter, Leech | | | To do |
| Sprat, Lanternfish, Ghost fish | | | To do: as swarms, not one by one |
| Pilot fish | *Naucrates ductor*, which goes about beside sharks | dark bars, and lit white tips to the tail | Done as company: waits, rides the wake, is left behind. One model, five to a band |
| Cleaner wrasse | *Labroides dimidiatus*, which keeps cleaning stations on reefs | one black stripe from the eye to the tail, widening | Done as company: turns over its coral head, goes along the body while it works, goes in when the station rests. One model, six to a station |
| Squid | the bigfin reef squid, *Sepioteuthis lessoniana*: fins down the whole mantle | ten separate arms that stream behind an arrowhead of a body | A model only, in the library under `Not yet in the dive`: hovers, jets, turns, flares pale, shoots its two long arms. No behaviour, in no band. Not yet seen moving by a person |
