# Handover: the menu kit for Oarfish dive (branch `ui-menu`)

Written for an engineer who has seen none of this work. The job was stopped part way, on instruction, to change model. Everything made so far is committed on `ui-menu` (commit `21b15ab`, "WIP: menu kit…", and the commit that adds this file). Nothing was pushed. Nothing was written to Figma.

- Worktree: `/home/claude/oarfish-ui`, branch `ui-menu`, cut from `squid-play` at `f8c84fe`. Work only here. `/home/claude/oarfish-repo` and the other `/home/claude/oarfish-*` folders belong to other jobs.
- `node_modules` in the worktree is a symlink to `/home/claude/oarfish-repo/node_modules`. It shows as untracked (the root `.gitignore` says `node_modules/`, which does not match a symlink). Never `git add -A`; add by path: `git add tools/shot_ui.mjs ui HANDOVER.md`.
- No existing file of the game was changed. All of it is new: `ui/`, `tools/shot_ui.mjs`, and this file.
- The original brief is at the end of this file, whole. `ui/README.md` is the kit's own document (brief for the next chat, inventory); read it after this.

## 1. Done, and how far each was checked

| Thing | State | Checked how |
| --- | --- | --- |
| `tools/shot_ui.mjs` | Written; five modes (`stills`, `page`, `game`, `dump`, and `small` as a modifier). | Every mode has run to the end at least once without a page error. |
| Stills, `ui/bg/*.png` (9, 1920 × 1080): `start nursery ruins swarm keeper deep end surface library` | Taken. | I read `start ruins swarm keeper deep end surface library` at full size after their first take: no interface in them, framed well. **Not looked at since:** all nine were taken again twice with the same steps (the pictures should be the same; `end.png` changed in size by a few kB after I set some numbers on the dive before it dies), and **`nursery.png` was added later and has never been looked at.** |
| `ui/bg/stills.js` | Written by the `stills` mode: for each still, the band, segments, food, where the marker, head and tail are on screen, and the nursery's key prompt. | Used by the page; the pause menu over `ruins` matched the real game to the pixel, which includes the lettering and marker under the blur. |
| `ui/menus.css` | The game's `<style>` block, lines 26 to 327 of `index.html`, copied whole under a five-line comment. | `diff <(sed -n '26,327p' index.html) <(tail -n +6 ui/menus.css)` printed nothing. |
| Markup in `ui/index.html` | Lines 331 to 492 of the game's `index.html`, plus one added line (`<canvas id="still">`). | `diff <(sed -n '331,492p' index.html) <(sed -n '19,181p' ui/index.html)` showed only that line. |
| `ui/game-data.js` | Written by the `dump` mode from the running game: bands, shells, actions and default keys, controller button names, creatures to bring, all 68 library specimens (13 groups), one sample "now playing" line. | Ran once; the page renders from it. |
| `ui/fonts/` | The three typefaces as files (from `node_modules/@fontsource`, OFL), `fonts.css`, `OFL.txt`. | The page asked the network for nothing during a full `page` run (the tool logs any request that is not its own server). |
| `ui/menus.js` | Stands in for `main.js` / `library.js`: same templates, same wording, cheap interactions. | Rendering of states: yes (see the comparison below). **Clicking through by hand: never done.** |
| `ui/kit.js`, `ui/kit.css` | 8 screens, 43 states, addressable by URL; `?bare` mode; the switcher bar. | `?bare&hold=1` mode: yes, it is what every picture was taken through. **The switcher bar itself (the page without `?bare`: bar, frame, sizes, the backquote key) has never been opened in a browser.** |
| `ui/README.md` | Brief for the next chat, inventory of every screen with file and line, tokens table, 18 notes on what looks unfinished, decisions. | Written from reading the code. Three parts are marked "NOT … YET" in capitals (Figma, the table of states, the match write-up). See section 2 for claims in it that I did not verify. |

### The comparison with the real game (step 4, part done)

