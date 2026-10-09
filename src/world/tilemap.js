import { isSectorActive, isSectorCompleted } from "../state.js";

export const TILE_SIZE = 16;

export const TILE = {
  FLOOR: 0,
  WALL: 1,
  DOOR_L1: 2,
  DOOR_L2: 3,
  DOOR_L3: 4,
  DOOR_L4: 5,
  SPAWN: 9,
  DESK: 10,
  TERMINAL: 11,
  RACK: 12,
  PLANT: 13,
  CARPET: 14,
  GRATING: 15,
  SIGN: 16,
  LIGHT: 17,
  DEBRIS: 18,
  LOCKER: 19,
  GLASS: 20,
  TANK: 21,
  BENCH: 22,
  CORE: 23,
  METAL: 24,
  CABLE: 25,
  VENT: 26,
  HAZARD: 27,
};

const SOLID = new Set([
  TILE.WALL,
  TILE.DOOR_L1, TILE.DOOR_L2, TILE.DOOR_L3, TILE.DOOR_L4,
  TILE.DESK, TILE.TERMINAL, TILE.RACK, TILE.PLANT, TILE.DEBRIS, TILE.LOCKER,
  TILE.GLASS, TILE.TANK, TILE.BENCH, TILE.CORE,
]);

const INTERACTIVE = new Set([TILE.TERMINAL, TILE.SIGN]);

// Wall palettes per floor.
export const THEMES = {
  lobby: {
    fill: "#1d5a3c", fillDot: "#246a48", fillLine: "#16482f",
    top: "#2c8256", hi: "#58d68e", lip: "#1a5a3a", face: "#123f29", seam: "#0c2e1e", faceHi: "#1a5236", base: "#06170f",
    led: "#4ae6ff",
  },
  research: {
    fill: "#2a3e4c", fillDot: "#34505e", fillLine: "#22323e",
    top: "#4e7486", hi: "#a6dcef", lip: "#3a5868", face: "#1c2a36", seam: "#121c26", faceHi: "#2a3c4a", base: "#0a1218",
    led: "#ffd15a",
  },
  core: {
    fill: "#2a1016", fillDot: "#3a161e", fillLine: "#200c10",
    top: "#4a1a22", hi: "#ff5a6a", lip: "#34121a", face: "#1a080c", seam: "#0e0406", faceHi: "#2a0e14", base: "#060203",
    led: "#ff2a3a",
  },
};

const DOOR_TILES = [TILE.DOOR_L1, TILE.DOOR_L2, TILE.DOOR_L3, TILE.DOOR_L4];

export class Tilemap {
  // doors: { 1: { label, stage }, ... } keyed by door slot (DOOR_L1 = slot 1)
  constructor(grid, { doors = {}, theme = "lobby" } = {}) {
    this.rows = grid.length;
    this.cols = grid[0].length;
    this.grid = grid.map((row) => row.slice());
    this.widthPx = this.cols * TILE_SIZE;
    this.heightPx = this.rows * TILE_SIZE;
    this.doors = doors;
    this.theme = THEMES[theme] ?? THEMES.lobby;
    this.themeName = theme;
  }

  tileAt(col, row) {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return TILE.WALL;
    return this.grid[row][col];
  }

  isSolidAt(col, row) { return SOLID.has(this.tileAt(col, row)); }

