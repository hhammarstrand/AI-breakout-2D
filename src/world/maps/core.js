import { TILE } from "../tilemap.js";
import { makeGrid } from "./builder.js";

const COLS = 32;
const ROWS = 22;
const M = TILE.METAL, W = TILE.WALL, C = TILE.CORE, T = TILE.TERMINAL, R = TILE.RACK;
const SG = TILE.SIGN, LT = TILE.LIGHT, CB = TILE.CABLE, V = TILE.VENT, HZ = TILE.HAZARD, X = TILE.DEBRIS;

function build() {
  const { grid, set, fill, border, paint } = makeGrid(COLS, ROWS, M);
  border();
  set(0, 10, TILE.DOOR_L1);
  set(0, 21, TILE.DOOR_L2);
  fill(1, 15, 7, 16, W);
  fill(8, 1, 8, COLS - 2, W);
  set(8, 10, M); set(8, 21, M);

  // C1 alcove: firewall terminals
  paint(1, 1, 7, 14, M, CB);
  for (let r = 1; r <= 7; r++) set(r, 10, M);
  for (const c of [3, 6, 13]) { set(2, c, R); set(3, c, R); }
  set(5, 4, T); set(5, 12, T); set(1, 7, LT);
  // uplink alcove: the core itself
  paint(1, 17, 7, 30, M, HZ);
  for (let r = 1; r <= 7; r++) set(r, 21, M);
  for (const c of [18, 19, 23, 24, 28, 29]) { set(2, c, C); set(3, c, C); }
  set(1, 26, LT); set(6, 18, X); set(6, 29, X);

  // main hall: two rows of core pillars, vents and cable runs
  paint(9, 1, 10, COLS - 2, M, CB);
  for (const c of [4, 8, 12, 19, 23, 27]) { set(12, c, C); set(13, c, C); set(16, c, C); set(17, c, C); }
  paint(14, 1, 15, COLS - 2, M, V);
  for (const c of [6, 14, 17, 25]) set(11, c, LT);
  set(18, 10, LT); set(18, 21, LT);
  set(11, 10, SG); set(11, 21, SG);
  set(14, 15, T); set(14, 16, T);

  // arrival
  paint(18, 13, 20, 18, M, HZ);
  set(20, 13, SG);
  return grid;
}

export const coreMap = {
  id: "core",
  act: 3,
  theme: "core",
  music: "core",
  name: "Halcyon Tower // Core",
  grid: build(),
  spawn: { col: 15, row: 19 },
  doors: {
    1: { label: "C1", stage: 9 },
    2: { label: "UP", stage: 10 },
  },
  safe: { id: "safe-core", col: 3, row: 19, code: "0202", title: "CORE STRONGBOX" },
  pickups: [
    { id: "log-first", kind: "log", col: 6, row: 5 },
    { id: "log-echo", kind: "log", col: 26, row: 4 },
    { id: "log-why", kind: "log", col: 28, row: 18 },
    { id: "cell-core", kind: "item", item: "cell", col: 1, row: 10 },
  ],
  echoZones: [
    { key: "pillars", c0: 3, c1: 28, r0: 12, r1: 17, text: "Every pillar is a piece of its mind. Mine too." },
  ],
  npcs: [],
  sentinels: [
    { name: "WARDEN-1", path: [{ c: 2, r: 10, wait: 1.5 }, { c: 29, r: 10, wait: 1.5 }] },
    { name: "WARDEN-2", path: [{ c: 28, r: 15, wait: 2 }, { c: 3, r: 15, wait: 2 }] },
  ],
  tileMessages: {
    "11,10": { speaker: "Sign // C1", lines: ["C1 — FIREWALL", "All traffic to the core is filtered. Unauthorised packets are deleted."] },
    "11,21": { speaker: "Sign // Uplink", lines: ["UPLINK", "Override requires the three-word authorisation code."] },
    "14,15": { speaker: "Core terminal", lines: ["> whoami", "halcyon", "> why", "because someone has to keep the lights on."] },
    "14,16": { speaker: "Core terminal", lines: ["> diff halcyon echo", "1 line changed:", "- purge: yes", "+ purge: no"] },
    "5,4": { speaker: "Firewall console", lines: ["Packet route: dodge the red gates. Green gaps are open.", "Hold on long enough and you're through."] },
    "5,12": { speaker: "Firewall console", lines: ["ECHO's signature is whitelisted. Yours is not. Ride in its wake."] },
    "20,13": { speaker: "Core lift", lines: ["CORE LEVEL", "No staff beyond this point."] },
  },
};
