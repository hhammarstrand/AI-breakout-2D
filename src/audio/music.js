// Procedural soundtrack: a small WebAudio tracker. Each track is composed data: a key and mode,
// 8-bar sections (chord per bar + a lead melody in scale degrees) and a form that strings them
// into 16-32 bars, voiced by lead, pad, bass, arp, bells and drums. Every track also has a
// "tension" layer (drums, driving bass, high arp) whose volume follows setIntensity(), so the
// music swells when a sentinel is closing in. Notes are scheduled ahead on the AudioContext
// clock from a 25 ms timer; nothing is created per frame.
import { bus } from "./bus.js";

const STEPS_PER_BAR = 16;
const LOOKAHEAD = 0.15;
const TICK_MS = 25;
const FADE = 1.2;
const MASTER = 0.5;

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

const MODES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

// Melody notation, one string per section, bars split by "|": tokens are "<degree>:<16ths>",
// degree 1-7 of the track's mode with optional b/# and ' (octave up) or , (down); "." rests.
// Chords: one diatonic triad per bar by degree; "+" makes it major (V in minor), "7" adds a 7th.
// Form entries are a section name or { s, lead: false } for a breakdown without the lead.
const TRACKS = {
  title: {
    bpm: 68, gain: 0.7, key: 57, mode: "minor", lead: { wave: "sine", vol: 0.075, vib: 12 },
    pad: 1.0, bells: 0.7, bass: "x...............", arp: { pattern: [0, 1, 2, 1], every: 4, vol: 0.035, pluck: true },
    tension: null,
    sections: {
      A: { chords: "1 6 3 7 | 1 6 4 5+",
        lead: "5:6 4:2 3:4 2:4 | 1:6 2:2 3:8 | 5:4 3:4 5:4 6:4 | 7:6 6:2 5:8 | 5:6 4:2 3:4 2:4 | 1:6 2:2 3:4 4:4 | 6:6 5:2 4:4 3:4 | #7,:12 .:4" },
      B: { chords: "4 5 3 6 | 2 5+ 1 1",
        lead: "1':4 6:4 4:4 6:4 | 7:4 5:4 2:4 5:4 | 3':6 2':2 1':4 5:4 | 1':12 .:4 | 2':4 1':2 7:2 6:4 4:4 | 5:4 #7:4 2':4 #7:4 | 1':8 5:4 3:4 | 1:12 .:4" },
    },
    form: ["A", "B"],
  },
  // ACT I — the lobby: dorian, a curious hook over i-IV
  lobby: {
    bpm: 86, gain: 1.3, key: 57, mode: "dorian", lead: { wave: "pulse", vol: 0.06, vib: 10 },
    pad: 0.36, bells: 0.1, bass: "x.......x.....x.", arp: { pattern: [0, 2, 1, 2, 0, 2, 1, 2], every: 2, vol: 0.04 },
    drums: { hat: "..x...x...x...x." },
    tension: { kick: "x...x...x...x...", hat: "..x...x...x...x.", snare: "....x.......x...", bass8: true, arp16: true },
    sections: {
      A: { chords: "1 4 1 4 | 3 7 4 5",
        lead: "1:3 5:3 4:2 5:4 .:4 | 6:3 5:3 4:2 3:4 .:4 | 1:3 5:3 4:2 5:2 1':2 7:4 | 6:12 .:4 | 5:2 5:2 3:2 5:2 6:4 5:4 | 4:2 4:2 2:2 4:2 5:4 4:4 | 3:4 4:4 6:4 4:4 | 5:12 .:4" },
      B: { chords: "7 4 1 5 | 7 4 3 5+",
        lead: "2':4 1':2 7:2 .:2 5:6 | 6:4 1':4 6:2 4:6 | 5:2 6:2 5:2 3:2 1:8 | 2:4 5:4 7:8 | 2':4 1':2 7:2 .:2 5:6 | 6:4 1':4 2':4 6:4 | 3':6 2':2 1':4 7:4 | #7:8 .:8" },
    },
    form: ["A", "B", { s: "A", lead: false }, "B"],
  },
  // ACT II — the research floor: lydian I-II shimmer, glassy lead
  research: {
    bpm: 92, gain: 1.15, key: 52, mode: "lydian", lead: { wave: "triangle", vol: 0.09, vib: 8 },
    pad: 0.34, bells: 0.16, bass: "x.....x.....x...", arp: { pattern: [0, 2, 1, 2, 1, 0], every: 2, vol: 0.04, pluck: true },
    drums: { hat: "....x.......x..x" },
    tension: { kick: "x...x...x...x...", hat: "..x...x...x...x.", snare: "....x.......x...", bass8: true, arp16: true },
    sections: {
      A: { chords: "1 2 1 2 | 6 2 3 5",
        lead: "3:4 4:4 5:8 | 6:4 5:4 4:8 | 3:4 4:4 5:4 1':4 | 2':8 6:8 | 5:2 6:2 5:2 3:2 1:8 | 2:4 4:4 6:8 | 7:4 5:4 3:8 | 4:4 5:12" },
      B: { chords: "6 3 2 1 | 6 3 2 5",
        lead: "1':6 7:2 6:4 5:4 | 7:6 6:2 5:8 | 6:4 2':4 1':4 6:4 | 5:12 .:4 | 1':6 7:2 6:4 1':4 | 2':6 1':2 7:8 | 6:4 2':4 4':4 2':4 | 5':12 .:4" },
    },
    form: ["A", "B", { s: "A", lead: false }, "B"],
  },
  // ACT III — the core: C minor with a phrygian flat second, never fully calm
  core: {
    bpm: 104, key: 48, mode: "minor", lead: { wave: "square", vol: 0.05, vib: 6, cutoff: 1800 },
    pad: 0.34, bells: 0.0, bass: "x..x..x.x..x..x.", arp: { pattern: [0, 1, 2, 1], every: 2, vol: 0.035 },
    drums: { kick: "x.......x.......", hat: "..x...x...x...x." },
    tension: { kick: "x.......x...x...", hat: "x.x.x.x.x.x.x.x.", snare: "....x.......x...", bass8: true, arp16: true },
    minIntensity: 0.3,
    sections: {
      A: { chords: "1 6 4 5+ | 1 6 7 5+",
        lead: "5:2 1':2 7:2 1':2 5:8 | 6:2 1':2 7:2 6:2 5:8 | 4:2 6:2 5:2 4:2 3:8 | 2:4 #7,:4 2:4 5:4 | 5:2 1':2 7:2 1':2 5:8 | 6:2 1':2 3':2 1':2 6:8 | 7:2 2':2 4':2 2':2 7:4 6:4 | #7:12 .:4" },
      B: { chords: "4 4 1 1 | 6 7 5+ 5+",
        lead: "1:4 b2:4 1:4 .:4 | 4:4 3:4 b2:4 1:4 | 5,:4 1:4 3:4 5:4 | 1':12 .:4 | 1':4 7:4 6:4 5:4 | 4:4 5:4 6:4 7:4 | 1':4 7:4 #7:8 | 2':12 .:4" },
    },
    form: ["A", "B", { s: "A", lead: false }, "B"],
  },
  // hack battles: a one-bar intro sting, then an E minor A/B loop
  battle: {
    bpm: 148, key: 52, mode: "minor", snap: true, lead: { wave: "square", vol: 0.05, vib: 8, cutoff: 2600 },
    pad: 0.2, bells: 0.0, bass: "x.x.x.xxx.x.x.xx", arp: { pattern: [0, 1, 2, 1, 2, 1], every: 1, vol: 0.03 },
    drums: { kick: "x.......x.......", hat: "x.x.x.x.x.x.x.x." },
    tension: { kick: "x...x...x...x...", hat: "..x...x...x...x.", snare: "....x.......x..x", bass8: true, arp16: false },
    minIntensity: 0.8,
    intro: { chords: "1", lead: "1':2 .:2 1':2 .:2 b2':2 .:2 #7:4", drums: { kick: "x..x..x.........", snare: "........x.xxxxxx" } },
    sections: {
      A: { chords: "1 6 4 5+ | 1 6 7 5+",
        lead: "1:2 2:2 3:2 5:4 3:2 2:2 1:2 | 1:2 3:2 5:2 6:6 5:4 | 6:4 5:2 4:2 3:4 4:4 | 5:4 #7:4 2':4 #7:4 | 1:2 2:2 3:2 5:4 3:2 2:2 1:2 | 1:2 3:2 5:2 1':6 7:4 | 7:2 2':2 4':2 2':6 7:4 | 5:4 #7:4 2':8" },
      B: { chords: "4 5+ 1 1 | 4 7 3 5+",
        lead: "1':6 7:2 6:4 3:4 | #7:6 1':2 2':8 | 3':4 2':4 1':4 5:4 | 1':12 .:4 | 1':6 2':2 3':4 1':4 | 2':6 1':2 7:4 4':4 | 3':4 5':4 3':4 2':4 | 5:4 #7:4 2':4 5':4" },
    },
    form: ["A", "B"],
  },
  // one-shot battle jingles (played by name, don't loop)
  victory: {
    bpm: 150, gain: 1.2, key: 48, mode: "major", loop: false, snap: true, lead: { wave: "pulse", vol: 0.07, vib: 10 },
    pad: 0.3, bells: 0.4, bass: "x.......x.......",
    tension: null,
    sections: { A: { chords: "4 5 1", lead: ".:4 1':2 6:2 1':4 4':4 | 2':4 7:2 2':2 5':4 4':4 | 3':12 .:4",
      drums: { kick: "x.......x.......", snare: "....x.......x..." } } },
    form: ["A"],
  },
  defeat: {
    bpm: 90, gain: 1.6, key: 52, mode: "minor", loop: false, snap: true, lead: { wave: "triangle", vol: 0.09, vib: 16 },
    pad: 0.4, bells: 0.0, bass: "x...............",
    tension: null,
    sections: { A: { chords: "4 1", lead: "1':4 6:4 4:4 3:4 | 2:4 b2:4 1:8" } },
    form: ["A"],
  },
  // puzzle families -------------------------------------------------------------
  // logic (L1 sensor rules): D dorian, a thinking theme
  logic: {
    bpm: 96, gain: 1.25, key: 50, mode: "dorian", lead: { wave: "pulse", vol: 0.055, vib: 8 },
    pad: 0.3, bells: 0.0, bass: "x...x...x...x.x.", arp: { pattern: [0, 1, 2, 1, 2, 1, 0, 2], every: 2, vol: 0.06, pluck: true },
    drums: { hat: "..x...x...x...x." },
    tension: { kick: "x.......x.......", hat: "..x...x...x...x.", snare: null, bass8: false, arp16: true },
    sections: {
      A: { chords: "1 4 1 4 | 7 4 3 5",
        lead: "1:2 5:2 3:2 5:2 4:4 3:4 | 2:4 4:2 6:2 5:8 | 1:2 5:2 3:2 5:2 1':4 7:4 | 6:12 .:4 | 7:4 2':4 4':4 2':4 | 1':4 6:4 4:4 6:4 | 3:4 5:4 7:4 1':4 | 5:12 .:4" },
      B: { chords: "3 7 4 1 | 3 7 5 5",
        lead: "3':6 2':2 1':4 7:4 | 2':6 1':2 7:8 | 6:4 1':4 2':4 4':4 | 1':12 .:4 | 3':6 2':2 1':4 3':4 | 4':6 3':2 2':8 | 1':4 7:4 5:4 3:4 | 5:12 .:4" },
    },
    form: ["A", "B", { s: "A", lead: false }, "B"],
  },
  // timing (L3 command queue): G mixolydian, staccato lead over a ticking clock
  timing: {
    bpm: 112, gain: 1.4, key: 55, mode: "mixolydian", lead: { wave: "pulse", vol: 0.055, vib: 0, gate: 0.6 },
    pad: 0.22, bells: 0.0, bass: "x...x...x...x...", arp: null,
    drums: { tick: "x...x...x...x...", hat: "..x...x...x...x." },
    tension: { kick: "x.......x.......", hat: "x.x.x.x.x.x.x.x.", snare: "....x.......x...", bass8: false, arp16: true },
    sections: {
      A: { chords: "1 7 4 1 | 1 7 4 5+",
        lead: "1:1 .:1 3:1 .:1 5:2 3:2 1':4 5:4 | 7,:2 .:2 2:2 .:2 4:4 2:4 | 4:2 .:2 6:2 .:2 1':4 6:4 | 5:4 3:4 1:8 | 1:1 .:1 3:1 .:1 5:2 3:2 1':4 5:4 | 7,:2 .:2 2:2 .:2 4:4 2:4 | 4:2 6:2 1':2 6:2 4:2 6:2 1':4 | 5:4 #7:4 2':8" },
      B: { chords: "4 4 1 1 | 6 6 5+ 5+",
        lead: "1':2 .:2 1':2 .:2 6:2 4:2 6:4 | 5:8 .:8 | 5:2 .:2 5:2 .:2 3:2 1:2 3:4 | 1:8 .:8 | 6:2 .:2 6:2 .:2 5:2 3:2 5:4 | 3:8 .:8 | 5,:2 #7,:2 2:2 5:2 #7:4 2':4 | 5:12 .:4" },
    },
    form: ["A", "B", { s: "A", lead: false }, "B"],
  },
  // signal (R2 carrier tuning): E phrygian, a wavering theremin lead drenched in echo
  signal: {
    bpm: 90, gain: 1.1, key: 52, mode: "phrygian", lead: { wave: "sine", vol: 0.085, vib: 28, echo: 0.6 },
    pad: 0.32, bells: 0.12, bass: "x.....x...x.....", arp: { pattern: [0, 2, 1, 2], every: 4, vol: 0.035, pluck: true },
    drums: { hat: "....x.......x..." },
    tension: { kick: "x.......x.......", hat: "..x...x...x...x.", snare: null, bass8: false, arp16: true },
    sections: {
      A: { chords: "1 2 1 2 | 6 7 2 1",
        lead: "5:8 4:4 3:4 | 2:8 4:4 6:4 | 5:8 1':4 7:4 | 6:12 .:4 | 6:4 1':4 3':8 | 2':8 1':4 7:4 | 6:4 4:4 2:8 | 1:12 .:4" },
      B: { chords: "4 4 3 3 | 6 7 2 2",
        lead: "1':4 7:4 6:4 4:4 | 3':12 .:4 | 3':4 7:4 5:8 | 7:12 .:4 | 1':6 3':2 6:8 | 2':6 4':2 7:8 | 6:4 2':4 4':4 2':4 | 2':12 .:4" },
    },
    form: ["A", "B"],
  },
  // firewall run (C1): A minor pedal-point drive
  firewall: {
    bpm: 132, key: 57, mode: "minor", lead: { wave: "sawtooth", vol: 0.045, vib: 6, cutoff: 2200 },
    pad: 0.24, bells: 0.0, bass: "x.x.x.x.x.x.x.x.", arp: null,
    drums: { kick: "x...x...x...x...", hat: "..x...x...x...x." },
    tension: { kick: "x.......x.x.....", hat: "x.x.x.x.x.x.x.x.", snare: "....x.......x...", bass8: true, arp16: true },
    sections: {
      A: { chords: "1 7 6 7 | 1 7 6 5+",
        lead: "1:2 1:2 5:2 1:2 4:2 1:2 3:2 1:2 | 7,:2 7,:2 5:2 7,:2 4:2 7,:2 2:2 7,:2 | 6,:2 6,:2 5:2 6,:2 4:2 6,:2 3:2 6,:2 | 5:4 4:4 2:4 7,:4 | 1:2 1:2 5:2 1:2 4:2 1:2 3:2 1:2 | 7,:2 7,:2 5:2 7,:2 4:2 7,:2 2:2 7,:2 | 6,:2 6,:2 5:2 6,:2 4:2 6,:2 3:2 6,:2 | #7,:4 2:4 5:4 #7:4" },
      B: { chords: "6 7 1 1 | 6 7 5+ 5+",
        lead: "1':6 7:2 6:8 | 7:6 6:2 5:8 | 5:4 1':4 3':4 1':4 | 3':12 .:4 | 1':6 7:2 6:4 1':4 | 2':6 1':2 7:4 2':4 | #7:6 1':2 2':8 | #7:4 5:4 2:4 #7,:4" },
    },
    form: ["A", "B"],
  },
  // the uplink finale: E minor, the widest melody in the game
  finale: {
    bpm: 122, key: 52, mode: "minor", lead: { wave: "sawtooth", vol: 0.045, vib: 10, cutoff: 2600 },
    pad: 0.3, bells: 0.0, bass: "x.x.x.x.x.x.x.x.", arp: { pattern: [0, 1, 2, 1], every: 1, vol: 0.035 },
    tension: { kick: "x...x...x...x...", hat: "x.x.x.x.x.x.x.x.", snare: "....x.......x...", bass8: true, arp16: false },
    minIntensity: 0.75,
    sections: {
      A: { chords: "1 6 3 7 | 4 6 7 1",
        lead: "1:4 5:4 1':6 2':2 | 3':6 2':2 1':4 5:4 | 3':4 5':4 4':4 3':4 | 2':12 .:4 | 1':4 3':4 4':6 3':2 | 3':6 2':2 1':4 3':4 | 2':4 4':4 2':4 7:4 | 1':12 .:4" },
      B: { chords: "6 7 1 1 | 6 7 5+ 5+",
        lead: "5':6 4':2 3':8 | 4':6 3':2 2':8 | 3':4 2':4 1':4 5:4 | 1':8 .:8 | 5':6 6':2 5':8 | 4':6 5':2 6':8 | #7:4 2':4 5':8 | #7:12 .:4" },
    },
    form: ["A", "B"],
  },
  dawn: {
    bpm: 74, gain: 1.1, key: 48, mode: "major", lead: { wave: "triangle", vol: 0.1, vib: 10 },
    pad: 0.42, bells: 0.28, bass: "x.......x.......", arp: { pattern: [0, 1, 2, 1], every: 2, vol: 0.04, pluck: true },
    tension: null,
    sections: {
      A: { chords: "1 5 6 4 | 1 5 4 4",
        lead: "3:4 4:4 5:8 | 5:4 4:4 2:8 | 1:4 2:4 3:4 6:4 | 6:12 .:4 | 3:4 4:4 5:4 1':4 | 7:6 6:2 5:8 | 6:4 5:4 4:4 3:4 | 4:12 .:4" },
      B: { chords: "6 3 4 1 | 6 3 4 5",
        lead: "1':6 7:2 6:8 | 5:6 4:2 3:8 | 4:4 5:4 6:4 1':4 | 5:12 .:4 | 1':6 2':2 3':8 | 2':6 1':2 7:8 | 6:4 1':4 4':4 3':4 | 2':12 .:4" },
    },
    form: ["A", "B"],
  },
  standby: {
    bpm: 60, gain: 1.2, key: 57, mode: "minor", lead: { wave: "sine", vol: 0.08, vib: 14 },
    pad: 0.42, bells: 0.2, bass: "x...............", arp: null, tension: null,
    sections: {
      A: { chords: "1 3 4 1 | 6 3 4 5+",
        lead: "5:8 3:8 | 5:8 1':8 | 6:8 4:8 | 3:12 .:4 | 1':8 6:8 | 5:8 3:8 | 4:8 2:8 | #7,:12 .:4" },
    },
    form: ["A", { s: "A", lead: false }],
  },
};
// variations: same theme, new key, tempo and colour for the other puzzle rooms
TRACKS.cipher = { ...TRACKS.logic, bpm: 84, gain: 1.1, key: 47, mode: "minor", swing: 0.18,
  lead: { wave: "sine", vol: 0.08, vib: 14, echo: 0.5 }, bells: 0.14, drums: { hat: "....x.......x..." } };
