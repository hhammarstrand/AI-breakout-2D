import { gameState } from "../state.js";
import { Menu } from "./menu.js";

export class PauseScene {
  constructor({ sfx, onToggleSfx, onQuit }) {
    this._t = 0;
    this.menu = new Menu([
      { label: "RESUME", action: () => this.game.pop() },
      { label: () => `SOUND: ${gameState.sfxOn ? "ON" : "OFF"}`, action: onToggleSfx },
      { label: "SAVE & QUIT TO TITLE", action: onQuit },
    ], sfx);
  }

  update(dt, input) {
    this._t += dt;
    if (input.wasPressed("pause")) { this.game.pop(); return; }
    this.menu.update(input);
  }

  render(renderer) {
    const w = renderer.width;
    const h = renderer.height;
    renderer.fillRect(0, 0, w, h, "rgba(0, 0, 0, 0.72)");

    const bw = 200, bh = 100;
    const x = w / 2 - bw / 2, y = h / 2 - bh / 2;
    renderer.fillRect(x, y, bw, bh, "#031a0d");
    renderer.strokeRect(x, y, bw, bh, "#0aff7a", 1);
    renderer.strokeRect(x + 3, y + 3, bw - 6, bh - 6, "#0a4a2a", 1);
    renderer.fillRect(x, y, bw, 18, "#0aff7a");
    renderer.text("■ SYSTEM PAUSED", x + 8, y + 9, {
      color: "#000", size: 10, baseline: "middle", weight: "bold",
    });

    this.menu.draw(renderer, w / 2, y + 40, this._t);
  }
}
