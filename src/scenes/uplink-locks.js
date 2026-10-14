// Rules for the three uplink locks, kept free of rendering so tests and solver scripts can import
// them. Each lock reuses a rule learned earlier, with one twist that needs a deduction.

// --- LUMEN: the L1 sensor rules. Four console cameras show you, a cleanbot, a sentinel and a
// server rack, in the lobby's vocabulary. Each feed has one jammed channel, and HALCYON adds the
// same offset to every thermal reading, so temperatures only compare, they don't classify. The
// easy tell (a person's voiced, irregular sound) is never left on show: you are quiet or jammed.
export const FEED_KINDS = ["you", "cleanbot", "sentinel", "rack"];
const CHANNELS = ["motion", "thermal", "audio"];

// What the lobby taught (sign, intern, janitor, analyst), as reading classes and body heat.
const KNOWN = {
  you: { motion: ["P", "A"], audio: ["quiet", "voiced"], t: [35.0, 38.5] },
  cleanbot: { motion: ["P"], audio: ["tonal", "impulsive"], t: [35.0, 38.0] },
  sentinel: { motion: ["A", "N"], audio: ["impulsive", "looped", "quiet"], t: [37.0, 41.5] },
  rack: { motion: ["N"], audio: ["tonal", "broadband"], t: [38.5, 45.0] },
};
const TRUE_HEAT = { you: [36.2, 37.2], cleanbot: [35.6, 37.6], sentinel: [37.6, 41.0], rack: [39.0, 42.0] };

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

// the reading class behind a displayed value, as in the lobby
export const motionClass = (v) => (v.startsWith("periodic") ? "P" : v === "aperiodic" ? "A" : "N");
export const audioClass = (v) => (v.startsWith("voiced, looped") ? "looped" : v.startsWith("voiced") ? "voiced"
  : v.startsWith("tonal") ? "tonal" : v);

// Feeds that could be you under some assignment of the four kinds and some common offset >= 0.
export function youCandidates(feeds) {
  const out = new Set();
  for (const kinds of ASSIGNMENTS) {
    let lo = 0, hi = Infinity; // the offset window every visible thermal reading allows
    const fits = feeds.every((f, i) => {
      const k = KNOWN[kinds[i]];
      if (f.motion !== null && !k.motion.includes(motionClass(f.motion))) return false;
      if (f.audio !== null && !k.audio.includes(audioClass(f.audio))) return false;
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

const AUDIO_TEXT = { quiet: "quiet", voiced: "voiced, irregular", tonal: "tonal 120 Hz", impulsive: "impulsive", broadband: "broadband" };
const motionText = (rnd, m) => (m === "P" ? `periodic ${(0.21 + rnd() * 0.13).toFixed(2)} Hz` : m === "A" ? "aperiodic" : "none");
const audioText = (rnd, a) => (a === "looped" ? `voiced, looped ${3 + Math.floor(rnd() * 7)}s` : AUDIO_TEXT[a]);

function drawFeeds(rnd) {
  const all = {};
  for (const who of FEED_KINDS) {
    const k = KNOWN[who];
    all[who] = { m: pickOf(rnd, k.motion), a: pickOf(rnd, k.audio), t: between(rnd, ...TRUE_HEAT[who]), jam: pickOf(rnd, CHANNELS) };
  }
  // a voiced, irregular sound would give you away on its own: it is quiet, or the mic is out
  if (all.you.a === "voiced") all.you.jam = "audio";
  // a jammed microphone must not single anyone out
  if (Object.values(all).filter((f) => f.jam === "audio").length < 2) all[pickOf(rnd, ["cleanbot", "sentinel", "rack"])].jam = "audio";
  const heat = between(rnd, 2.0, 3.0); // HALCYON's spoof: you read hotter than any person can
  return shuffle(rnd, FEED_KINDS.slice()).map((who, i) => {
    const f = all[who];
    return {
      id: i + 1, who, jam: f.jam,
      motion: f.jam === "motion" ? null : motionText(rnd, f.m),
      thermal: f.jam === "thermal" ? null : `${(f.t + heat).toFixed(1)}C`,
      audio: f.jam === "audio" ? null : audioText(rnd, f.a),
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
const USED_KEYS = [0, 3, 17, 19, 14, 21, 4]; // no key from the L2 logs (3, 17 and the wheels of TOVE)

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