`node tools/shot_ui.mjs game` takes the real game to the same moment as a state's still, opens the menu in it, hides the game's canvas behind the very same still, and counts the pixels that differ from the standalone page. Results at 1920 × 1080, real game on the left of each `out/ui-compare/<id>.side.png`, differences in the middle, copy on the right:

| Screen and state | Pixels that differ | What differs |
| --- | --- | --- |
| `pause--default`, `--lower`, `--controller`, `--shells`, `--look`, `--armed`, `--full` | 0 | nothing (third run, after the last edits) |
| `binds--default`, `binds--waiting` | 0 | nothing (third run) |
| `end--over`, `library--default` | 0 | nothing (second run; **not run again after the last edits**) |
| `hud--full` | 0 | nothing (third run) |
| `hud--plain`, `hud--full-look`, `hud--shells` | 500 to 720 (0.02 to 0.04%) | only the marker ("the rift · 76 m"), one pixel off: the game does not land it on exactly the same pixel from one run to the next |
| `drawer--default` | 722 | the "Now: …" line and the thin energy line: sample numbers in the copy, live ones in the game |
| `feedback--empty` | 2772 (0.13%) | the four lines of facts: sample numbers in the copy |
| `feedback--from-end` | 2642 (second run) | the same facts lines; **not run again after the last edits** |
| `end--taken` | 572 (second run) | the short scale bar's throb, stopped at a different point in each. I changed the tool to stop it from the start in both; **that fix has not been run** |

So type, spacing and colours match wherever they were compared. States with no recipe in the tool (`RECIPES`) were not compared with the game: all the message states, `hud--opening`, `--nursery`, `--hunted`, `--low`, `--rift-toll`, the two flashes, `hud--controller`, `hud--touch`, the other drawer states, `pause--tuning`, `pause--touch`, `binds--saved`, three feedback states, `library--changed`, `error--default`.

## 2. Half done, file by file

