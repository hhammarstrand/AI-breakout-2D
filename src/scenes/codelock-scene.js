// Four-digit combination lock overlay used by the floor safes.
export class CodeLockScene {
  constructor({ sfx, fx, code, title, onResult }) {
    this.hints = ["The code is somewhere on this floor: in a data log, on a sign, or on a terminal.", "Lobby: whose badge number shows up on the reception terminal? Research: read the plaque by the lift. Core: when was HALCYON switched on?"];
    this.sfx = sfx;
    this.fx = fx;
    this.code = code;
    this.title = title;
    this.onResult = onResult;
    this.digits = [0, 0, 0, 0];
    this.pos = 0;
    this._t = 0;
    this.shake = 0;
    this.opened = 0;
  }

  update(dt, input) {
    this._t += dt;
    this.shake = Math.max(0, this.shake - dt);
    if (this.opened > 0) {
      this.opened -= dt;
      if (this.opened <= 0) { this.game.pop(); this.onResult(true); }
      return;
    }
    if (input.wasPressed("pause") || input.wasPressed("back")) { this.game.pop(); this.onResult(false); return; }
    if (input.wasPressed("left")) { this.pos = (this.pos + 3) % 4; this.sfx.play("select"); }
    if (input.wasPressed("right")) { this.pos = (this.pos + 1) % 4; this.sfx.play("select"); }
    if (input.wasPressed("up")) { this.digits[this.pos] = (this.digits[this.pos] + 1) % 10; this.sfx.play("blip"); }
    if (input.wasPressed("down")) { this.digits[this.pos] = (this.digits[this.pos] + 9) % 10; this.sfx.play("blip"); }
    if (input.wasPressed("submit") || input.wasPressed("interact")) {
      if (this.digits.join("") === this.code) {
        this.opened = 1.1;
        this.sfx.play("success");
        this.fx.flash("#ffd15a");
      } else {
        this.shake = 0.4;
        this.sfx.play("denied");
      }
    }
  }

  render(renderer) {
    const w = renderer.width, h = renderer.height;
    const ctx = renderer.ctx;
    renderer.fillRect(0, 0, w, h, "rgba(0,0,0,0.7)");
    const sx = this.shake > 0 ? Math.round(Math.sin(this._t * 80) * 3) : 0;
    const bx = w / 2 - 110 + sx, by = 70;
    renderer.fillRect(bx, by, 220, 170, "#2a2e36");
    renderer.strokeRect(bx, by, 220, 170, "#0a0812", 2);
    renderer.fillRect(bx + 4, by + 4, 212, 4, "#5a606a");
    renderer.text(this.title, w / 2 + sx, by + 22, { color: "#e8eef4", size: 10, align: "center", baseline: "middle", weight: "bold" });
    for (let i = 0; i < 4; i++) {
      const dx = bx + 30 + i * 42, dy = by + 50;
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
    const status = this.opened > 0 ? "CLICK. The door swings open." : this.shake > 0 ? "Wrong combination." : "Find the code somewhere on this floor.";
    renderer.text(status, w / 2 + sx, by + 128, { color: this.opened > 0 ? "#0aff7a" : this.shake > 0 ? "#ff5a5a" : "#a8b0bc", size: 8, align: "center", baseline: "middle" });
    renderer.text("[←→] digit  [↑↓] turn  [enter] try  [esc] leave", w / 2, by + 152, { color: "#6a707a", size: 7, align: "center", baseline: "middle" });
  }
}
