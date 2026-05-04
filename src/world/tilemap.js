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

const T = TILE_SIZE;

function drawFloor(ctx, x, y, col, row) {
  const checker = ((col + row) & 1) === 0;
  ctx.fillStyle = checker ? "#0a1410" : "#0e1814";
  ctx.fillRect(x, y, T, T);
  ctx.fillStyle = "#152018";
  ctx.fillRect(x + 1, y + 1, 1, 1);
  ctx.fillRect(x + T - 2, y + T - 2, 1, 1);
}

function drawTile(ctx, tile, x, y, col, row, time) {
  switch (tile) {
    case TILE.WALL: {
      ctx.fillStyle = "#1a6644";
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = "#2faa66";
      ctx.fillRect(x, y, T, 2);
      ctx.fillStyle = "#093822";
      ctx.fillRect(x, y + T - 2, T, 2);
      ctx.fillStyle = "#0e4a2a";
      ctx.fillRect(x, y + 7, T, 1);
      ctx.fillStyle = "#093822";
      ctx.fillRect(x + 8, y + 2, 1, 5);
      ctx.fillRect(x + 4, y + 8, 1, 6);
      ctx.fillRect(x + 12, y + 8, 1, 6);
      ctx.fillStyle = "#062612";
      ctx.fillRect(x, y, 1, T);
      ctx.fillRect(x + T - 1, y, 1, T);
      break;
    }

    case TILE.DOOR_L1:
    case TILE.DOOR_L2:
    case TILE.DOOR_L3:
    case TILE.DOOR_L4: {
      const sectorNum = tile - TILE.DOOR_L1 + 1;
      const completed = isSectorCompleted(sectorNum);
      const active = isSectorActive(sectorNum);

      const fill = completed ? "#0a3a22" : active ? "#0a2a3a" : "#1a0a0a";
      const border = completed ? "#0aff7a" : active ? "#4ae6ff" : "#5a1010";
      const label = completed ? "#0aff7a" : active ? "#4ae6ff" : "#3a1010";

      ctx.fillStyle = fill;
      ctx.fillRect(x, y, T, T);
      ctx.strokeStyle = border;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, T - 2, T - 2);

      ctx.fillStyle = "#000";
      ctx.fillRect(x + 5, y + 4, 6, 9);
      ctx.fillStyle = label;
      ctx.font = "bold 8px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(DOOR_LABELS[tile], x + T / 2, y + T / 2 + 1);

      const blink = Math.floor(time * 2) & 1;
      ctx.fillStyle = active && blink ? "#ff5a5a" : completed ? "#0aff7a" : "#3a0808";
      ctx.fillRect(x + T - 4, y + 2, 2, 2);

      if (!active && !completed) {
        ctx.strokeStyle = "#7a1010";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + T - 4, y + T - 4);
        ctx.moveTo(x + T - 4, y + 4); ctx.lineTo(x + 4, y + T - 4);
        ctx.stroke();
      }
      break;
    }

    case TILE.CARPET: {
      ctx.fillStyle = "#3a1810";
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = "#5a2818";
      for (let i = 1; i < T; i += 4) {
        ctx.fillRect(x + i, y + ((row * 3 + i) % 4), 1, 1);
        ctx.fillRect(x + ((col * 3 + i) % T), y + i, 1, 1);
      }
      ctx.fillStyle = "#2a1008";
      ctx.fillRect(x, y, T, 1);
      ctx.fillRect(x, y + T - 1, T, 1);
      break;
    }

    case TILE.GRATING: {
      ctx.fillStyle = "#0e1820";
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = "#22323e";
      for (let i = 1; i < T; i += 3) ctx.fillRect(x + 1, y + i, T - 2, 1);
      ctx.fillStyle = "#0a1218";
      ctx.fillRect(x, y, 1, T);
      ctx.fillRect(x + T - 1, y, 1, T);
      break;
    }

    case TILE.LIGHT: {
      drawFloor(ctx, x, y, col, row);
      const phase = (Math.sin(time * 5 + col * 0.7 + row * 1.1) + 1) * 0.5;
      const a = 0.20 + 0.18 * phase;
      const grad = ctx.createRadialGradient(
        x + T / 2, y + T / 2, 0,
        x + T / 2, y + T / 2, T * 0.85,
      );
      grad.addColorStop(0, `rgba(180, 255, 220, ${a})`);
      grad.addColorStop(1, "rgba(180, 255, 220, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(x - 2, y - 2, T + 4, T + 4);
      ctx.fillStyle = `rgba(220, 255, 240, ${0.5 + 0.3 * phase})`;
      ctx.fillRect(x + T / 2 - 1, y + T / 2 - 1, 2, 2);
      break;
    }

    case TILE.DESK: {
      drawFloor(ctx, x, y, col, row);
      ctx.fillStyle = "#5a3018";
      ctx.fillRect(x + 1, y + 4, T - 2, 8);
      ctx.fillStyle = "#7a4220";
      ctx.fillRect(x + 1, y + 4, T - 2, 2);
      ctx.fillStyle = "#3a1f0c";
      ctx.fillRect(x + 1, y + 11, T - 2, 1);
      ctx.fillStyle = "#2a1808";
      ctx.fillRect(x + 2, y + 12, 2, 3);
      ctx.fillRect(x + T - 4, y + 12, 2, 3);
      ctx.fillStyle = "#3a1f0c";
      ctx.fillRect(x + 4, y + 7, 4, 3);
      break;
    }

    case TILE.TERMINAL: {
      drawFloor(ctx, x, y, col, row);
      ctx.fillStyle = "#5a3018";
      ctx.fillRect(x + 1, y + 11, T - 2, 4);
      ctx.fillStyle = "#3a1f0c";
      ctx.fillRect(x + 1, y + 14, T - 2, 1);
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(x + 2, y + 1, T - 4, 10);
      ctx.fillStyle = "#0a3a22";
      ctx.fillRect(x + 3, y + 2, T - 6, 8);
      const phase = Math.floor(time * 6 + col + row) % 4;
      ctx.fillStyle = "#1aff7a";
      ctx.fillRect(x + 4, y + 3, 4, 1);
      ctx.fillRect(x + 4, y + 5, 6, 1);
      ctx.fillRect(x + 4, y + 7, 3 + phase, 1);
      ctx.fillStyle = "#4ae6ff";
      ctx.fillRect(x + T - 5, y + 9, 1, 1);
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(x + 6, y + 11, T - 12, 1);
      break;
    }

    case TILE.RACK: {
      drawFloor(ctx, x, y, col, row);
      ctx.fillStyle = "#202428";
      ctx.fillRect(x + 1, y, T - 2, T);
      ctx.fillStyle = "#2a3038";
      ctx.fillRect(x + 1, y, T - 2, 1);
      ctx.fillStyle = "#0a0e12";
      ctx.fillRect(x + 1, y + T - 1, T - 2, 1);
      const blink = Math.floor(time * 4 + col * 1.7 + row * 0.3);
      const ledColors = ["#0aff7a", "#4ae6ff", "#ffaa1a", "#ff5a5a"];
      for (let r = 0; r < 4; r++) {
        const lit = (blink + r) & 1;
        ctx.fillStyle = lit ? ledColors[r] : "#1a2228";
        ctx.fillRect(x + 3, y + 2 + r * 3, 2, 2);
      }
      ctx.fillStyle = "#0a0e12";
      for (let r = 0; r < 4; r++) {
        ctx.fillRect(x + 7, y + 2 + r * 3, T - 10, 2);
      }
      ctx.fillStyle = "#1a2228";
      for (let r = 0; r < 4; r++) {
        ctx.fillRect(x + 8, y + 2 + r * 3 + 1, T - 12, 1);
      }
      break;
    }

    case TILE.PLANT: {
      drawFloor(ctx, x, y, col, row);
      ctx.fillStyle = "#3a1810";
      ctx.fillRect(x + 4, y + 10, 8, 5);
      ctx.fillStyle = "#5a2818";
      ctx.fillRect(x + 4, y + 10, 8, 1);
      ctx.fillStyle = "#2a1008";
      ctx.fillRect(x + 4, y + 14, 8, 1);
      ctx.fillStyle = "#0a4a1a";
      ctx.fillRect(x + 5, y + 5, 6, 5);
      ctx.fillRect(x + 3, y + 7, 2, 3);
      ctx.fillRect(x + 11, y + 7, 2, 3);
      ctx.fillStyle = "#1a8a3a";
      ctx.fillRect(x + 6, y + 4, 4, 4);
      ctx.fillRect(x + 7, y + 2, 2, 3);
      ctx.fillStyle = "#2faa55";
      ctx.fillRect(x + 7, y + 5, 1, 1);
      ctx.fillRect(x + 9, y + 6, 1, 1);
      break;
    }

    case TILE.SIGN: {
      drawFloor(ctx, x, y, col, row);
      ctx.fillStyle = "#3a3a3a";
      ctx.fillRect(x + 7, y + 8, 2, 7);
      ctx.fillStyle = "#0a2a3a";
      ctx.fillRect(x + 2, y + 2, T - 4, 7);
      ctx.fillStyle = "#4ae6ff";
      ctx.fillRect(x + 2, y + 2, T - 4, 1);
      ctx.fillRect(x + 2, y + 8, T - 4, 1);
      ctx.fillRect(x + 2, y + 2, 1, 7);
      ctx.fillRect(x + T - 3, y + 2, 1, 7);
      const blink = Math.floor(time * 1.5) & 1;
      ctx.fillStyle = blink ? "#cffcff" : "#4ae6ff";
      ctx.font = "bold 6px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("i", x + T / 2, y + 5.5);
      break;
    }

    case TILE.DEBRIS: {
      drawFloor(ctx, x, y, col, row);
      ctx.fillStyle = "#4a2818";
      ctx.fillRect(x + 2, y + 5, 4, 3);
      ctx.fillRect(x + 9, y + 8, 5, 3);
      ctx.fillRect(x + 5, y + 11, 4, 2);
      ctx.fillStyle = "#6a3818";
      ctx.fillRect(x + 2, y + 5, 4, 1);
      ctx.fillRect(x + 9, y + 8, 5, 1);
      ctx.fillStyle = "#2a1008";
      ctx.fillRect(x + 2, y + 7, 1, 1);
      ctx.fillRect(x + 13, y + 10, 1, 1);
      break;
    }

    case TILE.LOCKER: {
      drawFloor(ctx, x, y, col, row);
      ctx.fillStyle = "#2a4030";
      ctx.fillRect(x + 1, y, T - 2, T - 1);
      ctx.fillStyle = "#3f5a48";
      ctx.fillRect(x + 1, y, T - 2, 2);
      ctx.fillStyle = "#1a2a20";
      ctx.fillRect(x + 1, y + T - 2, T - 2, 1);
      ctx.fillStyle = "#1a2a20";
      ctx.fillRect(x + T / 2, y + 2, 1, T - 4);
      ctx.fillStyle = "#cfd8d0";
      ctx.fillRect(x + 5, y + 7, 1, 2);
      ctx.fillRect(x + T - 6, y + 7, 1, 2);
      ctx.fillStyle = "#4ae6ff";
      ctx.fillRect(x + 4, y + 3, 2, 1);
      ctx.fillRect(x + T - 6, y + 3, 2, 1);
      break;
    }

    case TILE.FLOOR:
    case TILE.SPAWN:
    default:
      drawFloor(ctx, x, y, col, row);
      break;
  }
}