  isSolidPx(x, y) {
    return this.isSolidAt(Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE));
  }

  rectCollides(x, y, w, h) {
    const x0 = Math.floor(x / TILE_SIZE);
    const y0 = Math.floor(y / TILE_SIZE);
    const x1 = Math.floor((x + w - 1) / TILE_SIZE);
    const y1 = Math.floor((y + h - 1) / TILE_SIZE);
    for (let r = y0; r <= y1; r++) {
      for (let c = x0; c <= x1; c++) {
        if (this.isSolidAt(c, r)) return true;
      }
    }
    return false;
  }

  doorSlot(tile) { return DOOR_TILES.indexOf(tile) + 1; }

  doorAtPx(x, y) {
    const col = Math.floor(x / TILE_SIZE);
    const row = Math.floor(y / TILE_SIZE);
    const tile = this.tileAt(col, row);
    const slot = this.doorSlot(tile);
    const cfg = slot ? this.doors[slot] : null;
    return cfg ? { col, row, tile, label: cfg.label, stage: cfg.stage } : null;
  }

  interactiveAtPx(x, y) {
    const col = Math.floor(x / TILE_SIZE);
    const row = Math.floor(y / TILE_SIZE);
    const tile = this.tileAt(col, row);
    if (!INTERACTIVE.has(tile)) return null;
    return { col, row, tile };
  }

  draw(renderer, camera, time = 0) {
    const ctx = renderer.ctx;
    const startCol = Math.max(0, Math.floor(camera.x / TILE_SIZE));
    const startRow = Math.max(0, Math.floor(camera.y / TILE_SIZE));
    const endCol = Math.min(this.cols - 1, Math.ceil((camera.x + camera.vw) / TILE_SIZE));
    const endRow = Math.min(this.rows - 1, Math.ceil((camera.y + camera.vh) / TILE_SIZE));

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const tile = this.grid[r][c];
        const px = (c * TILE_SIZE - camera.x) | 0;
        const py = (r * TILE_SIZE - camera.y) | 0;
        if (tile === TILE.WALL) {
          drawWall(ctx, this.theme, px, py, c, r, !isWallLike(this.tileAt(c, r + 1)), time);
        } else if (DOOR_TILES.includes(tile)) {
          drawDoor(ctx, this.theme, px, py, this.doors[this.doorSlot(tile)], time);
        } else {
          drawTile(ctx, tile, px, py, c, r, time, this.floorAt(c, r));
        }
      }
    }
  }

  // The floor shown under props: whichever floor kind its neighbours use.
  floorAt(c, r) {
    for (const [dc, dr] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) {
      const t = this.tileAt(c + dc, r + dr);
      if (FLOORS.has(t)) return t;
    }
    return TILE.FLOOR;
  }
}

const T = TILE_SIZE;
const INK = "#0a0812";
const FLOORS = new Set([TILE.FLOOR, TILE.CARPET, TILE.GRATING, TILE.METAL, TILE.CABLE, TILE.VENT, TILE.HAZARD, TILE.SPAWN, TILE.LIGHT]);

const isWallLike = (t) => t === TILE.WALL || DOOR_TILES.includes(t);

function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
function box(ctx, x, y, w, h, fill) { rect(ctx, x, y, w, h, INK); rect(ctx, x + 1, y + 1, w - 2, h - 2, fill); }

// Walls get a 3/4 look: a lit top cap, and a darker panelled front face wherever the
// tile below is open floor, so rooms read as having height.
function drawWall(ctx, th, x, y, col, row, face, time) {
  if (!face) {
    rect(ctx, x, y, T, T, th.fill);
    rect(ctx, x + ((col * 5 + row * 3) % 12), y + ((col * 7 + row) % 12), 2, 2, th.fillDot);
    rect(ctx, x, y + T - 1, T, 1, th.fillLine);
    return;
  }
  rect(ctx, x, y, T, 5, th.top);
  rect(ctx, x, y, T, 1, th.hi);
  rect(ctx, x, y + 4, T, 1, th.lip);
  rect(ctx, x, y + 5, T, T - 5, th.face);
  rect(ctx, x + (col & 1 ? 0 : 8), y + 5, 1, T - 6, th.seam);
  rect(ctx, x, y + 10, T, 1, th.seam);
  rect(ctx, x + 1, y + 6, T - 2, 1, th.faceHi);
  rect(ctx, x, y + T - 1, T, 1, th.base);
  if ((col * 13 + row * 7) % 9 === 0) {
    const on = Math.floor(time * 1.3 + col) % 3 !== 0;
    rect(ctx, x + 12, y + 7, 2, 1, on ? th.led : th.seam);
  }
}

function drawDoor(ctx, th, x, y, cfg, time) {
  const stage = cfg?.stage ?? 99;
  const done = isSectorCompleted(stage);
  const active = isSectorActive(stage);
  const edge = done ? "#0aff7a" : active ? "#4ae6ff" : "#ff3a3a";
  // frame + lintel
  rect(ctx, x, y, T, T, th.face);
  rect(ctx, x, y, T, 3, th.top);
  rect(ctx, x, y, T, 1, th.hi);
  if (done) {
    // slid open: dark interior with door edges tucked to the sides
    rect(ctx, x + 2, y + 3, 12, 13, "#020406");
    rect(ctx, x + 1, y + 3, 2, 13, "#3a4a54");
    rect(ctx, x + 13, y + 3, 2, 13, "#3a4a54");
    rect(ctx, x + 3, y + 14, 10, 2, "rgba(10,255,122,0.25)");
  } else {
    rect(ctx, x + 1, y + 3, 14, 13, "#2a343c");
    rect(ctx, x + 1, y + 3, 7, 13, "#34424c");
    rect(ctx, x + 8, y + 3, 1, 13, INK);
    rect(ctx, x + 2, y + 4, 5, 1, "#4a5a66");
    if (active) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 4);
      ctx.globalAlpha = 0.4 + 0.6 * pulse;
      rect(ctx, x + 1, y + 3, 1, 13, edge);
      rect(ctx, x + 14, y + 3, 1, 13, edge);
      ctx.globalAlpha = 1;
    } else {
      ctx.strokeStyle = "rgba(255,40,40,0.75)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 7); ctx.lineTo(x + 12, y + 14);
      ctx.moveTo(x + 12, y + 7); ctx.lineTo(x + 4, y + 14);
      ctx.stroke();
    }
  }
  // label plate
  rect(ctx, x + 2, y + 4, 12, 6, INK);
  ctx.fillStyle = edge;
  ctx.font = "bold 6px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(cfg?.label ?? "?", x + T / 2, y + 7.5);
  const blink = Math.floor(time * 2) & 1;
  rect(ctx, x + 13, y + 1, 2, 1, active && blink ? "#ff5a5a" : done ? "#0aff7a" : "#3a0808");
}

