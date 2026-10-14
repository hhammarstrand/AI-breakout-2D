import { TILE_SIZE } from "../world/tilemap.js";
import { character, FRAME_W, FRAME_H } from "../gfx/characters.js";

const WALK_SPEED = 72;   // px/s — 4.5 tiles per second
const RUN_SPEED = 128;
const TURN_DELAY = 0.09; // tap a direction to turn on the spot, hold to walk
const W = 12;
const H = 14;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const ORDER = ["up", "down", "left", "right"];

// Pokémon-style grid movement: the player always stands on a tile and walks tile to tile.
export class Player {
  constructor(col, row) {
    this.w = W;
    this.h = H;
    this.teleport(col, row);
    this.facing = "down";
    this.animTime = 0;
    this.idleTime = 0;
    this.dirX = 0;
    this.dirY = 1;
    this._turnHold = 0;
    this._lastDir = null;
    this.bumped = false;
  }

  teleport(col, row) {
    this.x = col * TILE_SIZE + (TILE_SIZE - W) / 2;
    this.y = row * TILE_SIZE + (TILE_SIZE - H) / 2;
    this.target = null;
    this.moving = false;
    this.started = null;
  }

  get col() { return Math.round((this.x - (TILE_SIZE - W) / 2) / TILE_SIZE); }
  get row() { return Math.round((this.y - (TILE_SIZE - H) / 2) / TILE_SIZE); }
  get centerX() { return this.x + this.w / 2; }
  get centerY() { return this.y + this.h / 2; }

  _heldDir(input) {
    let tapped = null;
    for (const d of ORDER) if (input.wasPressed(d)) { this._lastDir = d; tapped = d; }
    // a tap that was released within the same frame still counts (turns on the spot)
    if (tapped && !input.isDown(tapped)) return tapped;
    if (this._lastDir && input.isDown(this._lastDir)) return this._lastDir;
    return ORDER.find((d) => input.isDown(d)) ?? null;
  }

  // isBlocked(col, row) -> true when the tile can't be entered (walls, props, people)
  update(dt, input, isBlocked) {
    this.bumped = false;
    // step events for floor puzzles: `started` when a step begins, `arrived` when it lands
    this.started = null;
    this.arrived = null;
    const dir = this._heldDir(input);
    const speed = input.isDown("run") ? RUN_SPEED : WALK_SPEED;

    if (this.target) {
      this.animTime += dt * (speed / WALK_SPEED);
      const tx = this.target.x - this.x, ty = this.target.y - this.y;
      const dist = Math.hypot(tx, ty);
      const step = speed * dt;
      if (step < dist) {
        this.x += (tx / dist) * step;
        this.y += (ty / dist) * step;
        return;
      }
      this.x = this.target.x;
      this.y = this.target.y;
      this.target = null;
      this.arrived = { col: this.col, row: this.row };
      // keep walking without a pause if a direction is still held
      if (dir) this._tryStep(dir, isBlocked, true);
      this.moving = !!this.target;
      return;
    }

    if (!dir) {
      this.moving = false;
      this.idleTime += dt;
      this._turnHold = 0;
      return;
    }
    if (dir !== this.facing) {
      this._face(dir);
      this._turnHold = TURN_DELAY;
      return;
    }
    if (this._turnHold > 0) { this._turnHold -= dt; return; }
    this._tryStep(dir, isBlocked, false);
    this.moving = !!this.target;
  }

  _face(dir) {
    this.facing = dir;
    [this.dirX, this.dirY] = DIRS[dir];
  }

  _tryStep(dir, isBlocked, chained) {
    this._face(dir);
    const [dx, dy] = DIRS[dir];
    const nc = this.col + dx, nr = this.row + dy;
    if (isBlocked(nc, nr)) {
      if (!chained) this.bumped = true;
      return;
    }
    this.idleTime = 0;
    this.target = { x: nc * TILE_SIZE + (TILE_SIZE - W) / 2, y: nr * TILE_SIZE + (TILE_SIZE - H) / 2 };
    this.started = { col: nc, row: nr, from: { col: this.col, row: this.row } };
  }

  facingTilePx() {
    const cx = this.centerX;
    const cy = this.centerY;
    const reach = TILE_SIZE;
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
