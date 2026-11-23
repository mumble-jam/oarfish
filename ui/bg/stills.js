// Written by `node tools/shot_ui.mjs stills` beside the stills: what the game's plate said at the moment each was taken (the band, the
// body's length in segments, the food on the way to the next) and where on the screen the marker, the head and the tail were, as
// parts of its width and height. Do not edit by hand: take the stills again.
window.STILLS = {
 "start": {
  "floor": 0,
  "segs": 10,
  "food": 0,
  "goal": {
   "x": 0.437396,
   "y": 0.082407,
   "ang": -106,
   "here": false,
   "label": "the rift · 70 m"
  },
  "head": {
   "x": 0.5472,
   "y": 0.4867
  },
  "tail": {
   "x": 0.3331,
   "y": 0.5564
  },
  "prompt": null
 },
 "nursery": {
  "floor": 0,
  "segs": 10,
  "food": 0,
  "goal": {
   "x": 0.500104,
   "y": 0.116296,
   "ang": -90,
   "here": true,
   "label": "the hoop · 12 m"
  },
  "head": {
   "x": 0.5009,
   "y": 0.4548
  },
  "tail": {
   "x": 0.5067,
   "y": 0.6848
  },
  "prompt": {
   "keys": [
    "W",
    "A",
    "S",
    "D"
   ],
   "verb": "swim",
   "x": 0.500208,
   "y": 0.288056
  }
 },
 "ruins": {
  "floor": 0,
  "segs": 14,
  "food": 0,
  "goal": {
   "x": 0.966667,
   "y": 0.149722,
   "ang": -21.2,
   "here": false,
   "label": "the rift · 76 m"
  },
  "head": {
   "x": 0.4845,
   "y": 0.5058
  },
  "tail": {
   "x": 0.487,
   "y": 0.7861
  },
  "prompt": null
 },
 "swarm": {
  "floor": 0,
  "segs": 22,
  "food": 0,
  "goal": {
   "x": 0.663542,
   "y": 0.082407,
   "ang": -53.2,
   "here": false,
   "label": "the rift · 47 m"
  },
  "head": {
   "x": 0.4964,
   "y": 0.4878
  },
  "tail": {
   "x": 0.1994,
   "y": 0.8125
  },
  "prompt": null
 },
 "keeper": {
  "floor": 0,
  "segs": 18,
  "food": 0,
  "goal": {
   "x": 0.834427,
   "y": 0.082407,
   "ang": -33.2,
   "here": false,
   "label": "the rift · 28 m"
  },
  "head": {
   "x": 0.5226,
   "y": 0.4782
  },
  "tail": {
   "x": 0.2737,
   "y": 0.6372
  },
  "prompt": null
 },
 "deep": {
  "floor": 3,
  "segs": 20,
  "food": 0,
  "goal": {
   "x": 0.600938,
   "y": 0.082407,
   "ang": -65.3,
   "here": false,
   "label": "the rift · 52 m"
  },
  "head": {
   "x": 0.4879,
   "y": 0.5049
  },
  "tail": {
   "x": 0.5526,
   "y": 0.9159
  },
  "prompt": null
 },
 "end": {
  "floor": 2,
  "segs": 5,
  "food": 0,
  "goal": {
   "x": 0.80099,
   "y": 0.082407,
   "ang": -36,
   "here": false,
   "label": "the rift · 70 m"
  },
  "head": {
   "x": 0.5179,
   "y": 0.4951
  },
  "tail": {
   "x": 0.5611,
   "y": 0.605
  },
  "prompt": null
 },
 "surface": {
  "floor": 0,
  "segs": 24,
  "food": 0,
  "goal": null,
  "head": {
   "x": 0.4709,
   "y": 0.5062
  },
  "tail": {
   "x": 0.8241,
   "y": 0.5041
  },
  "prompt": null,
  "surface": true
 },
 "library": {
  "library": "keeper"
 }
};