function drawFloorKind(ctx, kind, x, y, col, row) {
  switch (kind) {
    case TILE.CARPET: {
      rect(ctx, x, y, T, T, "#3a1810");
      ctx.fillStyle = "#4e2216";
      for (let i = 1; i < T; i += 4) {
        ctx.fillRect(x + i, y + ((row * 3 + i) % 4), 1, 1);
        ctx.fillRect(x + ((col * 3 + i) % T), y + i, 1, 1);
      }
      if ((col + row) % 4 === 0) rect(ctx, x + 6, y + 6, 4, 4, "#45200f");
      rect(ctx, x, y, T, 1, "#2a1008");
      return;
    }
    case TILE.GRATING: {
      rect(ctx, x, y, T, T, "#0e1820");
      ctx.fillStyle = "#22323e";
      for (let i = 1; i < T; i += 3) ctx.fillRect(x + 1, y + i, T - 2, 1);
      rect(ctx, x, y, 1, T, "#0a1218");
      rect(ctx, x + T - 1, y, 1, T, "#0a1218");
      return;
    }
    case TILE.METAL: {
      rect(ctx, x, y, T, T, (col + row) & 1 ? "#1c252c" : "#1f2a32");
      rect(ctx, x, y, T, 1, "#2c3a44");
      rect(ctx, x, y, 1, T, "#2c3a44");
      rect(ctx, x + T - 1, y, 1, T, "#11181e");
      rect(ctx, x + 2, y + 2, 1, 1, "#3a4a56");
      rect(ctx, x + T - 3, y + T - 3, 1, 1, "#3a4a56");
      return;
    }
    case TILE.CABLE: {
      drawFloorKind(ctx, TILE.METAL, x, y, col, row);
      rect(ctx, x, y + 5, T, 2, "#0a0a10");
      rect(ctx, x, y + 6, T, 1, (col & 1) ? "#ff8a1a" : "#c86a10");
      rect(ctx, x, y + 10, T, 2, "#0a0a10");
      rect(ctx, x, y + 11, T, 1, "#2a6aa8");
      return;
    }
    case TILE.VENT: {
      rect(ctx, x, y, T, T, "#1a2228");
      box(ctx, x + 1, y + 1, T - 2, T - 2, "#0c1014");
      ctx.fillStyle = "#2a3640";
      for (let i = 3; i < T - 2; i += 2) ctx.fillRect(x + 3, y + i, T - 6, 1);
      return;
    }
    case TILE.HAZARD: {
      drawFloorKind(ctx, TILE.METAL, x, y, col, row);
      ctx.fillStyle = "#c8a010";
      for (let i = -T; i < T; i += 6) {
        ctx.beginPath();
        ctx.moveTo(x + i, y + T); ctx.lineTo(x + i + 3, y + T); ctx.lineTo(x + i + T + 3, y); ctx.lineTo(x + i + T, y);
        ctx.fill();
      }
      return;
    }
    default: {
      const checker = ((col + row) & 1) === 0;
      rect(ctx, x, y, T, T, checker ? "#0a1410" : "#0e1814");
      rect(ctx, x + 1, y + 1, 1, 1, "#152018");
      rect(ctx, x + T - 2, y + T - 2, 1, 1, "#152018");
    }
  }
}

function propShadow(ctx, x, y) { rect(ctx, x + 2, y + T - 2, T - 3, 2, "rgba(0,0,0,0.4)"); }

