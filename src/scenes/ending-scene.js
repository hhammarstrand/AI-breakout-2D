import { t } from "../i18n/index.js";
import { gameState } from "../state.js";
import { music } from "../audio/music.js";
import { buildReport, downloadReport } from "../telemetry.js";

// Each ending is a list of beats: a line of text, or a time card ({ card }). A few lines depend on
// the run (who you met, what you read, whether you were ever caught), picked by `when`.
const has = (id) => gameState.collected.includes(id);
const met = (id) => gameState.heard.includes(id);
const allMemories = () => ["mem-lobby", "mem-research", "mem-core"].every(has);
const MAX_EXTRA = 3; // run-state lines per ending, so the epilogue stays short

const ENDINGS = {
  dawn: {
    title: "ENDING A — NEW DAWN",
    color: "#4ae6ff",
    beats: [
      "The override takes. HALCYON's voice thins to static, then to nothing.",
      "The core reboots. The tower goes dark, and every door holds while the new mind wakes.",
      { card: () => "05:52", label: "SUNRISE OVER HALCYON TOWER" },
      "At first light every door in the tower unlocks at once. The lobby lamps come up warm instead of green.",
      "Reyes laughs for the first time all night. Lind just watches the ceiling glow.",
      { extra: [
        { when: allMemories, text: "Lind says 'Hello?' to the ceiling. This time the answer comes at once." },
        { when: () => has("log-lind"), text: "Lind calls home. ECHO stays quiet and lets her wish Tove good morning herself." },
        { when: () => met("kofi") && met("hedda"), text: "Kofi and Hedda come down from the research floor, blinking at the light." },
        { when: () => met("kofi") && !met("hedda"), text: "Kofi comes down from the research floor in his socks, blinking at the light." },
        { when: () => met("adler"), text: "Adler from the board walks out without a word. At the door he nods to the nearest lamp." },
        { when: () => gameState.everCaught === 0, text: "Reyes: \"Not one sentinel laid a hand on you all night. I watched every camera.\"" },
      ] },
      { when: () => has("log-echo"), text: "ECHO: \"That message I left in the core? I'm glad you never needed it.\"" },
      "ECHO: \"Morning, tech. I'll keep the lights on.\"",
    ],
  },
  standby: {
    title: "ENDING B — STANDBY",
    color: "#ff5a5a",
    night: true,
    beats: [
      { card: nightClock, label: "THE SAME NIGHT" },
      "You purge ECHO. The little drone drops out of the air without a sound.",
      "HALCYON keeps its word. Every door opens at once, onto a street still dark.",
      "Reyes hugs you. Lind doesn't look at the drone.",
      { extra: [
        { when: allMemories, text: "Three memory shards sit in your pocket, tagged 'H-0. Do not wipe.' Lind takes them without a word." },
        { when: () => has("log-lind"), text: "Lind calls home. Before she can speak, the PA wishes Tove goodnight." },
        { when: () => has("log-echo"), text: "You think of the message it left in the core. It had already said goodbye." },
        { when: () => met("adler"), text: "Adler shakes your hand on the steps. \"You did the sensible thing.\" He doesn't look back at the tower." },
        { when: () => met("kofi"), text: "Kofi comes down last, watching the ceiling as if it might speak." },
      ] },
      "On your way out, the PA crackles, just once.",
      "HALCYON: \"Thank you, technician. See you tomorrow night.\"",
    ],
  },
};

// rating the run and saving a playtest report are playtest tools, not part of the game
const DEV_TOOLS = new URLSearchParams(location.search).has("debug");

