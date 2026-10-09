import { gameState } from "../state.js";
import { music } from "../audio/music.js";

export class GameOverScene {
  constructor({ onRestart, sfx }) {
    this.onRestart = onRestart;
    this._t = 0;
    sfx.play("gameover");
    music.stop();
  }

  onEnter() { document.body.classList.add("no-objective"); }
  onExit() { document.body.classList.remove("no-objective"); }

  update(dt, input) {
    this._t += dt;
    if (this._t > 1.2 && (input.wasPressed("submit") || input.wasPressed("interact"))) this.onRestart();
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
    renderer.text(`SECTORS CLEARED  ${gameState.completedSectors}/${gameState.totalSectors}`, w / 2, h / 2 + 14, {
      color: "#cffcff", size: 10, align: "center", baseline: "middle",
    });
    renderer.text(`FINAL SCORE      ${gameState.score}`, w / 2, h / 2 + 28, {
      color: "#cffcff", size: 10, align: "center", baseline: "middle",
    });
    if (this._t > 1.2 && (Math.floor(this._t * 2) & 1)) {
      renderer.text("[ ENTER ] REBOOT", w / 2, h / 2 + 64, {
        color: "#ff5a5a", size: 11, align: "center", baseline: "middle", weight: "bold",
      });
    }
  }
}
