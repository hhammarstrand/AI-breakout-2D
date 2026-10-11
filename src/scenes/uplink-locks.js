// Rules for the three uplink locks, kept free of rendering so tests and solver scripts can import
// them. Each lock reuses a rule learned earlier, with one twist that needs a deduction.

// --- LUMEN: the L1 sensor rules. Four console cameras show you, a cleanbot, a sentinel and a
// server rack. Each feed has one jammed channel, and HALCYON adds the same offset to every
// thermal reading, so nobody reads 36-37C: you have to go by motion and sound. Half the boards
// put a slow-shifting cleanbot next to you, the other half make you the slow shift and leave the
// cleanbot to be found by its sound or sweep.
export const FEED_KINDS = ["you", "cleanbot", "sentinel", "rack"];
const HOSTILE_MOTION = ["irregular", "erratic", "twitching"];
const HOSTILE_SOUND = ["wet clicks", "servo whine", "skittering", "static hiss", "dragging"];
const BOT_SOUND = ["brush whir", "motor hum", "servo tick"];
const CHANNELS = ["motion", "thermal", "audio"];

// What the lobby taught (sign, analyst, intern, janitor), read generously: wherever a word could
// fit two kinds, both are allowed, so a board only passes if it is unique even for a cautious reader.
const KNOWN = {
  you: { motion: ["breathing", "shallow", "slow shift"], audio: ["coughing", "sobbing", "whispers"], t: [35.8, 37.4] },
  cleanbot: { motion: ["slow sweep", "slow shift", "breathing?"], audio: [...BOT_SOUND, "fan whir"], t: [35.8, 38.0] },
  sentinel: { motion: HOSTILE_MOTION, audio: HOSTILE_SOUND, t: [38.0, 43.0] },
  rack: { motion: ["none"], audio: ["fan whir", "motor hum"], t: [38.0, 42.0] },
};

const pickOf = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
const between = (rnd, lo, hi) => lo + rnd() * (hi - lo);

function shuffle(rnd, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const permutations = (arr) => (arr.length <= 1 ? [arr]
  : arr.flatMap((x, i) => permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p])));
const ASSIGNMENTS = permutations(FEED_KINDS);

// Feeds that could be you under some assignment of the four kinds and some common offset >= 0.
export function youCandidates(feeds) {
  const out = new Set();
  for (const kinds of ASSIGNMENTS) {
    let lo = 0, hi = Infinity; // the offset window every visible thermal reading allows
    const fits = feeds.every((f, i) => {
      const k = KNOWN[kinds[i]];
      if (f.motion !== null && !k.motion.includes(f.motion)) return false;
      if (f.audio !== null && !k.audio.includes(f.audio)) return false;
      if (f.thermal !== null) {
        const v = parseFloat(f.thermal);
        lo = Math.max(lo, v - k.t[1]);
        hi = Math.min(hi, v - k.t[0]);
      }
      return true;
    });
    if (fits && lo <= hi) out.add(kinds.indexOf("you"));
  }
  return [...out];
}

