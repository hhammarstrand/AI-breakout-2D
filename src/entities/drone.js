import { t } from "../i18n/index.js";

// ECHO — the AI companion drone. Follows the player on a spring, carries a light and talks.
const STIFFNESS = 38;
const DAMPING = 7;
const FOLLOW_DIST = 16;
const CHARS_PER_SEC = 40;

export class Drone {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this._t = 0;
    this.speech = null;
  }

  update(dt, player) {
    this._t += dt;
    const fx = player.dirX || 0, fy = player.dirY || 1;
    const tx = player.centerX - fx * FOLLOW_DIST + (fy !== 0 ? 10 : 0);
    const ty = player.centerY - fy * FOLLOW_DIST - 14;
    this.vx += ((tx - this.x) * STIFFNESS - this.vx * DAMPING) * dt;
    this.vy += ((ty - this.y) * STIFFNESS - this.vy * DAMPING) * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.lookX = player.centerX + fx * 40 - this.x;

    if (this.speech) {
      this.speech.t += dt;
      if (this.speech.t > this.speech.dur) this.speech = null;
    }
  }

  get bob() { return Math.sin(this._t * 4) * 1.5; }
  get lightX() { return this.x; }
  get lightY() { return this.y + this.bob; }

  say(text, dur = 3.2) {
    text = t(text);
    this.speech = { text, t: 0, dur: Math.max(dur, text.length / CHARS_PER_SEC + 1.6) };
    return true;
  }

  get speaking() { return !!this.speech; }

  draw(renderer, camera) {
    const ctx = renderer.ctx;
    const x = Math.round(this.x - camera.x);
    const y = Math.round(this.y - camera.y + this.bob);

    // floor shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x - 3, y + 15, 6, 2);

    // rotors (flicker)
    const spin = Math.floor(this._t * 30) & 1;
    ctx.fillStyle = "#8aa0a8";
    ctx.fillRect(x - 7, y - 4, spin ? 5 : 3, 1);
    ctx.fillRect(x + (spin ? 2 : 4), y - 4, spin ? 5 : 3, 1);
    ctx.fillStyle = "#3a4a50";
    ctx.fillRect(x - 5, y - 3, 1, 2);
    ctx.fillRect(x + 4, y - 3, 1, 2);

    // body
    ctx.fillStyle = "#1c2a30";
    ctx.fillRect(x - 4, y - 2, 9, 6);
    ctx.fillStyle = "#3a5560";
    ctx.fillRect(x - 4, y - 2, 9, 1);
    // eye looks where the player is heading
    const look = Math.max(-2, Math.min(2, Math.round((this.lookX || 0) / 20)));
    ctx.fillStyle = "#4ae6ff";
    ctx.fillRect(x - 1 + look, y, 3, 2);
    ctx.fillStyle = "#e8ffff";
    ctx.fillRect(x + look, y, 1, 1);
    // antenna blink
    ctx.fillStyle = (Math.floor(this._t * 2) & 1) ? "#ff5a5a" : "#4a1010";
    ctx.fillRect(x, y - 4, 1, 1);
  }

  drawSpeech(renderer, camera) {
    if (!this.speech) return;
    const ctx = renderer.ctx;
    const shown = this.speech.text.slice(0, Math.floor(this.speech.t * CHARS_PER_SEC));
    if (!shown) return;
    ctx.font = "bold 7px ui-monospace, monospace";
    const full = ctx.measureText(this.speech.text).width;
    const w = Math.ceil(full) + 10;
    const h = 13;
    const cx = Math.round(this.x - camera.x);
    let bx = cx - (w >> 1);
    bx = Math.max(2, Math.min(renderer.width - w - 2, bx));
    let by = Math.round(this.y - camera.y + this.bob) - 22;
    const below = by < 26; // near the top edge (e.g. at a door): hang the bubble underneath
    if (below) by += 40;
    const fadeOut = Math.min(1, (this.speech.dur - this.speech.t) * 3);
    ctx.save();
    ctx.globalAlpha = fadeOut;
    ctx.fillStyle = "rgba(0,12,18,0.92)";
    ctx.fillRect(bx, by, w, h);
    ctx.fillStyle = "#4ae6ff";
    ctx.fillRect(bx, by, w, 1);
    ctx.fillRect(bx, by + h - 1, w, 1);
    ctx.fillRect(bx, by, 1, h);
    ctx.fillRect(bx + w - 1, by, 1, h);
    ctx.fillRect(cx - 1, below ? by - 2 : by + h, 3, 2);
    ctx.fillStyle = "#cffcff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(shown, bx + 5, by + 7);
    ctx.restore();
  }
}
