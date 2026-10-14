import { gameState, currentAct } from "../state.js";
import { ACTS } from "../story.js";
import { t } from "../i18n/index.js";
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
    // the state is back at this act's checkpoint, so currentAct() is the floor that was purged
    renderer.text(`HALCYON sealed ${ACTS[currentAct()].purge}. Nobody walked out.`, w / 2, h / 2 - 12, {
      color: "#ffaaaa", size: 9, align: "center", baseline: "middle",
    });
    // labels are padded after translation, so the values line up in either language
    const rows = [["STAGES CLEARED", `${this.stats.cleared}/${gameState.totalSectors}`], ["FINAL SCORE", `${this.stats.score}`]];
    const pad = Math.max(...rows.map(([l]) => t(l).length)) + 3;
    const lines = rows.map(([l, v]) => t(l).padEnd(pad) + v);
    renderer.ctx.font = "normal 10px ui-monospace, \"SF Mono\", Menlo, Consolas, monospace";
    const x = w / 2 - Math.max(...lines.map((s) => renderer.ctx.measureText(s).width)) / 2;
    lines.forEach((s, i) => renderer.text(s, x, h / 2 + 14 + i * 14, { color: "#cffcff", size: 10, baseline: "middle" }));
    if (this._t > 1.2) this.menu.draw(renderer, w / 2, h / 2 + 62, this._t);
  }
}
