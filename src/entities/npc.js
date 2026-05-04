import { TILE_SIZE } from "../world/tilemap.js";

const W = 12;
const H = 14;

export class Npc {
  constructor(config) {
    this.id = config.id;
    this.col = config.col;
    this.row = config.row;
    this.x = config.col * TILE_SIZE + (TILE_SIZE - W) / 2;
    this.y = config.row * TILE_SIZE + (TILE_SIZE - H) / 2;
    this.w = W;
    this.h = H;
    this.color = config.color || "#4ae6ff";
    this.accent = config.accent || "#cffcff";
    this.bodyDark = config.bodyDark || "#1a3a4a";
    this.name = config.name || "?";
    this.lines = config.lines || [];
    this._bobTime = Math.random() * 10;
  }

  update(dt) { this._bobTime += dt; }

  draw(renderer, camera) {
    const bob = Math.sin(this._bobTime * 2.4) * 0.6;
    const px = (this.x - camera.x) | 0;
    const py = (this.y - camera.y + bob) | 0;
    const ctx = renderer.ctx;

    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(px - 1, py + this.h, this.w + 2, 2);

    ctx.fillStyle = this.bodyDark;
    ctx.fillRect(px + 1, py + 8, this.w - 2, 6);
    ctx.fillStyle = this.color;
    ctx.fillRect(px + 1, py + 7, this.w - 2, 2);

    ctx.fillStyle = "#3a1f0c";
    ctx.fillRect(px + 2, py + this.h - 2, 3, 2);
    ctx.fillRect(px + this.w - 5, py + this.h - 2, 3, 2);

    ctx.fillStyle = "#fbd2a0";
    ctx.fillRect(px + 2, py + 2, this.w - 4, 5);

    ctx.fillStyle = this.accent;
    ctx.fillRect(px + 1, py, this.w - 2, 3);
    ctx.fillStyle = "#fff";
    ctx.fillRect(px + 1, py, this.w - 2, 1);

    ctx.fillStyle = "#000";
    ctx.fillRect(px + 4, py + 4, 1, 2);
    ctx.fillRect(px + this.w - 5, py + 4, 1, 2);

    ctx.fillStyle = "#cffcff";
    ctx.font = "bold 7px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(this.name.toUpperCase(), px + this.w / 2, py - 2);
  }

  containsPx(x, y) {
    return x >= this.x - 2 && x <= this.x + this.w + 2 &&
           y >= this.y - 2 && y <= this.y + this.h + 2;
  }
}