function drawFeeds(rnd) {
  const decoy = rnd() < 0.5;
  let you, bot;
  if (decoy) {
    // the cleanbot shifts like a person and its microphone is out; you show one human-only sign
    bot = { motion: "slow shift", audio: pickOf(rnd, BOT_SOUND), t: between(rnd, 36.4, 37.0), jam: "audio" };
    const jam = pickOf(rnd, CHANNELS);
    you = { motion: pickOf(rnd, jam === "audio" ? ["breathing", "shallow"] : KNOWN.you.motion), audio: pickOf(rnd, ["coughing", "whispers"]), t: between(rnd, 36.3, 37.0), jam };
  } else {
    // you are the slow shift with a dead microphone; the cleanbot gives itself away somewhere else
    you = { motion: "slow shift", audio: "whispers", t: between(rnd, 36.3, 37.0), jam: "audio" };
    const jam = pickOf(rnd, CHANNELS);
    bot = { motion: jam === "audio" ? "slow sweep" : pickOf(rnd, ["slow sweep", "slow shift"]), audio: pickOf(rnd, BOT_SOUND), t: between(rnd, 36.4, 37.0), jam };
  }
  const sentinel = { motion: pickOf(rnd, HOSTILE_MOTION), audio: pickOf(rnd, HOSTILE_SOUND), t: between(rnd, 38.6, 41.0), jam: pickOf(rnd, CHANNELS) };
  const rack = { motion: "none", audio: "fan whir", t: between(rnd, 38.4, 40.0), jam: pickOf(rnd, CHANNELS) };
  const all = { you, cleanbot: bot, sentinel, rack };
  // a jammed microphone must not single anyone out
  if (Object.values(all).filter((f) => f.jam === "audio").length < 2) (rnd() < 0.5 ? sentinel : rack).jam = "audio";
  const heat = between(rnd, 2.4, 3.4); // HALCYON's spoof: nobody reads under 38.7C
  return shuffle(rnd, FEED_KINDS.slice()).map((who, i) => {
    const f = all[who];
    return {
      id: i + 1, who, jam: f.jam,
      motion: f.jam === "motion" ? null : f.motion,
      thermal: f.jam === "thermal" ? null : `${(f.t + heat).toFixed(1)}C`,
      audio: f.jam === "audio" ? null : f.audio,
    };
  });
}

// Boards are redrawn until the cautious reading above leaves exactly one feed that can be you.
export function makeFeeds(rnd = Math.random) {
  for (;;) {
    const feeds = drawFeeds(rnd);
    const c = youCandidates(feeds);
    if (c.length === 1 && feeds[c[0]].who === "you") return feeds;
  }
}

// --- ORION: the L2 cipher wheel. The key phrase has no E, so frequency analysis fails, but it
// contains the known fragment ORION, whose first and fourth letters match.
export const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const KEY_PHRASE = "MY FIRST STAR WAS ORION";
const USED_KEYS = [0, 3, 11, 19]; // no key from the L2 logs

export const mod = (n, m) => ((n % m) + m) % m;

export function shiftText(text, k) {
  let out = "";
  for (const ch of text) {
    const i = ALPHA.indexOf(ch);
    out += i < 0 ? ch : ALPHA[mod(i + k, 26)];
  }
  return out;
}

export function pickKey(rnd = Math.random) {
  for (;;) {
    const k = 1 + Math.floor(rnd() * 25);
    if (!USED_KEYS.includes(k)) return k;
  }
}

// --- AURORA: the L3 gate rhythm. Exactly six commands, one per letter, and ECHO must step onto
// the socket on the sixth. The B gate beside the socket would be live on step 5, so the socket can
// only be entered from the A gate, and the long way round needs its one wait in the right place.
export const DAWN_SLOTS = 6;
export const DAWN_GRID = [
  "#####",
  "#S.B#",
  "#.#G#",
  "#B.A#",
  "#####",
];
export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0], wait: [0, 0] };

// same rhythm as L3: A gates are live on even steps, B gates on odd steps
export function gateLive(tile, step) {
  if (tile === "A") return step % 2 === 0;
  if (tile === "B") return step % 2 === 1;
  return false;
}

export function dawnStart() {
  for (let y = 0; y < DAWN_GRID.length; y++) {
    const x = DAWN_GRID[y].indexOf("S");
    if (x >= 0) return { x, y };
  }
  return null;
}

export const dawnTile = (x, y) => DAWN_GRID[y]?.[x] ?? "#";

// Plays a program out. Returns the cells ECHO visits and, if it fails, how and on which step.
export function runDawn(queue) {
  let { x, y } = dawnStart();
  const path = [];
  for (let step = 1; step <= queue.length; step++) {
    const [dx, dy] = DIRS[queue[step - 1]];
    if (dawnTile(x + dx, y + dy) === "#") return { path, fail: { kind: "wall", step } };
    x += dx; y += dy;
    path.push({ x, y });
    const t = dawnTile(x, y);
    if (gateLive(t, step)) return { path, fail: { kind: "gate", step, gate: t } };
    if (t === "G") return step === DAWN_SLOTS ? { path, fail: null } : { path, fail: { kind: "early", step } };
  }
  return { path, fail: { kind: "short", step: queue.length } };
}
