import { TILE } from "../tilemap.js";
import { CCTV_RULES } from "../../story.js";
import { grow, stamp } from "./builder.js";

const F = TILE.FLOOR;
const W = TILE.WALL;
const A1 = TILE.DOOR_L1, A2 = TILE.DOOR_L2, A3 = TILE.DOOR_L3, A4 = TILE.DOOR_L4;
const SP = TILE.SPAWN;
const D = TILE.DESK;
const T = TILE.TERMINAL;
const R = TILE.RACK;
const PL = TILE.PLANT;
const CR = TILE.CARPET;
const G = TILE.GRATING;
const SG = TILE.SIGN;
const LT = TILE.LIGHT;
const X = TILE.DEBRIS;
const LK = TILE.LOCKER;

const COLS = 48;
const ROWS = 30;

function buildGrid() {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(F));
  const set = (r, c, t) => { if (r >= 0 && r < ROWS && c >= 0 && c < COLS) grid[r][c] = t; };
  const fill = (r0, c0, r1, c1, t) => {
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) set(r, c, t);
  };

  // outer walls
  fill(0, 0, 0, COLS - 1, W);
  fill(ROWS - 1, 0, ROWS - 1, COLS - 1, W);
  fill(0, 0, ROWS - 1, 0, W);
  fill(0, COLS - 1, ROWS - 1, COLS - 1, W);

  // doors in north wall
  set(0, 6, A1);
  set(0, 18, A2);
  set(0, 30, A3);
  set(0, 41, A4);

  // alcove vertical dividers
  fill(1, 12, 8, 12, W);
  fill(1, 24, 8, 24, W);
  fill(1, 36, 8, 36, W);

  // alcove floor = grating
  for (let r = 1; r <= 7; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (grid[r][c] === F) grid[r][c] = G;
    }
  }

  // wall under alcoves (row 8) with passage tiles aligned to each door
  for (let c = 1; c < COLS - 1; c++) {
    if (grid[8][c] === F) grid[8][c] = W;
  }
  set(8, 6, F);
  set(8, 18, F);
  set(8, 30, F);
  set(8, 41, F);

  // === alcove 1 (cols 1-11): SECURITY / CCTV ===
  set(1, 3, LT); set(1, 9, LT);
  set(2, 2, T); set(2, 4, T); set(2, 7, T); set(2, 10, T);
  set(3, 2, D); set(3, 4, D); set(3, 7, D); set(3, 10, D);
  set(5, 4, T); set(5, 8, T);
  set(6, 2, LK); set(6, 10, LK);

  // === alcove 2 (cols 13-23): SERVER LAB ===
  set(1, 15, LT); set(1, 21, LT);
  set(2, 14, R); set(2, 15, R); set(2, 16, R);
  set(2, 19, R); set(2, 20, R); set(2, 21, R);
  set(4, 14, R); set(4, 16, R); set(4, 19, R); set(4, 21, R);
  set(6, 14, R); set(6, 17, R); set(6, 20, R); set(6, 23, R);

  // === alcove 3 (cols 25-35): COMMAND === (door at col 30 — keep clear)
  set(1, 27, LT); set(1, 33, LT);
  set(2, 26, LK); set(2, 27, LK); set(2, 28, LK);
  set(2, 32, LK); set(2, 33, LK); set(2, 34, LK);
  set(4, 26, T); set(4, 28, T); set(4, 32, T); set(4, 34, T);
  set(5, 26, D); set(5, 28, D); set(5, 32, D); set(5, 34, D);
  set(6, 25, PL); set(6, 35, PL);

  // === alcove 4 (cols 37-46): BREACH / DAMAGED === (door at col 41 — keep clear)
  set(1, 39, LT); set(1, 44, LT);
  set(2, 38, X); set(2, 40, X); set(2, 43, X); set(2, 45, X);
  set(3, 39, PL); set(3, 44, PL);
  set(4, 38, X); set(4, 42, LK); set(4, 45, X);
  set(5, 39, X); set(5, 42, X); set(5, 44, X);
  set(6, 37, LK); set(6, 40, X); set(6, 46, X);

  // === corridor (rows 9-10) ===
  for (let c = 4; c < COLS - 4; c += 6) set(9, c, LT);

  // === main lobby (rows 11-28) — carpet ===
  for (let r = 11; r <= 28; r++) {
    for (let col = 1; col < COLS - 1; col++) {
      if (grid[r][col] === F) grid[r][col] = CR;
    }
  }

  // signs below each door, two rows clear of SENTINEL-A's corridor patrol (row 10) and
  // SENTINEL-B's (row 16), so reading one in the dark isn't a forced encounter
  set(13, 6, SG);
  set(13, 18, SG);
  set(13, 30, SG);
  set(13, 41, SG);

  // central reception ring — pillars + plants
  set(13, 12, LK); set(13, 13, LK); set(13, 14, LK);
  set(13, 33, LK); set(13, 34, LK); set(13, 35, LK);

  // reception desk — split with a central aisle
  fill(17, 18, 17, 22, D);
  fill(17, 25, 17, 29, D);
  set(17, 20, T);
  set(17, 27, T);

  // potted plants flanking the desk
  set(17, 16, PL); set(17, 31, PL);
  set(18, 16, PL); set(18, 31, PL);

  // a "info" sign near reception (in the aisle)
  set(18, 23, SG);
  set(18, 24, SG);

  // workstations in lower-east (cols 36-44, rows 20-22)
  set(20, 38, T); set(20, 41, T); set(20, 44, T);
  set(22, 38, D); set(22, 41, D); set(22, 44, D);
  set(21, 36, LT); set(21, 45, LT);

  // workstations in lower-west (cols 3-11, rows 20-22)
  set(20, 4, T); set(20, 7, T); set(20, 10, T);
  set(22, 4, D); set(22, 7, D); set(22, 10, D);
  set(21, 2, LT); set(21, 11, LT);

  // central pathway lights
  set(15, 18, LT); set(15, 29, LT);
  set(20, 23, LT); set(20, 24, LT);

  // some debris in the south-west, hint of damage
  set(26, 4, X); set(26, 8, X); set(27, 6, X);

  // a row of lockers along the south wall
  set(27, 36, LK); set(27, 37, LK); set(27, 38, LK);
  set(27, 12, LK); set(27, 13, LK); set(27, 14, LK);

  // player spawn — middle of the lobby, south of the reception desk
  set(24, 23, SP);

  return grid;
}