- **`ui/shots/`** (not committed; `ui/.gitignore` keeps it out because it is 34 MB and the brief's limit is about 30). The 49 pictures there are **stale**: they were taken before I renamed and added drawer states (`default`, `this-depth`, `muted`, `silent`; the old `drawer--playing.png` no longer has a state) and before the page began to give Resume the keyboard as the game does (so Resume has a focus ring now). I looked at one only (`pause--default`). Take them again and look at them.
- **`out/ui-compare/`** (ignored by the root `.gitignore`): the third run was stopped after `feedback--empty`. The files for `feedback--from-end`, `end--taken`, `end--over`, `library--default` are from the second run.
- **`ui/README.md`**: unverified statements, to check or soften:
  - the pause column's height is said to be "taller than the screen… reaches only as far as the first testing buttons" (true of the picture I saw at 1080; the full height was never measured);
  - "about forty different lessons", "seven different sentences" (preset messages), "about ten different sentences" (bindings messages) are counts by eye of `say(` / `tell(` calls;
  - note 14 (a phone on its side cuts off the foot; upright, the caption breaks and the model tools sit mid-foot) comes from reading the CSS (`min-height: 440px`, the 640 px rules), not from looking at the phone pictures, which exist but were never opened;
  - "opening from disk is meant to work" is untried;
  - the tokens table was counted by a script from the CSS and is sound.
- **`ui/kit.js`**: the shell (bar plus a frame that loads the same page with `?bare`) is written and unseen. Things to try first: does the frame scale and centre; do the five menus change it; does the backquote key hide the bar from inside and outside the frame; does `history.replaceState` complain when opened from disk.
- **`ui/menus.js`**: the library panel was only ever rendered for the Keeper; the other 67 come from the same data but were not looked at. The share button on the feedback sheet only writes "Handed over. Thank you." (the game opens the device's share sheet).
- **`tools/shot_ui.mjs`**: the header comment lists the modes correctly. `RECIPES` has no entries for the new drawer states.

## 3. Left to do from the brief, in order

1. **Stills (brief, item 2):** read `ui/bg/nursery.png`, `end.png`, `surface.png` (and glance at the rest again). Retake any that is wrong: `node tools/shot_ui.mjs stills nursery`.
2. **Standalone page (item 3):** open it without `?bare` and exercise the bar; open with `?bare` and confirm no bar; try the three desktop sizes and the phone; try it from disk. Fix what breaks.
3. **Check by eye (item 4):** `node tools/shot_ui.mjs page`, read the pictures; `node tools/shot_ui.mjs game` for the rest of the comparison; make the contact sheet at `/home/claude/ui-sheet.jpg` and read it. The project's `tools/sheet.py` does it: `python3 tools/sheet.py /home/claude/ui-sheet.jpg 6 480 ui/shots/*.png` (it labels each tile with the file name; `.jpg` works).
4. **Figma (item 5):** not started. See section 6.
5. **README (items 1 and 6):** write the table of states (from `SCREENS` in `kit.js`), the "How closely the copy matches" section (from the table above, brought up to date), the Figma paragraph in the brief, and re-check the unverified statements. The opening message for a new chat is already written there.
6. **Commits and the report** as the brief asks. Decide again whether `ui/shots/` fits under 30 MB (it did not).

## 4. Decisions taken, and why

- **Nine stills, not six**: the six asked for, plus `nursery` (the real first moment of a first dive), `surface` (the other ending) and `library` (that screen stands over its own picture).
- **The nest in `start` has a middling record** (16 segments, three shells, one fragment) set through `localStorage`, so the picture is what a menu stands over after a few dives.
- **Each still records what the plate said** (`bg/stills.js`), so the band's name, the scale bar and the marker under a menu fit the picture behind it. This is also what made a pixel comparison possible.
- **The still is a `<canvas>` with a CSS background**, not an `<img>`: the game's rules say "the canvas" and "everything but the canvas" (`#stage.lib > :not(canvas):not(#library)`), and they have to fall on it unchanged.
- **CSS and markup are copied whole and untouched**, so they can be laid back over the game's block; everything of the kit's own is in `kit.css` / `kit.js`.
- **Words the game builds by script are read off the running game** into `game-data.js` rather than typed out, so they can be refreshed when the game changes.
- **The stage sits in a frame of the chosen size** (the page inside itself) so the game's media queries see the chosen width. A touch screen cannot be faked for a media query, so `kit.css` repeats the game's three touch rules under `html.kit-touch` (the README warns to keep the two in step).
- **Fonts are local files**, because the page must make no network request; the game takes the same faces from Google Fonts.
- **A phone size is offered**, upright and on its side: the game has a touch layout today.
- **The hide-the-bar key is the backquote**: every letter near at hand is one of the game's keys.
- **`ui/shots/` is left out of the commits** (34 MB).
- **The drawer's usual state is "the band playing"**: in the real game the click that opens the drawer starts the sound, so "Press any key or click to start the sound" is almost never seen there. It is kept as the state `silent`.
- **Sample numbers** (end card, feedback facts, now playing) are made up to read like a real dive; the two end stills set the same numbers on the real dive so the end card compares equal.

## 5. Commands

Run from `/home/claude/oarfish-ui`. Put `CHROME=/usr/bin/google-chrome` in front: there is no downloaded Chromium here. The machine has two cores, no graphics card, and other jobs on it; a foreground command in this harness is cut at 600 s, so run the long ones in the background and read the log.

| Command | What it does | Where the output goes | How long here |
| --- | --- | --- | --- |
| `node tools/shot_ui.mjs` or `… stills [name…]` | The stills, world 4242, through the game's own camera, interface hidden. Also rewrites `ui/bg/stills.js`. | `ui/bg/<name>.png`, `ui/bg/stills.js` | about 4 min for all nine |
| `… stills small [name…]` | The same at 960 × 540, for trying a framing. | `out/ui-trial/` | under a minute each |
| `… dump` | Reads the game's words and lists off the running game. | `ui/game-data.js` | about a minute |
| `… page [id-prefix…]` | A picture of every state of `ui/index.html?bare&hold=1…`, and eight at phone sizes. | `ui/shots/<screen>--<state>.png`, `…@phone.png`, `…@phone-wide.png` | a few minutes |
| `… game [id-prefix…]` | The comparison described above. | `out/ui-compare/<id>.game.png`, `.copy.png`, `.side.png`, `report.json` | 30 to 60 s a screen; 12 min or more for all 19 when the machine is busy |
| `npm start` | The project's own server. | http://localhost:8080/ui/ is the kit; http://localhost:8080/ is the game | |
| `python3 tools/sheet.py <out> <cols> <tile width> <files…>` | The project's contact-sheet maker. | `<out>` | seconds |

The tool starts its own server on a free port and serves three.js from `node_modules`, as the project's other shot scripts do. It answers the game's request to Google Fonts with `ui/fonts/fonts.css`, so the real game is photographed in its real typefaces.

How a still is set up: one entry in `STILLS` in the tool. How a state is put on the page: one entry in `SCREENS` in `ui/kit.js` (`set` changes what the game would know, `then` opens or says what comes on top). How the real game is taken to a state: one entry in `RECIPES` in the tool, keyed by the same id.

## 6. Figma: exactly what has been written

**Nothing.** No page, no frame, no upload. `create_session` was not called. The only Figma calls made were two reads of skill text through `mcp__fig__get_figma_skill` (`skill://figma/figma-use/SKILL.md` and `skill://figma/figma-generate-design/SKILL.md`), which the brief requires before any write. The file `rFNso5egYivjGoBfhuqi1B` is as it was.

What those two documents say that shapes the work:

- `use_figma` takes at most 50,000 characters of code a call, and the whole request at most 100 KiB; no base64 images in it. Page context resets every call: `await figma.setCurrentPageAsync(page)` each time. Return every created node id. Colours are 0 to 1. Load a font before touching text, and check style names with `figma.listAvailableFontsAsync()` first.
- Images go in through `mcp__fig__upload_assets`: it returns upload addresses, the bytes are POSTed to them (curl), and each can be set as the fill of an existing node. After that an image fill can be copied to other nodes inside `use_figma`.
- Pass `skillNames: "resource:figma-use,resource:figma-generate-design"` on each `use_figma` call.
- The generate-design skill says a flattened picture of a complete screen must never go into the deliverable. The brief allows exactly that as a fallback ("place the screenshots from step 4 as image frames instead and say so plainly"). The two disagree; whoever does the step should aim for editable layers and, if falling back, say so in the report.
- It also asks for `get_libraries` / `search_design_system` before building. The file is said to hold one blank page, so there is probably nothing to find, but the calls are expected.

The plan I had, not started: build each screen with a few helper functions that mirror the CSS (button, key cap, dial, tick box, section with its hairline), in auto-layout, text as text, panels as shapes with the real colours and a background blur for the veils; one 1920 × 1080 frame per state, named `Screen / State` as in `kit.js`; clone a screen's first frame for its other states and change only what differs; a bottom rectangle named for the still, filled through `upload_assets` (nine uploads, then copy the fill to the frames that share it). Fonts wanted: IM Fell English (Regular, Italic), IM Fell English SC (Regular), Alegreya Sans (Regular, Medium, Bold). Whether Figma has them is **not checked**. The brief's rules for this step stand: one new page named "Menus today (from the game)", add only, touch nothing else, stop if a tool call fails twice, screenshot the page at the end and look at it.

## 7. Traps met

- **`run.safe` makes the fish blink**, so a picture can catch it invisible. The tool keeps hunters off with `run.hush` (which does not show) and sets `run.safe = 0` before a picture. A dead fish flickers nine times a second for good: the `end` still waits for a frame in which it is drawn.
- **`g.sim(seconds, forced)` with a forced input skips the controller**: `devices()` only runs in an un-forced frame. That is why the pause menu's controller line was empty in the first comparison. An un-forced `g.sim(1e-6)` runs one real frame; do it only while paused, or the dive moves.
- **A click in the real game starts the band**, which changes the drawer's first line.
- **The end card comes up on a real clock** (900 ms `setTimeout`), not on the dive's clock: wait for it.
- **The game is not exactly repeatable**: the marker can land a pixel away from where it was when the still was taken.
- **Headless Chrome here does not reach Google Fonts**; without the tool's stand-in the game falls back to system fonts and nothing compares.
- **The library's still** is taken with `#library` at `opacity: 0`, not hidden: the library's camera is offset by the widths of its list and panel. Under `window.__hold` the library does not animate; the tool calls `g.lib.frame()` itself.
- **The `surface` still** is reached by putting a dive in the first band into the state `rise` by hand (the real ending needs the last boss). The marker is hidden by hand there, as it would be after a real ending.
- **What throbs or fades** makes two pictures differ for no reason: both sides are held (`hold=1` on the page, the same rule injected into the game from the start).
- **This harness changed my shell's starting folder twice** (to `/home/claude/reports`, then `/home/claude/oarfish-bosses`, another job's worktree). Use absolute paths, and `cd /home/claude/oarfish-ui &&` in every command.
- **The session was cut once in the middle of a run** and resumed by itself; the edits had landed, the run had not finished. Check `git status` and the logs before trusting that a long command completed.

## 8. The original brief, whole

You are preparing a starter kit so that a designer can redesign the menus of his browser game without running the game. The game is "Oarfish dive" (plain ES modules, three.js from a CDN, no build). The designer, George (a UX and product designer), is away; nobody can answer questions, so make the most reasonable call, write down what you decided, and carry on. If a permission or safety check refuses something, do NOT work around it: stop that step and report it.

## Set up
- Repository: /home/claude/oarfish-repo, working branch `squid-play`. Do not work in that directory. Make your own worktree and branch:
  `cd /home/claude/oarfish-repo && git worktree add /home/claude/oarfish-ui -b ui-menu squid-play && cd /home/claude/oarfish-ui && ln -s /home/claude/oarfish-repo/node_modules node_modules`
- Read /home/claude/oarfish-ui/CLAUDE.md first (project notes, conventions, how pictures are taken with headless Chrome: see the tools/shot_*.mjs scripts).
- Never push. Never touch `main`. Never commit `package-lock.json`. Do not publish anything anywhere except the one Figma step below.
- Do NOT change any existing file of the game (index.html, game/*.js). Everything you make is new files: a `ui/` folder and one new script under `tools/`. Other jobs are changing the game at the same time and your branch must merge without conflict.
- Headless Chrome is at /usr/bin/google-chrome (set CHROME to it, as the other tools do). The machine has no graphics card, so the game renders slowly but correctly. Other jobs share the machine; be patient with timeouts.

## What to make
1. **An inventory of today's interface**, `ui/README.md`. Go through index.html and game/main.js and list every screen and overlay the game shows a person: the opening screen, the pause menu and every section in it (settings, the "feel" dials, controls, testing tools and so on), the card at the end of a dive, the nest or records if they are a screen, the library page if there is one, the heads-up display, any toasts or messages. For each: what opens it, every control on it and what the control does, which states it has (for example a controller connected or not), and where its markup, styles and behaviour live (file and line). Note the fonts, colours and sizes in use, as a designer would want them (a small table of the tokens actually found, not an invented design system). Note anything that looks unfinished or inconsistent, without fixing it.
2. **Stills from the game as backgrounds**, `ui/bg/*.png`, 1920×1080, with no menu, overlay or heads-up display in the picture. About six, chosen so a menu can be judged over different pictures: the surface or first moment of a dive; open water in the first band with ruins; a busy moment with a swarm; the Keeper's ground at the rift (the crab in view); a deeper, darker band; a moment that suits the end of a dive. Write `tools/shot_ui.mjs` to take them, following the existing shot scripts (seed 4242 is the world the project's checks use). Look at each still yourself (Read the image) and retake any that is empty, badly framed or has interface in it.
3. **A standalone page with today's menus and no game**, `ui/index.html` (plus `ui/menus.css` and `ui/menus.js` if that keeps it tidy; no frameworks, no build, no network requests). It shows each screen and overlay from the inventory exactly as the game shows it today, over one of the stills. Copy the game's real markup and styles into the page so it is faithful (copy, do not link: the designer will edit these freely); keep the same class names and ids so changes can be carried back. Each screen and each of its states must be reachable without the game: a small switcher bar (clearly not part of the design, hidden with a key press, and absent when the page is opened with `?bare`) to pick the screen, the state, the background still and the viewport size (1920×1080, 1440×900, 1280×720; and a phone size only if the game has a touch layout today). Controls on the menus should respond as far as is cheap (dials move, checkboxes tick, tabs switch) but nothing needs to work for real. Make each screen addressable by URL (for example `ui/index.html?screen=pause&state=controller&bg=keeper`), so screenshots and links can point at one state.
4. **Check it by eye.** Serve the worktree locally the way the project's tools do, open the standalone page in headless Chrome, and take a 1920×1080 screenshot of every screen and state into `ui/shots/`. For the two or three most important screens also take the same screen in the REAL game and compare side by side: the standalone copy should match (same type, spacing, colours). Fix differences. Make one contact sheet of all screens: /home/claude/ui-sheet.jpg. Read it yourself before handing back.
5. **The same screens in the designer's Figma file.** The file is https://www.figma.com/design/rFNso5egYivjGoBfhuqi1B/the-oarfish (file key `rFNso5egYivjGoBfhuqi1B`). It is reachable through the Figma tools in this session (tool names start with `mcp__fig__`; load their schemas with ToolSearch, and call `mcp__fig__create_session` with the file key before any other file tool). It currently holds one blank page. Before writing, read the Figma skills the server asks for: the figma-use skill is mandatory before `use_figma` and figma-generate-design is the one for turning a page into Figma; if they are not installed as skills, read them as MCP resources (skill://figma/figma-use/SKILL.md, skill://figma/figma-generate-design/SKILL.md). Then add ONE new page named "Menus today (from the game)" with one 1920×1080 frame per screen and state, named as in the inventory. Aim for editable layers (text as text, panels as shapes with the real colours, the still as an image behind), since the designer will design over them. If the fonts the game uses are not available in Figma, use the nearest and say which. If editable layers cannot be produced cleanly within a reasonable effort, place the screenshots from step 4 as image frames instead and say so plainly. Rules for this step: add only; never delete, move or rename anything that is already in the file; do not touch any other Figma file; if a tool call fails twice, stop the Figma step and report what happened. When done, take a screenshot of the new page through the Figma tools and look at it.
6. **A brief for the next chat**, at the top of `ui/README.md`: what this folder is, how to open the standalone page, how to retake the stills, how changes get carried back into the game (which parts of index.html each copied block came from), and the project's standing rules (work on branches; nothing goes to `main` or to the live site unless George asks; never work around a refused action). End it with a short opening message George can paste into a new chat to start menu work from this branch, naming the repository (`mumble-jam/oarfish`), the branch (`ui-menu`), this README and the Figma link.

## Commits
Commit on `ui-menu` (the PNG stills and shots included, if they total under about 30 MB; otherwise keep `ui/shots/` out and say so), each message ending with exactly these two lines:
Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BybvcV3w5toWNGmEXbK8dM

## Hand back
A short report in plain language: what is in the kit and where, the list of screens and states found, how closely the standalone copy matches the game (and where it does not), what went into Figma (editable layers or pictures, with the page name and any node ids), the path of the contact sheet, the opening message for the new chat, and what you are unsure about or did not finish.
