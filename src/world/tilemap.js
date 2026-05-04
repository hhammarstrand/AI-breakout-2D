export const TILE_SIZE = 16;

export const TILE = {
  FLOOR: 0,
  WALL: 1,
  DOOR_L1: 2,
  DOOR_L2: 3,
  DOOR_L3: 4,
  DOOR_L4: 5,
  SPAWN: 9,
};

const SOLID = new Set([TILE.WALL, TILE.DOOR_L1, TILE.DOOR_L2, TILE.DOOR_L3, TILE.DOOR_L4]);

const DOOR_LABELS = {
  [TILE.DOOR_L1]: "L1",
  [TILE.DOOR_L2]: "L2",
  [TILE.DOOR_L3]: "L3",
  [TILE.DOOR_L4]: "L4",
};

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

  draw(renderer, camera) {
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
        drawTile(ctx, tile, px, py, c, r);
      }
    }
  }
}

function drawTile(ctx, tile, x, y, col, row) {
  switch (tile) {
    case TILE.WALL:
      ctx.fillStyle = "#062";
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = "#0aff7a";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
      break;
    case TILE.DOOR_L1:
    case TILE.DOOR_L2:
    case TILE.DOOR_L3:
    case TILE.DOOR_L4:
      ctx.fillStyle = "#003322";
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = "#4ae6ff";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1.5, y + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);
      ctx.fillStyle = "#4ae6ff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 8px ui-monospace, monospace";
      ctx.fillText(DOOR_LABELS[tile], x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 1);
      break;
    case TILE.FLOOR:
    case TILE.SPAWN:
    default: {
      const checker = ((col + row) & 1) === 0;
      ctx.fillStyle = checker ? "#021008" : "#031a0d";
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      break;
    }
  }
}
