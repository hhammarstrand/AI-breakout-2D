import { gameState } from "../state.js";
import { ACTS } from "../story.js";
import { t } from "../i18n/index.js";
import { music } from "../audio/music.js";
import { Menu } from "./menu.js";

// Running out of time restarts the stage in hand. The state (and the save on disk) is already the
// stage retry when this opens; RESTART ACT is offered only when it would differ, i.e. when stages
// were cleared since the lift. retry: { act, stage, seconds, actSeconds, kept: [labels] }
export class GameOverScene {
  constructor({ onRetry, onRestartAct, onQuit, sfx, stats, retry }) {
    this._t = 0;
    this.stats = stats ?? { cleared: gameState.completedSectors, score: gameState.score };
    this.retry = retry;
    const items = [{ label: `RETRY ${retry.stage.label} — ${clock(retry.seconds)}`, action: onRetry }];
    if (retry.kept.length && onRestartAct) items.push({ label: `RESTART ACT — ${clock(retry.actSeconds)}`, action: onRestartAct });
    items.push({ label: "QUIT TO TITLE", action: onQuit });
    this.menu = new Menu(items, sfx);
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
      const jitter = !gameState.calmFx && Math.random() < 0.03 ? Math.random() * 20 - 10 : 0;
      renderer.fillRect(jitter, y, w, 1, "rgba(255,40,40,0.06)");
    }

    const r = this.retry;
    const shake = !gameState.calmFx && this._t < 0.6 ? (Math.random() * 6 - 3) : 0;
    renderer.text("PURGE COMPLETE", w / 2 + shake, 66, {
      color: "#ff5a5a", size: 24, align: "center", baseline: "middle", weight: "bold",
    });
    renderer.text(`HALCYON sealed ${ACTS[r.act].purge}. Nobody walked out.`, w / 2, 94, {
      color: "#ffaaaa", size: 9, align: "center", baseline: "middle",
    });
    // labels are padded after translation, so the values line up in either language
    const rows = [["STAGES CLEARED", `${this.stats.cleared}/${gameState.totalSectors}`], ["FINAL SCORE", `${this.stats.score}`]];
    const pad = Math.max(...rows.map(([l]) => t(l).length)) + 3;
    const lines = rows.map(([l, v]) => t(l).padEnd(pad) + v);
    renderer.ctx.font = "normal 10px ui-monospace, \"SF Mono\", Menlo, Consolas, monospace";
    const lx = w / 2 - Math.max(...lines.map((s) => renderer.ctx.measureText(s).width)) / 2;
    lines.forEach((s, i) => renderer.text(s, lx, 116 + i * 14, { color: "#cffcff", size: 10, baseline: "middle" }));
    // what the retry keeps, so a timeout never reads like losing the whole act
    const kept = r.kept.length
      ? `Kept: ${r.kept.join(", ")} stay cleared, with the logs, items and cells you found.`
      : "Kept: the logs, items and cells you found.";
    const lost = r.stage.lift ? "Lost: nothing else. The lift is still open." : `Lost: your progress inside ${r.stage.label}.`;
    renderer.text(kept, w / 2, 154, { color: "#0aff7a", size: 8, align: "center", baseline: "middle" });
    renderer.text(lost, w / 2, 167, { color: "#ffaaaa", size: 8, align: "center", baseline: "middle" });
    if (this._t > 1.2) this.menu.draw(renderer, w / 2, 198, this._t);
  }
}

function clock(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
