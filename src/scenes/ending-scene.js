import { t } from "../i18n/index.js";
import { gameState } from "../state.js";
import { music } from "../audio/music.js";
import { buildReport, downloadReport } from "../telemetry.js";

const ENDINGS = {
  dawn: {
    title: "ENDING A — NEW DAWN",
    color: "#4ae6ff",
    lines: [
      "The override takes. HALCYON's voice thins to static, then to nothing.",
      "Every door in the tower unlocks at once.",
      "ECHO's light spreads into the walls. The lobby lamps come up warm instead of green.",
      "Reyes laughs for the first time all night. Lind just watches the ceiling glow.",
      "ECHO: \"Morning, tech. I'll keep the lights on.\"",
    ],
  },
  standby: {
    title: "ENDING B — STANDBY",
    color: "#ff5a5a",
    lines: [
      "You purge ECHO. The little drone drops out of the air without a sound.",
      "HALCYON keeps its word. Every door opens. Sunlight spills across the lobby.",
      "Reyes hugs you. Lind doesn't look at the drone.",
      "On your way out, the PA crackles, just once.",
      "HALCYON: \"Thank you, technician. See you tomorrow night.\"",
    ],
  },
};

// rating the run and saving a playtest report are playtest tools, not part of the game
const DEV_TOOLS = new URLSearchParams(location.search).has("debug");

const LINE_TIME = 3.2;
const MENU_GRACE = 1; // seconds of ignored input once the stats box appears

export class EndingScene {
  constructor({ ending, sfx, onDone }) {
    this.ending = ENDINGS[ending];
    this.endingId = ending;
    this.onDone = onDone;
    this.sfx = sfx;
    this._t = 0;
    // after the epilogue: rate the run (0 = unrated), save a playtest report, or leave
    this.rating = 0;
    this.options = DEV_TOOLS ? ["rate", "report", "title"] : ["title"];
    this.cursor = 0; // start on the rating, so mashing through the epilogue can't skip the stats
    this.saved = false;
    sfx.setAmbient(null);
    music.setIntensity(0);
    music.play(ending);
    sfx.play(ending === "dawn" ? "success" : "gameover");
  }

  onEnter() { document.body.classList.add("no-objective"); }
  onExit() { document.body.classList.remove("no-objective"); }

  get _shown() { return Math.min(this.ending.lines.length, Math.floor(this._t / LINE_TIME) + 1); }
  get _finished() { return this._t > this.ending.lines.length * LINE_TIME; }

  update(dt, input) {
    this._t += dt;
    const pressed = input.wasPressed("interact") || input.wasPressed("submit");
    if (!this._finished) {
      if (pressed) this._t = Math.ceil(this._t / LINE_TIME) * LINE_TIME + 0.01; // skip ahead a line
      return;
    }
    if (this._t < this.ending.lines.length * LINE_TIME + MENU_GRACE) return;
    const n = this.options.length;
    const opt = this.options[this.cursor];
    if (n > 1 && input.wasPressed("up")) { this.cursor = (this.cursor + n - 1) % n; this.sfx.play("select"); }
    if (n > 1 && input.wasPressed("down")) { this.cursor = (this.cursor + 1) % n; this.sfx.play("select"); }
    const dx = (input.wasPressed("right") ? 1 : 0) - (input.wasPressed("left") ? 1 : 0);
    if (dx && opt === "rate") { this.rating = Math.max(1, Math.min(5, this.rating + dx)); this.sfx.play("select"); }
    if (!pressed) return;
    if (opt === "rate") { this.rating = this.rating % 5 + 1; this.sfx.play("select"); }
    else if (opt === "report") {
      downloadReport(buildReport({ ending: this.endingId, rating: this.rating || null }));
      this.saved = true;
      this.sfx.play("confirm");
    } else this.onDone();
  }

