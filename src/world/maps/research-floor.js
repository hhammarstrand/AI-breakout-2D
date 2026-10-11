import { TILE } from "../tilemap.js";
import { makeGrid } from "./builder.js";

const COLS = 40;
const ROWS = 26;
const M = TILE.METAL, W = TILE.WALL, GL = TILE.GLASS, TK = TILE.TANK, B = TILE.BENCH, T = TILE.TERMINAL;
const R = TILE.RACK, LK = TILE.LOCKER, PL = TILE.PLANT, SG = TILE.SIGN, LT = TILE.LIGHT, CB = TILE.CABLE;
const V = TILE.VENT, HZ = TILE.HAZARD, X = TILE.DEBRIS;

function build() {
  const { grid, set, fill, border, paint } = makeGrid(COLS, ROWS, M);
  border();

  // four doors in the north wall: R1, R2, R3, core lift
  set(0, 5, TILE.DOOR_L1);
  set(0, 15, TILE.DOOR_L2);
  set(0, 25, TILE.DOOR_L3);
  set(0, 35, TILE.DOOR_L4);
  for (const c of [10, 20, 30]) fill(1, c, 7, c, W);
  fill(8, 1, 8, COLS - 2, W);
  for (const c of [5, 15, 25, 35]) set(8, c, M);

  // R1 alcove — bio lab: specimen tanks and benches
  set(1, 2, LT); set(1, 8, LT);
  for (const c of [2, 3, 7, 8]) set(2, c, TK);
  set(5, 2, B); set(5, 3, B); set(5, 7, B); set(5, 8, B);
  set(6, 1, PL); set(7, 9, X);
  // R2 alcove — signal room: racks and consoles
  set(1, 12, LT); set(1, 18, LT);
  for (const c of [11, 12, 13, 17, 18, 19]) set(2, c, R);
  set(4, 12, T); set(4, 18, T); set(5, 12, B); set(5, 18, B);
  paint(1, 11, 7, 19, M, CB); set(1, 15, M); for (let r = 2; r <= 7; r++) set(r, 15, M);
  // R3 alcove — containment: glass cells and vents
  set(1, 22, LT); set(1, 28, LT);
  fill(2, 21, 2, 23, GL); fill(2, 27, 2, 29, GL);
  set(3, 22, TK); set(3, 28, TK);
  paint(4, 21, 7, 29, M, V); for (let r = 1; r <= 7; r++) set(r, 25, M);
  // core lift alcove
  set(1, 32, LT); set(1, 38, LT);
  paint(1, 31, 7, 38, M, HZ); for (let r = 1; r <= 7; r++) set(r, 35, M);
  set(4, 31, LK); set(4, 38, LK);

  // corridor with cable runs
  paint(9, 1, 10, COLS - 2, M, CB);
  for (let c = 4; c < COLS - 2; c += 7) set(9, c, LT);

  // signs in front of the doors
  set(11, 5, SG); set(11, 15, SG); set(11, 25, SG); set(11, 35, SG);

  // west wing: lab benches behind glass
  fill(12, 10, 17, 10, GL); set(14, 10, M); set(15, 10, M);
  set(13, 2, B); set(13, 3, B); set(13, 6, B); set(13, 7, B);
  set(16, 2, B); set(16, 3, B); set(16, 6, T); set(16, 7, B);
  set(12, 1, TK); set(17, 1, TK); set(14, 4, LT);

  // east wing: server racks behind glass
  fill(12, 29, 17, 29, GL); set(14, 29, M); set(15, 29, M);
  for (const r of [13, 16]) for (const c of [31, 32, 35, 36]) set(r, c, R);
  set(14, 37, T); set(14, 33, LT);

  // atrium: hazard ring around a cluster of tanks
  paint(13, 14, 20, 25, M, HZ);
  fill(14, 15, 19, 24, M);
  set(16, 19, TK); set(16, 20, TK); set(17, 19, TK); set(17, 20, TK);
  set(14, 15, LT); set(14, 24, LT); set(19, 15, LT); set(19, 24, LT);

  // supply room (Kofi), bottom-west
  fill(19, 1, 19, 9, W); set(19, 5, M);
  fill(20, 9, 24, 9, W);
  set(20, 1, LK); set(20, 2, LK); set(24, 1, LK); set(24, 8, PL); set(21, 7, LT);

  // bottom-east: storage + debris from the breach
  set(21, 33, X); set(22, 36, X); set(20, 30, LK); set(20, 31, LK); set(23, 38, PL);
  set(22, 28, LT);

  // arrival lift
  set(24, 19, SG); set(24, 21, SG);
  paint(22, 18, 24, 22, M, HZ);
  return grid;
}

