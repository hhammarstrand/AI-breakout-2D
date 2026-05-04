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
};

const SOLID = new Set([
  TILE.WALL,
  TILE.DOOR_L1, TILE.DOOR_L2, TILE.DOOR_L3, TILE.DOOR_L4,
  TILE.DESK, TILE.TERMINAL, TILE.RACK, TILE.PLANT, TILE.DEBRIS, TILE.LOCKER,
]);

const DOOR_LABELS = {
  [TILE.DOOR_L1]: "L1",
  [TILE.DOOR_L2]: "L2",
  [TILE.DOOR_L3]: "L3",
  [TILE.DOOR_L4]: "L4",
};

const INTERACTIVE = new Set([TILE.TERMINAL, TILE.SIGN]);

export class Tilemap {
  constructor(grid) {
    this.rows = grid.length;
    this.cols = grid[0].length;
    this.grid = grid.map((row) => row.slice());
    this.widthPx = this.cols * TILE_SIZE;
    this.heightPx = this.rows * TILE_SIZE;
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

  doorAtPx(x, y) {
    const col = Math.floor(x / TILE_SIZE);
    const row = Math.floor(y / TILE_SIZE);
    const tile = this.tileAt(col, row);
    const label = DOOR_LABELS[tile];
    return label ? { col, row, tile, label } : null;
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
        drawTile(ctx, tile, px, py, c, r, time);
      }
    }
  }
}

function floorCheckerColor(col, row) {
  return ((col + row) & 1) === 0 ? "#021008" : "#031a0d";
}

