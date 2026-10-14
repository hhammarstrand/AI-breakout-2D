import { Menu } from "./menu.js";

// One pause rule for the whole game: the purge clock only runs while you can act on the world or
// a puzzle. Menus, this overlay, conversations, briefings, field notes and hints stop it; anything
// that stops it hides what it covers, so reading can't be used to solve for free.

// Small "‖ CLOCK PAUSED" tag for overlays that stop the clock.
export function drawClockPaused(renderer, x, y, align = "right") {
  renderer.text("‖ CLOCK PAUSED", x, y, { color: "#ffd15a", size: 7, align, baseline: "middle", weight: "bold" });
}

// Pushed when the window loses focus, or by a scene that needs a real pause (the C1 run).
// onAbort adds a second entry that leaves the scene underneath.
export class PauseScene {
  constructor({ sfx, onAbort = null, abortLabel = "LEAVE" }) {
    this.sfx = sfx;
    this._t = 0;
    const items = [{ label: "RESUME", action: () => this._resume() }];
    if (onAbort) items.push({ label: abortLabel, action: () => { this.game.pop(); onAbort(); } });
    this.menu = new Menu(items, sfx);
    sfx.play("menu");
  }

  _resume() { this.sfx.play("select"); this.game.pop(); }

  update(dt, input) {
    this._t += dt;
    if (this._t < 0.15) return; // the key that paused can't also resume
    if (input.wasPressed("pause") || input.wasPressed("back") || input.wasPressed("menu")) { this._resume(); return; }
    this.menu.update(input);
  }

  render(renderer) {
    const w = renderer.width, h = renderer.height;
    renderer.fillRect(0, 0, w, h, "rgba(0,0,0,0.88)");
    const bw = 220, bh = 66 + this.menu.items.length * 16, bx = (w - bw) / 2, by = (h - bh) / 2;
    renderer.fillRect(bx, by, bw, bh, "#03140b");
    renderer.strokeRect(bx, by, bw, bh, "#ffd15a", 2);
    renderer.text("‖ PAUSED", w / 2, by + 18, { color: "#ffd15a", size: 14, align: "center", baseline: "middle", weight: "bold" });
    renderer.text("The purge clock is stopped.", w / 2, by + 36, { color: "#cffcff", size: 8, align: "center", baseline: "middle" });
    this.menu.draw(renderer, w / 2, by + 56, this._t);
  }
}
