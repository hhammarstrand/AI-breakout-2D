import { TILE_SIZE } from "../world/tilemap.js";

// A data capsule lying on the floor — the game's "item ball". Blocks its tile until picked up.
export class Pickup {
  constructor(cfg) {
    this.id = cfg.id;
    this.col = cfg.col;
    this.row = cfg.row;
    this.kind = cfg.kind;   // "log" | "item"
    this.item = cfg.item;
    this._t = Math.random() * 6;
  }

  update(dt) { this._t += dt; }

  draw(renderer, camera) {
    const ctx = renderer.ctx;
    const x = Math.round(this.col * TILE_SIZE - camera.x);
    const y = Math.round(this.row * TILE_SIZE - camera.y);
    const top = this.kind === "log" ? "#2ac8e8" : "#ffaa3a";
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(x + 4, y + 12, 8, 2);
    // capsule: two-tone sphere with a band and a centre button
    ctx.fillStyle = "#0a0812";
    ctx.beginPath(); ctx.arc(x + 8, y + 8, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = top;
    ctx.beginPath(); ctx.arc(x + 8, y + 8, 4.5, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#e8eef4";
    ctx.beginPath(); ctx.arc(x + 8, y + 8, 4.5, 0, Math.PI); ctx.fill();
    ctx.fillStyle = "#0a0812";
    ctx.fillRect(x + 3, y + 7, 10, 2);
    ctx.fillStyle = "#e8eef4";
    ctx.fillRect(x + 7, y + 7, 2, 2);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillRect(x + 6, y + 5, 1, 1);
    // glint
    const g = (this._t % 2.4);
    if (g < 0.3) {
      ctx.fillStyle = "#ffffff";
      const s = g < 0.15 ? 1 : 2;
      ctx.fillRect(x + 11, y + 2 - s, 1, s * 2 + 1);
      ctx.fillRect(x + 11 - s, y + 2, s * 2 + 1, 1);
    }
  }
}