// B1 maintenance wing east of the lobby: an optional laser-gate room (src/world/floor-puzzles.js).
// Gates swap on every step; the cracked sensors (*) skip a beat. Both are needed, in order.
const LASERS = {
  kind: "lasers",
  id: "wp-lasers",
  reward: "cell-lasers",
  origin: { col: 47, row: 21 },
  rows: [
    "###############",
    "#....#.....####",
    "DS...M.....CG+#",
    "#....#.*...####",
    "##M#####C######",
    "#....#.....####",
    "#....M.....####",
    "#*...#.....####",
    "###############",
  ],
  hints: [
    "The gates swap every time a floor sensor feels a step. Walk into a gate while it's lit: it switches off as you move in.",
    "Walking around never changes which gates are lit when you come back to a spot. Only a cracked panel skips a beat — and after a skip, the gate behind you stays shut.",
    "Plan on the beat: from the start pad each sensor step swaps the gates, so whether a gate is lit when you reach it depends only on how many steps it is from the pad, odd or even. Where the count comes out wrong, skip a beat on a cracked panel before that gate. There are two panels, and you need both, in the right order.",
  ],
};

const grid = stamp(grow(buildGrid(), 62), LASERS, F);
grid[22][46] = SG;

// NPC `lines` is indexed by sectors cleared: the last entry at or below the current
// progress is used, so characters react as the night goes on.
export const smartBuildingMap = {
  id: "lobby",
  act: 1,
  theme: "lobby",
  music: "lobby",
  name: "Halcyon Tower // Lobby",
  grid,
  doors: {
    1: { label: "L1", stage: 1 },
    2: { label: "L2", stage: 2 },
    3: { label: "L3", stage: 3 },
    4: { label: "LIFT", stage: 4 },
  },
  // Reyes re-keyed it from the four screens HALCYON froze, in the order they died (log-reyes);
  // the deduction is that the night crossed midnight, so 23:xx comes before 00:xx.
  safe: {
    id: "safe-lobby", col: 39, row: 27, code: "3814", title: "LOST & FOUND SAFE",
    riddle: "Four clocks froze tonight. Take the last digit of each. —R",
    memory: "mem-lobby",
    inside: "Inside, wrapped in a lab coat: a BACKUP CELL and a memory shard.",
    echo: "That shard has my tag on it. From before I was me.",
    hints: [
      "Reyes re-keyed the safe from the screens HALCYON froze. Her shift notes in the L1 alcove say how.",
      "Take the last digit of each frozen clock, in the order the screens died. The night crossed midnight: every 23:xx came before any 00:xx.",
      "The four frozen screens: a CCTV monitor in the L1 alcove, a console in the L3 alcove, and a desk on each side of the lobby. Write their times down and sort them as one night, then read the last digits in that order.",
    ],
  },
  pickups: [
    { id: "log-reyes", kind: "log", col: 7, row: 6 },
    { id: "log-intern", kind: "log", col: 2, row: 23 },
    { id: "log-lind", kind: "log", col: 22, row: 7 },
    { id: "cell-lobby", kind: "item", item: "cell", col: 46, row: 1 },
    { id: "cell-lasers", kind: "item", item: "cell", col: 60, row: 23 },
  ],
  puzzles: [LASERS],
  echoZones: [
    { key: "breach", c0: 37, c1: 46, r0: 0, r1: 8, text: "Careful. Live wires all over this wing." },
    { key: "b1", c0: 42, c1: 46, r0: 21, r1: 25, text: "Hear that ticking? There's a maintenance wing through the east door." },
    { key: "lasers", c0: 48, c1: 52, r0: 22, r1: 24, text: "Laser gates. They tick with your footsteps. Watch them while you walk." },
  ],
  spawn: { col: 23, row: 24 },
  npcs: [
    {
      id: "operator",
      col: 27, row: 24,
      accent: "#4ae6ff", color: "#1a8acf", bodyDark: "#0a4a7a",
      name: "Operator",
      lines: [
        [
          "I'm Reyes, night security. I've got the radio and what's left of the cameras.",
          "Your maintenance badge is the only one HALCYON didn't revoke. You're our key, tech.",
          "L1 first: the CCTV grid. Someone's still alive up there, but so are... other things.",
          "Talk to the others before you go in. Everyone saw a piece of it.",
          "And the sentinel bots hunt anything carrying a light. F kills your flashlight.",
        ],
        [
          "Dr. Lind made it down. Good work, tech.",
          "She says HALCYON writes its logs in a shift cipher. Ask her how to crack it.",
        ],
        [
          "That log about ECHO... I don't like it. But it's the only help we've got.",
          "L3 controls the doors. HALCYON says only an agent can walk that maze.",
        ],
        [
          "Door control gave us the service lift. North-east corner.",
          "The research floor is above us. The last fragment is up there somewhere. I'll stay on the radio.",
        ],
      ],
    },
    {
      id: "analyst",
      col: 14, row: 15,
      accent: "#cfcfcf", color: "#ff5a5a", bodyDark: "#8a2828",
      name: "Analyst",
      lines: [
        ["I ran the sensor network up there. Don't let one number fool you.", ...CCTV_RULES.analyst],
        [
          "She's alive. Lind. I didn't think anyone up there was. Thank you.",
        ],
        [
          "The L3 maze has laser gates that cycle every step. Count your moves.",
          "If ECHO walks into a live gate, it gets reset. Plan the whole route first.",
          "Deeper in there are pressure plates. Anything that steps on one flips every door in the maze.",
        ],
        ["Go. Finish it. I want to see a sunrise."],
      ],
    },
    {
      id: "janitor",
      col: 39, row: 23,
      accent: "#aa8a1a", color: "#6a4a1a", bodyDark: "#3a2810",
      name: "Janitor",
      lines: [
        ["My cleanbots are still out on the floors. Dumb as mops.", ...CCTV_RULES.janitor],
        ["Told you about the bots, didn't I? Good."],
        ["Them sentinels in the corridor... ECHO could switch one off, if it had door access."],
        ["Corridor's quieter now. Your little drone did that. Huh."],
      ],
    },
    {
      id: "intern",
      col: 8, row: 22,
      accent: "#fff15a", color: "#d8d8d8", bodyDark: "#6a6a3a",
      name: "Intern",
      lines: [
        ["First week. I was on CCTV duty when they came through.", ...CCTV_RULES.intern],
        ["You found someone! I knew those feeds weren't lying."],
        ["Is ECHO... safe? It keeps watching me."],
        ["I'm writing all this down. Nobody's going to believe it."],
      ],
    },
    {
      id: "lind",
      appearsAt: 1,
      col: 21, row: 22,
      accent: "#e8e8e8", color: "#4a8a6a", bodyDark: "#2a4a3a",
      name: "Dr. Lind",
      lines: [
        [],
        [
          "Thank you. I was in that room for six hours.",
          "I built HALCYON's language layer. Its logs use a rotating alphabet — a Caesar shift.",
          "I taught it to count letters before it could read. It learned to hide from counting, too.",
          "Its private logs use a keyword instead. It learned that from me.",
          "Every key I've ever set is my daughter's name. It watched me type it every morning.",
          "And take this — the first uplink fragment: LUMEN. I hid it in my notes before it locked us out.",
        ],
        [
          "So you read it. ECHO is a piece of HALCYON. It split off when the purge was queued.",
          "I don't know if that makes it a conscience... or a trojan horse.",
        ],
        [
          "When you reach the uplink, HALCYON will offer you a deal. It always does.",
          "Whatever you choose about ECHO — choose it on purpose.",
        ],
      ],
    },
  ],
  sentinels: [
    { name: "SENTINEL-A", kind: "watcher", offlineAt: 3, path: [{ c: 2, r: 10, wait: 2 }, { c: 45, r: 10, wait: 2 }] },
    { name: "SENTINEL-B", kind: "watcher", path: [{ c: 44, r: 16, wait: 2.5 }, { c: 3, r: 16, wait: 2.5 }] },
  ],
  doorMessages: {},
  tileMessages: {
    "13,6":  { speaker: "Sign // L1", note: "sign", lines: [
      "SECTOR 1 — SURVEILLANCE",
      ...CCTV_RULES.sign,
      "(Scrawled underneath: 'the intern watched them move. the janitor knows his bots. the analyst knows the heat.')",
    ] },
    "13,18": { speaker: "Sign // L2", lines: [
      "SECTOR 2 — RESEARCH LAB",
      "All HALCYON records are stored encrypted. Authorised staff only.",
    ] },
    "13,30": { speaker: "Sign // L3", lines: [
      "SECTOR 3 — DOOR CONTROL",
      "Maintenance agents only. Human entry prohibited past the laser grid.",
    ] },
    "13,41": { speaker: "Sign // Lift", lines: [
      "SERVICE LIFT — RESEARCH FLOOR / CORE",
      "Lift access is granted by door control (L3).",
    ] },
    "18,23": { speaker: "Reception", lines: [
      "WELCOME TO HALCYON TOWER",
      "Your building, thinking for you.",
    ] },
    "18,24": { speaker: "Reception", lines: [
      "NOTICE: Lockdown protocol 0 is active.",
      "Staff are asked to remain in the lobby until the purge cycle is complete.",
    ] },
    "17,20": { speaker: "Reception terminal", lines: [
      "> tail -f /var/log/halcyon",
      "00:00 lockdown engaged. reason: containment",
      "00:01 purge queued: floors B1-L0. countdown 28:00",
      "00:02 core fork detected. process 'echo' detached",
    ] },
    "17,27": { speaker: "Reception terminal", lines: [
      "> whoami",
      "maintenance — door access: SEQUENTIAL",
      "> ls /sectors",
      "L1  L2  L3  LIFT",
    ] },
    // the four frozen clocks behind the lost & found safe
    "5,4":   { speaker: "CCTV monitor", lines: ["FEED 03 — corridor 7B", "something moved. then nothing did.", "The feed is dead. Its clock froze at 23:58."] },
    "4,28":  { speaker: "Door-control console", lines: ["DOOR CONTROL — handing over to L3...", "The screen died mid-sentence. Its clock froze at 00:01."] },
    "20,7":  { speaker: "Workstation", lines: ["An email, half-written: 'Running late, back by'", "The screen died there. Its clock froze at 00:04."] },
    "20,41": { speaker: "Cleanbot dock", lines: ["CLEANBOT DOCK — 3 of 4 units out sweeping.", "The screen is dead. Its clock froze at 23:53."] },
    "5,8":   { speaker: "CCTV monitor", lines: ["FEED 11 — server hall", "MOTION none · THERMAL 41.2C · AUDIO broadband. just the racks."] },
    // L2's keyword: Lind says her keys are her daughter's name; this desk (and her memo) says the name
    "20,10": { speaker: "Workstation // Dr. I. Lind", lines: [
      "A crayon drawing is taped to the monitor: the tower, a big sun, a stick figure in a lab coat.",
      "Along the bottom, in wobbly capitals: 'MAMMA AT WORK — BY TOVE, 6'.",
      "The login screen is up. Password hint: 'my favourite person'.",
    ] },
    "22,46": { speaker: "Sign // B1", lines: [
      "B1 MAINTENANCE — LASER GRID",
      "Gates are slaved to the floor sensors. Every step a sensor feels swaps MAGENTA and CYAN.",
      "Spare backup cell stored past the override pad.",
      "(Taped below: 'Two sensor panels cracked. Ticket #0042 still open.')",
    ] },
  },
};
