import { TILE_SIZE } from "../world/tilemap.js";

const SIZE = 12;

export class Npc {
  constructor(config) {
    this.id = config.id;
    this.col = config.col;
    this.row = config.row;
    this.x = config.col * TILE_SIZE + (TILE_SIZE - SIZE) / 2;
    this.y = config.row * TILE_SIZE + (TILE_SIZE - SIZE) / 2;
    this.w = SIZE;
    this.h = SIZE;
    this.color = config.color || "#4ae6ff";
    this.name = config.name || "?";
    this.lines = config.lines || [];
    this._bobTime = Math.random() * 10;
  }

  update(dt) { this._bobTime += dt; }

  containsPx(x, y) {
    return x >= this.x - 2 && x <= this.x + this.w + 2 &&
           y >= this.y - 2 && y <= this.y + this.h + 2;
  }

  draw(renderer, camera) {
    const bob = Math.sin(this._bobTime * 2) * 1;
    const px = (this.x - camera.x) | 0;
    const py = (this.y - camera.y + bob) | 0;
    const ctx = renderer.ctx;

    ctx.fillStyle = "#031a0d";
    ctx.fillRect(px - 1, py + this.h, this.w + 2, 2);

    ctx.fillStyle = this.color;
    ctx.fillRect(px, py, this.w, this.h);

    ctx.fillStyle = "#001a18";
    ctx.fillRect(px + 2, py + 4, 2, 2);
    ctx.fillRect(px + this.w - 4, py + 4, 2, 2);

    ctx.fillStyle = "#cffcff";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.font = "bold 7px ui-monospace, monospace";
    ctx.fillText(this.name.toUpperCase(), px + this.w / 2, py - 2);
  }
}
