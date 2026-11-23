# The menu kit: today's menus of Oarfish dive, without the game

## Brief for the next chat (read this first)

**What this folder is.** George wants to redesign the game's menus without having to run the game. This folder is the starting point: every screen and overlay the game shows a person today, copied out of the game onto one plain page, standing over stills taken from the real game. Nothing here is a new design. It is the "before".

| In this folder | What it is |
| --- | --- |
| `index.html` | The page. Inside `#stage` it is the game's own markup, copied. |
| `menus.css` | The game's own styles, copied whole. **This is the file a redesign edits.** |
| `menus.js` | Stands in for `game/main.js` and `game/library.js`: writes into the page what they write (key list, binding grid, messages…) and answers clicks. |
| `kit.css`, `kit.js` | The kit's own: the list of screens and states, and the switcher bar. Not part of the design, never goes into the game. |
| `game-data.js`, `bg/stills.js` | Written by the tool from the running game: its words and lists, and what the plate said at each still. Never edited by hand. |
| `bg/*.png` | Nine stills from the game, 1920 × 1080, no interface in them. |
| `fonts/` | The game's three typefaces, so the page asks the network for nothing (see "Fonts" below). |
| `shots/` | A picture of every screen and state, taken from this page. Not committed (38 MB); `node tools/shot_ui.mjs page` makes them again in a few minutes. |
| `figma/build.js` | Turns one state, as `node tools/shot_ui.mjs layers` reads it, into editable layers in Figma (through the Figma tools' `use_figma`). |
| `../tools/shot_ui.mjs` | The one tool: takes the stills, the pictures, the game's data, the layers for Figma, and compares the copy with the real game. |

**Open it.** From the repository's folder: `npm start`, then http://localhost:8080/ui/ (any static server does the same; opening `ui/index.html` straight from disk works too: tried in Chrome, the bar, the frame and the address all behave, and nothing is asked of the network). You get the menus in a frame under a dashed yellow bar marked KIT. The bar picks the screen, its state, the still behind it, the size of the screen (1920 × 1080, 1440 × 900, 1280 × 720, a phone upright and on its side, or the window as it is) and whether to pretend the screen is a touch screen. The backquote key (`` ` ``) hides the bar and brings it back.

Every state has an address, so a link or a screenshot can point at one:

```
ui/index.html?screen=pause&state=controller&bg=keeper&size=1440x900     in the frame, under the bar
ui/index.html?bare&screen=pause&state=controller&bg=keeper              the stage alone, filling the window; no bar
ui/index.html?bare&hold=1&screen=hud&state=low                          the same, held still for a picture (nothing times out, throbs or fades)
```

`screen` and `state` are the ids in the table of states below. `bg` is one of `start nursery ruins swarm keeper deep end surface library none`; leave it out and the state uses its own. `touch=1` or `touch=0` forces the touch layout on or off.

The menus answer as far as that was cheap: Pause, Resume, Key bindings, Leave feedback, Specimen library and the Tuning tab open and close what they open in the game; dials move; boxes tick; a binding slot takes the next key; the library's list changes the panel (the picture behind it stays the Keeper). P or Esc pauses, H shows the keys and tools, V changes the camera's name, as in the game. Nothing is saved, played or sent.

**Take the pictures again.** `CHROME=/usr/bin/google-chrome` in front if there is no downloaded Chromium, as for the project's other tools.

```
node tools/shot_ui.mjs                  the stills: ui/bg/*.png and ui/bg/stills.js (world 4242; about four minutes in a software renderer)
node tools/shot_ui.mjs stills keeper    only one of them
node tools/shot_ui.mjs dump             ui/game-data.js, from the running game (do this when the game's words, keys, shells or creatures change)
node tools/shot_ui.mjs page             a picture of every screen and state of this page: ui/shots/<screen>--<state>.png
node tools/shot_ui.mjs game             the same screens in the real game, over the same still, compared with the copy: out/ui-compare/
node tools/shot_ui.mjs layers           every state read back as boxes and text, for figma/build.js: out/ui-figma/
```

Add `small` to try a still at 960 × 540 first (it goes to `out/ui-trial/`, never into `ui/`). How each still is set up is one line in `STILLS` in the tool; change the line and take it again.

**Carrying a change back into the game.** The copy was made from the branch `squid-play` at commit `f8c84fe`; every line number in this file is of that commit. Other work is changing `index.html` and `game/main.js` at the same time, so find the place by its id or selector, not by the number alone.

| Changed here | Goes back to | How |
| --- | --- | --- |
| `menus.css` | `index.html`, inside `<style>`, lines 26 to 327 | It is a whole copy, so it can replace that block whole. First run `diff <(sed -n '26,327p' index.html) <(tail -n +6 ui/menus.css)`: it shows your changes, and also anything the game gained meanwhile that you must not lose. |
| markup inside `#stage` in `index.html` (lines 19 to 181 here) | `index.html`, lines 331 to 492 | The same block, with one line added here that must not go back: `<canvas id="still">` (the game puts its own canvas there). Keep every `id` and class name: `game/main.js` finds its elements by them (`$('btn-resume')`…), and the checks in `tools/test_*.mjs` do too. |
| the font link in `<head>` | `index.html`, lines 22 to 24 (Google Fonts) | Here the fonts are local files (`fonts/fonts.css`). If a typeface or a weight changes, change the Google link in the game to match. |
| words and templates written by script (`menus.js`) | `game/main.js`, `game/library.js` | By hand. Each part of `menus.js` names the lines it was copied from. The table "Written by script" below says which is which. |
| a new control, a new screen, a new state | `game/main.js` | Needs real behaviour there. Say plainly that it is new, and add a state for it in `kit.js` so it can be seen here. |
| `kit.css`, `kit.js`, `game-data.js`, `bg/`, `shots/`, `fonts/` | nowhere | The kit's own. |

After carrying anything back: `npm test` (five suites, about ten minutes) and look at the result with `node tools/shot_ui.mjs game`, which lays the real game beside this copy.

**Standing rules of the project** (from `CLAUDE.md`, which is the authority):

- Work on a branch. This kit is on `ui-menu`, cut from `squid-play`. Nothing goes to `main`, and nothing goes to the live site (https://mumble-jam.github.io/oarfish/ serves `main`), unless George asks.
- Do not push unless asked. Never commit `package-lock.json`.
- If a permission or safety check refuses an action, do not work around it: stop that step and say what was refused.
- Before saying something works, run the checks and look at the picture yourself. Say plainly what is unverified.
- Words on screen: short, concrete, no jargon. Explain a change in terms of what the player sees.

**The same screens in Figma.** In the file https://www.figma.com/design/rFNso5egYivjGoBfhuqi1B/the-oarfish, on a page of its own, "Menus today (from the game)" (nothing else in the file was touched). One section per screen, and in it the screen's main state as a 1920 × 1080 frame of **editable layers**: text as text in the game's typefaces (Figma has IM FELL English, IM FELL English SC and Alegreya Sans; JetBrains Mono stands in for the system monospace), panels as shapes with the game's colours and strengths, the veils' blur as a background blur, the plate's shade as a gradient. Layers are named by the game's ids and classes (`#pause`, `div.in`, `#btn-resume`…), so a change can be found again in `menus.css` and `index.html`. They were made from the page itself: `node tools/shot_ui.mjs layers` reads every state back as boxes and text (`out/ui-figma/<id>.json`) and `figma/build.js` turns one into layers, so any other state can be added the same way. The eight frames: Heads-up display / plain (`16:550`), Tuning drawer / default (`17:550`), Pause menu / default (`18:550`), Key bindings / default (`19:550`), Leave feedback / empty (`20:550`), End of a dive / taken (`20:632`), Specimen library / default (`21:550`), The dive could not start (`20:684`); the page is `15:550`.

**Not there yet:** the pictures. Uploading an image to Figma was refused by the network this was made from, so (1) the still behind each frame is missing: its place is a locked layer named "Still · ruins" (or swarm, deep, end, library) in a flat abyss colour, and dropping `bg/<name>.png` onto it as an image fill puts the picture in; (2) the other 35 states, meant to go in as pictures from `shots/`, are not in the file at all. Every state is in `shots/` and on the page. Other limits: positions are fixed, not auto layout (they were measured, not rebuilt); Figma sets type a hair differently from Chrome, so a line can sit a pixel or two off; focus rings are left out; the tick boxes, sliders, text boxes and drop-down are drawn to look like Chrome's; in the library the line of facts is one text, not two.

**An opening message for a new chat.** Paste this to start menu work from here:

> I want to redesign the menus of my browser game, Oarfish dive. The repository is `mumble-jam/oarfish`; work on the branch `ui-menu` and nowhere else (nothing goes to `main` or the live site unless I ask, and never work around a refused action). Start by reading `ui/README.md` on that branch: it is a kit with today's menus copied out of the game onto one page (`ui/index.html`), stills from the game behind them, and an inventory of every screen. The same screens are in my Figma file, on the page "Menus today (from the game)": https://www.figma.com/design/rFNso5egYivjGoBfhuqi1B/the-oarfish. Open the page for me, tell me in a few lines what you see as the biggest problems of the pause menu, and then let's start with the pause menu: propose a new structure before changing any styles.

---

## Inventory of today's interface

Line numbers are of `index.html` and `game/main.js` at commit `f8c84fe`. "css" means the `<style>` block of `index.html`. All of the interface is HTML over one canvas; the 3D picture has no lettering of its own.

### How it hangs together

- **There is no opening screen.** The page loads straight into a dive. The first thing a person sees is the plate's lettering over the water, the title card of the first band, and a first line of teaching. On a first visit the dive opens in the nursery (a paved way with hoops) and a "Skip tutorial" button sits at the top right; after that it opens at the nest.
- **There is no settings screen.** Settings live in two places: the pause menu, and the Tuning drawer.
- **The nest is a place, not a screen**: stones and shells on the seabed where a dive starts, with no lettering. The only record a screen shows is one line on the end card ("Deepest dive so far").
- **Two views of the dive.** The plain view is the default. The full view (H, or "Show keys and tools on screen" in the pause menu) adds the key list, the model tools, and the Full screen and Tuning buttons. Remembered in the browser (`oarfish.ui`).
- **One overlay holds three things.** The pause menu, the key bindings and the feedback sheet are three columns inside the same `#pause` overlay; a class on it (`binding`, `noting`) says which one shows.

```
the dive (heads-up display)
 ├─ P, Esc, the pause button, Options on a controller ──> Pause menu
 │     ├─ Key bindings ──> Key bindings ──> Done
 │     ├─ Leave feedback ──> Feedback sheet ──> Back
 │     ├─ Specimen library ──> Specimen library ──> Back to the menu
 │     └─ Tuning (top right) ──> Tuning drawer, open beside the menu
 ├─ Tuning (top right, full view only) ──> Tuning drawer
 └─ the dive ends ──> End card ──> Dive again │ Leave feedback ──> Feedback sheet
the game cannot start ──> "The dive could not start"
```

Layers, lowest first (`z-index`): 1 the plate mark and the shade; 2 lettering, title card, marker, key prompt, stamina ring, flashes; 3 message card, key list, model tools, touch buttons; 4 pause overlay, fade; 5 Tuning drawer; 6 the corner buttons; 7 end card; 8 specimen library, and the pause overlay while it holds the feedback sheet; 9 the error screen.

### 1. Heads-up display (`hud`)

What is on screen during a dive. Markup `index.html` 332 to 392; behaviour `hud()` in `main.js` 826 to 878.

| Part | What it is and when it shows | Markup | Styles (css) | Behaviour (`main.js`) |
| --- | --- | --- | --- | --- |
| Plate mark | A hairline 12 px in from the edge, always. | 332 `.plate` | 50 | none |
| Shade | The picture darkened at the top (ink 40%) and the foot (ink 55%) so lettering reads. A pseudo-element, not markup. | `#stage::after` | 47 | none |
| Lettering | "Règne Animal." top left, "Poissons." top right, the band's name and depth top centre ("The sunlight zone", "40 m down"). The band's name is empty at the surface, in the ending. | 334 to 339 `.book` `.class` `.where` `#zone` `#zone-depth` | 51 to 56 | 335 to 336, 647, 660 |
| Caption and scale bar | "Le Gymnètre Épée. (Gymnetrus gladius)" and under it the body's length as a ruler: one tick a segment, the length in metres beside it. **This is the health bar.** A coral stub is food on the way to the next segment. Dots over the ticks are shells. | 366 to 372 `.foot` `.caption` `#scale` `#scale-bar` `#scale-food` `#scale-shells` `#scale-toll` `#len` | 75 to 95 | 840 to 846; shells 544 |
| Marker | An arrow at the edge of the screen pointing to the rift, with "the rift · 70 m"; a small diamond over the place once it is in view. Says "the palace" in the last band, and "the hoop", "the pen", "the small pens", "the bigger swarm", "the jar" in the nursery. Gone in the endings. | 364 `#goal` `#goal-arrow` `#goal-label` | 102 to 106 | 848 to 869; nursery targets 744 to 752 |
| Message card | Everything the game says in words: one card over the scale bar, one message at a time, the rest queued. A stripe down its side says what kind it is; a hairline along its foot runs down with the time left. Hidden while paused. | 362 `#toast` `#toast-kick` `#toast-title` `#hint` | 57 to 74 | `tell()` 783 to 789, `say()` 715, shown 829 to 836 |
| Title card | The band's name, large, and "40 metres down", for 3.2 s on entering a band. | 340 `#card` | 98 to 101 | `card()` 775, called 337 |
| Key prompt | A small pill with key caps and a verb, hung over the thing it is about ("W A S D swim", "Space rise", "Shift dash into it", "X shed your tail", "C dive into the rift"). Only while teaching is on, never on touch, never across the title card. | 361 `#prompt` | 162 to 167 | `prompt()` 753 to 774 |
| Stamina ring | A ring beside the fish's head, only while something hunts it or the ring is not full. | 363 `#stamina` | 175 to 181 | 870 to 877 |
| Corner buttons | Top right: Skip tutorial (nursery only), Pause (always; dimmed to 72% in the plain view), Full screen and Tuning (full view, or while paused). | 387 to 392 `.top` `#btn-skip` `#btn-pause` `#btn-fs` `#music-tab` | 201 to 204, 168 to 170, 288 to 292 | 1380 to 1382, 1413, 1489 |
| Flashes | The edge of the screen glows for about half a second: alarm pink when bitten, pale when grown or when a blow lands. | 333 `#pulse` | 230 to 233 | `pulse()` 776 |
| Fade | The whole screen goes to the next band's water colour and back, going down a rift and in the ending. | 421 `#fade` | 234 to 235 | `fade()` 635 |
| Key list (full view) | Bottom left: key caps and what they do, then a sentence about the mouse. Written for what is in the player's hands. | 374 `#keys` | 184 to 190 | `legend()` 1002 to 1010 |
| Model tools (full view) | Bottom right: Wireframe, Skeleton. They show the fish's mesh and bones. | 382 to 385 `.tools` | 191 | 1446 to 1453 |
| Touch buttons | Four round buttons at the right edge: Rise, Dive, Shed, Dash. Only on a touch screen. Shed greys out when the body is too short. | 376 to 381 `.depth` | 197 to 198, 297 to 301 | 1371 to 1378 |

States of the heads-up display:

- **Plain or full view**: see above.
- **What is in the hands** (`#stage[data-dev]`, `legend()`): keyboard and mouse; a controller (key caps become L2, R2, ✕, ○…; Xbox names on an Xbox pad); touch (the key list is one sentence).
- **Which mouse controls** (`#stage[data-mode]`): Point and swim, or Adventure camera. Only the sentence in the key list changes, in three wordings (mouse not yet handed over, handed over, or the browser refused to hand it over).
- **Nursery**: Skip tutorial shows, the marker names the lesson's target, key prompts hang over things.
- **Scale bar**: ordinary; low (six segments or fewer: alarm pink, throbbing); tolled (over an open rift: the end the rift will take is dark with a coral line); with shells; with food.
- **Message kinds**: `teach` (pale stripe; about forty different lessons, each said once ever), `warn` (coral stripe, sometimes with a title: "The Cap broke"), `shell` (stripe in the shell's own colour, a small-caps line "A shell" or "A new kind of shell", the shell's name as a title), `note` (dim stripe, smaller text: "Keys and tools hidden. H brings them back.").
- **Endings** (`#stage.cine`): the key list, tools, corner buttons and messages are put away while the ending plays.

### 2. Tuning drawer (`drawer`)

A panel 330 px wide that slides in from the right. Opened by the Tuning button (top right), which only shows in the full view or while paused. Markup 393 to 419 `#drawer`; css 200 to 227; behaviour `main.js` 1455 to 1521 and `nowPlaying()` 818 to 825. Remembered in the browser (`oarfish.music`, and Loop assist in `oarfish.feel`).

| Control | What it does |
| --- | --- |
| "The band" | Heading. |
| the line under it | What the band is playing now: "Now: cool, in D. 165 bpm, energy 75%, intensity 56%. Sitting in: tuba." Or "Sound is off." Or, before any sound, "Press any key or click to start the sound." |
| Sound on / Sound off | Mutes the band. Coral while on. |
| Volume | Dial, quiet to loud. |
| All depths / This depth only | Whether the six dials below apply everywhere or only in the band the fish is in; a line under them says which. |
| Dream, Energy, Menace, Reaction, Swing, Balance | Six dials, 0 to 100, each with a word at either end. The first four have a sentence of explanation; Swing and Balance have none. Under Energy a thin pale line shows where the band's energy is right now. |
| Copy preset | Copies the six dials as a line of text ("oarfish-music:1:dream=60,…"). |
| Paste a preset, Apply | A box for such a line, and a button; a line under them says what happened (seven different sentences). |
| "The feel" → Loop assist | One dial: how much help wrapping a swarm. |

States: all depths or this depth; sound on or off; before sound has started (seldom seen: the click that opens the drawer starts the sound); open over the dive, or open beside the pause menu.

### 3. Pause menu (`pause`)

Opened by P, Esc, the pause button, or Options on a controller. It also opens by itself when the tab is hidden, when Esc takes the page out of full screen, and when the browser takes the mouse back in the adventure camera. One column 400 px wide over the dimmed, blurred dive. **At 1920 × 1080 the column is taller than the screen: 1,650 px of column (1,706 with the overlay's padding) against 1,080, so the screen ends in the middle of the "Bring one to look at" buttons, and the rest is below the fold; the whole overlay scrolls.** (Measured in the standalone page.) Markup 422 to 463; css 243 to 252, 171 to 174, 279 to 285; behaviour `setPaused()` `main.js` 1059 to 1075.

From the top:

| # | Control | What it does | Behaviour |
| --- | --- | --- | --- |
| 1 | "Paused" | Heading. | |
| 2 | Resume | Back to the dive. Coral. It has the keyboard when the menu opens, so it shows a focus ring. | 1381 |
| 3 | Full screen | Goes full screen; reads "Leave full screen" while it is. | `fullscreen()` 1078 to 1096 |
| 4 | New dive | Two presses: the first turns it into "Leave this dive? Press again" for four seconds. | `newDive()` 1107 to 1112, 1383 |
| 5 | Leave feedback | Opens the feedback sheet. | 1201 |
| 6 | a line of text | Empty unless there is something to say: full screen refused, or the library changed something. | `note()` 1077 |
| 7 | Shells | A list of the shells worn: a dot in the shell's colour, its name, which segment, what it does worn and what it does shed. Or "None yet. They lie glowing about each band; swim your head over one to take it." | `shellsChanged()` 541 to 548 |
| 8 | Controls: Point and swim / Adventure camera | Two buttons, one coral. A paragraph under them explains the one chosen (three wordings for the adventure camera). The whole section is hidden on a touch screen. | `setMode()` 1024, `showMode()` 1018 |
| 9 | Look speed | Dial, slow to fast, with a sentence. | 1404 to 1408 |
| 10 | Teach me as I play | Tick box with a sentence. Off: no nursery, no prompts, no lessons. | `setTeach()` 716 |
| 11 | Lighter picture | Tick box with a sentence. | `setLight()` 904 |
| 12 | Specimen library | Opens the library. | 1964 |
| 13 | Key bindings | Opens the key bindings. | 1174 |
| 14 | Show keys and tools on screen | Turns the full view on; then reads "Hide keys and tools on screen". | `setFull()` 1100 |
| 15 | Testing | For trying things out, and shown to every player: bands 1 to 5 (go straight there; the current one coral), Grow four segments, Beat the keeper here, then "Bring one to look at (not in the dive yet)" with Squid, Moon jelly, Sea nettle, Helmet jelly, Box jelly, then Unlock every shell, Empty the nest, and a line saying what happened. | 1391 to 1402 |
| 16 | the key list | The same list as on screen in the full view. | `legend()` 1002 |
| 17 | Vibration | Dial, off to strong, with a sentence. | 1414 to 1418 |
| 18 | Test the vibration | Plays three buzzes on a controller and says what the browser answered (long sentences). | 1421 to 1432 |
| 19 | Connect DualSense motors | Only in Chrome and Edge. Asks the browser for the controller. Reads "DualSense motors: connected" afterwards. | 1435 to 1444 |
| 20 | two lines of text | What the vibration test said; and whether a controller is seen: "No controller seen yet. To use one, click the page once, then press any button on it." or "DualSense Wireless Controller is connected, and can vibrate." | `devices()` 1328 to 1333 |

States: keyboard, controller or touch; Point and swim or Adventure camera; no shells or some; New dive armed; full screen on; full view on; the Tuning drawer open beside it; each testing button's own message; the DualSense button there or not.

On a controller, in any menu: the D-pad or the left stick moves from control to control, ✕ presses, ○ goes back, left and right nudge a dial (`main.js` 1340 to 1348).

### 4. Key bindings (`binds`)

Opened by "Key bindings" in the pause menu; takes the pause column's place (540 px wide). Markup 464 to 474; css 253 to 256, 270 to 278; behaviour `main.js` 1115 to 1174 and 1217 to 1230. Remembered in the browser (`oarfish.binds`).

| Control | What it does |
| --- | --- |
| "Key bindings" | Heading. |
| Saved sets | A drop-down: "The defaults", any named sets, and "Not saved yet" when the keys match none of them. Delete beside it (greyed for the defaults). |
| Name this set, Save | A box and a button: keeps the present keys under a name. |
| a line of text | What to do, or what just happened (about ten different sentences). |
| the grid | Four columns: Action, Key, Or, Controller. Twenty actions. Each slot is a button showing the key, or a dash when empty; the four swimming actions say "Left stick" in the controller column and cannot be changed. Click a slot and it turns coral and reads "press a key" (or "press a button"); the next key goes in. Backspace empties it, Esc leaves it. |
| Back to the defaults, Done | At the foot, stuck to the bottom of the screen when the grid is taller than it. Done is coral. |

States: the defaults; a slot waiting; a saved set chosen; keys changed but not saved.

### 5. Leave feedback (`feedback`)

Opened by "Leave feedback" in the pause menu, or by the same words on the end card (then the pause overlay is put up over the end card). Takes the pause column's place (460 px). Markup 475 to 483; css 257 to 268; behaviour `main.js` 1175 to 1216. Nothing is sent from the page: the note is copied, or handed to the device's share sheet.

| Control | What it does |
| --- | --- |
| "Leave feedback" and a paragraph | Heading, and what will happen to the note. |
| the text box | Six lines; "I liked… I got stuck when… I expected…" in grey until something is typed. It has the keyboard when the sheet opens. |
| Add how the dive went | Tick box, on. Under it four lines of facts about the dive, the controls and the browser, for the player to read before sending. |
| Back | Back to where it was opened from. Esc does the same. |
| Share… | Only where the device has a share sheet (phones, mostly). |
| Copy | Coral. Copies the note; a line under the buttons says "Copied. Paste it into a message to whoever sent you the link." |
| a second box | Only when copying was blocked: the whole note, selected, to copy by hand. |

States: empty; written and copied; "Write a line first, even a short one."; copying blocked; with or without Share; opened from the pause menu or from the end card.

### 6. End of a dive (`end`)

Comes up nine tenths of a second after the dive ends, over the dimmed, blurred picture. Markup 484 to 490; css 236 to 242, 269; behaviour `endScreen()` `main.js` 695 to 702, called from `die()` 584 and `finish()` 664.

| Control | What it does |
| --- | --- |
| the title | "Taken by the deep" (died) or "The dive is over" (reached the end). |
| a sentence | Died: "You reached the twilight zone, 450 metres down." Ended: "It took 41:07." Then always "Longest body 4.9 m. 23 caught." and, if fragments were hauled, "3 fragments of the ruins given to the rift (7 in all)." |
| Deepest dive so far: 450 m | Small caps. The one record a screen shows (`oarfish.best`). |
| Dive again | Coral; has the keyboard. Enter, R, or Options on a controller do the same. |
| Leave feedback | A quieter, outlined button. |

States: died; ended. Whatever message was up when the dive ended can still be seen, blurred, under the card.

### 7. Specimen library (`library`)

A page of its own, laid over everything: every creature and thing of the dive on a turntable. Opened by "Specimen library" in the pause menu, or by the address ending `#library` (or `#library/keeper`). "Back to the menu" or Esc closes it; the up and down arrows step through the list. Markup 341 to 360; css 108 to 161; behaviour `game/library.js` 141 to 208, opened in `main.js` 1962 to 1965. Changes are remembered in the browser (`oarfish.npc`).

| Part | What is in it |
| --- | --- |
| Header | "Specimen library", a sentence, and Back to the menu (coral). |
| List (left, 214 px) | 68 specimens in 13 groups under small-caps headings (The oarfish, Swarms, Company, Hunters, Keepers of the rifts, The Sum, Not yet in the dive, Shells, Loose things, Things that grow, On the bed, Stonework, Colours of the world). The one on show is lighter. A coral dot marks one whose colours were changed in this browser. |
| Stage (middle) | The canvas shows through: the specimen, turning, on a measure. Drag to turn, scroll to zoom. |
| Panel (right, 348 px) | The name, what it does in the game, what it is, a line of facts (bands · length · triangles). "In the band: tuba. Hear it" when it has an instrument. **Playground**: Light of (bands 1 to 5; a coral line under the bands it lives in), State (when it has more than one: the Keeper has thirteen), Swarm (size, for swarms), Tint, Speed (a slider, for swimmers), Show (Turning, Wireframe, Oarfish for scale). **Component**: a colour well for each of its colours, with the hex beside it, and a size slider; a changed one is lettered in coral. Reset this one, Reset all, Copy changes for Claude (which also shows the changes in a box), and a line of explanation. |

States: one specimen or another (the panel's rows come and go with what the specimen has); nothing changed (the three buttons greyed) or something changed; the changes copied. Narrower than 760 px the three parts stack and the list becomes a strip that scrolls sideways.

### 8. The dive could not start (`error`)

One paragraph in the middle of a screen of the abyss colour: "The dive could not start in this browser: WebGL is unavailable or the 3D library did not load. Try a current version of Chrome, Safari or Firefox." Shown when the game fails to start, or has not started after twelve seconds. Markup 491; css 294 to 295; behaviour `index.html` 500 to 508.

### Written by script

These parts of the page are empty in `index.html` and filled in by the game as it runs. Here `menus.js` fills them the same way; a change to their wording or layout goes back to these lines.

| What | Where in the game | Where here |
| --- | --- | --- |
| The key list (`#keys`, `#pause-keys`) | `main.js` 999 to 1010 | `menus.js`, "the key list" |
| The Controls paragraph (`#mode-note`) | `main.js` 1018 to 1023 | "the two sets of controls" |
| The binding grid and the saved sets (`#bind-grid`, `#bind-preset`), and its messages | `main.js` 1127 to 1173, 1217 to 1230 | "key and button bindings" |
| The facts on the feedback sheet, the note itself, its messages | `main.js` 1177 to 1216 | "feedback" |
| The shells list and the dots on the scale bar | `main.js` 541 to 548 | "shells" |
| The scale bar's numbers, the band's name, the marker's label | `main.js` 335 to 336, 840 to 869 | "the heads-up display" |
| Messages, title card, key prompts | `main.js` 715 to 789, 829 to 836; the lessons' words are where each is said (search `say(` and `tell(`) | "the heads-up display" |
| The end card's words | `main.js` 584 to 588, 664 to 668, 695 to 702 | "the end of a dive" |
| The testing buttons and their messages | `main.js` 1391 to 1402 | "testing tools" |
| The controller line, the vibration test's answers | `main.js` 1328 to 1333, 1421 to 1444 | "the feel, teaching…" |
| The drawer's lines and the preset's messages | `main.js` 818 to 825, 1463 to 1513 | "the Tuning drawer" |
| The library's list and panel | `game/library.js` 141 to 171 | "the specimen library" |

### Fonts, colours and sizes actually in use

Counted from the `<style>` block; nothing here is invented.

**Typefaces** (from Google Fonts in the game; local copies here):

| Name in the styles | Face | Used for |
| --- | --- | --- |
| `--font-display` | IM Fell English, almost always italic | Headings and names: Paused, the end card's title, the band's name, a message's title, the library's names. |
| `--font-caps` | IM Fell English SC (small capitals), letter-spaced 0.12 to 0.22 em | Labels: section names (SHELLS, CONTROLS, TESTING), dial names, the plate's lettering, "40 M DOWN", the length. |
| `--font-body` | Alegreya Sans 400, 500 (buttons, key caps), 700 (shell names) | Everything else. |
| none | the system's monospace | Preset codes, hex colours, the library's text box. |

**Type sizes**: display 20, 26, 30 px and three headings that grow with the screen: 30 to 44 (Paused, Key bindings, Leave feedback), 30 to 46 (end card), 30 to 52 (title card). Small capitals 11.5, 12, 13, 14, 15, 16, 17, 21 px. Body 12, 12.5, 13, 13.5, 14, 14.5, 15, 16, 17 px.

**Colours**: six named, one of them unused, and one loose.

| Name | Value | Used for |
| --- | --- | --- |
| `--foam` | `#f2faf7` | All lettering and lines. Also at 24 different strengths between 10% and 94% for quieter text and hairlines (the commonest: 26% for borders, 20% for dividers, 80% and 86% for secondary text). |
| `--ink` | `#06222e` | All panels and veils, never solid: 15 strengths between 38% and 86% (buttons 58%, pause veil 64%, end veil 62%, message card 68%, library panels 72%, drawer 86%). |
| `--coral` | `#f4a4b9` | The main button, anything chosen or pressed, dials and tick boxes, warnings, food on the scale bar. |
| `--alarm` | `#ff7f96` | The scale bar when short, the stamina ring when winded, the flash when bitten. |
| `--abyss` | `#0b3345` | The page behind the picture; the error screen. |
| `--water` | `#2b93a3` | Declared, never used. |
| (none) | `#04121c` | The fade between bands, before it takes the next band's water colour. |

Shell colours come from the game's data (ten of them, `#f4e3c1` to `#cfe6ff`), not from the styles.

**Shapes**: buttons are pills (radius 999 px) with a 1 px line at foam 26%; key caps 5 px; text boxes, the drop-down and binding slots 8 px; the message card 9 px; the library's list rows and its segmented buttons 7 px. Blur behind panels: 5 px (pause and end veils), 6 px (buttons), 7 px (message card), 8 px (library), 12 px (drawer).

**Spacing**: the plate mark 12 px from the edge; lettering 24 to 30 px from the edge; overlays padded 28 px; the pause column's gap 14 px, with a hairline and 14 px above each section; rows of buttons 8 px apart (6 px in the drawer); column widths 400 (pause), 540 (bindings), 460 (feedback), 520 at most (end), 330 (drawer), 214 and 348 (library).

**Movement**: the drawer slides in 0.35 s; messages rise 10 px and fade in 0.3 s; the title card fades over 0.9 s; the fade between bands 0.65 s; the short scale bar throbs every 0.7 s.

### What looks unfinished or inconsistent

Noted, not fixed.

1. **No way in.** No title, no "start", no name of the game on screen but the plate's caption in French and Latin. A first-time player lands in a moving dive with a button that says "Skip tutorial".
2. **The pause menu is one long list in the order things were added.** Taller than a 1080 screen (1,706 px in all): it fits only as far as the middle of the testing tools. Vibration and the controller's status are at the very end, after the testing tools and the key list. The key list (reference) sits between two groups of settings.
3. **Testing tools are in every player's pause menu**, between the settings and the key list, with five creatures "not in the dive yet". (They were hidden once, and George could not find them. Where they live is a decision for the redesign.)
4. **Settings are in two places with no rule one can see.** Look speed, teaching, lighter picture and vibration are in the pause menu. Loop assist is in the Tuning drawer under "The feel", a heading with one dial under it, though look speed and vibration are saved as "feel" too. The drawer's button says "Tuning", its heading says "The band".
5. **The Tuning drawer cannot be reached from the plain view** except by pausing first: its button only shows in the full view or while paused.
6. **Coral means two things.** It is the main action (Resume, Dive again, Done, Copy, Back to the menu) and also "this one is on" (Point and swim, the current band, Sound on, the Tuning button while the drawer is open, the pause button while paused). On the pause menu both meanings are on screen at once. In the library, "this one is on" is a pale fill and not coral.
7. **The pause button does not change its sign.** Paused, it turns coral and still shows two bars; only its hidden label changes to "Resume".
8. **Focus rings come and go.** Resume and Dive again always open with a pale ring round them (they are given the keyboard); the feedback text box opens with the browser's own ring, which is not the game's.
9. **Seven body sizes between 12 and 15 px**, half a pixel apart, and three large headings each with its own top size (44, 46, 52).
10. **Many strengths of the same two colours**: 24 of foam, 15 of ink.
11. **Dials are uneven.** Four of the band's dials explain themselves and two do not; a dial is the browser's own slider tinted coral.
12. **Left-overs in the styles**: `--water` is never used; `#drawer h2 + .lede` styles a paragraph that is not in the page; the classes `paste` (rows in key bindings) and `many` (the library's Show row) have no styles; `#bind-grid` is given its gap twice (lines 271 and 278); a comment about the stamina ring (line 108) sits over the library's styles.
13. **Under the end card the dive's lettering carries on**: the last message stays up, and a short body's scale bar keeps throbbing pink through the blur.
14. **On a phone on its side the foot is cut off.** The stage is never less than 440 px tall, so on a screen 390 px tall the scale bar (the health bar) is below the edge and the caption sits on it; the touch sentence of the key list runs into the caption. In both directions the marker's label ("the rift · 76 m") is cut by the right edge, and upright the corner buttons sit over the band's name. Upright, the caption breaks onto two lines. (Seen in the phone pictures in `shots/`.)
15. **Things only a developer needs are a key away**: H puts Wireframe and Skeleton on a player's screen.
16. **Long sentences in small places**: the vibration test answers with up to fifty words under a button; the controller line can run to three lines.
17. **The error screen** is a bare paragraph: no heading, nothing to press.
18. **"Connect DualSense motors"**, "Test the vibration" and the Vibration dial show whether or not a controller is there.

Found later, while building the Figma frames (all three are in the copied styles, and the two screens they are on matched the real game to the pixel, so they are in the game too):

19. **In the library's list the specimen on show is dark on dark.** The general rule for a pressed button turns its text ink-dark; the list's own rule replaces only the coral background, with a pale see-through one. "The Keeper" reads ink on near-ink.
20. **The "Name this set" box in key bindings is in the monospace face.** It takes the rule written for the drawer's preset box (`.preset input`), because the saved-sets section carries the class `preset` too.
21. **The drawer's "Now: …" line runs into "Sound on"** when it wraps onto two lines (as it does at 1920 × 1080 with a player sitting in): the drawer is a column taller than the screen, and `min-height: 1.35em` on that line lets it be squeezed to one line's height.

---

## The screens and states of this page

`screen` and `state` are what goes in the address; the pictures in `shots/` and the frames in Figma carry the same two words (`pause--controller`, "Pause menu / A controller connected…").

8 screens, 43 states; the list itself is `SCREENS` in `kit.js`, and the bar's State menu shows the same names. "Real game compared" is the result of `node tools/shot_ui.mjs game` (see the next section). "Figma" says which state is in the Figma file as layers. Besides these, `shots/` has eight phone pictures: `hud--touch`, `pause--touch`, `library--default` and `end--taken`, upright (390 × 844) and on their side (844 × 390).

| Screen | `state` | What it shows | Still | Real game compared | Figma |
| --- | --- | --- | --- | --- | --- |
| Heads-up display (`hud`) | `opening` | A dive opens: the band’s title card and the first lesson | start | not compared | – |
| Heads-up display (`hud`) | `nursery` | A first dive: the nursery, with Skip tutorial and a key prompt | nursery | not compared | – |
| Heads-up display (`hud`) | `plain` | The plain view, nothing happening | ruins | marker 1 px off | editable |
| Heads-up display (`hud`) | `toast-teach` | A message: a lesson | swarm | not compared | – |
| Heads-up display (`hud`) | `toast-warn` | A message: a warning, with a title | keeper | not compared | – |
| Heads-up display (`hud`) | `toast-shell` | A message: a shell taken | ruins | not compared | – |
| Heads-up display (`hud`) | `toast-note` | A message: a note | ruins | not compared | – |
| Heads-up display (`hud`) | `hunted` | Hunted: the stamina ring and a key prompt | deep | not compared | – |
| Heads-up display (`hud`) | `low` | Nearly too short: the scale bar in alarm | end | not compared | – |
| Heads-up display (`hud`) | `rift-toll` | Over an open rift: the toll marked on the scale bar | keeper | not compared | – |
| Heads-up display (`hud`) | `shells` | Shells riding on the scale bar, food on the way | swarm | marker 1 px off | – |
| Heads-up display (`hud`) | `flash-hurt` | Bitten: the flash round the edge | end | not compared | – |
| Heads-up display (`hud`) | `flash-grow` | Grown: the flash round the edge | swarm | not compared | – |
| Heads-up display (`hud`) | `full` | The full view: keys and tools on screen | ruins | same | – |
| Heads-up display (`hud`) | `full-look` | The full view, adventure camera | ruins | marker 1 px off | – |
| Heads-up display (`hud`) | `controller` | The full view, a controller in hand | ruins | not compared | – |
| Heads-up display (`hud`) | `touch` | A touch screen: the four buttons at the right | ruins | not compared | – |
| Tuning drawer (`drawer`) | `default` | The band playing, sliders for all depths | swarm | "Now:" line (sample) | editable |
| Tuning drawer (`drawer`) | `this-depth` | Sliders set for this depth only | keeper | not compared | – |
| Tuning drawer (`drawer`) | `muted` | Sound off | swarm | not compared | – |
| Tuning drawer (`drawer`) | `silent` | Sound not started (seldom seen: the click that opens the drawer starts it) | swarm | not compared | – |
| Pause menu (`pause`) | `default` | Keyboard and mouse, plain view | ruins | same | editable |
| Pause menu (`pause`) | `lower` | The same, scrolled to the end | ruins | same | – |
| Pause menu (`pause`) | `controller` | A controller connected (scrolled to the end, where it shows) | ruins | same | – |
| Pause menu (`pause`) | `shells` | Three shells worn | swarm | same | – |
| Pause menu (`pause`) | `look` | Adventure camera chosen | ruins | same | – |
| Pause menu (`pause`) | `armed` | New dive pressed once | ruins | same | – |
| Pause menu (`pause`) | `full` | With keys and tools on screen | ruins | same | – |
| Pause menu (`pause`) | `tuning` | With the Tuning drawer open over it | keeper | not compared | – |
| Pause menu (`pause`) | `touch` | On a touch screen | ruins | not compared | – |
| Key bindings (`binds`) | `default` | The defaults | swarm | same | editable |
| Key bindings (`binds`) | `waiting` | A slot waiting for a key | swarm | same | – |
| Key bindings (`binds`) | `saved` | A saved set in use | swarm | not compared | – |
| Leave feedback (`feedback`) | `empty` | Opened from the pause menu | deep | facts (sample) | editable |
| Leave feedback (`feedback`) | `copied` | A note written and copied | deep | not compared | – |
| Leave feedback (`feedback`) | `by-hand` | Copying blocked: the note shown to copy by hand | deep | not compared | – |
| Leave feedback (`feedback`) | `share` | Where the device can share: a third button | deep | not compared | – |
| Leave feedback (`feedback`) | `from-end` | Opened from the end of a dive | end | facts (sample) | – |
| End of a dive (`end`) | `taken` | Taken by the deep | end | same | editable |
| End of a dive (`end`) | `over` | The dive is over | surface | same | – |
| Specimen library (`library`) | `default` | The Keeper on the stand | library | same | editable |
| Specimen library (`library`) | `changed` | A colour and the size changed, and the changes copied out | library | not compared | – |
| The dive could not start (`error`) | `default` | No WebGL, or the 3D library did not load | none | not compared | editable |


Stills (`bg/`): `start` the nest, as a dive opens · `nursery` the first moment of a first dive · `ruins` open water among columns, first band · `swarm` a long body most of the way round the great swarm · `keeper` the Keeper come over to the fish, the mural behind, the veil over the rift · `deep` deep twilight, 800 m · `end` a short body and a tail-biter in the twilight zone, as it is when "Taken by the deep" comes up · `surface` the raft under an empty sky, as it is when "The dive is over" comes up · `library` the library's own stage with the Keeper on it. Each still has, in `bg/stills.js`, what the plate said at that moment, so the band's name, the length on the scale bar and the marker under a menu belong to the picture behind it.

Two things a still cannot be: the pictures behind "Over an open rift" and "Hunted" are borrowed (the Keeper is still standing in the one, and nothing is chasing the fish in the other); and the library's picture stays the Keeper whichever specimen is picked.

## How closely the copy matches the game

`node tools/shot_ui.mjs game` takes the real game to the moment of a state's still (the same steps that took the still), opens the menu in it as a player would, puts the game's own picture away behind the very same still, and counts the pixels that differ from this page at 1920 × 1080. Each result is in `out/ui-compare/` as the game, the differences (marked red) and the copy, side by side.

| States | Pixels that differ | What differs |
| --- | --- | --- |
| `pause--default`, `--lower`, `--controller`, `--shells`, `--look`, `--armed`, `--full` | 0 | nothing |
| `binds--default`, `binds--waiting` | 0 | nothing |
| `end--taken`, `end--over`, `library--default` | 0 | nothing |
| `hud--full` | 0 | nothing |
| `hud--plain`, `hud--full-look`, `hud--shells` | 500 to 720 (under 0.04%) | only the marker ("the rift · 76 m"): the game does not land it on the same pixel from one run to the next |
| `drawer--default` | 722 | the "Now: …" line and the thin energy line: sample numbers here, live ones in the game |
| `feedback--empty`, `feedback--from-end` | about 2,700 (0.13%) | the four lines of facts: sample numbers here |

So wherever the two were compared, type, spacing and colours are the game's to the pixel, and what differs is numbers. **24 states were not compared** (all marked "not compared" in the table above): every message state, the title card, the nursery, hunted, low, over an open rift, the two flashes, the controller and touch views of the heads-up display, three drawer states, `pause--tuning`, `pause--touch`, `binds--saved`, three feedback states, `library--changed`, the error. They use the same copied styles and markup, so they should match as closely, but that has not been checked; to check one, add a line to `RECIPES` in the tool that takes the real game there.

Where the copy knowingly differs from the game:

- **Sample numbers**: the end card, the feedback facts, the "now playing" line and the band's energy line are made up (the words round them are the game's). The two end stills set the same numbers on the real dive, so those compare equal.
- **The share button** on the feedback sheet only writes "Handed over. Thank you."; the game opens the device's share sheet.
- **The library**: the panel changes with the list, but the picture behind stays the Keeper; and only the Keeper's panel has been looked at (the other 67 come from the same data).
- **A touch screen** cannot be faked for the browser, so the bar's Touch setting applies a copy of the game's three touch rules (`kit.css`). Keep them in step with `menus.css`.
- **Timers**: with `hold=1` nothing fades, throbs or times out; without it, messages time out and the pink scale bar throbs as in the game.

## Fonts

The game loads IM Fell English, IM Fell English SC and Alegreya Sans from Google Fonts. This page must ask the network for nothing, so `fonts/` holds the same faces as files (from the `@fontsource` packages the project already has for its thumbnail tool; SIL Open Font License, text in `fonts/OFL.txt`). The comparison with the real game was made with the game using these same files.

## Decisions made while nobody could be asked

- **Nine stills, not six.** The six asked for, plus the nursery (it is the true first moment of a first dive), the surface (the other way a dive ends) and the library's stage (that screen has its own picture).
- **The nest in `start` is a middling one** (a record of 16 segments, three shells found, one fragment), not an empty one: it is what a menu will stand over after a few dives.
- **A phone size is offered**, upright and on its side, because the game has a touch layout and rules for narrow screens today.
- **The stage sits in a frame** (the page loaded a second time inside itself) so that the width the menus feel is the width chosen in the bar, and the game's own rules for narrow screens apply.
- **`shots/` is not committed** (38 MB; the limit given was about 30). The tool makes it again.
- **The main state of each screen** (the one put in Figma as layers) is the one a player sees first or most: the plain view for the heads-up display, and the first state of every other screen.
- **The Figma layers were measured off the page, not rebuilt by hand**: every box and line of text where Chrome put it. This keeps them faithful and lets any state be added later, at the price of fixed positions instead of auto layout. No component library was used: the file's libraries (Material 3, Simple Design System, iOS) have nothing of the game's look.
- **Sample numbers** on the end card, the feedback facts and the "now playing" line are made up to read like a real dive; the words round them are the game's.
