import { TILE_SIZE } from "../world/tilemap.js";
import { character, FRAME_W, FRAME_H } from "../gfx/characters.js";

const SPEED = 70;
const W = 12;
const H = 14;
const SLIDE_REACH = 7;

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
    this.dirX = 0;
    this.dirY = 1;
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
      this.dirX = dx;
      this.dirY = dy;
      this.animTime += dt;
      this.idleTime = 0;
    } else {
      this.idleTime += dt;
    }
    if (Math.abs(dx) > Math.abs(dy)) this.facing = dx < 0 ? "left" : "right";
    else if (dy !== 0) this.facing = dy < 0 ? "up" : "down";

    const stepX = dx * SPEED * dt;
    const stepY = dy * SPEED * dt;

    if (stepX !== 0) {
      if (!tilemap.rectCollides(this.x + stepX, this.y, this.w, this.h)) this.x += stepX;
      else if (dy === 0) this._slideAround(tilemap, "y", stepX, Math.abs(stepX));
    }
    if (stepY !== 0) {
      if (!tilemap.rectCollides(this.x, this.y + stepY, this.w, this.h)) this.y += stepY;
      else if (dx === 0) this._slideAround(tilemap, "x", stepY, Math.abs(stepY));
    }
  }

  // Corner assist: when bumping into a wall next to a 1-tile gap, nudge sideways
  // toward the gap instead of requiring pixel-perfect alignment.
  _slideAround(tilemap, axis, step, speed) {
    for (let off = 1; off <= SLIDE_REACH; off++) {
      for (const sign of [-1, 1]) {
        const ox = axis === "x" ? sign * off : step;
        const oy = axis === "y" ? sign * off : step;
        if (!tilemap.rectCollides(this.x + ox, this.y + oy, this.w, this.h)) {
          const nudge = sign * Math.min(speed, off);
          if (axis === "x") this.x += nudge; else this.y += nudge;
          return;
        }
      }
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
    const ctx = renderer.ctx;
    const step = this.moving ? Math.floor(this.animTime * 9) % 4 : 0;
    const blink = !this.moving && this.idleTime % 3.6 > 3.45;
    const breathe = !this.moving && Math.sin(this.idleTime * 2.2) > 0.6 ? 1 : 0;
    const dx = Math.round(this.x + this.w / 2 - FRAME_W / 2 - camera.x);
    const dy = Math.round(this.y + this.h - FRAME_H + 1 - camera.y);
    drawShadow(ctx, dx, dy);
    ctx.drawImage(character("player").frame(this.facing, step, blink), dx, dy + breathe);
  }
}

export function drawShadow(ctx, dx, dy) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.fillRect(dx + 4, dy + FRAME_H - 3, 10, 2);
  ctx.fillRect(dx + 5, dy + FRAME_H - 1, 8, 1);
}
