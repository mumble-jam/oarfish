// Written by `node tools/shot_ui.mjs dump` from the running game (world 4242): the words and lists the game builds its menus from.
// Do not edit by hand. When the game changes, run the tool again and this file follows.
window.GAME = {
 "from": "tools/shot_ui.mjs dump",
 "world": 4242,
 "floors": [
  {
   "name": "The sunlight zone",
   "depth": 40,
   "water": "#2b93a3"
  },
  {
   "name": "The edge of light",
   "depth": 180,
   "water": "#1d6f8e"
  },
  {
   "name": "The twilight zone",
   "depth": 450,
   "water": "#12426a"
  },
  {
   "name": "Deep twilight",
   "depth": 800,
   "water": "#0a2444"
  },
  {
   "name": "Ryūgū, the palace below",
   "depth": 1000,
   "water": "#07142e"
  }
 ],
 "shells": {
  "spire": {
   "name": "Spire",
   "colour": "#f4e3c1",
   "worn": "Your dash carries half as far again.",
   "shed": "the bait bursts when a hunter reaches it."
  },
  "fan": {
   "name": "Fan",
   "colour": "#f9cdd6",
   "worn": "You have half as much stamina again.",
   "shed": "your stamina refills and you surge away."
  },
  "coil": {
   "name": "Coil",
   "colour": "#c9a877",
   "worn": "Dashes come back twice as fast and cost a third less.",
   "shed": "the bait swims off and takes its hunters with it."
  },
  "ring": {
   "name": "Ring",
   "colour": "#e9dfc0",
   "worn": "A loop closes sooner: you need not go as far round.",
   "shed": "the bait calls twice as far and lasts twice as long."
  },
  "horn": {
   "name": "Horn",
   "colour": "#ec7090",
   "worn": "Closing a loop stuns every hunter near you.",
   "shed": "hunters near the bait are stunned as it drops."
  },
  "cap": {
   "name": "Cap",
   "colour": "#9fb8c4",
   "worn": "It takes the next bite for you, and breaks.",
   "shed": "the bait lasts three times as long, and anglers cannot swallow it."
  },
  "spine": {
   "name": "Spine",
   "colour": "#d83c5f",
   "worn": "A biter that bites you dies of it.",
   "shed": "whatever reaches the bait dies."
  },
  "lamp": {
   "name": "Lamp",
   "colour": "#ffd27a",
   "worn": "Your light reaches half as far again.",
   "shed": "the bait flares and dazzles every angler near it."
  },
  "tusk": {
   "name": "Tusk",
   "colour": "#ffffff",
   "worn": "A ram breaks anglers too, and every ram feeds you more.",
   "shed": "each hunter that reaches the bait feeds you."
  },
  "pearl": {
   "name": "Pearl",
   "colour": "#cfe6ff",
   "worn": "Every new segment costs a fifth less to grow.",
   "shed": "take the bait back before it fades and regain two segments."
  }
 },
 "bring": [
  {
   "id": "squid",
   "name": "Squid"
  },
  {
   "id": "moonjelly",
   "name": "Moon jelly"
  },
  {
   "id": "nettle",
   "name": "Sea nettle"
  },
  {
   "id": "helmetjelly",
   "name": "Helmet jelly"
  },
  {
   "id": "boxjelly",
   "name": "Box jelly"
  }
 ],
 "actions": [
  [
   "up",
   "Swim forward"
  ],
  [
   "down",
   "Swim back"
  ],
  [
   "left",
   "Swim left"
  ],
  [
   "right",
   "Swim right"
  ],
  [
   "sprint",
   "Dash, hold to sprint"
  ],
  [
   "wrap",
   "Wrap or coil, side picked for you"
  ],
  [
   "wrapL",
   "Wrap or coil left"
  ],
  [
   "wrapR",
   "Wrap or coil right"
  ],
  [
   "oarL",
   "Left oar, on the beat"
  ],
  [
   "oarR",
   "Right oar, on the beat"
  ],
  [
   "rise",
   "Rise"
  ],
  [
   "dive",
   "Dive"
  ],
  [
   "shed",
   "Shed tail as bait"
  ],
  [
   "pause",
   "Pause"
  ],
  [
   "full",
   "Full screen"
  ],
  [
   "hide",
   "Keys and tools on screen"
  ],
  [
   "view",
   "Switch camera"
  ],
  [
   "behind",
   "Bring the view behind you"
  ],
  [
   "zoomIn",
   "Zoom in"
  ],
  [
   "zoomOut",
   "Zoom out"
  ]
 ],
 "stick": [
  "up",
  "down",
  "left",
  "right"
 ],
 "binds": {
  "keys": {
   "up": [
    "KeyW",
    "ArrowUp"
   ],
   "down": [
    "KeyS",
    "ArrowDown"
   ],
   "left": [
    "KeyA",
    "ArrowLeft"
   ],
   "right": [
    "KeyD",
    "ArrowRight"
   ],
   "sprint": [
    "ShiftLeft",
    "ShiftRight"
   ],
   "wrap": [],
   "wrapL": [
    "KeyQ"
   ],
   "wrapR": [
    "KeyE"
   ],
   "oarL": [
    "KeyJ",
    "Digit1"
   ],
   "oarR": [
    "KeyK",
    "Digit2"
   ],
   "rise": [
    "Space"
   ],
   "dive": [
    "KeyC"
   ],
   "shed": [
    "KeyX"
   ],
   "pause": [
    "KeyP"
   ],
   "full": [
    "KeyF"
   ],
   "hide": [
    "KeyH"
   ],
   "view": [
    "KeyV"
   ],
   "behind": [],
   "zoomIn": [],
   "zoomOut": []
  },
  "pad": {
   "sprint": 7,
   "wrap": 6,
   "wrapL": null,
   "wrapR": null,
   "oarL": 0,
   "oarR": 1,
   "rise": 5,
   "dive": 4,
   "shed": 2,
   "pause": 9,
   "full": null,
   "hide": 8,
   "view": null,
   "behind": 11,
   "zoomIn": 12,
   "zoomOut": 13
  }
 },
 "padNames": {
  "ps": [
   "✕",
   "○",
   "□",
   "△",
   "L1",
   "R1",
   "L2",
   "R2",
   "Create",
   "Options",
   "L3",
   "R3",
   "D-pad up",
   "D-pad down",
   "D-pad left",
   "D-pad right",
   "Home",
   "Touchpad"
  ],
  "xbox": [
   "A",
   "B",
   "X",
   "Y",
   "LB",
   "RB",
   "LT",
   "RT",
   "View",
   "Menu",
   "LS",
   "RS",
   "D-pad up",
   "D-pad down",
   "D-pad left",
   "D-pad right",
   "Home",
   "Touchpad"
  ]
 },
 "now": {
  "text": "Now: cool, in D. 165 bpm, energy 75%, intensity 56%. Sitting in: tuba.",
  "energy": 75
 },
 "groups": [
  {
   "group": "The oarfish",
   "ids": [
    "oarfish"
   ]
  },
  {
   "group": "Swarms",
   "ids": [
    "sprat",
    "lanternfish",
    "ghostfish"
   ]
  },
  {
   "group": "Company",
   "ids": [
    "pilot",
    "cleaner"
   ]
  },
  {
   "group": "Hunters",
   "ids": [
    "biter",
    "angler",
    "drifter",
    "leech",
    "hook"
   ]
  },
  {
   "group": "Keepers of the rifts",
   "ids": [
    "keeper",
    "shearer",
    "lamplighter",
    "warden"
   ]
  },
  {
   "group": "The Sum",
   "ids": [
    "sum"
   ]
  },
  {
   "group": "Not yet in the dive",
   "ids": [
    "squid",
    "moonjelly",
    "nettle",
    "helmetjelly",
    "boxjelly"
   ]
  },
  {
   "group": "Shells",
   "ids": [
    "shell-spire",
    "shell-fan",
    "shell-coil",
    "shell-ring",
    "shell-horn",
    "shell-cap",
    "shell-spine",
    "shell-lamp",
    "shell-tusk",
    "shell-pearl"
   ]
  },
  {
   "group": "Loose things",
   "ids": [
    "tailpiece"
   ]
  },
  {
   "group": "Things that grow",
   "ids": [
    "kelp",
    "seagrass",
    "staghorn",
    "tablecoral",
    "braincoral",
    "seafan",
    "sponge",
    "anemone",
    "sealily",
    "glasssponge",
    "tubeworms",
    "lantern",
    "seapen"
   ]
  },
  {
   "group": "On the bed",
   "ids": [
    "starfish",
    "brittlestar",
    "urchin",
    "clam",
    "pebble",
    "rock"
   ]
  },
  {
   "group": "Stonework",
   "ids": [
    "shaft",
    "stump",
    "base",
    "echinus",
    "block",
    "flag",
    "rubble",
    "wreath",
    "hoop",
    "coil",
    "coin",
    "chime",
    "jar",
    "jarbroken",
    "shard"
   ]
  },
  {
   "group": "Colours of the world",
   "ids": [
    "paint",
    "stone"
   ]
  }
 ],
 "specimens": {
  "oarfish": {
   "name": "The oarfish",
   "role": "You. Length is health: every segment is a bite you can take, and a longer body goes round a bigger swarm. At each length that opens a bigger kind of swarm the crest stands taller and the fins glow deeper.",
   "about": "Le Gymnètre épée, as the plate has it: a ribbon of a fish with a red crest and a fin the length of its back. It is rebuilt at every change of length, so the same model serves a short body and a long one.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 4.9 m long",
   "tris": "1473 triangles",
   "hear": "",
   "band": 0,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [
    "At its shortest",
    "As a dive begins",
    "Long enough for a middling swarm",
    "Long enough for a big one",
    "At its longest"
   ],
   "state": 1,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [
    [
     "body",
     "#c9a877"
    ],
    [
     "bodyTop",
     "#a8875a"
    ],
    [
     "belly",
     "#b3b1bb"
    ],
    [
     "spots",
     "#8a6b4c"
    ],
    [
     "face",
     "#98a1b2"
    ],
    [
     "gill",
     "#b0b8c6"
    ],
    [
     "jaw",
     "#7d8799"
    ],
    [
     "mouth",
     "#3d2433"
    ],
    [
     "finPale",
     "#f9cdd6"
    ],
    [
     "finPink",
     "#f4a4b9"
    ],
    [
     "finMid",
     "#ec7090"
    ],
    [
     "finRed",
     "#d83c5f"
    ],
    [
     "eyeRing",
     "#2c2531"
    ],
    [
     "eye",
     "#f6d040"
    ],
    [
     "pupil",
     "#1a171f"
    ]
   ],
   "scale": null
  },
  "sprat": {
   "name": "Sprat",
   "role": "Food. A swarm is taken whole, by a body long enough to go round it.",
   "about": "The small silver fish of the two bands that have light. A yellow line down the flank; the back takes a cool shadow so a swarm reads from above.",
   "where": "The sunlight zone, The edge of light · 0.43 m each",
   "tris": "70 triangles",
   "hear": "",
   "band": 0,
   "home": [
    0,
    1
   ],
   "states": [
    "Loose",
    "Balled up",
    "Pressed",
    "Scattering",
    "One that bolts",
    "One that parts",
    "In the dark"
   ],
   "state": 0,
   "tiers": [
    [
     "s",
     "8"
    ],
    [
     "m",
     "18"
    ],
    [
     "l",
     "36"
    ],
    [
     "h",
     "70"
    ]
   ],
   "tones": 4,
   "speed": null,
   "palette": [
    [
     "back",
     "#a2bcd4"
    ],
    [
     "stripe",
     "#fff0b4"
    ],
    [
     "tone1",
     "#f3f7fa"
    ],
    [
     "tone2",
     "#ffd96b"
    ],
    [
     "tone3",
     "#9fe0ea"
    ],
    [
     "tone4",
     "#ffb38a"
    ]
   ],
   "scale": 1
  },
  "lanternfish": {
   "name": "Lanternfish",
   "role": "Food. A swarm is taken whole, by a body long enough to go round it.",
   "about": "Blunt-headed, big-eyed, with a row of lights along the belly. In the dark the swarm is found by those lights.",
   "where": "The twilight zone, Deep twilight · 0.43 m each",
   "tris": "78 triangles",
   "hear": "",
   "band": 2,
   "home": [
    2,
    3
   ],
   "states": [
    "Loose",
    "Balled up",
    "Pressed",
    "Scattering",
    "One that bolts",
    "One that parts",
    "In the dark"
   ],
   "state": 0,
   "tiers": [
    [
     "s",
     "8"
    ],
    [
     "m",
     "18"
    ],
    [
     "l",
     "36"
    ],
    [
     "h",
     "70"
    ]
   ],
   "tones": 4,
   "speed": null,
   "palette": [
    [
     "back",
     "#a2bcd4"
    ],
    [
     "lights",
     "#c9f6ff"
    ],
    [
     "tone1",
     "#f3f7fa"
    ],
    [
     "tone2",
     "#ffd96b"
    ],
    [
     "tone3",
     "#9fe0ea"
    ],
    [
     "tone4",
     "#ffb38a"
    ]
   ],
   "scale": 1
  },
  "ghostfish": {
   "name": "Ghost fish",
   "role": "Food. A swarm is taken whole, by a body long enough to go round it.",
   "about": "What swims in the palace: pale, with one lit line down each side.",
   "where": "Ryūgū · 0.43 m each",
   "tris": "72 triangles",
   "hear": "",
   "band": 4,
   "home": [
    4
   ],
   "states": [
    "Loose",
    "Balled up",
    "Pressed",
    "Scattering",
    "One that bolts",
    "One that parts",
    "In the dark"
   ],
   "state": 0,
   "tiers": [
    [
     "s",
     "8"
    ],
    [
     "m",
     "18"
    ],
    [
     "l",
     "36"
    ],
    [
     "h",
     "70"
    ]
   ],
   "tones": 4,
   "speed": null,
   "palette": [
    [
     "back",
     "#a2bcd4"
    ],
    [
     "line",
     "#fff3d0"
    ],
    [
     "tone1",
     "#f3f7fa"
    ],
    [
     "tone2",
     "#ffd96b"
    ],
    [
     "tone3",
     "#9fe0ea"
    ],
    [
     "tone4",
     "#ffb38a"
    ]
   ],
   "scale": 1
  },
  "pilot": {
   "name": "Pilot fish",
   "role": "Not food, and no danger. A few wait along the way in every band; they fall in beside the body as it passes and ride there, keeping up with a swim but not with a sprint.",
   "about": "Blue, with dark bars and white tips to the tail, as the real ones are that go about beside sharks. The tips are lit, so in the dark it is two small lights at your side.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 0.5 m long",
   "tris": "108 triangles",
   "hear": "",
   "band": 4,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [
    "Waiting",
    "Riding the wake"
   ],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": 0.7,
   "palette": [
    [
     "back",
     "#274a7a"
    ],
    [
     "flank",
     "#a9cbe6"
    ],
    [
     "bar",
     "#1f3050"
    ],
    [
     "belly",
     "#f2f8fc"
    ],
    [
     "fin",
     "#35598a"
    ],
    [
     "tip",
     "#ffffff"
    ]
   ],
   "scale": 1
  },
  "cleaner": {
   "name": "Cleaner wrasse",
   "role": "Not food, and no danger. Half a dozen keep each cleaning station, a coral head with a pale ring over it. Hold still over one and they go along the body; when they are done a segment has grown back. Nothing bites at a station while they work, but the hunters gather round to wait.",
   "about": "A finger long, pale blue going to yellow at the head, with one black stripe from the eye to the tail that widens as it goes, as the real ones have. The pale back is lit a little, so in the dark a station is a small knot of lights over a coral head.",
   "where": "The edge of light, The twilight zone, Deep twilight, Ryūgū · 0.24 m long",
   "tris": "91 triangles",
   "hear": "",
   "band": 4,
   "home": [
    1,
    2,
    3,
    4
   ],
   "states": [
    "Over the station",
    "Cleaning"
   ],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": 0.5,
   "palette": [
    [
     "front",
     "#ffe27a"
    ],
    [
     "rear",
     "#bfe6ff"
    ],
    [
     "stripe",
     "#1b1b2a"
    ],
    [
     "belly",
     "#f6fbff"
    ],
    [
     "fin",
     "#8fc4ee"
    ],
    [
     "tip",
     "#ffffff"
    ]
   ],
   "scale": 1
  },
  "biter": {
   "name": "Tail-biter",
   "role": "Goes for the back half of the body. A dash head-first breaks it.",
   "about": "Deep-chested, with an underbite and a tall fin. It lives in the shearing stalls, and on the Sum as cleaner fish live on a whale.",
   "where": "The edge of light, The twilight zone, Deep twilight, Ryūgū · 0.9 m long",
   "tris": "212 triangles",
   "hear": "In the band: muted trumpet. Hear it",
   "band": 4,
   "home": [
    1,
    2,
    3,
    4
   ],
   "states": [
    "Roaming",
    "Hunting",
    "Stunned"
   ],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": 1.2,
   "palette": [
    [
     "back",
     "#3f2550"
    ],
    [
     "flank",
     "#6d4180"
    ],
    [
     "bar",
     "#583369"
    ],
    [
     "belly",
     "#a981b3"
    ],
    [
     "fins",
     "#e2566b"
    ],
    [
     "finDark",
     "#b8364f"
    ],
    [
     "jaw",
     "#2d1a3a"
    ],
    [
     "eye",
     "#eaff7c"
    ]
   ],
   "scale": 1
  },
  "angler": {
   "name": "Angler",
   "role": "Hangs behind one warm light and lunges at what comes to it. It swallows a bait whole.",
   "about": "A globe of a fish, all mouth, with a rod over its head. It sits on the old lamp plinths, where the lamps used to be.",
   "where": "The twilight zone, Deep twilight, Ryūgū · 1.6 m long",
   "tris": "302 triangles",
   "hear": "In the band: vibraphone. Hear it",
   "band": 4,
   "home": [
    2,
    3,
    4
   ],
   "states": [
    "Lurking",
    "Lunging",
    "Dazzled"
   ],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": 0,
   "palette": [
    [
     "back",
     "#221d36"
    ],
    [
     "skin",
     "#322d4b"
    ],
    [
     "wart",
     "#2a2540"
    ],
    [
     "belly",
     "#4d4770"
    ],
    [
     "gum",
     "#2a0f20"
    ],
    [
     "fins",
     "#474066"
    ],
    [
     "finTip",
     "#6a6190"
    ],
    [
     "eye",
     "#c8ecff"
    ],
    [
     "lure",
     "#ffd27a"
    ],
    [
     "glow",
     "#ffc56a"
    ]
   ],
   "scale": 1
  },
  "drifter": {
   "name": "Spined drifter",
   "role": "Hunts nothing. Costs a segment to brush against; head first, a dash breaks it.",
   "about": "An urchin adrift: plates in five bands, and spines lit at the tip so it can be seen coming.",
   "where": "The edge of light, The twilight zone, Deep twilight, Ryūgū · 1.3 m long",
   "tris": "584 triangles",
   "hear": "In the band: woodblock. Hear it",
   "band": 4,
   "home": [
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [
    [
     "test",
     "#4a2f63"
    ],
    [
     "band",
     "#6a4585"
    ],
    [
     "spine",
     "#c2577e"
    ],
    [
     "tip",
     "#ff9db8"
    ]
   ],
   "scale": 1
  },
  "leech": {
   "name": "Leech",
   "role": "Fastens on the body and eats what you have eaten. A dash throws it off; a tight coil crushes it.",
   "about": "A lamprey: an eel of a body with a ring of teeth at one end and a row of gill pores behind the eye.",
   "where": "The twilight zone, Deep twilight, Ryūgū · 1 m long",
   "tris": "168 triangles",
   "hear": "In the band: bass clarinet. Hear it",
   "band": 4,
   "home": [
    2,
    3,
    4
   ],
   "states": [
    "Searching",
    "Fastened on"
   ],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": 1,
   "palette": [
    [
     "back",
     "#2b2038"
    ],
    [
     "flank",
     "#4a3560"
    ],
    [
     "belly",
     "#8d7aa0"
    ],
    [
     "fin",
     "#ff9db8"
    ],
    [
     "eye",
     "#eaff7c"
    ]
   ],
   "scale": 1
  },
  "hook": {
   "name": "Hook",
   "role": "Hangs on a line from above and strikes at a body under it.",
   "about": "Steel, a lead, and the tally tag of whoever set it. The lines come down from the raft, far overhead.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight · 0.8 m long",
   "tris": "203 triangles",
   "hear": "In the band: plucked string. Hear it",
   "band": 0,
   "home": [
    0,
    1,
    2,
    3
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [
    [
     "steel",
     "#d5dee2"
    ],
    [
     "shade",
     "#93a4ad"
    ],
    [
     "lead",
     "#9aa6ad"
    ],
    [
     "tag",
     "#e2566b"
    ],
    [
     "bait",
     "#ffe89a"
    ],
    [
     "glow",
     "#fff1b8"
    ],
    [
     "line",
     "#e8f6f6"
    ]
   ],
   "scale": 1
  },
  "keeper": {
   "name": "The Keeper",
   "role": "Its shell turns a ram, and every blow it means to land is shown first. When it has struck and missed it is open: ram a leg then, and ram it again or go round it, and the leg comes off. Four legs, and it is done. With two gone it is quicker, and digs.",
   "about": "A great crab under a dome of plates, its right claw far bigger than its left. It keeps the first rift.",
   "where": "The sunlight zone · 6 m long",
   "tris": "676 triangles",
   "hear": "In the band: tuba. Hear it",
   "band": 0,
   "home": [
    0
   ],
   "states": [
    "Waiting",
    "Walking",
    "Claws up",
    "The great claw comes down, and sticks",
    "The great claw goes across",
    "A jab of the small claw",
    "Drawn in, about to run",
    "Running, sideways",
    "Digging in",
    "Feeding on a shed tail",
    "Hurt",
    "Two legs gone",
    "Beaten"
   ],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [
    [
     "tone",
     "#f9cdd6"
    ],
    [
     "pale",
     "#e9dfc0"
    ],
    [
     "dark",
     "#3b2a4d"
    ],
    [
     "deep",
     "#2a1d38"
    ],
    [
     "eye",
     "#eaff7c"
    ]
   ],
   "scale": 1
  },
  "shearer": {
   "name": "The Shearer",
   "role": "It feels the water you move: its line follows a moving tail and slides off a still one. Where its saw crosses your body, what is behind the cut is gone. The saw turns a ram from ahead; from the side, when it is spent or stuck, a ram takes a row of its teeth, and a body drawn round it snaps the saw. Four rows, and it is done.",
   "about": "A sawfish, the saw toothed in the district’s colour. The saw is how it finds you and what it hits you with. It keeps the second rift.",
   "where": "The edge of light · 7 m long",
   "tris": "372 triangles",
   "hear": "In the band: tenor saxophone. Hear it",
   "band": 1,
   "home": [
    1
   ],
   "states": [
    "Searching",
    "Feeling for you",
    "Winding up",
    "Slashing",
    "Pinning",
    "Spent",
    "Saw stuck in the bed",
    "Saw stuck in a column",
    "Swiping, at what is by its head",
    "Hurt",
    "Two rows of teeth gone",
    "The saw snapped",
    "Beaten"
   ],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": 1.5,
   "palette": [
    [
     "tone",
     "#f4a4b9"
    ],
    [
     "back",
     "#3b2a4d"
    ],
    [
     "flank",
     "#55406b"
    ],
    [
     "belly",
     "#d9cfe0"
    ],
    [
     "saw",
     "#e9dfc0"
    ],
    [
     "eye",
     "#eaff7c"
    ]
   ],
   "scale": 1
  },
  "lamplighter": {
   "name": "The Lamplighter",
   "role": "Hangs over the rift and lunges. It takes a bait first. Ram or wrap it while its lamp is out.",
   "about": "The angler grown huge, its fins in the district’s colour. It keeps the third rift.",
   "where": "The twilight zone · 3.5 m long",
   "tris": "350 triangles",
   "hear": "In the band: celesta. Hear it",
   "band": 2,
   "home": [
    2
   ],
   "states": [
    "Hanging",
    "Winding up",
    "Lamp out"
   ],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": 0,
   "palette": [
    [
     "tone",
     "#ec7090"
    ],
    [
     "back",
     "#221d36"
    ],
    [
     "skin",
     "#322d4b"
    ],
    [
     "wart",
     "#2a2540"
    ],
    [
     "belly",
     "#4d4770"
    ],
    [
     "gum",
     "#2a0f20"
    ],
    [
     "eye",
     "#c8ecff"
    ],
    [
     "lure",
     "#ffd27a"
    ]
   ],
   "scale": 1
  },
  "warden": {
   "name": "The Warden",
   "role": "An eel circling the mouth of the rift, which tightens on a fish inside its ring. Ram its head, or bait the head out and wrap it.",
   "about": "A moray’s head on eleven lengths of body, banded in the district’s colour. It keeps the fourth rift.",
   "where": "Deep twilight · 11 m long",
   "tris": "254 triangles",
   "hear": "In the band: bowed cello. Hear it",
   "band": 3,
   "home": [
    3
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [
    [
     "tone",
     "#d83c5f"
    ],
    [
     "pale",
     "#e9dfc0"
    ],
    [
     "gum",
     "#3a1626"
    ],
    [
     "eye",
     "#eaff7c"
    ]
   ],
   "scale": 1
  },
  "sum": {
   "name": "The Sum",
   "role": "Everything the Long Ones ever paid, joined into one body. It is the wall of the palace hall, and it hunts by closing a loop.",
   "about": "One length of it: a paid tail, pinched and dark where it was joined to the next, still carrying its piece of the dorsal fin. Each takes the colour of the district it was paid in.",
   "where": "Ryūgū · 0.72 m to a length",
   "tris": "54 triangles",
   "hear": "In the band: organ. Hear it",
   "band": 4,
   "home": [
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [
    [
     "own",
     "#e3c28a"
    ]
   ],
   "scale": 1
  },
  "squid": {
   "name": "Squid",
   "role": "Nothing yet. It is a model to look at: no dive has one, and nothing has been decided about what it does.",
   "about": "A big-finned squid, a metre of mantle and as much again of arms. The fins run down the whole mantle, so the back of it is an arrowhead. Eight arms and two long tentacles with clubs, each a piece of its own that trails through the water by itself, as the oarfish’s oars do.",
   "where": "In no band yet · 2.4 m long",
   "tris": "1418 triangles",
   "hear": "",
   "band": 4,
   "home": [],
   "states": [
    "Hovering",
    "Jetting",
    "Turning",
    "Alarmed",
    "Reaching"
   ],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [
    [
     "back",
     "#f79fbd"
    ],
    [
     "flank",
     "#ee7fa8"
    ],
    [
     "belly",
     "#fbd3e2"
    ],
    [
     "fin",
     "#f48db3"
    ],
    [
     "finUnder",
     "#dcb0e4"
    ],
    [
     "fleck",
     "#ffe6ef"
    ],
    [
     "arm",
     "#ea6f9b"
    ],
    [
     "armUnder",
     "#f9cfe0"
    ],
    [
     "sucker",
     "#fff4f6"
    ],
    [
     "eye",
     "#fff3f1"
    ],
    [
     "pupil",
     "#221a2e"
    ],
    [
     "pale",
     "#fff1ee"
    ]
   ],
   "scale": 1
  },
  "moonjelly": {
   "name": "Moon jelly",
   "role": "Nothing yet. It is a model to look at: no dive has one, and nothing has been decided about what it does.",
   "about": "A clear saucer forty centimetres across with four violet horseshoes showing through it, as the real one has. A fine fringe round the rim and four short ruffled arms under it, each a piece of its own. It beats slowly and evenly and never quite stops. A creature of the bright water, seen in numbers.",
   "where": "In no band yet · 0.4 m long",
   "tris": "548 triangles",
   "hear": "",
   "band": 4,
   "home": [],
   "states": [
    "Drifting",
    "Pulsing",
    "Flattened, at rest"
   ],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [
    [
     "bell",
     "#dff1ff"
    ],
    [
     "rim",
     "#ffffff"
    ],
    [
     "gonad",
     "#9a3fe6"
    ],
    [
     "gonadPale",
     "#e3a6ff"
    ],
    [
     "canal",
     "#a78de8"
    ],
    [
     "arm",
     "#e2ccff"
    ],
    [
     "frill",
     "#fbf4ff"
    ],
    [
     "fringe",
     "#f6f8ff"
    ]
   ],
   "scale": 1
  },
  "nettle": {
   "name": "Sea nettle",
   "role": "Nothing yet. It is a model to look at: no dive has one, and nothing has been decided about what it does.",
   "about": "An amber bell half a metre across, darkest at the rim, and behind it a train: twenty-four fine dark red tentacles, each a piece of its own, round four long pale ruffled arms wound in spirals. It beats hard; the train streams out on the stroke and catches up as the bell fills. Fishing, it lets the tentacles hang wide like a net.",
   "where": "In no band yet · 3 m long",
   "tris": "1306 triangles",
   "hear": "",
   "band": 4,
   "home": [],
   "states": [
    "Drifting",
    "Pulsing",
    "Turning",
    "Fishing, tentacles spread"
   ],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [
    [
     "bell",
     "#f2a53f"
    ],
    [
     "rim",
     "#b24c2a"
    ],
    [
     "ray",
     "#ffe0a0"
    ],
    [
     "lappet",
     "#8a3524"
    ],
    [
     "gut",
     "#ffe9cf"
    ],
    [
     "gutDark",
     "#f3c79d"
    ],
    [
     "arm",
     "#fff3e6"
    ],
    [
     "frill",
     "#f7c3ae"
    ],
    [
     "tentacle",
     "#8c2437"
    ],
    [
     "tentacleTip",
     "#cf5f6f"
    ]
   ],
   "scale": 1
  },
  "helmetjelly": {
   "name": "Helmet jelly",
   "role": "Nothing yet. It is a model to look at: no dive has one, and nothing has been decided about what it does.",
   "about": "Taller than it is wide and coming to a point: a dark red cone inside a dome as clear as glass, a groove round it, and under the groove a crown of sixteen lappets. Twelve thick stiff tentacles, which it carries up and ahead of itself. Touched, a blue-green light runs round the crown. An animal of the dark water: daylight harms the real one.",
   "where": "In no band yet · 0.9 m long",
   "tris": "872 triangles",
   "hear": "",
   "band": 4,
   "home": [],
   "states": [
    "Drifting",
    "Pulsing",
    "Touched: lit",
    "Tentacles turned down"
   ],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [
    [
     "glass",
     "#ffd9e2"
    ],
    [
     "core",
     "#4a0818"
    ],
    [
     "coreLit",
     "#6b1024"
    ],
    [
     "crown",
     "#8a1629"
    ],
    [
     "crownDark",
     "#620f20"
    ],
    [
     "lappet",
     "#b8303f"
    ],
    [
     "mouth",
     "#2c0610"
    ],
    [
     "tentacle",
     "#9a1f30"
    ],
    [
     "tentacleTip",
     "#ee7f6c"
    ],
    [
     "light",
     "#74ffe4"
    ]
   ],
   "scale": 1
  },
  "boxjelly": {
   "name": "Box jelly",
   "role": "Nothing yet. It is a model to look at: no dive has one, and nothing has been decided about what it does.",
   "about": "A clear bell that is square from above, a pale rib down each corner and a dark eye low on each side. At each corner a stalk like a hand, with a long ringed ribbon of a tentacle from every finger (five here; the real sea wasp has up to fifteen). Unlike the others it goes somewhere: quick strokes, the tentacles drawn up short behind it. To fish it lets them out, tips over and sinks.",
   "where": "In no band yet · 1.5 m long",
   "tris": "828 triangles",
   "hear": "",
   "band": 4,
   "home": [],
   "states": [
    "Drifting",
    "Pulsing",
    "Turning sharply",
    "Fishing: tipped over, sinking"
   ],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [
    [
     "bell",
     "#bfe3ff"
    ],
    [
     "rib",
     "#f4fbff"
    ],
    [
     "gut",
     "#ffc4d8"
    ],
    [
     "gonad",
     "#e9d6ff"
    ],
    [
     "eye",
     "#1b1730"
    ],
    [
     "pedal",
     "#e6f4ff"
    ],
    [
     "tentacle",
     "#cfe0ff"
    ],
    [
     "band",
     "#6f8fe8"
    ]
   ],
   "scale": 1
  },
  "shell-spire": {
   "name": "Spire",
   "role": "Worn: Your dash carries half as far again.",
   "about": "Shed with the segment it rides on, the bait bursts when a hunter reaches it.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 1.2 m long",
   "tris": "261 triangles",
   "hear": "",
   "band": 4,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [
    [
     "colour",
     "#f4e3c1"
    ]
   ],
   "scale": 1
  },
  "shell-fan": {
   "name": "Fan",
   "role": "Worn: You have half as much stamina again.",
   "about": "Shed with the segment it rides on, your stamina refills and you surge away.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 1.2 m long",
   "tris": "64 triangles",
   "hear": "",
   "band": 4,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [
    [
     "colour",
     "#f9cdd6"
    ]
   ],
   "scale": 1
  },
  "shell-coil": {
   "name": "Coil",
   "role": "Worn: Dashes come back twice as fast and cost a third less.",
   "about": "Shed with the segment it rides on, the bait swims off and takes its hunters with it.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 1.2 m long",
   "tris": "162 triangles",
   "hear": "",
   "band": 4,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [
    [
     "colour",
     "#c9a877"
    ]
   ],
   "scale": 1
  },
  "shell-ring": {
   "name": "Ring",
   "role": "Worn: A loop closes sooner: you need not go as far round.",
   "about": "Shed with the segment it rides on, the bait calls twice as far and lasts twice as long.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 1.2 m long",
   "tris": "210 triangles",
   "hear": "",
   "band": 4,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [
    [
     "colour",
     "#e9dfc0"
    ]
   ],
   "scale": 1
  },
  "shell-horn": {
   "name": "Horn",
   "role": "Worn: Closing a loop stuns every hunter near you.",
   "about": "Shed with the segment it rides on, hunters near the bait are stunned as it drops.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 1.2 m long",
   "tris": "91 triangles",
   "hear": "",
   "band": 4,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [
    [
     "colour",
     "#ec7090"
    ]
   ],
   "scale": 1
  },
  "shell-cap": {
   "name": "Cap",
   "role": "Worn: It takes the next bite for you, and breaks.",
   "about": "Shed with the segment it rides on, the bait lasts three times as long, and anglers cannot swallow it.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 1.2 m long",
   "tris": "84 triangles",
   "hear": "",
   "band": 4,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [
    [
     "colour",
     "#9fb8c4"
    ]
   ],
   "scale": 1
  },
  "shell-spine": {
   "name": "Spine",
   "role": "Worn: A biter that bites you dies of it.",
   "about": "Shed with the segment it rides on, whatever reaches the bait dies.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 1.2 m long",
   "tris": "152 triangles",
   "hear": "",
   "band": 4,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [
    [
     "colour",
     "#d83c5f"
    ]
   ],
   "scale": 1
  },
  "shell-lamp": {
   "name": "Lamp",
   "role": "Worn: Your light reaches half as far again.",
   "about": "Shed with the segment it rides on, the bait flares and dazzles every angler near it.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 1.2 m long",
   "tris": "80 triangles",
   "hear": "",
   "band": 4,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [
    [
     "colour",
     "#ffd27a"
    ]
   ],
   "scale": 1
  },
  "shell-tusk": {
   "name": "Tusk",
   "role": "Worn: A ram breaks anglers too, and every ram feeds you more.",
   "about": "Shed with the segment it rides on, each hunter that reaches the bait feeds you.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 1.2 m long",
   "tris": "90 triangles",
   "hear": "",
   "band": 4,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [
    [
     "colour",
     "#ffffff"
    ]
   ],
   "scale": 1
  },
  "shell-pearl": {
   "name": "Pearl",
   "role": "Worn: Every new segment costs a fifth less to grow.",
   "about": "Shed with the segment it rides on, take the bait back before it fades and regain two segments.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 1.2 m long",
   "tris": "144 triangles",
   "hear": "",
   "band": 4,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [
    [
     "colour",
     "#cfe6ff"
    ]
   ],
   "scale": 1
  },
  "tailpiece": {
   "name": "A shed tail",
   "role": "Three segments, dropped as bait or bitten off. Hunters go to it; a shell that rode on it gives the bait its other power.",
   "about": "A length of the oarfish’s own tail, loose in the water, the cut end showing. It has no colours of its own: it is the oarfish’s, so change those and this follows.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 0.65 m long",
   "tris": "48 triangles",
   "hear": "",
   "band": 4,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [],
   "scale": null
  },
  "kelp": {
   "name": "Kelp",
   "role": "Leans out of the way of the fish, and comes back.",
   "about": "Four broad blades, each folded along its midrib so the two halves take the light differently, the edges ruffled; round the foot, young blades on their floats.",
   "where": "The sunlight zone, The edge of light, The twilight zone · 5 m long",
   "tris": "128 triangles",
   "hear": "",
   "band": 0,
   "home": [
    0,
    1,
    2
   ],
   "states": [
    "As it stands",
    "Leaning, the fish going by"
   ],
   "state": 0,
   "tiers": null,
   "tones": 5,
   "speed": null,
   "palette": [
    [
     "tone1",
     "#4ba57c"
    ],
    [
     "tone2",
     "#5fb88a"
    ],
    [
     "tone3",
     "#7bb262"
    ],
    [
     "tone4",
     "#3f9a8a"
    ],
    [
     "tone5",
     "#6cc09a"
    ]
   ],
   "scale": null
  },
  "seagrass": {
   "name": "Seagrass",
   "role": "Leans out of the way of the fish, and comes back.",
   "about": "A tuft of narrow blades. It grows on the green patches of the two bands that have light.",
   "where": "The sunlight zone, The edge of light · 0.7 m long",
   "tris": "18 triangles",
   "hear": "",
   "band": 0,
   "home": [
    0,
    1
   ],
   "states": [
    "As it stands",
    "Leaning, the fish going by"
   ],
   "state": 0,
   "tiers": null,
   "tones": 4,
   "speed": null,
   "palette": [
    [
     "tone1",
     "#6fbf86"
    ],
    [
     "tone2",
     "#86c98f"
    ],
    [
     "tone3",
     "#5aa884"
    ],
    [
     "tone4",
     "#9bd28e"
    ]
   ],
   "scale": null
  },
  "staghorn": {
   "name": "Staghorn coral",
   "role": "Grows where it grows. The fish swims through or round it.",
   "about": "Each branch forks, and the growing tips are pale. It also takes root on the stonework where there is light.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 1.3 m long",
   "tris": "144 triangles",
   "hear": "",
   "band": 0,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 6,
   "speed": null,
   "palette": [
    [
     "tone1",
     "#f28d7d"
    ],
    [
     "tone2",
     "#f6b95f"
    ],
    [
     "tone3",
     "#c98fe3"
    ],
    [
     "tone4",
     "#f9d9c9"
    ],
    [
     "tone5",
     "#ea6079"
    ],
    [
     "tone6",
     "#ff9fb0"
    ]
   ],
   "scale": null
  },
  "tablecoral": {
   "name": "Table coral",
   "role": "Grows where it grows. The fish swims through or round it.",
   "about": "Tiers of plates on a stalk, with a scalloped, paler rim and dark underneath.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 2.4 m long",
   "tris": "118 triangles",
   "hear": "",
   "band": 0,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 6,
   "speed": null,
   "palette": [
    [
     "tone1",
     "#f28d7d"
    ],
    [
     "tone2",
     "#f6b95f"
    ],
    [
     "tone3",
     "#c98fe3"
    ],
    [
     "tone4",
     "#f9d9c9"
    ],
    [
     "tone5",
     "#ea6079"
    ],
    [
     "tone6",
     "#ff9fb0"
    ]
   ],
   "scale": null
  },
  "braincoral": {
   "name": "Brain coral",
   "role": "Grows where it grows. The fish swims through or round it.",
   "about": "A dome, its ridges and valleys in two tones. The big ones are solid: the fish goes round.",
   "where": "The sunlight zone, The edge of light · 1.8 m long",
   "tris": "48 triangles",
   "hear": "",
   "band": 0,
   "home": [
    0,
    1
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 5,
   "speed": null,
   "palette": [
    [
     "tone1",
     "#f6b95f"
    ],
    [
     "tone2",
     "#d9a86a"
    ],
    [
     "tone3",
     "#9fc59a"
    ],
    [
     "tone4",
     "#f28d7d"
    ],
    [
     "tone5",
     "#e8c9a0"
    ]
   ],
   "scale": null
  },
  "seafan": {
   "name": "Sea fan",
   "role": "Leans out of the way of the fish, and comes back.",
   "about": "One flat spray of branches, standing across the current.",
   "where": "The sunlight zone, The edge of light, The twilight zone · 1.5 m long",
   "tris": "44 triangles",
   "hear": "",
   "band": 0,
   "home": [
    0,
    1,
    2
   ],
   "states": [
    "As it stands",
    "Leaning, the fish going by"
   ],
   "state": 0,
   "tiers": null,
   "tones": 5,
   "speed": null,
   "palette": [
    [
     "tone1",
     "#b47be0"
    ],
    [
     "tone2",
     "#f08a4b"
    ],
    [
     "tone3",
     "#e2566b"
    ],
    [
     "tone4",
     "#f6d040"
    ],
    [
     "tone5",
     "#ff9fb0"
    ]
   ],
   "scale": null
  },
  "sponge": {
   "name": "Tube sponge",
   "role": "Grows where it grows. The fish swims through or round it.",
   "about": "Open chimneys, wider at the lip, dark inside.",
   "where": "The sunlight zone, The edge of light, The twilight zone · 1.1 m long",
   "tris": "72 triangles",
   "hear": "",
   "band": 0,
   "home": [
    0,
    1,
    2
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 4,
   "speed": null,
   "palette": [
    [
     "tone1",
     "#f6d040"
    ],
    [
     "tone2",
     "#c98fe3"
    ],
    [
     "tone3",
     "#f08a4b"
    ],
    [
     "tone4",
     "#7fd6c8"
    ]
   ],
   "scale": null
  },
  "anemone": {
   "name": "Anemone",
   "role": "Pulls in when the fish comes by, and opens again when it has gone.",
   "about": "A short column and a crown of tentacles with pale ends, moving with the water. It shuts when the fish comes by.",
   "where": "The sunlight zone, The edge of light, The twilight zone · 0.6 m long",
   "tris": "153 triangles",
   "hear": "",
   "band": 0,
   "home": [
    0,
    1,
    2
   ],
   "states": [
    "As it stands",
    "Pulled in, the fish going by"
   ],
   "state": 0,
   "tiers": null,
   "tones": 5,
   "speed": null,
   "palette": [
    [
     "tone1",
     "#f4a4b9"
    ],
    [
     "tone2",
     "#9fe0b0"
    ],
    [
     "tone3",
     "#fff1d0"
    ],
    [
     "tone4",
     "#c98fe3"
    ],
    [
     "tone5",
     "#ff9f7a"
    ]
   ],
   "scale": null
  },
  "sealily": {
   "name": "Sea lily",
   "role": "Pulls in when the fish comes by, and opens again when it has gone.",
   "about": "A jointed stalk and a cup of arms that curl in. An animal, for all it looks like a flower: the arms close when the fish comes by.",
   "where": "The edge of light, The twilight zone, Deep twilight, Ryūgū · 1.3 m long",
   "tris": "70 triangles",
   "hear": "",
   "band": 1,
   "home": [
    1,
    2,
    3,
    4
   ],
   "states": [
    "As it stands",
    "Pulled in, the fish going by"
   ],
   "state": 0,
   "tiers": null,
   "tones": 4,
   "speed": null,
   "palette": [
    [
     "tone1",
     "#f6d040"
    ],
    [
     "tone2",
     "#f6b95f"
    ],
    [
     "tone3",
     "#fff1d0"
    ],
    [
     "tone4",
     "#f4a4b9"
    ]
   ],
   "scale": null
  },
  "glasssponge": {
   "name": "Glass sponge",
   "role": "Grows where it grows. The fish swims through or round it.",
   "about": "A pale vase of lattice, from the dark bands.",
   "where": "The twilight zone, Deep twilight, Ryūgū · 1 m long",
   "tris": "49 triangles",
   "hear": "",
   "band": 2,
   "home": [
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 3,
   "speed": null,
   "palette": [
    [
     "tone1",
     "#e4f1ff"
    ],
    [
     "tone2",
     "#cfe3f2"
    ],
    [
     "tone3",
     "#f2faf7"
    ]
   ],
   "scale": null
  },
  "tubeworms": {
   "name": "Tube worms",
   "role": "Pulls in when the fish comes by, and opens again when it has gone.",
   "about": "White tubes with red plumes, in a clump by the rocks of the deepest bands. They are coloured in themselves: the tint only warms or cools them. The plumes are gone down the tubes before the fish can touch them.",
   "where": "Deep twilight, Ryūgū · 1.1 m long",
   "tris": "84 triangles",
   "hear": "",
   "band": 3,
   "home": [
    3,
    4
   ],
   "states": [
    "As it stands",
    "Pulled in, the fish going by"
   ],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [
    [
     "tone1",
     "#ffffff"
    ]
   ],
   "scale": null
  },
  "lantern": {
   "name": "Lantern flower",
   "role": "Leans out of the way of the fish, and comes back.",
   "about": "The stalk bows over and the light hangs from it in its sepals. Below the reach of the sun these are most of what there is to see by.",
   "where": "The edge of light, The twilight zone, Deep twilight, Ryūgū · 1.2 m long",
   "tris": "56 triangles",
   "hear": "",
   "band": 3,
   "home": [
    1,
    2,
    3,
    4
   ],
   "states": [
    "As it stands",
    "Leaning, the fish going by"
   ],
   "state": 0,
   "tiers": null,
   "tones": 4,
   "speed": null,
   "palette": [
    [
     "tone1",
     "#7ff3ff"
    ],
    [
     "tone2",
     "#b79bff"
    ],
    [
     "tone3",
     "#9dffb4"
    ],
    [
     "tone4",
     "#ff9de0"
    ]
   ],
   "scale": null
  },
  "seapen": {
   "name": "Sea pen",
   "role": "Pulls in when the fish comes by, and opens again when it has gone.",
   "about": "A quill that makes its own light along its vanes. Come near and it folds and goes down into the bed.",
   "where": "The edge of light, The twilight zone, Deep twilight, Ryūgū · 1.4 m long",
   "tris": "62 triangles",
   "hear": "",
   "band": 3,
   "home": [
    1,
    2,
    3,
    4
   ],
   "states": [
    "As it stands",
    "Pulled in, the fish going by"
   ],
   "state": 0,
   "tiers": null,
   "tones": 4,
   "speed": null,
   "palette": [
    [
     "tone1",
     "#7ff3ff"
    ],
    [
     "tone2",
     "#b79bff"
    ],
    [
     "tone3",
     "#9dffb4"
    ],
    [
     "tone4",
     "#ff9de0"
    ]
   ],
   "scale": null
  },
  "starfish": {
   "name": "Starfish",
   "role": "Lies on the bed. Nothing to the fish but something to swim over.",
   "about": "Five arms, paler at the tips, lying to the slope of the bed.",
   "where": "The sunlight zone, The edge of light, The twilight zone · 0.6 m long",
   "tris": "10 triangles",
   "hear": "",
   "band": 0,
   "home": [
    0,
    1,
    2
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 5,
   "speed": null,
   "palette": [
    [
     "tone1",
     "#f08a4b"
    ],
    [
     "tone2",
     "#e2566b"
    ],
    [
     "tone3",
     "#f6b95f"
    ],
    [
     "tone4",
     "#b47be0"
    ],
    [
     "tone5",
     "#f4a4b9"
    ]
   ],
   "scale": null
  },
  "brittlestar": {
   "name": "Brittle star",
   "role": "Lies on the bed. Nothing to the fish but something to swim over.",
   "about": "The starfish of the dark bands: a small disc and long thin arms.",
   "where": "The twilight zone, Deep twilight, Ryūgū · 0.9 m long",
   "tris": "10 triangles",
   "hear": "",
   "band": 2,
   "home": [
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 4,
   "speed": null,
   "palette": [
    [
     "tone1",
     "#e9dfc0"
    ],
    [
     "tone2",
     "#d7b9a0"
    ],
    [
     "tone3",
     "#f4a4b9"
    ],
    [
     "tone4",
     "#cfe3f2"
    ]
   ],
   "scale": null
  },
  "urchin": {
   "name": "Urchin",
   "role": "Lies on the bed. Nothing to the fish but something to swim over.",
   "about": "A small one on the bed, by the rocks. It is the spined drifter’s harmless cousin.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight · 0.5 m long",
   "tris": "67 triangles",
   "hear": "",
   "band": 2,
   "home": [
    0,
    1,
    2,
    3
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 4,
   "speed": null,
   "palette": [
    [
     "tone1",
     "#3b2a4d"
    ],
    [
     "tone2",
     "#2b2038"
    ],
    [
     "tone3",
     "#5a2f4f"
    ],
    [
     "tone4",
     "#7a2f45"
    ]
   ],
   "scale": null
  },
  "clam": {
   "name": "Clam",
   "role": "Pulls in when the fish comes by, and opens again when it has gone.",
   "about": "Two ribbed valves, standing open, that shut as the fish goes over.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 0.5 m long",
   "tris": "10 triangles",
   "hear": "",
   "band": 2,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [
    "As it stands",
    "Pulled in, the fish going by"
   ],
   "state": 0,
   "tiers": null,
   "tones": 4,
   "speed": null,
   "palette": [
    [
     "tone1",
     "#f3ead2"
    ],
    [
     "tone2",
     "#f9cdd6"
    ],
    [
     "tone3",
     "#d9c7a8"
    ],
    [
     "tone4",
     "#e7d3e8"
    ]
   ],
   "scale": null
  },
  "pebble": {
   "name": "Pebbles",
   "role": "Lies on the bed. Nothing to the fish but something to swim over.",
   "about": "Pebbles and broken shell, in drifts.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 0.3 m long",
   "tris": "8 triangles",
   "hear": "",
   "band": 2,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 6,
   "speed": null,
   "palette": [
    [
     "tone1",
     "#9aa39a"
    ],
    [
     "tone2",
     "#b7b8a6"
    ],
    [
     "tone3",
     "#8b9299"
    ],
    [
     "tone4",
     "#dcd9c6"
    ],
    [
     "tone5",
     "#7d8790"
    ],
    [
     "tone6",
     "#c9b9a0"
    ]
   ],
   "scale": null
  },
  "rock": {
   "name": "Rock",
   "role": "Lies on the bed. Nothing to the fish but something to swim over.",
   "about": "Darker toward the foot, where silt gathers. The big ones stand in reefs, and the corals keep to them.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 2.4 m long",
   "tris": "80 triangles",
   "hear": "",
   "band": 2,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 5,
   "speed": null,
   "palette": [
    [
     "tone1",
     "#8f95a8"
    ],
    [
     "tone2",
     "#7f889c"
    ],
    [
     "tone3",
     "#a29dac"
    ],
    [
     "tone4",
     "#8c9aa3"
    ],
    [
     "tone5",
     "#969fb0"
    ]
   ],
   "scale": null
  },
  "shaft": {
   "name": "Column drum",
   "role": "Has no colour of its own: it takes its band’s stone (see Colours of the world).",
   "about": "One drum of a fluted column: eight flutes, the two faces of each a little apart in tone. A column is a stack of these, narrowing as it climbs.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 1.2 m long",
   "tris": "48 triangles",
   "hear": "",
   "band": 2,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 4,
   "speed": null,
   "palette": [],
   "scale": null
  },
  "stump": {
   "name": "Broken top",
   "role": "Has no colour of its own: it takes its band’s stone (see Colours of the world).",
   "about": "Where a column snapped: the break climbs to one side and is hollowed where the core came away.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 1 m long",
   "tris": "48 triangles",
   "hear": "",
   "band": 2,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 4,
   "speed": null,
   "palette": [],
   "scale": null
  },
  "base": {
   "name": "Column base",
   "role": "Has no colour of its own: it takes its band’s stone (see Colours of the world).",
   "about": "The moulding a column stands on.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 1.4 m long",
   "tris": "70 triangles",
   "hear": "",
   "band": 2,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 4,
   "speed": null,
   "palette": [],
   "scale": null
  },
  "echinus": {
   "name": "Capital cushion",
   "role": "Has no colour of its own: it takes its band’s stone (see Colours of the world).",
   "about": "The cushion under a column’s top slab. The slab itself is a block in the district’s paint.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 1.5 m long",
   "tris": "70 triangles",
   "hear": "",
   "band": 2,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 4,
   "speed": null,
   "palette": [],
   "scale": null
  },
  "block": {
   "name": "Block",
   "role": "Has no colour of its own: it takes its band’s stone (see Colours of the world).",
   "about": "The squared stone everything else is built of: plinths, lintels, walls, kerbs, steps. Darker toward the foot.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 1 m long",
   "tris": "12 triangles",
   "hear": "",
   "band": 2,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 4,
   "speed": null,
   "palette": [],
   "scale": null
  },
  "flag": {
   "name": "Paving flag",
   "role": "Has no colour of its own: it takes its band’s stone (see Colours of the world).",
   "about": "No two corners alike. Roads, the floors of houses, the rings round the wells.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 1 m long",
   "tris": "18 triangles",
   "hear": "",
   "band": 2,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 4,
   "speed": null,
   "palette": [],
   "scale": null
  },
  "rubble": {
   "name": "Rubble",
   "role": "Has no colour of its own: it takes its band’s stone (see Colours of the world).",
   "about": "A chunk of broken masonry, half sunk where it fell.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 0.6 m long",
   "tris": "12 triangles",
   "hear": "",
   "band": 2,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 4,
   "speed": null,
   "palette": [],
   "scale": null
  },
  "wreath": {
   "name": "The people’s ring",
   "role": "Has no colour of its own: it takes its band’s paint (see Colours of the world).",
   "about": "A body closed on itself, segment by segment. The nursery’s hoops are this ring.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 3.4 m long",
   "tris": "288 triangles",
   "hear": "",
   "band": 2,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [],
   "scale": null
  },
  "hoop": {
   "name": "A young one’s hoop",
   "role": "Has no colour of its own: it takes its band’s paint (see Colours of the world).",
   "about": "The stone hoops the young swam through, beside the houses and along the way to the first well.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 1.4 m long",
   "tris": "120 triangles",
   "hear": "",
   "band": 2,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [],
   "scale": null
  },
  "coil": {
   "name": "The carved coil",
   "role": "Has no colour of its own: it takes its band’s paint (see Colours of the world).",
   "about": "A body that has almost closed on itself, with a crest where the head is. It sits at the middle of every hero’s ring.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 1.4 m long",
   "tris": "164 triangles",
   "hear": "",
   "band": 2,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [],
   "scale": null
  },
  "coin": {
   "name": "A tail, as coin",
   "role": "Has no colour of its own: it takes its band’s paint (see Colours of the world).",
   "about": "A tail segment: what the Long Ones paid with. Stacked on the market tables, heaped at the wells.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 0.4 m long",
   "tris": "64 triangles",
   "hear": "",
   "band": 2,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [],
   "scale": null
  },
  "chime": {
   "name": "Chime",
   "role": "Brushed, it swings aside and rings, on a note of whatever chord the band is playing at that moment. It stops nobody.",
   "about": "A flat bar of bronze on a cord. They hang in a row, the longest in the middle, under a lintel or on a line between two columns. The band near the foot is painted, and lit where there is nothing else to find it by.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 2 m long",
   "tris": "46 triangles",
   "hear": "",
   "band": 2,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [],
   "scale": null
  },
  "jar": {
   "name": "Jar",
   "role": "Has no colour of its own: it takes its band’s clay, warmed by its band’s paint (see Colours of the world).",
   "about": "A storage jar: foot, belly, shoulder, neck, lip, two handles, a painted band. At nearly three times the size, sealed, it is the jar a dash breaks open.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 1 m long",
   "tris": "180 triangles",
   "hear": "",
   "band": 2,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [],
   "scale": null
  },
  "jarbroken": {
   "name": "Broken jar",
   "role": "Has no colour of its own: it takes its band’s clay, warmed by its band’s paint (see Colours of the world).",
   "about": "What is left standing when a jar is broken.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 0.8 m long",
   "tris": "104 triangles",
   "hear": "",
   "band": 2,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [],
   "scale": null
  },
  "shard": {
   "name": "Sherd",
   "role": "Has no colour of its own: it takes its band’s clay, warmed by its band’s paint (see Colours of the world).",
   "about": "A potsherd, a roof tile, a broken plate: something thin with a curve to it.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 0.4 m long",
   "tris": "3 triangles",
   "hear": "",
   "band": 2,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [],
   "scale": null
  },
  "paint": {
   "name": "District paint",
   "role": "One colour to a band. It is on the top slab of every column, the caps of the well curbs, the seal over a guarded well, and the lengths of the Sum paid in that band.",
   "about": "The fin’s own reds, paler above and deeper below; the last is the body’s gold. The keepers of the rifts take their band’s colour too, unless given one of their own.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 6 m long",
   "tris": "308 triangles",
   "hear": "",
   "band": 2,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [
    [
     "band1",
     "#f9cdd6"
    ],
    [
     "band2",
     "#f4a4b9"
    ],
    [
     "band3",
     "#ec7090"
    ],
    [
     "band4",
     "#d83c5f"
    ],
    [
     "band5",
     "#c9a877"
    ]
   ],
   "scale": null
  },
  "stone": {
   "name": "Stone",
   "role": "The stone of each band’s ruins. Each block takes this colour or one of a few near it.",
   "about": "Stone weathers from the top down: the shallow ruins are the oldest and greenest, the deepest are clean.",
   "where": "The sunlight zone, The edge of light, The twilight zone, Deep twilight, Ryūgū · 6 m long",
   "tris": "308 triangles",
   "hear": "",
   "band": 2,
   "home": [
    0,
    1,
    2,
    3,
    4
   ],
   "states": [],
   "state": 0,
   "tiers": null,
   "tones": 0,
   "speed": null,
   "palette": [
    [
     "band1",
     "#c3cfae"
    ],
    [
     "band2",
     "#d2d8c2"
    ],
    [
     "band3",
     "#dde0cf"
    ],
    [
     "band4",
     "#e2e3d8"
    ],
    [
     "band5",
     "#e8e8e0"
    ]
   ],
   "scale": null
  }
 },
 "bands": [
  "The sunlight zone",
  "The edge of light",
  "The twilight zone",
  "Deep twilight",
  "Ryūgū"
 ]
};
