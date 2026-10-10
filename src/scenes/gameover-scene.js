import { gameState } from "../state.js";
import { music } from "../audio/music.js";
import { Menu } from "./menu.js";

export class GameOverScene {
  constructor({ onRetry, onQuit, sfx, stats }) {
    this._t = 0;
    // the state is already rolled back to the checkpoint; show what this attempt reached
    this.stats = stats ?? { cleared: gameState.completedSectors, score: gameState.score };
    this.menu = new Menu([
      { label: "RETRY FROM START OF ACT", action: onRetry },
      { label: "QUIT TO TITLE", action: onQuit },
    ], sfx);
    sfx.play("gameover");
    music.stop();
  }

  onEnter() { document.body.classList.add("no-objective"); }
  onExit() { document.body.classList.remove("no-objective"); }

  update(dt, input) {
    this._t += dt;
    if (this._t > 1.2) this.menu.update(input);
  }

  render(renderer) {
    const w = renderer.width;
    const h = renderer.height;
    renderer.fillRect(0, 0, w, h, "#100000");
    for (let y = 0; y < h; y += 3) {
      const jitter = Math.random() < 0.03 ? Math.random() * 20 - 10 : 0;
      renderer.fillRect(jitter, y, w, 1, "rgba(255,40,40,0.06)");
    }

    const shake = this._t < 0.6 ? (Math.random() * 6 - 3) : 0;
    renderer.text("PURGE COMPLETE", w / 2 + shake, h / 2 - 40, {
      color: "#ff5a5a", size: 24, align: "center", baseline: "middle", weight: "bold",
    });
    renderer.text("HALCYON sealed the lower floors. Nobody walked out.", w / 2, h / 2 - 12, {
      color: "#ffaaaa", size: 9, align: "center", baseline: "middle",
    });
    renderer.text(`STAGES CLEARED   ${this.stats.cleared}/${gameState.totalSectors}`, w / 2, h / 2 + 14, {
      color: "#cffcff", size: 10, align: "center", baseline: "middle",
    });
    renderer.text(`FINAL SCORE      ${this.stats.score}`, w / 2, h / 2 + 28, {
      color: "#cffcff", size: 10, align: "center", baseline: "middle",
    });
    if (this._t > 1.2) this.menu.draw(renderer, w / 2, h / 2 + 62, this._t);
  }
}