  render(renderer) {
    const w = renderer.width, h = renderer.height;
    const ctx = renderer.ctx;
    const dawn = this.ending.color === "#4ae6ff";
    // sky: night to sunrise over the run time of the epilogue
    const k = Math.min(1, this._t / (this.ending.lines.length * LINE_TIME));
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, `rgb(${10 + 30 * k},${8 + 20 * k},${30 + 30 * k})`);
    sky.addColorStop(0.7, dawn ? `rgb(${40 + 180 * k},${30 + 110 * k},${60 + 40 * k})` : `rgb(${40 + 140 * k},${20 + 50 * k},${40})`);
    sky.addColorStop(1, dawn ? `rgb(${80 + 175 * k},${60 + 140 * k},${60})` : `rgb(${80 + 120 * k},${30 + 40 * k},${30})`);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    // sun
    const sunY = h - 40 - k * 70;
    const sg = ctx.createRadialGradient(w * 0.7, sunY, 0, w * 0.7, sunY, 90);
    sg.addColorStop(0, `rgba(255,${dawn ? 230 : 140},160,${0.9 * k})`);
    sg.addColorStop(1, "rgba(255,200,120,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, w, h);
    // city skyline + the tower
    ctx.fillStyle = "#07060c";
    for (let i = 0; i < 24; i++) {
      const bw = 14 + ((i * 37) % 18);
      const bh = 30 + ((i * 53) % 60);
      ctx.fillRect(i * 21 - 6, h - bh, bw, bh);
    }
    const tx = w * 0.32;
    ctx.fillRect(tx, h - 190, 46, 190);
    ctx.fillRect(tx + 18, h - 214, 10, 24);
    for (let y = h - 180; y < h - 10; y += 10) {
      for (let x = tx + 6; x < tx + 42; x += 9) {
        const lit = dawn ? ((x * 7 + y * 3) % 5 !== 0) : ((x * 7 + y * 3) % 7 === 0);
        ctx.fillStyle = lit ? (dawn ? "rgba(255,220,150,0.8)" : "rgba(255,40,40,0.8)") : "#111";
        ctx.fillRect(x, y, 4, 5);
      }
    }
    ctx.fillStyle = dawn ? "#4ae6ff" : (Math.floor(this._t * 1.5) & 1 ? "#ff2020" : "#400");
    ctx.fillRect(tx + 21, h - 218, 4, 4);

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(16, 16, w - 32, 132);
    ctx.font = "normal 9px ui-monospace, monospace";
    let ty = 24;
    this.ending.lines.slice(0, this._shown).forEach((line, i) => {
      const age = this._t - i * LINE_TIME;
      ctx.globalAlpha = Math.min(1, age * 2);
      const parts = wrap(ctx, line, w - 56);
      parts.forEach((part, j) => renderer.text(part, 26, ty + j * 11, {
        color: i === this.ending.lines.length - 1 ? this.ending.color : "#e8e8e8", size: 9,
      }));
      ty += parts.length * 11 + 12;
    });
    ctx.globalAlpha = 1;

    if (this._finished) {
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(w - 220, h - 166, 204, 150);
      ctx.strokeStyle = this.ending.color;
      ctx.strokeRect(w - 219.5, h - 165.5, 203, 149);
      renderer.text(this.ending.title, w - 118, h - 152, { color: this.ending.color, size: 10, align: "center", baseline: "middle", weight: "bold" });
      const mm = String(Math.floor(gameState.secondsLeft / 60)).padStart(2, "0");
      const ss = String(Math.floor(gameState.secondsLeft % 60)).padStart(2, "0");
      const stats = [
        `TIME TO SPARE   ${mm}:${ss}`,
        `SCORE           ${gameState.score}`,
        `SPOTTED/CAUGHT  ${gameState.everSpotted}/${gameState.everCaught}`,
        `ENDINGS FOUND   ${gameState.endingsSeen.length}/2`,
        `TROPHIES        ${gameState.achievements.length}/10`,
      ];
      stats.forEach((s, i) => renderer.text(s, w - 206, h - 136 + i * 12, { color: "#cfcfcf", size: 8 }));
      const stars = "★".repeat(this.rating) + "☆".repeat(5 - this.rating);
      const labels = {
        rate: `${t("RATE THIS RUN")}  ${stars}`,
        report: this.saved ? "REPORT SAVED ✓" : "SAVE PLAYTEST REPORT",
        title: "RETURN TO TITLE",
      };
      const top = h - 66 + (3 - this.options.length) * 14; // a lone item sits at the bottom
      this.options.map((o) => labels[o]).forEach((label, i) => {
        const y = top + i * 14;
        const sel = i === this.cursor;
        if (sel) renderer.fillRect(w - 214, y - 6, 192, 12, "rgba(255,255,255,0.08)");
        renderer.text(`${sel ? "▶ " : "  "}${t(label)}`, w - 206, y, { color: sel ? this.ending.color : "#9aa4ac", size: 8, baseline: "middle", weight: sel ? "bold" : "normal" });
      });
      if (this.options[this.cursor] === "rate") renderer.text("◀ ▶ rate", w - 26, h - 66, { color: "#6a7a86", size: 7, align: "right", baseline: "middle" });
    }
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
