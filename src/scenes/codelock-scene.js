import { penalize, scaledPenalty } from "../state.js";
import { t } from "../i18n/index.js";

// Each wrong combination costs a little time, so the dial can't be brute-forced for free.
const WRONG_PENALTY = 5;
const OPEN_TIME = 1.1;

// Four-digit combination lock overlay used by the floor safes. The note on the dial says what the
// code is made of; the pieces are spread over the floor's signs, terminals and logs, and only
// combining them gives the code. The purge clock keeps running.
export class CodeLockScene {
  constructor({ hud, sfx, fx, onResult, safe }) {
    this.hud = hud;
    this.sfx = sfx;
    this.fx = fx;
    this.onResult = onResult;
    this.safe = safe;
    this.hints = safe.hints; // per floor: where to look, how to combine, nearly the answer
    this.digits = [0, 0, 0, 0];
    this.pos = 0;
    this._t = 0;
    this.shake = 0;
    this.opened = 0;
    this.costT = 0;
    this._done = false;
  }

  // the PA and the objective bar would sit on top of the dial
  onEnter() { document.body.classList.add("no-objective", "in-puzzle"); }
  onExit() { document.body.classList.remove("no-objective", "in-puzzle"); }

  _finish(result) {
    if (this._done) return;
    this._done = true;
    this.onResult(result);
  }

  update(dt, input) {
    this._t += dt;
    this.hud.update(dt);
    this.shake = Math.max(0, this.shake - dt);
    this.costT = Math.max(0, this.costT - dt);
    if (this.opened > 0) {
      this.opened -= dt;
      if (this.opened <= 0) this._finish({ success: true, aborted: false });
      return;
    }
    if (input.wasPressed("pause") || input.wasPressed("back")) { this._finish({ success: false, aborted: true }); return; }
    if (input.wasPressed("left")) { this.pos = (this.pos + 3) % 4; this.sfx.play("select"); }
    if (input.wasPressed("right")) { this.pos = (this.pos + 1) % 4; this.sfx.play("select"); }
    if (input.wasPressed("up")) { this.digits[this.pos] = (this.digits[this.pos] + 1) % 10; this.sfx.play("blip"); }
    if (input.wasPressed("down")) { this.digits[this.pos] = (this.digits[this.pos] + 9) % 10; this.sfx.play("blip"); }
    if (input.wasPressed("submit")) this._try(); // only Enter commits: Space must never cost time
  }

  _try() {
    if (this.digits.join("") === this.safe.code) {
      this.opened = OPEN_TIME;
      this.sfx.play("success");
      this.fx.flash("#ffd15a");
      return;
    }
    this.shake = 0.4;
    this.sfx.play("denied");
    penalize(WRONG_PENALTY);
    this.cost = scaledPenalty(WRONG_PENALTY);
    this.costT = 1.6;
  }

  render(renderer) {
    const w = renderer.width, h = renderer.height;
    const ctx = renderer.ctx;
    renderer.fillRect(0, 0, w, h, "rgba(0,0,0,0.7)");
    const sx = this.shake > 0 ? Math.round(Math.sin(this._t * 80) * 3) : 0;
    const bw = 280, bh = 196;
    const bx = (w - bw) / 2 + sx, by = 58;
    renderer.fillRect(bx, by, bw, bh, "#2a2e36");
    renderer.strokeRect(bx, by, bw, bh, "#0a0812", 2);
    renderer.fillRect(bx + 4, by + 4, bw - 8, 4, "#5a606a");
    renderer.text(this.safe.title, w / 2 + sx, by + 17, { color: "#e8eef4", size: 10, align: "center", baseline: "middle", weight: "bold" });

    // the riddle: a note taped above the dial, or a line engraved in a brass plate
    const engraved = !!this.safe.engraved;
    ctx.font = `${engraved ? "bold" : "normal"} 8px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
    const lines = wrap(ctx, t(this.safe.riddle), bw - 44).slice(0, 3);
    const nx = bx + 16, ny = by + 27, nw = bw - 32, nh = lines.length * 10 + 8;
    if (engraved) {
      renderer.fillRect(nx, ny, nw, nh, "#9a7e3a");
      renderer.strokeRect(nx + 1, ny + 1, nw - 2, nh - 2, "#5a4618", 1);
    } else {
      renderer.fillRect(nx, ny, nw, nh, "#e4d9a6");
      renderer.fillRect(nx + 8, ny - 2, 14, 4, "rgba(220,230,240,0.55)");
      renderer.fillRect(nx + nw - 22, ny - 2, 14, 4, "rgba(220,230,240,0.55)");
    }
    lines.forEach((line, i) => renderer.text(line, w / 2 + sx, ny + 9 + i * 10, {
      color: engraved ? "#20180a" : "#2a2216", size: 8, align: "center", baseline: "middle", weight: engraved ? "bold" : "normal",
    }));

    for (let i = 0; i < 4; i++) {
      const dx = w / 2 + sx - 82 + i * 42, dy = by + 80;
      const sel = i === this.pos && this.opened <= 0;
      renderer.fillRect(dx, dy, 34, 50, "#0a0c10");
      renderer.strokeRect(dx, dy, 34, 50, sel ? "#ffd15a" : "#4a4e56", sel ? 2 : 1);
      renderer.text(String((this.digits[i] + 9) % 10), dx + 17, dy + 9, { color: "#3a3e46", size: 9, align: "center", baseline: "middle" });
      renderer.text(String(this.digits[i]), dx + 17, dy + 25, { color: this.opened > 0 ? "#0aff7a" : "#ffffff", size: 18, align: "center", baseline: "middle", weight: "bold" });
      renderer.text(String((this.digits[i] + 1) % 10), dx + 17, dy + 42, { color: "#3a3e46", size: 9, align: "center", baseline: "middle" });
      if (sel) {
        renderer.text("▲", dx + 17, dy - 7, { color: "#ffd15a", size: 8, align: "center", baseline: "middle" });
        renderer.text("▼", dx + 17, dy + 57, { color: "#ffd15a", size: 8, align: "center", baseline: "middle" });
      }
    }
    const status = this.opened > 0 ? "CLICK. The door swings open." : this.costT > 0 ? `Wrong combination. (-${this.cost}s)` : "Set the dials, then press Enter.";
    renderer.text(status, w / 2 + sx, by + 156, { color: this.opened > 0 ? "#0aff7a" : this.costT > 0 ? "#ff5a5a" : "#a8b0bc", size: 8, align: "center", baseline: "middle" });
    renderer.text("[←→] digit  [↑↓] turn  [enter] try  [h] hint  [esc] leave", w / 2, by + 180, { color: "#6a707a", size: 7, align: "center", baseline: "middle" });
  }
}

function wrap(ctx, text, maxW) {
  const out = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out;
}
