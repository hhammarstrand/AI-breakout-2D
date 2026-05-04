import { TILE_SIZE } from "../world/tilemap.js";

const SPEED = 70;
const W = 12;
const H = 14;

export class Player {
  constructor(col, row) {
    this.x = col * TILE_SIZE + (TILE_SIZE - W) / 2;
    this.y = row * TILE_SIZE + (TILE_SIZE - H) / 2;
    this.w = W;
    this.h = H;
    this.facing = "down";
    this.animTime = 0;
    this.idleTime = 0;
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
    if (this.moving) {
      this.animTime += dt;
      this.idleTime = 0;
    } else {
      this.idleTime += dt;
    }
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
    const reach = TILE_SIZE * 0.8;
    switch (this.facing) {
      case "up":    return { x: cx, y: cy - reach };
      case "down":  return { x: cx, y: cy + reach };
      case "left":  return { x: cx - reach, y: cy };
      case "right": return { x: cx + reach, y: cy };
    }
    return { x: cx, y: cy };
  }

  draw(renderer, camera) {
    const idleBob = Math.sin(this.idleTime * 2.4) * 0.6;
    const px = (this.x - camera.x) | 0;
    const py = ((this.y - camera.y) + (this.moving ? 0 : idleBob)) | 0;
    const ctx = renderer.ctx;

    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(px - 1, py + this.h, this.w + 2, 2);

    ctx.fillStyle = "#0a4a2a";
    ctx.fillRect(px + 1, py + 8, this.w - 2, 6);
    ctx.fillStyle = "#1a8a3a";
    ctx.fillRect(px + 1, py + 7, this.w - 2, 2);

    ctx.fillStyle = "#3a1f0c";
    ctx.fillRect(px + 2, py + this.h - 2, 3, 2);
    ctx.fillRect(px + this.w - 5, py + this.h - 2, 3, 2);

    if (this.moving) {
      const phase = Math.floor(this.animTime * 8) & 1;
      ctx.fillStyle = "#1a8a3a";
      if (phase) ctx.fillRect(px + 2, py + this.h - 2, 3, 1);
      else ctx.fillRect(px + this.w - 5, py + this.h - 2, 3, 1);
    }

    ctx.fillStyle = "#fbd2a0";
    ctx.fillRect(px + 2, py + 2, this.w - 4, 5);

    ctx.fillStyle = "#4ae6ff";
    ctx.fillRect(px + 1, py, this.w - 2, 3);
    ctx.fillStyle = "#cffcff";
    ctx.fillRect(px + 1, py, this.w - 2, 1);
    ctx.fillStyle = "#0a8aff";
    ctx.fillRect(px + 1, py + 2, this.w - 2, 1);

    ctx.fillStyle = "#000";
    if (this.facing === "down") {
      ctx.fillRect(px + 4, py + 4, 1, 2);
      ctx.fillRect(px + this.w - 5, py + 4, 1, 2);
    } else if (this.facing === "up") {
      ctx.fillStyle = "#7a4220";
      ctx.fillRect(px + 2, py + 3, this.w - 4, 3);
    } else if (this.facing === "left") {
      ctx.fillStyle = "#000";
      ctx.fillRect(px + 3, py + 4, 1, 2);
    } else if (this.facing === "right") {
      ctx.fillStyle = "#000";
      ctx.fillRect(px + this.w - 4, py + 4, 1, 2);
    }

    ctx.fillStyle = "#cffcff";
    switch (this.facing) {
      case "up":    ctx.fillRect(px + this.w / 2 - 1, py - 1, 2, 1); break;
      case "down":  ctx.fillRect(px + this.w / 2 - 1, py + this.h, 2, 1); break;
      case "left":  ctx.fillRect(px - 1, py + 8, 1, 2); break;
      case "right": ctx.fillRect(px + this.w, py + 8, 1, 2); break;
    }
  }
}
