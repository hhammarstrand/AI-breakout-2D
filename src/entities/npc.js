import { TILE_SIZE } from "../world/tilemap.js";
import { character, FRAME_W, FRAME_H } from "../gfx/characters.js";
import { drawShadow } from "./player.js";

const LOOK_RADIUS = 60;

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
    this.stagedLines = config.lines || [];
    this.appearsAt = config.appearsAt ?? 0;
    this._bobTime = Math.random() * 10;
    this._hop = 0;
    this.facing = config.facing ?? "down";
    this._blinkAt = 1 + Math.random() * 4;
  }

  update(dt, player) {
    this._bobTime += dt;
    this._blinkAt -= dt;
    if (this._blinkAt < -0.14) this._blinkAt = 2 + Math.random() * 4;
    if (player) {
      // turn to watch the player when they come close
      const dx = player.centerX - (this.x + this.w / 2);
      const dy = player.centerY - (this.y + this.h / 2);
      if (dx * dx + dy * dy < LOOK_RADIUS * LOOK_RADIUS) {
        this.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
      }
    }
    if (this._hop > 0) this._hop = Math.max(0, this._hop - dt);
  }

  linesFor(stage) {
    for (let i = Math.min(stage, this.stagedLines.length - 1); i >= 0; i--) {
      if (this.stagedLines[i]?.length) return this.stagedLines[i];
    }
    return ["..."];
  }

  // Little "!" hop when the player starts a conversation.
  react() { this._hop = 0.35; }

  draw(renderer, camera) {
    const hop = this._hop > 0 ? Math.sin((this._hop / 0.35) * Math.PI) * 4 : 0;
    const ctx = renderer.ctx;
    const dx = Math.round(this.x + this.w / 2 - FRAME_W / 2 - camera.x);
    const dy = Math.round(this.y + this.h - FRAME_H + 1 - camera.y);
    drawShadow(ctx, dx, dy);
    const breathe = Math.sin(this._bobTime * 2.2) > 0.6 ? 1 : 0;
    ctx.drawImage(character(this.id).frame(this.facing, 0, this._blinkAt < 0), dx, dy + breathe - Math.round(hop));
  }

  // Name tag is drawn after the lighting pass so it stays readable in the dark.
  drawLabel(renderer, camera) {
    const hop = this._hop > 0 ? Math.sin((this._hop / 0.35) * Math.PI) * 4 : 0;
    const px = (this.x - camera.x) | 0;
    const py = (this.y - camera.y + Math.sin(this._bobTime * 2.4) * 0.6 - hop) | 0;
    const ctx = renderer.ctx;
    ctx.fillStyle = "#cffcff";
    ctx.font = "bold 7px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(this.name.toUpperCase(), px + this.w / 2, py - 10);
    if (this._hop > 0) {
      ctx.fillStyle = "#ffd15a";
      ctx.font = "bold 9px ui-monospace, monospace";
      ctx.fillText("!", px + this.w + 4, py - 3);
    }
  }

  containsPx(x, y) {
    return x >= this.x - 2 && x <= this.x + this.w + 2 &&
           y >= this.y - 2 && y <= this.y + this.h + 2;
  }
}