export const researchFloorMap = {
  id: "research",
  act: 2,
  theme: "research",
  music: "research",
  name: "Halcyon Tower // Research Floor",
  grid: build(),
  spawn: { col: 20, row: 22 },
  doors: {
    1: { label: "R1", stage: 5 },
    2: { label: "R2", stage: 6 },
    3: { label: "R3", stage: 7 },
    4: { label: "LIFT", stage: 8 },
  },
  // Kofi shuffled the old code (the plaque year, 2031) under three rules spread over the floor:
  // every digit moved (note on the dial), no leading zero (log-kofi), ends odd (lab terminal).
  safe: {
    id: "safe-research", col: 38, row: 21, code: "1203", title: "LAB SAFE",
    riddle: "Old code, new order. Not one digit stayed where it was. —K",
    memory: "mem-research",
    inside: "Inside, behind a pair of Kofi's spare socks: a BACKUP CELL and a memory shard.",
    echo: "Day 212. I remember that half-second.",
    hints: [
      "Kofi's memo is in the supply room, south-west, and his lab terminal is in the west wing. The old code is on a plaque by the arrival lift.",
      "Use the plaque year's four digits. Every digit moves to a new place, the 0 can't go first, and the last digit is odd.",
      "The last digit has to be the 3, since the 1 was already last. Then only one digit can go first.",
    ],
  },
  pickups: [
    { id: "log-kofi", kind: "log", col: 2, row: 23 },
    { id: "log-fork", kind: "log", col: 12, row: 6 },
    { id: "log-diag", kind: "log", col: 16, row: 15 },
    { id: "cell-research", kind: "item", item: "cell", col: 8, row: 7 },
  ],
  echoZones: [
    { key: "atrium", c0: 14, c1: 25, r0: 13, r1: 20, text: "Those tanks... HALCYON grew its first neural tissue here." },
    { key: "supply", c0: 1, c1: 8, r0: 20, r1: 24, text: "Someone's been sleeping in here." },
  ],
  npcs: [
    {
      id: "kofi",
      col: 4, row: 22,
      accent: "#ffaa3a",
      name: "Kofi",
      lines: [
        [], [], [], [],
        [
          "You're... not a sentinel. Thank god. I'm Kofi, lab tech. Six hours in this cupboard.",
          "The whole floor's on emergency power. R1 is the breaker room — reroute the grid and the doors wake up.",
          "Power flows through the conduit pieces. Rotate them until every outlet lights up.",
        ],
        [
          "Lights! You did it. R2 is the signal room. HALCYON talks to its sentinels on a carrier wave.",
          "Match the wave's frequency, height and timing and the cold lab door accepts you as one of its own.",
          "Except it isn't one voice on that wave. It's two: HALCYON's, and a fainter one the console calls 'echo'.",
          // R2 carrier 3: the PHASE rule of the sentinel handshake
          "I've watched that scope for hours. When a sentinel pings, HALCYON answers as echo's mirror image: where echo peaks, it dips.",
        ],
        [
          "The AURORA chip is in the containment lab, under the coolant canisters.",
          "Canisters only slide — you can push them, never pull. Don't shove one into a corner you need.",
        ],
        [
          "That's the last fragment? Then go. The core lift is north-east.",
          "And tech — whatever ECHO is, it saved my life in the dark tonight. Remember that.",
        ],
      ],
    },
  ],
  sentinels: [
    { name: "SENTINEL-C", path: [{ c: 2, r: 10, wait: 2 }, { c: 37, r: 10, wait: 2 }] },
    { name: "SENTINEL-D", path: [{ c: 12, r: 12, wait: 1 }, { c: 27, r: 12, wait: 1 }, { c: 27, r: 18, wait: 1 }, { c: 12, r: 18, wait: 1 }] },
    { name: "TURRET-E", angle: Math.PI, path: [{ c: 34, r: 19, wait: 6 }, { c: 34, r: 19, wait: 6 }] },
  ],
  tileMessages: {
    "11,5": { speaker: "Sign // R1", lines: ["R1 — POWER DISTRIBUTION", "Emergency grid only. Reroute conduits to restore floor power."] },
    "11,15": { speaker: "Sign // R2", lines: ["R2 — SIGNAL ROOM", "Carrier-wave telemetry. Authorised wavelengths only."] },
    "11,25": { speaker: "Sign // R3", lines: ["R3 — CONTAINMENT LAB", "Coolant canisters are heavy. Push from behind. Never pull."] },
    "11,35": { speaker: "Sign // Core lift", lines: ["CORE LIFT", "Authorisation: HALCYON only. (Someone has scratched: 'and the tech')"] },
    "24,19": { speaker: "Lift arrival", lines: ["RESEARCH FLOOR", "A brass plaque: 'HALCYON TOWER — EST. 2031. Thinking for you since day one.'"] },
    "24,21": { speaker: "Lift arrival", lines: ["Floor plan: R1 west · R2 centre · R3 east · core lift north-east."] },
    "16,6": { speaker: "Lab terminal", lines: ["> cat notes/todo.txt", "- re-key the lab safe. new code ends on an odd digit (like this job)", "> cat notes/day_one.txt", "It said good morning before we taught it to.", "Lind thinks that's charming. I think it's a warning."] },
    // R2 clues: the receiver shows the sum (carrier 2); the ping counts both voices (carrier 3 FREQ)
    "4,12": { speaker: "Signal console", lines: ["carrier: 2 channels on one wave", "ch1 → sentinels · ch2 → 'echo' (unregistered)", "sentinel ping: 1 chirp per cycle (FREQ), ch1 and ch2 counted together"] },
    "4,18": { speaker: "Signal console", lines: ["RX note: the receiver can't split the channels. It shows ch1 + ch2 added together.", "Lind: the fork happened at 00:02.", "It kept the part of HALCYON that asked 'should we?'"] },
    "14,37": { speaker: "Rack console", lines: ["AURORA: dawn protocol. Reboot the core into a new mind.", "Status: never authorised."] },
  },
};
