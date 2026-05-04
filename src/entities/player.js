import { TILE_SIZE } from "../world/tilemap.js";

const SPEED = 70;
const SIZE = 12;

export class Player {
  constructor(col, row) {
    this.x = col * TILE_SIZE + (TILE_SIZE - SIZE) / 2;
    this.y = row * TILE_SIZE + (TILE_SIZE - SIZE) / 2;
    this.w = SIZE;
    this.h = SIZE;
    this.facing = "down";
    this.animTime = 0;
    this.moving = false;
  }

  get centerX() { return this.x + this.w / 2; }
  get centerY() { return this.y + this.h / 2; }

  update(dt, input, tilemap) {
    let dx = 0, dy = 0;
    if (input.isDown("left")) dx -= 1;
    if (input.isDown("right")) dx += 1;
    if (input.isDown("up")) dy -= 1;
    if (input.isDown("down")) dy += 1;

    if (dx !== 0 && dy !== 0) {
      const inv = 1 / Math.SQRT2;
      dx *= inv; dy *= inv;
    }

    this.moving = dx !== 0 || dy !== 0;
    if (this.moving) this.animTime += dt;
    if (Math.abs(dx) > Math.abs(dy)) this.facing = dx < 0 ? "left" : "right";
    else if (dy !== 0) this.facing = dy < 0 ? "up" : "down";

    const stepX = dx * SPEED * dt;
    const stepY = dy * SPEED * dt;

    if (stepX !== 0 && !tilemap.rectCollides(this.x + stepX, this.y, this.w, this.h)) {
      this.x += stepX;
    }
    if (stepY !== 0 && !tilemap.rectCollides(this.x, this.y + stepY, this.w, this.h)) {
      this.y += stepY;
    }
  }

  facingTilePx() {
    const cx = this.centerX;
    const cy = this.centerY;
    const reach = TILE_SIZE * 0.75;
    switch (this.facing) {
      case "up":    return { x: cx, y: cy - reach };
      case "down":  return { x: cx, y: cy + reach };
      case "left":  return { x: cx - reach, y: cy };
      case "right": return { x: cx + reach, y: cy };
    }
    return { x: cx, y: cy };
  }

  draw(renderer, camera) {
    const px = (this.x - camera.x) | 0;
    const py = (this.y - camera.y) | 0;
    const ctx = renderer.ctx;

    ctx.fillStyle = "#031a0d";
    ctx.fillRect(px - 1, py + this.h - 2, this.w + 2, 2);

    ctx.fillStyle = "#0aff7a";
    ctx.fillRect(px, py, this.w, this.h);

    ctx.fillStyle = "#062";
    ctx.fillRect(px + 2, py + 4, 2, 2);
    ctx.fillRect(px + this.w - 4, py + 4, 2, 2);

    ctx.fillStyle = "#4ae6ff";
    switch (this.facing) {
      case "up":    ctx.fillRect(px + this.w / 2 - 1, py - 1, 2, 2); break;
      case "down":  ctx.fillRect(px + this.w / 2 - 1, py + this.h - 1, 2, 2); break;
      case "left":  ctx.fillRect(px - 1, py + this.h / 2 - 1, 2, 2); break;
      case "right": ctx.fillRect(px + this.w - 1, py + this.h / 2 - 1, 2, 2); break;
    }

    if (this.moving) {
      const phase = Math.floor(this.animTime * 8) & 1;
      ctx.fillStyle = "#062";
      ctx.fillRect(px + (phase ? 1 : this.w - 3), py + this.h - 3, 2, 2);
    }
  }
}
