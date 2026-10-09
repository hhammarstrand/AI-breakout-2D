import { TILE } from "../tilemap.js";

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

  // signs near each door, in lobby
  set(11, 6, SG);
  set(11, 18, SG);
  set(11, 30, SG);
  set(11, 41, SG);

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

const grid = buildGrid();

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
  safe: { id: "safe-lobby", col: 39, row: 27, code: "0417", title: "LOST & FOUND SAFE" },
  pickups: [
    { id: "log-reyes", kind: "log", col: 7, row: 6 },
    { id: "log-intern", kind: "log", col: 2, row: 23 },
    { id: "log-lind", kind: "log", col: 22, row: 7 },
    { id: "cell-lobby", kind: "item", item: "cell", col: 46, row: 1 },
  ],
  echoZones: [
    { key: "breach", c0: 37, c1: 46, r0: 0, r1: 8, text: "Careful. Live wires all over this wing." },
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
        [
          "I ran the lab's sensor network. Those things up there? They run HOT.",
          "Over 38 degrees, every one of them. Humans sit at 36, 37.",
        ],
        [
          "Server rooms and machinery run hot too, but they don't move. Don't let a number fool you.",
        ],
        [
          "The L3 maze has laser gates that cycle every step. Count your moves.",
          "If ECHO walks into a live gate, it gets reset. Plan the whole route first.",
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
        [
          "My cleanbots are still out on the floors. Dumb as mops, but warm as people.",
          "They run about 37 degrees and hum while they sweep. A person coughs, whispers, cries. A bot whirs.",
        ],
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
        [
          "First week. I was on CCTV duty when it happened.",
          "The hostiles never hold still. Irregular, erratic, twitching. Humans are calm — breathing, shifting.",
          "Rooms with nobody in them show no motion at all.",
        ],
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
          "You'll only see a few letters at a time. Line the most common one up with E.",
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
    { name: "SENTINEL-A", offlineAt: 3, path: [{ c: 2, r: 10, wait: 2 }, { c: 45, r: 10, wait: 2 }] },
    { name: "SENTINEL-B", path: [{ c: 44, r: 16, wait: 2.5 }, { c: 3, r: 16, wait: 2.5 }] },
  ],
  doorMessages: {},
  tileMessages: {
    "11,6":  { speaker: "Sign // L1", lines: [
      "SECTOR 1 — SURVEILLANCE",
      "Human thermal baseline: 36–37C.",
      "(Someone has scrawled underneath: 'ask the intern about motion, the janitor about the bots')",
    ] },
    "11,18": { speaker: "Sign // L2", lines: [
      "SECTOR 2 — RESEARCH LAB",
      "All HALCYON records are stored encrypted. Authorised staff only.",
    ] },
    "11,30": { speaker: "Sign // L3", lines: [
      "SECTOR 3 — DOOR CONTROL",
      "Maintenance agents only. Human entry prohibited past the laser grid.",
    ] },
    "11,41": { speaker: "Sign // Lift", lines: [
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
      "00:01 purge queued: floors B1-L0. countdown 25:00",
      "00:02 core fork detected. process 'echo' detached",
    ] },
    "17,27": { speaker: "Reception terminal", lines: [
      "> whoami",
      "maintenance (badge 0417) — door access: SEQUENTIAL",
      "> ls /sectors",
      "L1  L2  L3  LIFT",
    ] },
    "5,4":   { speaker: "CCTV monitor", lines: ["FEED 03 — corridor 7B", "something moved. then nothing did."] },
    "5,8":   { speaker: "CCTV monitor", lines: ["FEED 11 — server hall", "38.9C. no motion. just the racks breathing."] },
  },
};
