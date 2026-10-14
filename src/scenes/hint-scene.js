import { t } from "../i18n/index.js";
import { drawPortrait } from "../ui/portrait.js";
import { track } from "../telemetry.js";
import { drawClockPaused } from "./pause-scene.js";

// Seconds spent in the puzzle itself before ECHO will give a stronger hint, so the answer can't be
// pulled out with three quick presses, or by waiting in this overlay or a pause.
const HINT_GAP = 30;

// ECHO's hints: each press of H reveals the next, from a nudge to nearly the answer. Reading a
// hint stops the clock like any other text (see pause-scene.js); the overlay hides the puzzle, so
// it can't double as a free thinking pause. owner._activeT is the time the owner spent on top.
export class HintScene {
  constructor({ hints, owner, sfx, hud }) {
    this.list = hints; // not `hints`: that name makes the game route H here as a new overlay
    this.owner = owner;
    this.sfx = sfx;
    this.hud = hud;
    if (!owner._hintsShown || (this._ready() && owner._hintsShown < hints.length)) {
      this._reveal(owner._hintsShown + 1 || 1);
      track.hint();
    }
    this.count = owner._hintsShown;
    this._t = 0;
    this.portrait = document.createElement("canvas");
    this.portrait.width = 48;
    this.portrait.height = 48;
    sfx.play("drone");
  }

  update(dt, input) {
    this._t += dt;
    if (this._t <= 0.2) return;
    if (input.wasPressed("hint") && this.count < this.list.length) {
      if (!this._ready()) { this.sfx.play("denied"); return; } // the footer shows the countdown
      this._reveal(this.count + 1);
      this.count = this.owner._hintsShown;
      track.hint();
      this.sfx.play("drone");
      return;
    }
    if (input.wasPressed("interact") || input.wasPressed("submit") || input.wasPressed("pause") || input.wasPressed("back") || input.wasPressed("hint")) {
      this.game.pop();
    }
  }

  _wait() { return HINT_GAP - ((this.owner._activeT ?? 0) - (this.owner._hintAt ?? -Infinity)); }
  _ready() { return this._wait() <= 0; }
  _reveal(n) { this.owner._hintsShown = n; this.owner._hintAt = this.owner._activeT ?? 0; }

  render(renderer) {
    const w = renderer.width;
    const ctx = renderer.ctx;
    renderer.fillRect(0, 0, w, renderer.height, "rgba(0,0,0,0.88)");
    const bx = 24, by = 50, bw = w - 48;
    ctx.font = "normal 9px ui-monospace, monospace";
    const blocks = this.list.slice(0, this.count).map((hint) => wrap(ctx, hint, bw - 80));
    const textH = blocks.reduce((n, b) => n + b.length * 12 + 8, 0);
    const bh = 56 + textH + 14;
    renderer.fillRect(bx, by, bw, bh, "rgba(0,14,22,0.96)");
    renderer.strokeRect(bx, by, bw, bh, "#4ae6ff", 2);
    drawPortrait(this.portrait, { glyph: "◉", tint: "#4ae6ff" }, this._t);
    ctx.drawImage(this.portrait, bx + 10, by + 10, 36, 36);
    renderer.text(`ECHO — HINT ${this.count}/${this.list.length}`, bx + 56, by + 20, { color: "#4ae6ff", size: 10, baseline: "middle", weight: "bold" });
    let y = by + 50;
    blocks.forEach((block, i) => {
      block.forEach((part, j) => renderer.text(`${j === 0 ? "▸ " : "  "}${part}`, bx + 56, y + j * 12, {
        color: i === blocks.length - 1 ? "#ffffff" : "#8acada", size: 9, baseline: "middle",
      }));
      y += block.length * 12 + 8;
    });
    drawClockPaused(renderer, bx + bw - 10, by + 20);
    const wait = Math.ceil(this._wait());
    const more = this.count >= this.list.length ? "that's everything I've got" : wait > 0 ? `stronger hint in ${wait}s` : "H: stronger hint";
    renderer.text(`[space] back · ${more}`, bx + bw - 10, by + bh - 10, { color: "#2a7a8a", size: 7, align: "right", baseline: "middle" });
  }
}

function wrap(ctx, text, maxW) {
  text = t(text);
  const out = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out;
}
