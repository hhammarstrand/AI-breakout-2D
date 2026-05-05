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

export const smartBuildingMap = {
  id: "lobby",
  name: "Smart-Building // Lobby",
  grid,
  spawn: { col: 23, row: 24 },
  npcs: [
    {
      id: "operator",
      col: 27, row: 24,
      accent: "#4ae6ff", color: "#1a8acf", bodyDark: "#0a4a7a",
      name: "Operator",
      lines: [
        "We've got eyes on you, survivor. The building's gone dark.",
        "Four sectors. They must be cleared in order — L1 first, then L2, L3, L4.",
        "L1 is live: surveillance grid. Find the human, flag the hostiles.",
        "Read the L1 sign by the door for the sensor baselines.",
      ],
    },
    {
      id: "analyst",
      col: 14, row: 15,
      accent: "#cfcfcf", color: "#ff5a5a", bodyDark: "#8a2828",
      name: "Analyst",
      lines: [
        "...did you see what came out of the lab?",
        "I locked the racks before it spread. Don't open L2 alone.",
        "Tell the Operator I'm still breathing. Barely.",
      ],
    },
    {
      id: "janitor",
      col: 39, row: 23,
      accent: "#aa8a1a", color: "#6a4a1a", bodyDark: "#3a2810",
      name: "Janitor",
      lines: [
        "Half my mops are in L4. Don't ask why.",
        "If a door won't open, the building thinks you're not authorised.",
        "Check the signs near the doors. Sometimes they leak hints.",
      ],
    },
    {
      id: "intern",
      col: 8, row: 22,
      accent: "#fff15a", color: "#d8d8d8", bodyDark: "#6a6a3a",
      name: "Intern",
      lines: [
        "First day. They told me to monitor the CCTV in L1.",
        "Not really sure what 'baseline' means but the chart was bumpy.",
        "The Operator says you're the rescue. No pressure.",
      ],
    },
  ],
  doorMessages: {
    L1: "[L1] LOCATE THE SURVIVOR — sensors locked behind authentication. Coming soon.",
    L2: "[L2] DECRYPT THE LAB LOGS — three encrypted feeds. Coming soon.",
    L3: "[L3] BUILD THE DOOR AGENT — pathfinding agent required. Coming soon.",
    L4: "[L4] THE BREACH — final access. Auth code missing. Coming soon.",
  },
  tileMessages: {
    "11,6":  { speaker: "Sign // L1", lines: [
      "SECTOR 1 — SURVEILLANCE",
      "Sensor & CCTV station. Authenticated personnel only.",
      "Note: human baseline is ~36.5C with breathing motion.",
      "Hostiles run hot — over 38C, with irregular or erratic motion.",
    ] },
    "11,18": { speaker: "Sign // L2", lines: ["SECTOR 2 — RESEARCH LAB", "Bio-secure. Decrypt protocol required for access."] },
    "11,30": { speaker: "Sign // L3", lines: ["SECTOR 3 — DOOR CONTROL", "Pathfinding agent must be deployed before entry."] },
    "11,41": { speaker: "Sign // L4", lines: ["SECTOR 4 — UPLINK", "Final auth code required. Combine fragments from sectors 1–3."] },
    "18,23": { speaker: "Reception", lines: ["WELCOME TO BLACKOUT TOWER", "If you are reading this, you are the rescue.", "Press [E] near doors and people to interact."] },
    "18,24": { speaker: "Reception", lines: ["WELCOME TO BLACKOUT TOWER", "Sectors must be cleared in order: L1 → L2 → L3 → L4.", "Walk to a door and press [E]."] },
    "17,20": { speaker: "Reception terminal", lines: ["> tail -f /var/log/containment", "containment: 60:00 to lockout", "you have time. don't waste it."] },
    "17,27": { speaker: "Reception terminal", lines: ["> ls /sectors", "L1  L2  L3  L4", "> permissions: SEQUENTIAL"] },
    "5,4":   { speaker: "CCTV monitor", lines: ["FEED 03 — corridor 7B", "motion: irregular", "thermal: 38.2C anomaly"] },
    "5,8":   { speaker: "CCTV monitor", lines: ["FEED 11 — server hall", "motion: none", "thermal: nominal"] },
  },
};