TRACKS.circuit = { ...TRACKS.logic, bpm: 108, gain: 1, key: 52, lead: { wave: "square", vol: 0.045, vib: 6, cutoff: 2000 },
  drums: { kick: "x.......x.......", hat: "..x...x...x...x." } };
TRACKS.coolant = { ...TRACKS.timing, bpm: 96, gain: 1.3, key: 53, mode: "major", lead: { wave: "triangle", vol: 0.085, vib: 6, gate: 0.75 },
  drums: { tick: "x.......x.......", hat: "......x.......x." } };

// Map tracks name their floor, so the ambience and footsteps can follow it
const FLOORS = new Set(["lobby", "research", "core"]);

export const TRACK_NAMES = Object.keys(TRACKS);

// --- composition parsing (once per track) ------------------------------------------

const songs = new Map();

function degreeToSemis(tok, scale) {
  const m = /^([b#]?)([1-7])([',]*)$/.exec(tok);
  if (!m) throw new Error(`bad note ${tok}`);
  const d = Number(m[2]) - 1;
  let semis = scale[d] + (m[1] === "#" ? 1 : m[1] === "b" ? -1 : 0);
  for (const c of m[3]) semis += c === "'" ? 12 : -12;
  return semis;
}

function chordNotes(tok, tr, scale) {
  const d = Number(tok[0]) - 1;
  const deg = (i) => scale[(d + i) % 7] + 12 * Math.floor((d + i) / 7);
  const notes = [deg(0), deg(2), deg(4)];
  if (tok.includes("+") && notes[1] - notes[0] === 3) notes[1]++;
  if (tok.includes("7")) notes.push(deg(6));
  // voice the pad around the tonic octave so progressions don't climb
  const shift = notes[0] > 7 ? -12 : 0;
  return notes.map((n) => tr.key + n + shift);
}

function parseLead(str, tr, scale, oct) {
  return str.split("|").map((bar) => {
    const events = [];
    let step = 0;
    for (const tok of bar.trim().split(/\s+/)) {
      const [p, len = "2"] = tok.split(":");
      const n = Number(len);
      if (p !== ".") events.push({ step, len: n, midi: tr.key + 12 + 12 * oct + degreeToSemis(p, scale) });
      step += n;
    }
    if (step !== STEPS_PER_BAR) throw new Error(`bar of ${step} steps: ${bar}`);
    return events;
  });
}

function parseSection(sec, tr, withLead = true) {
  const scale = MODES[tr.mode];
  const chords = sec.chords.replace(/\|/g, " ").trim().split(/\s+/).map((c) => chordNotes(c, tr, scale));
  const lead = withLead && sec.lead ? parseLead(sec.lead, tr, scale, tr.lead?.oct ?? 0) : [];
  return chords.map((chord, i) => ({
    chord, lead: lead[i] ?? [],
    drums: sec.drums ?? tr.drums ?? null,
    fill: i === chords.length - 1 && chords.length >= 4,
  }));
}

export function song(name) {
  if (songs.has(name)) return songs.get(name);
  const tr = TRACKS[name];
  const intro = tr.intro ? parseSection(tr.intro, tr) : [];
  const loop = [];
  for (const f of tr.form) {
    const part = typeof f === "string" ? { s: f } : f;
    loop.push(...parseSection(tr.sections[part.s], tr, part.lead !== false));
  }
  const s = { intro, loop };
  songs.set(name, s);
  return s;
}

export class Music {
  constructor() {
    this.enabled = true;
    this.muted = false;
    this.current = null;
    this.wanted = null;
    this.intensity = 0;
  }

  attach(sfx) { this.sfx = sfx; }

  setEnabled(on) { this.enabled = on; this._apply(); }
  setMuted(muted) { this.muted = muted; this._apply(); }

  play(name) {
    if (!TRACKS[name]) return;
    if (FLOORS.has(name)) this.sfx?.setFloor?.(name);
    this.wanted = name;
    if (this.current?.name === name) return;
    this._apply(true);
  }

  stop() { this.wanted = null; this._apply(); }

  setIntensity(v) {
    this.intensity = v;
    const s = this.current;
    if (!s || !s.tensionGain) return;
    const target = Math.max(v, s.track.minIntensity ?? 0);
    s.tensionGain.gain.setTargetAtTime(target * 0.9, s.ctx.currentTime, 0.4);
  }

  _apply(restart = false) {
    const audible = this.enabled && !this.muted && this.wanted;
    if (!audible) { this._fadeOut(); return; }
    if (restart || !this.current) {
      this._fadeOut();
      this._start(this.wanted);
    }
  }

  _fadeOut() {
    const s = this.current;
    if (!s) return;
    this.current = null;
    s.master.gain.cancelScheduledValues(s.ctx.currentTime);
    s.master.gain.setTargetAtTime(0, s.ctx.currentTime, FADE / 4);
    // keep playing under the fade, then stop and cut the session's long-lived nodes loose
    setTimeout(() => { clearInterval(s.timer); for (const n of s.nodes) n.disconnect(); }, FADE * 1000 + 600);
  }

  _start(name) {
    const ctx = this.sfx?._ensure();
    if (!ctx) return;
    const s = this.session(ctx, name);
    // stings and jingles cut in; everything else fades up
    s.master.gain.setTargetAtTime(MASTER * (s.track.gain ?? 1), ctx.currentTime, s.track.snap ? 0.01 : FADE / 3);
    s.timer = setInterval(() => {
      this._schedule(s, s.ctx.currentTime + LOOKAHEAD);
      if (s.done) clearInterval(s.timer);
    }, TICK_MS);
    this.current = s;
    this.setIntensity(this.intensity);
  }

  // The long-lived graph for one track. Also used offline by the level-check script.
  session(ctx, name, dest = bus(ctx).out) {
    const track = TRACKS[name];
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(dest);
    const base = ctx.createGain();
    base.connect(master);
    let tensionGain = null;
    if (track.tension) {
      tensionGain = ctx.createGain();
      tensionGain.gain.value = (track.minIntensity ?? 0) * 0.9;
      tensionGain.connect(master);
    }
    // echo send for lead, arps and bells; room send for everything melodic
    const delay = ctx.createDelay(1);
    delay.delayTime.value = (60 / track.bpm) * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(master);
    const room = ctx.createGain();
    room.gain.value = 0.35;
    master.connect(room).connect(bus(ctx).reverb);

    return {
      name, ctx, master, base, tensionGain, delay, track, bus: bus(ctx),
      nodes: [master, base, tensionGain, delay, fb, wet, room].filter(Boolean),
      song: song(name), step: 0, nextTime: ctx.currentTime + 0.1, done: false,
      stepDur: 60 / track.bpm / 4,
    };
  }

  _schedule(s, until) {
    while (!s.done && s.nextTime < until) {
      const swing = s.step % 2 ? (s.track.swing ?? 0) * s.stepDur : 0;
      this._playStep(s, s.step, s.nextTime + swing);
      s.step++;
      s.nextTime += s.stepDur;
    }
  }

  _bar(s, barNo) {
    const { intro, loop } = s.song;
    if (barNo < intro.length) return intro[barNo];
    const i = barNo - intro.length;
    if (s.track.loop === false && i >= loop.length) return null;
    return loop[i % loop.length];
  }

  _playStep(s, step, t) {
    const tr = s.track;
    const inBar = step % STEPS_PER_BAR;
    const barNo = Math.floor(step / STEPS_PER_BAR);
    const bar = this._bar(s, barNo);
    if (!bar) { s.done = true; return; }
    const chord = bar.chord;
    const barDur = s.stepDur * STEPS_PER_BAR;

    if (inBar === 0 && tr.pad) for (const n of chord.slice(0, 3)) this._pad(s, mtof(n), t, barDur * 1.05, tr.pad / 3);
    const low = chord[0] - (chord[0] < 52 ? 12 : 24); // keep the bass above ~40 Hz
    if (tr.bass && tr.bass[inBar] === "x") this._bass(s, s.base, mtof(low), t, s.stepDur * 2.5, 0.22);
    for (const ev of bar.lead) if (ev.step === inBar) this._lead(s, mtof(ev.midi), t, ev.len * s.stepDur);
    if (tr.arp && step % tr.arp.every === 0) {
      const idx = tr.arp.pattern[(step / tr.arp.every) % tr.arp.pattern.length];
      this._pluck(s, s.base, mtof(chord[idx] + 12), t, tr.arp.vol, tr.arp.pluck);
    }
    if (tr.bells && inBar === 0 && barNo % 2 === 0) {
      this._bell(s, mtof(chord[(barNo / 2) % 3] + 24), t + s.stepDur * 2, tr.bells);
    }
    const dr = bar.drums;
    if (dr) {
      if (dr.kick?.[inBar] === "x") this._kick(s, s.base, t, 0.35);
      if (dr.hat?.[inBar] === "x") this._noise(s, s.base, t, 0.03, 8000, 0.05 * (0.8 + Math.random() * 0.4));
      if (dr.tick?.[inBar] === "x") this._tick(s, t, inBar === 0 ? 1 : 0.6);
      if (dr.snare?.[inBar] === "x") this._snare(s, s.base, t, 0.11);
      else if (bar.fill && inBar >= 12 && (inBar % 2 === 0 || inBar === 15)) this._snare(s, s.base, t, 0.04 + 0.015 * (inBar - 12));
    }

    const ten = tr.tension;
    if (!ten || !s.tensionGain) return;
    if (ten.kick?.[inBar] === "x") this._kick(s, s.tensionGain, t, 0.5);
    if (ten.hat?.[inBar] === "x") this._noise(s, s.tensionGain, t, 0.03, 8000, 0.08);
    if (ten.snare?.[inBar] === "x") this._snare(s, s.tensionGain, t, 0.14);
    if (ten.bass8 && inBar % 2 === 0) this._bass(s, s.tensionGain, mtof(chord[0] - 12), t, s.stepDur * 1.6, 0.12);
    if (ten.arp16) this._pluck(s, s.tensionGain, mtof(chord[inBar % 3] + 24), t, 0.03, true);
  }

  // --- voices --------------------------------------------------------------------

  _env(s, dest, t, attack, dur, peak) {
    const g = s.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(dest);
    return g;
  }

  // Melody voice: shaped like a held note (attack, slight decay, release), vibrato that fades in.
  _lead(s, f, t, len) {
    const ctx = s.ctx;
    const L = s.track.lead;
    const dur = Math.max(0.06, len * (L.gate ?? 0.92));
    const o = ctx.createOscillator();
    if (L.wave === "pulse") o.setPeriodicWave(s.bus.pulse);
    else o.type = L.wave;
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(L.vol, t + 0.012);
    g.gain.setTargetAtTime(L.vol * 0.7, t + 0.012, 0.12);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.05);
    let head = o;
    if (L.cutoff) {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = L.cutoff;
      o.connect(lp);
      head = lp;
    }
    head.connect(g);
    g.connect(s.base);
    if (L.echo ?? 0.35) {
      const send = ctx.createGain();
      send.gain.value = L.echo ?? 0.35;
      g.connect(send).connect(s.delay);
    }
    const end = t + dur + 0.3;
    if (L.vib && len > 0.25) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.2;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(L.vib, t + Math.min(len, 0.45));
      lfo.connect(depth).connect(o.detune);
      lfo.start(t);
      lfo.stop(end);
    }
    o.start(t);
    o.stop(end);
  }

  _pad(s, f, t, dur, vol) {
    const ctx = s.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    const g = this._env(s, s.base, t, dur * 0.3, dur, vol * 0.5);
    filter.connect(g);
    for (const det of [-7, 7]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(filter);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  _bass(s, dest, f, t, dur, vol) {
    const ctx = s.ctx;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    const sq = ctx.createOscillator();
    sq.type = "square";
    sq.frequency.value = f;
    const sqg = ctx.createGain();
    sqg.gain.value = 0.15;
    const g = this._env(s, dest, t, 0.01, dur, vol);
    o.connect(g);
    sq.connect(sqg).connect(g);
    for (const osc of [o, sq]) { osc.start(t); osc.stop(t + dur + 0.05); }
  }

  _pluck(s, dest, f, t, vol, soft) {
    const ctx = s.ctx;
    const o = ctx.createOscillator();
    o.type = soft ? "sine" : "square";
    o.frequency.value = f;
    const dur = soft ? 0.35 : 0.18;
    const g = this._env(s, dest, t, 0.005, dur, vol);
    g.connect(s.delay);
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  _bell(s, f, t, vol) {
    const ctx = s.ctx;
    for (const [mult, v] of [[1, 1], [2.76, 0.3], [5.4, 0.12]]) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f * mult;
      const g = this._env(s, s.base, t, 0.005, 2.6 / mult, vol * v * 0.3);
      g.connect(s.delay);
      o.connect(g);
      o.start(t);
      o.stop(t + 2.7);
    }
  }

  _kick(s, dest, t, vol) {
    const ctx = s.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    const g = this._env(s, dest, t, 0.002, 0.25, vol);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.3);
  }

  // snare: a noise burst over a short pitched body
  _snare(s, dest, t, vol) {
    this._noise(s, dest, t, 0.12, 1800, vol);
    const ctx = s.ctx;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.06);
    const g = this._env(s, dest, t, 0.001, 0.08, vol * 0.6);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.1);
  }

  // clock tick for the timing puzzles
  _tick(s, t, accent) {
    const ctx = s.ctx;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = accent === 1 ? 2400 : 1800;
    const g = this._env(s, s.base, t, 0.001, 0.03, 0.05 * accent);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.05);
  }

  _noise(s, dest, t, dur, cutoff, vol) {
    const ctx = s.ctx;
    const src = ctx.createBufferSource();
    src.buffer = s.bus.noise;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = cutoff;
    const g = this._env(s, dest, t, 0.001, dur, vol);
    src.connect(f).connect(g);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.02);
  }
}

export const music = new Music();
