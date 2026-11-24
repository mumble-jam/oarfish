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
- **Swimmers** bend. `spine.js` (`bendy`) gives one model a neck that turns and nods, and a body that lies along its turn. The rig banks it into a turn and points its nose the way it is going, from how it really moved since the last frame, not from what the behaviour meant it to do. A rigid piece carried on a body that bends (the Shearer's saw) is placed by the rig doing the shader's sum again; a tail can be a strand hung on the end of the trunk, on a mount that looks backward (`sawfish.js`).
- **Soft limbs** trail. `strands.js` (`createStrand`) hangs an arm or a tentacle on a body as a piece of its own. The rig says what shape it would hold in still water; the strand goes after that shape through the water, late and loose toward the tip. So it streams behind a body that moves and curls by one that is still. When there are many fine ones, `createBundle` draws them as one piece and still moves each by itself.
- **Bells** beat. `jelly.js` (`jellyRig`) squeezes a bell and lets it fill, the rim last, and keeps what hangs from the rim on the rim. It says how hard each stroke pushes and leaves the moving to whoever owns the animal, so the body goes forward on the squeeze and loses way as it fills.
- Reuse these. A new way of moving goes in a file of its own, knowing nothing about the animal, so the next creature can have it too.

## 4. Every mood is a pose

List what the behaviour can be doing, and give each one a pose that differs in silhouette, not only in a number.

- **A tell before every blow**, at least 0.6 s, that says which blow is coming and where. (Saw cocked to one side: a slash. Nose down overhead: a stoop.) Eyes can say where: the Keeper's turn to the point its claw is aimed at for the whole of the wind-up. A tell shows what the behaviour already does and is handed (`act.at`); it never adds to it.
- **A spent state after every blow**, which is when it can be hurt, and which looks like it. (Teeth dark and saw drooping. Or saw stuck in the bed, tail in the air.) It has to read from the dive's high camera, fifteen metres off, and in the band's own light, not only close up: the Shearer pants, and its breathing holes are on top of its head and lit.
- **Noticing** is its own pose, before the tell. (The sweep stops; the saw swings to you; the teeth tingle.)
- Being hit, and being beaten, are poses too. Beaten should show something not seen before. (The crab's legs curl and its folded tail shows. The sawfish goes belly up, and its face is underneath.) Damage that stays should stay in sight: the Keeper's shell cracks from the socket of each leg it loses, and the Shearer's teeth lie on the bed where they fell.
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

One material a creature where it can be done (the Shearer has three: one that bends, one that does not, one for what has come off it). The Keeper was about 700 triangles in 21 pieces and the Shearer 370 in one; at the squid's level the Keeper is about 2050 in 30 and the Shearer about 1550 in 36. A keeper, of which there is one, may cost up to about 2500; something there are twenty of may not: a swarm fish stays a single instanced model, and gets its character from how the swarm moves.

## 9. What grows, and what only answers

Not creatures, but the first rule holds: look at the real thing. A touched anemone draws its crown in, a tube worm is gone down its tube before anything reaches it, a sea pen folds and sinks into the bed, kelp only leans.

A thing that grows answers the fish in one of two ways, chosen where it is registered in `world.js`:

- `give`: it leans out of the way, by that part of its own height at the most. Nothing to mark in the model. Keep it small for what is tall: a lean is a part of the height, so 0.25 on a kelp of six metres is a metre and a half at the tip. It leans only for a body within about a metre and a half, and by how near the nearest part of that body is, not by how much of the body is about. (What shuts, shuts from further off: 2.6 m.)
- `shy`: it pulls in. In the model, say what pulls in and to where with `m.tuck(home)` before making those parts, and `m.tuck()` after: a tentacle to its root, a plume to a point inside its tube. Only what is marked moves, so the tube stays and the plume goes.

The library shows the answer as a second pose without being asked. None of this may ever matter to the rules: the fish swims through all of it as before.

## Where each creature stands

| Creature | Real animal | Trait | State |
|---|---|---|---|
| The Keeper | a crab (its eyes, mouth and legs read from the blue crab, *Callinectes sapidus*; its dark-tipped unequal claws from the stone crab, *Menippe mercenaria*) | one great claw | Done, and brought up to the squid's level: walks, leans, fights (four blows and a dig, legs that come off). Eyes on stalks that turn to where the blow will land; mouth doors and feelers that are never still; a numb leg that lies low and jerks; a crack in the shell for each leg lost, and a rage from two. Fourteen poses in the library. Only seen in stills |
| The Shearer | a sawfish, of the family Pristidae (its count of teeth and its tail are the largetooth's, *Pristis pristis*) | the saw, with lit teeth | Done, and redone at the squid's level: bends, fights (line, cut, swipes, teeth that go, a saw that snaps). A rigid saw of thirty-two separate teeth that fly off and lie on the bed; a tail that is a strand; wings that ripple and fold; gills that heave and breathing holes that light when it is spent, which is the tell. Fourteen poses in the library. Only seen in stills |
| The Lamplighter | an anglerfish | to be found | To do |
| The Warden | a moray | to be found | To do |
| The Sum | made of oarfish tails | to be found | To do |
| Tail-biter | | | Being redrawn in the soft style, in another branch: leave it |
| Angler, Hook, Spined drifter, Leech | | | To do |
| Sprat, Lanternfish, Ghost fish | | | To do: as swarms, not one by one |
| Pilot fish | *Naucrates ductor*, which goes about beside sharks | dark bars, and lit white tips to the tail | Done as company: waits, rides the wake, is left behind. One model, five to a band |
| Cleaner wrasse | *Labroides dimidiatus*, which keeps cleaning stations on reefs | one black stripe from the eye to the tail, widening | Done as company: turns over its coral head, goes along the body while it works, goes in when the station rests. One model, six to a station. In the first band too, at the reef head's station, where they only mend what the dive has lost (`reef.js`) |
| Squid | the bigfin reef squid, *Sepioteuthis lessoniana*: fins down the whole mantle. Behaviour borrowed from its Caribbean cousin *S. sepioidea* (shoals, appetite, the steps of its defence), ink from cephalopods in general, the strike from *Loligo pealei* | ten separate arms that stream behind an arrowhead of a body; the rule: it answers pressure in steps (bluff, pale flight, an ink copy and a scatter) | In the first band, a shoal of five at the bloom water (`bloom.js`, among the Rivals): raids swarms, bluffs, flees pale, inks, can be settled (the mini-game). Seven poses. Seen in stills and checks only |
| Moon jelly | *Aurelia aurita*. The bloom gathering in the sun is from a fjord population (Hamner et al. 1994) | four violet horseshoes seen through a clear saucer; the rule: the bloom is cover, not danger (a very mild sting; it shelters young fish) | In the first band, seventy at the bloom water (Company), drawn at 1.8 times the model (each 0.8 to 1.15 of that), every one the whole animal at every distance, all in one draw call (`jellyCrowd` in `jelly.js`). Harmless; fry under the bells; they part round the body. Seen in stills and checks only |
| Sea nettle | the Pacific sea nettle, *Chrysaora fuscescens*. Holding against a current is from a flume study of another nettle (Zeman 2015) | the long train: twenty-four dark threads round four pale spiral arms; the rule: the train stings and the bell is the safe end (it cannot chase) | In the first band, three at the bloom's edge (Hunters), at 1.7 times the model: the first sting in the band, one segment across the train, two along it. No stripes: the real one has none. Seen in stills and checks only |
| Helmet jelly | *Periphylla periphylla* | twelve stiff horns carried up and ahead of a dark red point | A model only: drifts, pulses, lights blue-green round the crown when touched, turns its tentacles down. Carries a little red light so it reads in the dark bands |
| Box jelly | the sea wasp, *Chironex fleckeri* | a square clear bell that goes somewhere, ribbons from each corner; the rule: it sees (it turns away from the body, so it can be herded), and its sting counts by how much of the body touches its tentacles | In the first band, one in the kelp forest's clearing (`kelpwood.js`, among the Hunters), at 2.4 times the model: patrols across the middle with its tentacles let out, turns away from the body and beats off with them drawn short, holds when hemmed in; stings one, two or three segments by how much of the body touches the tentacles as they are drawn, never below six. Keeps a shell; a clean take is a best in the nest. Five tentacles to a corner where the real one has up to fifteen; made easier to see than the real one, which is all but invisible. Seen in stills and checks only |
| Hermit crab | a marine hermit crab of the family Paguridae (its colours the bright red of *Pagurus bernhardus*), in a plain snail shell or any of the oarfish's ten | one empty shell re-houses a whole line, each crab moving up a size | In the first band, a line of four at a market table of the sand flat (Company; `sandflat.js`): each wears one of the game's shells; a shell laid down from the body (lying still across the table) goes to the biggest, each moves up one house, and the smallest's old shell is the player's. Twice a dive. Walks on two pairs of legs (`legs.js`), draws in, peers out, feels a shell, climbs out of its shell into another. Four sizes, at twice the model in the dive. About 1460 triangles with its snail shell. Seen in stills and checks only |
| Trumpetfish | *Aulostomus maculatus* | it hides along a big harmless body to get close to prey; the rule: it rides the oarfish and takes from the swarm it closes on | In the first band, three by the sea rods of the reef head (`reef.js`, among the Rivals): hang head down; one peels off a swimming body that passes within 3 m and lies yellow along its flank; strikes with a flash when a loop round a swarm is half closed, one fish, two at most; a dash, a coil round nothing or a sprint past is rid of it. Drawn 1.2 times the model (1.4 times the real one). About 810 triangles. Seen in stills and checks only |
| Shrimp goby and pistol shrimp | the yellow shrimp goby, *Cryptocentrus cinctus*, and the tiger pistol shrimp, *Alpheus bellulus*, at their burrow | the shrimp works only while the goby says it is safe | In the first band, two burrows on the sand flat (Company; `sandflat.js`): come in fast and both go down for a while; slow and near, the goby flicks (a bright yellow wink); still near by, the shrimp digs (puffs of sand, a growing heap) and pushes up a shell fragment for the puffer's circle, two a burrow a dive. 2.4 times the model in the dive (which is four times the real pair). About 1330 triangles with the sand. Seen in stills and checks only |
| Garden eels | the spotted garden eel, *Heteroconger hassi* | the field sinks ahead of you and rises behind you | In the first band, thirteen colonies of twenty in the sand flat's cistern rim (Company; `sandflat.js`): an eel goes down when a body comes nearer than a distance that grows with how fast and jerkily it moves (0.9 m slow, about 2.1 m at a plain swim, as the divers' figure). Cross with none going down; the best crossing is kept in the nest. One eel of 180 triangles drawn twenty at a time as one instanced mesh. Seen in stills and checks only |
| White-spotted puffer, and its circle | *Torquigener albomaculosus* | it ploughs a circle over many days, dresses it with shell, and never reuses it | In the first band, on the sand flat's patch of fine sand (Company; `sandflat.js`): the circle is a stage further each dive (kept in the nest), fragments from the burrows set on its ridges hurry it, a careless body flattens it; finished, its calm middle gives the breath back, the nest keeps a ring for it, and the next one is begun beside it. The puffer ploughs, stirs, and puffs up at a body close by. Circle 1.3 and fish 1.6 times the model in the dive |

## The sand flat batch

Five made for one of the first band's new places, a sand flat, and one (the trumpetfish) for the oarfish's long body. Four of them now live at the sand flat (`sandflat.js`, see CLAUDE.md), and the trumpetfish at the reef head (`reef.js`). Each file's header has the full reading; this is the short of it. None has been seen beside a photograph of the real animal: the sandbox could not fetch one, so everything was modelled from text.

- **Hermit crab** (`hermit.js`). True of it: the abdomen is soft and curls right; it walks on its second and third pairs of legs while the shorter fourth and fifth grip the shell's column; the right claw is usually larger and blocks the opening when it is in (Britannica, "hermit crab"). Finding a shell too large it waits by it up to 8 hours, up to 20 crabs line up largest to smallest, and when the right one takes it the rest swap down the line (Wikipedia, "Hermit crab"). A crab probes the opening with its claws, turns the shell over, pulls out and moves in (Scientific American, on *Pagurus longicarpus*). The size-ordered queue with crabs holding on to the shell ahead is documented on a land hermit crab (Tufts Now, 2010, on Rotjan's *Coenobita* work); in the sea, chains run one crab after another over minutes. From description only: the claws' shape and knobs, the eyes, the leg bands, how high the shell rides. The game's shells with no mouth (fan, ring, cap, lamp, pearl) are carried like a roof: not true of any crab, a liberty for the game.
- **Trumpetfish** (`trumpet.js`). True of it: very long and compressed, a trumpet of a snout with a barbel on the chin, the back fin and the fin under it set far back with 8 to 12 separate spines before it, a round tail with spots, a black bar along the fins' roots, mottled red-brown with silvery streaks and yellow, blue-grey and green phases; it hangs head down among sea fans and uses big plant-eating fish as cover (Florida Museum). It strikes by suction, expanding the gill membranes and the floor of the snout (Fishes of Australia). Pulled past damselfish on lines, a trumpetfish model alone was inspected and fled from; attached to a parrotfish model it was treated as the parrotfish (University of Cambridge, on Matchette et al. 2023). From description only: that it swims on the back fins alone (the brief's), the tail's shape, the pattern.
- **Shrimp goby and pistol shrimp** (`burrow.js`). True of them: the shrimp digs and keeps the burrow, the goby guards the mouth, the shrimp keeps an antenna on the goby above ground; a middle threat brings a quick flick and fewer trips out, a bad one sends the goby head first into the burrow and both stay in for minutes (Landsittel et al. 2021). The snapping shrimp has one claw often more than half its body and a hood of shell over its eyes (Wikipedia, "Alpheidae"); the snap is a collapsing bubble from a jet driven by a plunger on the finger (Versluis et al. 2000). The goby: 7.5 to 10 cm, whitish to dark or yellow, spotted fins (Australian Museum). The shrimp: 4 to 5 cm, yellowish white netted brown, banded legs, red antennae, poor-sighted (Wikipedia, "Tiger pistol shrimp"). From description only: the goby's outline (the big head and high eyes, the belly fins joined as a disc, from what gobies are), its pale blue spots, the claw's shape.
- **Garden eels** (`gardeneel.js`). True of them: 40 cm, about 14 mm across, white with fine black dots and three big black spots (at the gill opening, mid-body, round the vent), large eyes, about a third out, mouth into the current (Wikipedia, "Spotted garden eel"); colonies of hundreds that pull back when approached (Oceana); in more current they draw further in, curve and feed only on what passes close, and at the strongest go right in (OIST, Ishikawa et al. 2022); flight distance from divers 2.1 to 2.8 m (Yunger et al. 2025). From description only: the curve of the neck, the spacing of the holes (no figure found), and "two thirds out", which is the brief's: the reading says about a third.
- **White-spotted puffer** (`puffer.js`). True of it: about 10 cm, brown or brownish yellow with white spots, the belly silvery white; it rings the sand with its belly, raises ridges by flapping its fins along the floor in straight runs from the outside in, stirs the middle to fine sand with its anal fin, and sets shell and coral on the ridges; about 2 m across, 7 to 9 days (Wikipedia). Radii 79 to 105 cm, the middle 31 to 50 cm, sharpened by repeated passes, left to flatten after the eggs, never reused, and the middle's current 24% slower (Kawase et al. 2013). From description only: its outline, how it looks puffed, the number of ridges (28), their height.

Seen only in stills, on the stand and from the dive's own camera (`node tools/shot_sand.mjs`, `python3 tools/sand_sheet.py`); none has been watched moving by a person.