function drawTile(ctx, tile, x, y, col, row, time, floor) {
  if (FLOORS.has(tile) && tile !== TILE.LIGHT && tile !== TILE.SPAWN) {
    drawFloorKind(ctx, tile, x, y, col, row);
    return;
  }
  drawFloorKind(ctx, floor, x, y, col, row);

  switch (tile) {
    case TILE.LIGHT: {
      const phase = (Math.sin(time * 5 + col * 0.7 + row * 1.1) + 1) * 0.5;
      const grad = ctx.createRadialGradient(x + T / 2, y + T / 2, 0, x + T / 2, y + T / 2, T * 0.85);
      grad.addColorStop(0, `rgba(180, 255, 220, ${0.2 + 0.18 * phase})`);
      grad.addColorStop(1, "rgba(180, 255, 220, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(x - 2, y - 2, T + 4, T + 4);
      rect(ctx, x + 5, y + 6, 6, 3, INK);
      rect(ctx, x + 6, y + 7, 4, 1, `rgba(230, 255, 245, ${0.6 + 0.3 * phase})`);
      return;
    }

    case TILE.DESK:
    case TILE.BENCH: {
      const lab = tile === TILE.BENCH;
      propShadow(ctx, x, y);
      box(ctx, x, y + 3, T, 10, lab ? "#c8d4d8" : "#7a4a24");
      rect(ctx, x + 1, y + 4, T - 2, 1, lab ? "#f0f8fa" : "#9a6434");
      rect(ctx, x + 1, y + 8, T - 2, 4, lab ? "#7a8a92" : "#4e2c14");
      rect(ctx, x + 6, y + 9, 4, 1, lab ? "#c8d4d8" : "#7a4a24");
      rect(ctx, x + 1, y + 13, 2, 2, INK);
      rect(ctx, x + T - 3, y + 13, 2, 2, INK);
      const v = (col * 7 + row * 3) % 4;
      if (lab) {
        // flask + rack of tubes
        rect(ctx, x + 3, y + 1, 3, 5, INK);
        rect(ctx, x + 4, y + 2, 1, 3, v & 1 ? "#4ae6ff" : "#0aff7a");
        rect(ctx, x + 9, y + 3, 5, 2, INK);
        rect(ctx, x + 10, y + 2, 1, 2, "#ff5aa0");
        rect(ctx, x + 12, y + 2, 1, 2, "#ffd15a");
      } else if (v === 0) {
        rect(ctx, x + 3, y + 4, 4, 3, "#e8e8e0"); rect(ctx, x + 4, y + 5, 2, 1, "#9a9a90");
      } else if (v === 1) {
        rect(ctx, x + 10, y + 3, 3, 3, INK); rect(ctx, x + 11, y + 4, 1, 1, "#e8e0d0");
      }
      return;
    }

    case TILE.TERMINAL: {
      propShadow(ctx, x, y);
      box(ctx, x, y + 7, T, 7, "#7a4a24");
      rect(ctx, x + 1, y + 8, T - 2, 1, "#9a6434");
      rect(ctx, x + 1, y + 11, T - 2, 2, "#4e2c14");
      box(ctx, x + 2, y, 12, 9, "#2a3038");
      rect(ctx, x + 3, y + 1, 10, 6, "#062a18");
      const phase = Math.floor(time * 6 + col + row) % 4;
      rect(ctx, x + 4, y + 2, 4, 1, "#1aff7a");
      rect(ctx, x + 4, y + 4, 6, 1, "#0ac85a");
      rect(ctx, x + 4, y + 6, 2 + phase, 1, "#1aff7a");
      rect(ctx, x + 4, y + 8, 8, 1, "#40464e");
      rect(ctx, x + 12, y + 7, 1, 1, "#4ae6ff");
      return;
    }

    case TILE.RACK: {
      propShadow(ctx, x, y);
      box(ctx, x + 1, y - 3, T - 2, T + 2, "#1e2328");
      rect(ctx, x + 2, y - 2, T - 4, 2, "#3a424a");
      const blink = Math.floor(time * 4 + col * 1.7 + row * 0.3);
      const leds = ["#0aff7a", "#4ae6ff", "#ffaa1a", "#ff5a5a"];
      for (let r = 0; r < 4; r++) {
        rect(ctx, x + 3, y + 1 + r * 3, 8, 2, "#0c1014");
        rect(ctx, x + 4, y + 1 + r * 3, 6, 1, "#262e36");
        rect(ctx, x + 12, y + 1 + r * 3, 1, 1, (blink + r) & 1 ? leds[r] : "#1a2228");
      }
      return;
    }

    case TILE.LOCKER: {
      propShadow(ctx, x, y);
      box(ctx, x + 1, y - 3, T - 2, T + 1, "#3a5a48");
      rect(ctx, x + 2, y - 2, T - 4, 2, "#5a8068");
      rect(ctx, x + 8, y, 1, T - 4, INK);
      for (const dx of [3, 10]) {
        rect(ctx, x + dx, y + 1, 3, 1, "#22382c");
        rect(ctx, x + dx, y + 3, 3, 1, "#22382c");
      }
      rect(ctx, x + 6, y + 6, 1, 2, "#d0d8d0");
      rect(ctx, x + 10, y + 6, 1, 2, "#d0d8d0");
      return;
    }

    case TILE.PLANT: {
      propShadow(ctx, x, y);
      box(ctx, x + 4, y + 9, 8, 6, "#8a4a26");
      rect(ctx, x + 5, y + 10, 6, 1, "#b06a3a");
      rect(ctx, x + 2, y, 12, 10, INK);
      rect(ctx, x + 3, y + 1, 10, 8, "#1a6a2a");
      rect(ctx, x + 4, y + 1, 4, 3, "#2a9a3e");
      rect(ctx, x + 8, y + 4, 4, 3, "#2a9a3e");
      rect(ctx, x + 5, y + 2, 1, 1, "#6ad87a");
      rect(ctx, x + 9, y + 5, 1, 1, "#6ad87a");
      rect(ctx, x + 3, y + 7, 3, 2, "#125020");
      return;
    }

    case TILE.SIGN: {
      rect(ctx, x + 7, y + 8, 2, 7, INK);
      rect(ctx, x + 7, y + 8, 1, 7, "#5a5a64");
      box(ctx, x + 1, y + 1, 14, 8, "#0a2a3a");
      rect(ctx, x + 2, y + 2, 12, 1, "#4ae6ff");
      const blink = Math.floor(time * 1.5) & 1;
      ctx.fillStyle = blink ? "#cffcff" : "#4ae6ff";
      ctx.font = "bold 6px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("i", x + T / 2, y + 5.5);
      return;
    }

    case TILE.DEBRIS: {
      box(ctx, x + 1, y + 6, 7, 6, "#5a3a26");
      rect(ctx, x + 2, y + 7, 5, 1, "#7a5236");
      box(ctx, x + 7, y + 8, 8, 6, "#4a4a52");
      rect(ctx, x + 8, y + 9, 6, 1, "#6a6a74");
      box(ctx, x + 4, y + 11, 5, 4, "#3a2a1e");
      rect(ctx, x + 12, y + 4, 1, 5, "#8a8a90");
      return;
    }

    case TILE.GLASS: {
      ctx.fillStyle = "rgba(120, 220, 255, 0.16)";
      ctx.fillRect(x, y, T, T);
      rect(ctx, x, y, T, 1, "#a6dcef");
      rect(ctx, x, y + T - 1, T, 1, "#4e7486");
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(x + 3 + (col % 3), y + 2, 1, 6);
      ctx.fillRect(x + 5 + (col % 3), y + 3, 1, 3);
      return;
    }

    case TILE.TANK: {
      propShadow(ctx, x, y);
      box(ctx, x + 1, y - 4, T - 2, T + 3, "#2a3a44");
      const g = (Math.sin(time * 2 + col) + 1) / 2;
      rect(ctx, x + 3, y - 2, T - 6, T - 2, `rgb(${20 + 20 * g}, ${120 + 60 * g}, ${90 + 30 * g})`);
      for (let i = 0; i < 3; i++) {
        const by = ((time * 12 + i * 5 + col * 3) % 12);
        rect(ctx, x + 5 + i * 2, y + 9 - by, 1, 1, "#cfffe8");
      }
      rect(ctx, x + 4, y - 1, 1, 10, "rgba(255,255,255,0.4)");
      rect(ctx, x + 1, y + T - 4, T - 2, 3, "#3a4a54");
      return;
    }

    case TILE.CORE: {
      box(ctx, x, y - 4, T, T + 4, "#1a0a0e");
      const p = (Math.sin(time * 3 + row) + 1) / 2;
      for (let i = 0; i < 4; i++) rect(ctx, x + 3 + i * 3, y - 2, 1, T, `rgba(255,${40 + 40 * p},${50 + 30 * p},${0.4 + 0.5 * p})`);
      rect(ctx, x + 1, y - 3, T - 2, 1, "#ff5a6a");
      return;
    }
  }
}