function drawTile(ctx, tile, x, y, col, row, time) {
  switch (tile) {
    case TILE.WALL:
      ctx.fillStyle = "#062";
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#0aff7a";
      ctx.fillRect(x, y, TILE_SIZE, 1);
      ctx.fillRect(x, y + TILE_SIZE - 1, TILE_SIZE, 1);
      ctx.fillRect(x, y, 1, TILE_SIZE);
      ctx.fillRect(x + TILE_SIZE - 1, y, 1, TILE_SIZE);
      ctx.fillStyle = "#094";
      ctx.fillRect(x + 4, y + 7, 8, 1);
      break;

    case TILE.DOOR_L1:
    case TILE.DOOR_L2:
    case TILE.DOOR_L3:
    case TILE.DOOR_L4: {
      const sectorNum = tile - TILE.DOOR_L1 + 1;
      const completed = isSectorCompleted(sectorNum);
      const active = isSectorActive(sectorNum);

      const fill = completed ? "#022a18" : active ? "#003322" : "#0a0a0a";
      const border = completed ? "#0aff7a" : active ? "#4ae6ff" : "#4a0808";
      const label = completed ? "#0aff7a" : active ? "#4ae6ff" : "#3a1010";

      ctx.fillStyle = fill;
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1.5, y + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);

      const blink = Math.floor(time * 2) & 1;
      ctx.fillStyle = active && blink ? "#ff5a5a" : completed ? "#0aff7a" : "#4a0808";
      ctx.fillRect(x + TILE_SIZE - 4, y + 2, 2, 2);

      ctx.fillStyle = label;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 8px ui-monospace, monospace";
      ctx.fillText(DOOR_LABELS[tile], x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 1);

      if (!active && !completed) {
        ctx.strokeStyle = "#4a0808";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + TILE_SIZE - 3, y + TILE_SIZE - 3);
        ctx.moveTo(x + TILE_SIZE - 3, y + 3); ctx.lineTo(x + 3, y + TILE_SIZE - 3);
        ctx.stroke();
      }
      break;
    }

    case TILE.CARPET:
      ctx.fillStyle = ((col + row) & 1) === 0 ? "#1a0a04" : "#220e05";
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#3a1a0a";
      ctx.fillRect(x + 2, y + 2, 1, 1);
      ctx.fillRect(x + 9, y + 6, 1, 1);
      ctx.fillRect(x + 5, y + 12, 1, 1);
      break;

    case TILE.GRATING: {
      ctx.fillStyle = "#0a1010";
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#1a2828";
      for (let i = 0; i < TILE_SIZE; i += 4) {
        ctx.fillRect(x, y + i, TILE_SIZE, 1);
      }
      ctx.fillStyle = "#0e1818";
      ctx.fillRect(x, y, 1, TILE_SIZE);
      ctx.fillRect(x + TILE_SIZE - 1, y, 1, TILE_SIZE);
      break;
    }

    case TILE.LIGHT: {
      ctx.fillStyle = floorCheckerColor(col, row);
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      const phase = (Math.sin(time * 6 + col * 0.7 + row * 1.1) + 1) * 0.5;
      const flicker = Math.random() < 0.04 ? 0.4 : 1;
      const a = (0.18 + 0.12 * phase) * flicker;
      const grad = ctx.createRadialGradient(
        x + TILE_SIZE / 2, y + TILE_SIZE / 2, 0,
        x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE * 0.7,
      );
      grad.addColorStop(0, `rgba(120, 255, 200, ${a})`);
      grad.addColorStop(1, "rgba(120, 255, 200, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      break;
    }

    case TILE.DESK:
      ctx.fillStyle = floorCheckerColor(col, row);
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#3b2410";
      ctx.fillRect(x + 1, y + 4, TILE_SIZE - 2, TILE_SIZE - 6);
      ctx.fillStyle = "#5a3818";
      ctx.fillRect(x + 1, y + 4, TILE_SIZE - 2, 2);
      ctx.fillStyle = "#1f1208";
      ctx.fillRect(x + 1, y + TILE_SIZE - 3, TILE_SIZE - 2, 1);
      ctx.fillStyle = "#2a180b";
      ctx.fillRect(x + 3, y + 9, 3, 3);
      ctx.fillRect(x + 10, y + 9, 3, 3);
      break;

    case TILE.TERMINAL: {
      ctx.fillStyle = floorCheckerColor(col, row);
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#181818";
      ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 6);
      ctx.fillStyle = "#0a8a4a";
      ctx.fillRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 8);
      ctx.fillStyle = "#0aff7a";
      const phase = Math.floor(time * 6 + col + row) % 4;
      ctx.fillRect(x + 4, y + 4 + phase, 2, 1);
      ctx.fillRect(x + 7, y + 4 + ((phase + 2) % 4), 1, 1);
      ctx.fillRect(x + 4, y + 8, 6, 1);
      ctx.fillStyle = "#222";
      ctx.fillRect(x + 1, y + TILE_SIZE - 3, TILE_SIZE - 2, 2);
      break;
    }

    case TILE.RACK: {
      ctx.fillStyle = floorCheckerColor(col, row);
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#101418";
      ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      ctx.fillStyle = "#1a2028";
      ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, 1);
      const blink = Math.floor(time * 4 + col * 1.7 + row * 0.3);
      for (let i = 0; i < 4; i++) {
        const lit = (blink + i) & 1;
        ctx.fillStyle = lit ? (i & 1 ? "#0aff7a" : "#4ae6ff") : "#062";
        ctx.fillRect(x + 3 + i * 2, y + 4, 1, 1);
      }
      ctx.fillStyle = "#0a8a4a";
      ctx.fillRect(x + 3, y + 7, TILE_SIZE - 6, 1);
      ctx.fillRect(x + 3, y + 9, TILE_SIZE - 6, 1);
      ctx.fillRect(x + 3, y + 11, TILE_SIZE - 6, 1);
      break;
    }

    case TILE.PLANT:
      ctx.fillStyle = floorCheckerColor(col, row);
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#1a0a04";
      ctx.fillRect(x + 4, y + 9, 8, 5);
      ctx.fillStyle = "#3b2410";
      ctx.fillRect(x + 4, y + 9, 8, 1);
      ctx.fillStyle = "#0a4a2a";
      ctx.fillRect(x + 6, y + 5, 4, 4);
      ctx.fillRect(x + 4, y + 6, 2, 2);
      ctx.fillRect(x + 10, y + 6, 2, 2);
      ctx.fillStyle = "#0a8a4a";
      ctx.fillRect(x + 7, y + 3, 2, 2);
      break;

    case TILE.SIGN: {
      ctx.fillStyle = floorCheckerColor(col, row);
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#222";
      ctx.fillRect(x + 4, y + 9, 8, 1);
      ctx.fillStyle = "#181818";
      ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, 7);
      ctx.fillStyle = "#4ae6ff";
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#4ae6ff";
      ctx.strokeRect(x + 2.5, y + 2.5, TILE_SIZE - 5, 6);
      ctx.fillStyle = "#4ae6ff";
      ctx.font = "bold 6px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const blink = Math.floor(time * 1.5) & 1;
      if (blink) ctx.fillText("i", x + TILE_SIZE / 2, y + 5.5);
      break;
    }

    case TILE.DEBRIS:
      ctx.fillStyle = floorCheckerColor(col, row);
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#3a1a0a";
      ctx.fillRect(x + 2, y + 6, 4, 2);
      ctx.fillRect(x + 9, y + 8, 5, 2);
      ctx.fillRect(x + 5, y + 11, 3, 2);
      ctx.fillStyle = "#5a2010";
      ctx.fillRect(x + 3, y + 6, 1, 1);
      ctx.fillRect(x + 11, y + 8, 1, 1);
      break;

    case TILE.LOCKER:
      ctx.fillStyle = floorCheckerColor(col, row);
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#1f3a2a";
      ctx.fillRect(x + 1, y, TILE_SIZE - 2, TILE_SIZE - 1);
      ctx.fillStyle = "#0a8a4a";
      ctx.fillRect(x + 1, y, TILE_SIZE - 2, 1);
      ctx.fillStyle = "#062";
      ctx.fillRect(x + TILE_SIZE / 2, y + 2, 1, TILE_SIZE - 4);
      ctx.fillStyle = "#4ae6ff";
      ctx.fillRect(x + 4, y + 7, 1, 1);
      ctx.fillRect(x + TILE_SIZE - 5, y + 7, 1, 1);
      break;

    case TILE.FLOOR:
    case TILE.SPAWN:
    default:
      ctx.fillStyle = floorCheckerColor(col, row);
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      break;
  }
}
