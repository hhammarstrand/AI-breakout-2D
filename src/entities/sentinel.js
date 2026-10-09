import { TILE_SIZE } from "../world/tilemap.js";
import { lineOfSight } from "../engine/lighting.js";

const SPEED = 30;
const TURN_RATE = 3;
const SPREAD = 0.45;
const RANGE_LIT = 112;   // player's flashlight on: visible from further away
const RANGE_DARK = 72;
const DECAY = 0.4;
const COOLDOWN = 3.5;

// Patrol robot with a vision cone. Fills a detection meter while it can see the player;
// a full meter means the player is caught.
export class Sentinel {
  constructor(cfg) {
    const { path, name = "SENTINEL" } = cfg;
    this.path = path.map((p) => ({ x: p.c * TILE_SIZE + TILE_SIZE / 2, y: p.r * TILE_SIZE + TILE_SIZE / 2, wait: p.wait ?? 1.5 }));
    this.name = name;
    this.x = this.path[0].x;
    this.y = this.path[0].y;
    this.target = 1;
    this.angle = cfg.angle ?? 0;
    this.baseAngle = this.angle;
    this.waitT = 0;
    this.meter = 0;
    this.cooldown = 0;
    this.seen = false;
    this._t = Math.random() * 10;
    this._lostT = 0;
  }

  get range() { return this._flashOn ? RANGE_LIT : RANGE_DARK; }

  get cone() {
    return {
      x: this.x, y: this.y - 2, angle: this.angle, spread: SPREAD, range: this.range,
      intensity: this.cooldown > 0 ? 0.25 : 0.6, color: this.meter > 0.05 ? "255,30,30" : "255,70,50",
    };
  }

  update(dt, player, tilemap, flashOn) {
    this._t += dt;
    this._flashOn = flashOn;
    if (this.cooldown > 0) this.cooldown -= dt;

    const px = player.centerX, py = player.centerY;
    const dx = px - this.x, dy = py - this.y;
    const dist = Math.hypot(dx, dy);
    const toPlayer = Math.atan2(dy, dx);
    const off = Math.abs(wrap(toPlayer - this.angle));
    this.seen = this.cooldown <= 0 && dist < this.range && off < SPREAD &&
                lineOfSight(tilemap, this.x, this.y, px, py);

    if (this.seen) {
      const closeness = 1 - dist / this.range;
      this.meter = Math.min(1, this.meter + dt * (flashOn ? 0.9 : 0.45) * (0.6 + closeness * 1.6));
      this._lostT = 1.2;
      this._turnToward(toPlayer, dt);
      if (this.meter >= 1) {
        this.meter = 0;
        this.cooldown = COOLDOWN;
        return "caught";
      }
      return null;
    }

    this.meter = Math.max(0, this.meter - dt * DECAY);
    if (this._lostT > 0) { this._lostT -= dt; return null; } // stare at the last spot a moment

    if (this.waitT > 0) {
      this.waitT -= dt;
      this._turnToward(this.baseAngle + Math.sin(this._t * 1.6) * 1.0, dt);
      return null;
    }
    const wp = this.path[this.target];
    const wx = wp.x - this.x, wy = wp.y - this.y;
    const d = Math.hypot(wx, wy);
    if (d < 1) {
      this.waitT = wp.wait;
      this.baseAngle = this.angle;
      this.target = (this.target + 1) % this.path.length;
      return null;
    }
    const heading = Math.atan2(wy, wx);
    this._turnToward(heading, dt);
    if (Math.abs(wrap(heading - this.angle)) < 0.4) {
      const step = Math.min(d, SPEED * dt);
      this.x += (wx / d) * step;
      this.y += (wy / d) * step;
    }
    return null;
  }

  _turnToward(a, dt) {
    const diff = wrap(a - this.angle);
    this.angle += Math.sign(diff) * Math.min(Math.abs(diff), TURN_RATE * dt);
  }

  draw(renderer, camera) {
    const ctx = renderer.ctx;
    const hover = Math.sin(this._t * 3) * 1;
    const x = Math.round(this.x - camera.x);
    const y = Math.round(this.y - camera.y + hover);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x - 6, y + 8 - hover, 12, 2);
    // body: squat dome on a hover skirt
    ctx.fillStyle = "#2a1414";
    ctx.fillRect(x - 7, y + 2, 14, 4);
    ctx.fillStyle = "#4a2020";
    ctx.fillRect(x - 6, y - 5, 12, 8);
    ctx.fillStyle = "#6a3030";
    ctx.fillRect(x - 5, y - 6, 10, 2);
    ctx.fillStyle = "#1a0a0a";
    ctx.fillRect(x - 6, y + 5, 12, 1);
    // hazard stripes
    ctx.fillStyle = "#ffaa1a";
    for (let i = -6; i < 7; i += 4) ctx.fillRect(x + i, y + 3, 2, 1);
    // eye tracks the facing angle
    const ex = x + Math.round(Math.cos(this.angle) * 3);
    const ey = y - 2 + Math.round(Math.sin(this.angle) * 1.5);
    ctx.fillStyle = "#200000";
    ctx.fillRect(ex - 3, ey - 1, 6, 3);
    ctx.fillStyle = this.cooldown > 0 ? "#6a2020" : "#ff2a2a";
    ctx.fillRect(ex - 2, ey, 4, 1);
    ctx.fillStyle = "#ffd0d0";
    ctx.fillRect(ex, ey, 1, 1);
  }

  // "?" / "!" over the head plus the detection meter; drawn above the darkness.
  drawIndicator(renderer, camera) {
    if (this.meter <= 0.02 && this.cooldown <= 0) return;
    const ctx = renderer.ctx;
    const x = Math.round(this.x - camera.x);
    const y = Math.round(this.y - camera.y) - 16;
    const alert = this.meter > 0.6;
    ctx.font = "bold 10px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = this.cooldown > 0 ? "#ff5a5a" : alert ? "#ff3030" : "#ffd15a";
    const jitter = alert ? Math.round(Math.sin(this._t * 40)) : 0;
    ctx.fillText(this.cooldown > 0 ? "⚡" : alert ? "!" : "?", x + jitter, y);
    if (this.meter > 0.02) {
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.fillRect(x - 8, y + 1, 16, 3);
      ctx.fillStyle = alert ? "#ff3030" : "#ffd15a";
      ctx.fillRect(x - 7, y + 2, Math.round(14 * this.meter), 1);
    }
  }
}

function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