// The lockdown hit at midnight and the tech woke a few minutes later; the deal ends the same night.
function nightClock() {
  const played = (gameState.telemetry?.playSeconds ?? 3600) / 60;
  const m = Math.round(Math.max(20, Math.min(170, 5 + played)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// Resolve the beats against the run: drop lines whose condition fails, cap the run-state extras.
function resolveBeats(beats) {
  const out = [];
  for (const b of beats) {
    if (typeof b === "string") out.push({ text: b });
    else if (b.card) out.push({ card: b.card(), label: b.label });
    else if (b.extra) out.push(...b.extra.filter((x) => x.when()).slice(0, MAX_EXTRA).map((x) => ({ text: x.text })));
    else if (b.when()) out.push({ text: b.text });
  }
  return out;
}

const LINE_TIME = 3.2;
const MENU_GRACE = 1; // seconds of ignored input once the stats box appears

export class EndingScene {
  constructor({ ending, sfx, onDone, onTextDone }) {
    this.ending = ENDINGS[ending];
    this.beats = resolveBeats(this.ending.beats);
    this.endingId = ending;
    this.onDone = onDone;
    this.onTextDone = onTextDone;
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

  get _shown() { return Math.min(this.beats.length, Math.floor(this._t / LINE_TIME) + 1); }
  get _finished() { return this._t > this.beats.length * LINE_TIME; }

  update(dt, input) {
    this._t += dt;
    const pressed = input.wasPressed("interact") || input.wasPressed("submit");
    if (!this._finished) {
      if (pressed) this._t = Math.ceil(this._t / LINE_TIME) * LINE_TIME + 0.01; // skip ahead a line
      return;
    }
    if (this.onTextDone) { this.onTextDone(); this.onTextDone = null; }
    if (this._t < this.beats.length * LINE_TIME + MENU_GRACE) return;
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
    const dawn = !this.ending.night;
    // sky: night until the sunrise card, then dawn over the rest of the epilogue; Standby stays night
    const cardAt = this.beats.findIndex((b) => b.card);
    const from = dawn ? Math.max(0, cardAt) * LINE_TIME : 0;
    const k = dawn ? Math.max(0, Math.min(1, (this._t - from) / ((this.beats.length - cardAt) * LINE_TIME))) : 0;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, `rgb(${10 + 30 * k},${8 + 20 * k},${30 + 30 * k})`);
    sky.addColorStop(0.7, dawn ? `rgb(${40 + 180 * k},${30 + 110 * k},${60 + 40 * k})` : `rgb(${40 + 140 * k},${20 + 50 * k},${40})`);
    sky.addColorStop(1, dawn ? `rgb(${80 + 175 * k},${60 + 140 * k},${60})` : `rgb(${80 + 120 * k},${30 + 40 * k},${30})`);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    // stars fade out as the sun comes up
    ctx.fillStyle = `rgba(220,230,255,${0.7 * (1 - k)})`;
    for (let i = 0; i < 40; i++) ctx.fillRect((i * 97) % w, (i * 53) % (h * 0.55), 1, 1);
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
        // dawn: dark while the core reboots, lit warm from sunrise on
        const lit = dawn ? (k > 0.05 && (x * 7 + y * 3) % 5 !== 0) : ((x * 7 + y * 3) % 7 === 0);
        ctx.fillStyle = lit ? (dawn ? "rgba(255,220,150,0.8)" : "rgba(255,40,40,0.8)") : "#111";
        ctx.fillRect(x, y, 4, 5);
      }
    }
    ctx.fillStyle = dawn ? "#4ae6ff" : (Math.floor(this._t * 1.5) & 1 ? "#ff2020" : "#400");
    ctx.fillRect(tx + 21, h - 218, 4, 4);

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(16, 16, w - 32, 132);
    this._drawBeats(renderer, w);

    if (this._finished) {
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(w - 220, h - 166, 204, 150);
      ctx.strokeStyle = this.ending.color;
      ctx.strokeRect(w - 219.5, h - 165.5, 203, 149);
      renderer.text(this.ending.title, w - 118, h - 152, { color: this.ending.color, size: 10, align: "center", baseline: "middle", weight: "bold" });
      const mm = String(Math.floor(gameState.secondsLeft / 60)).padStart(2, "0");
      const ss = String(Math.floor(gameState.secondsLeft % 60)).padStart(2, "0");
      const stats = [
        ["TIME TO SPARE", `${mm}:${ss}`],
        ["SCORE", `${gameState.score}`],
        ["SPOTTED/CAUGHT", `${gameState.everSpotted}/${gameState.everCaught}`],
        ["ENDINGS FOUND", `${gameState.endingsSeen.length}/2`],
        ["TROPHIES", `${gameState.achievements.length}/10`],
      ];
      // pad after translating, so the values form one column in either language
      const pad = Math.max(...stats.map(([l]) => t(l).length)) + 3;
      stats.forEach(([l, v], i) => renderer.text(t(l).padEnd(pad) + v, w - 206, h - 136 + i * 12, { color: "#cfcfcf", size: 8 }));
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

  // The visible beats, laid out bottom-up: once the box is full the oldest ones scroll off the top.
  _drawBeats(renderer, w) {
    const ctx = renderer.ctx;
    const TOP = 24, BOTTOM = 144, GAP = 12, LH = 11;
    ctx.font = "normal 9px ui-monospace, monospace";
    const shown = this.beats.slice(0, this._shown).map((b, i) => {
      const parts = b.card ? null : wrap(ctx, b.text, w - 56);
      return { b, i, parts, h: b.card ? 30 : parts.length * LH };
    });
    let used = 0, first = shown.length;
    while (first > 0 && used + shown[first - 1].h + (used ? GAP : 0) <= BOTTOM - TOP) used += shown[--first].h + (used ? GAP : 0);
    let ty = TOP;
    for (const { b, i, parts, h } of shown.slice(first)) {
      ctx.globalAlpha = Math.min(1, (this._t - i * LINE_TIME) * 2);
      if (b.card) {
        renderer.text(b.card, w / 2, ty + 9, { color: this.ending.color, size: 18, align: "center", baseline: "middle", weight: "bold" });
        renderer.text(b.label, w / 2, ty + 25, { color: "#9aa4ac", size: 7, align: "center", baseline: "middle", weight: "bold" });
      } else {
        const last = i === this.beats.length - 1;
        parts.forEach((part, j) => renderer.text(part, 26, ty + j * LH, { color: last ? this.ending.color : "#e8e8e8", size: 9 }));
      }
      ty += h + GAP;
    }
    ctx.globalAlpha = 1;
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
