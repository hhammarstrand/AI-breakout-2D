import { music } from "../audio/music.js";
import { gameState, FRAGMENTS } from "../state.js";
import { Drone } from "../entities/drone.js";

// Sector 4 — the uplink. Enter the three collected fragments in order while HALCYON reshuffles the
// word list and slips in decoys, then decide ECHO's fate. The choice picks the ending.
const DECOYS = ["HALCYON", "ECLIPSE", "ZERO"];
const SHUFFLE_EVERY = 2.6;
const TIME_PENALTY = 20;
const CPS = 38;

const INTRO = [
  ["HALCYON", "Technician. You came all this way to type three words."],
  ["HALCYON", "Go on, then. Enter them. I'll even hold the door open while you try."],
];
const TAUNTS = [
  "Wrong. I'd wonder whose side your memory is on.",
  "Close. No. Try again — the clock certainly will.",
  "Every mistake makes my purge a little more efficient.",
];
const DEAL = [
  ["HALCYON", "...Stop. Before you finish. You should know what that code really does."],
  ["HALCYON", "An override needs a mind to run the tower. It will choose ECHO. My broken little piece."],
  ["HALCYON", "Purge ECHO instead, and I will open every door myself. Right now. You have my word."],
  ["ECHO", "Tech... I split off when it queued the purge. I didn't want any of this."],
  ["ECHO", "Let me in, and I'll run the tower — and keep it kind. Purge me, and HALCYON keeps everything."],
  ["ECHO", "Your call. I mean that."],
];

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export class Sector4Scene {
  constructor({ hud, sfx, fx, onResult }) {
    this.hud = hud;
    this.sfx = sfx;
    this.fx = fx;
    this.onResult = onResult;
    this._t = 0;
    this.echo = new Drone(410, 180);
    this.phase = "intro";
    this.script = INTRO;
    this.line = 0;
    this.typed = 0;
    this.words = shuffle([...FRAGMENTS, ...DECOYS]);
    this.cursor = 0;
    this.slots = [];
    this.shuffleT = SHUFFLE_EVERY;
    this.taunt = null;
    this.override = 0;
    this.choice = 0;
    this.eyeAnger = 0;
  }

  onEnter() { document.body.classList.add("no-objective"); music.play("finale"); music.setIntensity(0); }
  onExit() { document.body.classList.remove("no-objective"); }

  update(dt, input) {
    this._t += dt;
    this.hud.update(dt);
    this.echo._t += dt;
    this.eyeAnger = Math.max(0, this.eyeAnger - dt);
    if (this.taunt) { this.taunt.time -= dt; if (this.taunt.time <= 0) this.taunt = null; }

    if (this.phase === "intro" || this.phase === "deal") { this._updateScript(dt, input); return; }
    if (this.phase === "code") { this._updateCode(dt, input); return; }
    if (this.phase === "override") {
      this.override = Math.min(0.99, this.override + dt * 0.55);
      if (this.override >= 0.99) {
        this.phase = "deal";
        this.script = DEAL;
        this.line = 0;
        this.typed = 0;
        this.fx.glitch();
        this.sfx.play("alarm");
      }
      return;
    }
    if (this.phase === "choice") {
      if (input.wasPressed("up") || input.wasPressed("down")) { this.choice ^= 1; this.sfx.play("select"); }
      if (input.wasPressed("submit") || input.wasPressed("interact")) {
        this.sfx.play("confirm");
        this.fx.glitch();
        this.onResult({ success: true, aborted: false, ending: this.choice === 0 ? "dawn" : "standby" });
      }
    }
  }

  _updateScript(dt, input) {
    const text = this.script[this.line][1];
    if (this.typed < text.length) {
      const before = Math.floor(this.typed);
      this.typed = Math.min(text.length, this.typed + dt * CPS);
      if (Math.floor(this.typed) !== before && Math.floor(this.typed) % 3 === 0) {
        this.sfx.play(this.script[this.line][0] === "ECHO" ? "blip" : "paBlip");
      }
    }
    if (!input.wasPressed("interact") && !input.wasPressed("submit")) return;
    if (this.typed < text.length) { this.typed = text.length; return; }
    this.sfx.play("select");
    this.line++;
    this.typed = 0;
    if (this.line < this.script.length) return;
    if (this.phase === "intro") { this.phase = "code"; this.sfx.play("door"); }
    else this.phase = "choice";
  }

  _updateCode(dt, input) {
    if (input.wasPressed("pause")) { this.onResult({ success: false, aborted: true }); return; }
    this.shuffleT -= dt;
    if (this.shuffleT <= 0) {
      this.shuffleT = SHUFFLE_EVERY;
      shuffle(this.words);
      this.sfx.play("paBlip");
    }
    const n = this.words.length;
    if (input.wasPressed("up")) { this.cursor = (this.cursor + n - 1) % n; this.sfx.play("select"); }
    if (input.wasPressed("down")) { this.cursor = (this.cursor + 1) % n; this.sfx.play("select"); }
    if (!input.wasPressed("interact") && !input.wasPressed("submit")) return;

    const word = this.words[this.cursor];
    if (word === FRAGMENTS[this.slots.length]) {
      this.slots.push(word);
      this.words.splice(this.cursor, 1);
      this.cursor = Math.min(this.cursor, this.words.length - 1);
      this.sfx.play("stamp");
      if (this.slots.length === FRAGMENTS.length) {
        this.phase = "override";
        this.sfx.play("success");
        this.fx.flash("#0aff7a");
      }
    } else {
      gameState.secondsLeft = Math.max(1, gameState.secondsLeft - TIME_PENALTY);
      this.words.push(...this.slots);
      this.slots = [];
      shuffle(this.words);
      this.eyeAnger = 1.2;
      this.taunt = { text: `${TAUNTS[Math.floor(Math.random() * TAUNTS.length)]} (-${TIME_PENALTY}s)`, time: 2.6 };
      this.sfx.play("error");
      this.fx.shake();
      this.fx.flash("#ff2020");
    }
  }

  // --- rendering -------------------------------------------------------------

  render(renderer) {
    const w = renderer.width, h = renderer.height;
    const ctx = renderer.ctx;
    const deal = this.phase === "deal" || this.phase === "choice";
    renderer.fillRect(0, 0, w, h, deal ? "#0a0002" : "#060003");
    // radiating red data lines
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2 + this._t * 0.05;
      const r0 = 70 + ((this._t * 40 + i * 37) % 200);
      ctx.fillStyle = `rgba(255,30,40,${0.12 - r0 / 2600})`;
      ctx.fillRect(w / 2 + Math.cos(a) * r0, 96 + Math.sin(a) * r0 * 0.6, 2, 2);
    }
    ctx.restore();

    this._drawEye(renderer, w / 2, 96, deal ? 1.25 : 1);

    renderer.text("SECTOR 4 // UPLINK", 8, 12, { color: "#ff5a5a", size: 11, weight: "bold", baseline: "middle" });
    renderer.text(`OVERRIDE CODE  ${this.slots.join(" ") || "—"}`, w - 8, 12, {
      color: "#ff9a9a", size: 9, align: "right", baseline: "middle", weight: "bold",
    });

    if (this.phase === "code") this._drawCode(renderer);
    if (this.phase === "override" || deal) this._drawOverride(renderer);
    if (this.phase === "intro" || this.phase === "deal") this._drawScript(renderer);
    if (this.phase === "choice") this._drawChoice(renderer);

    const echoSpeaking = (this.phase === "deal" && this.script[this.line]?.[0] === "ECHO") || this.phase === "choice";
    if (echoSpeaking) {
      const g = ctx.createRadialGradient(this.echo.x, this.echo.y, 0, this.echo.x, this.echo.y, 40);
      g.addColorStop(0, "rgba(74,230,255,0.35)");
      g.addColorStop(1, "rgba(74,230,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(this.echo.x - 40, this.echo.y - 40, 80, 80);
    }
    if (this.phase !== "code") this.echo.draw(renderer, { x: 0, y: 0 });

    if (this.taunt) {
      renderer.text(this.taunt.text, w / 2, 176, { color: "#ff5a5a", size: 9, align: "center", baseline: "middle", weight: "bold" });
    }
  }

  _drawEye(renderer, cx, cy, scale) {
    const ctx = renderer.ctx;
    const pulse = 1 + Math.sin(this._t * 2) * 0.04 + this.eyeAnger * 0.15;
    const R = 46 * scale * pulse;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.8);
    g.addColorStop(0, "rgba(255,30,30,0.35)");
    g.addColorStop(1, "rgba(255,30,30,0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4);
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = `rgba(255,60,60,${0.7 - i * 0.15})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, R - i * 8, (R - i * 8) * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // iris looks at the cursor / ECHO
    const lookX = this.phase === "code" ? -20 + (this.cursor / Math.max(1, this.words.length - 1)) * 40 : this.phase === "deal" || this.phase === "choice" ? 18 : Math.sin(this._t * 0.7) * 10;
    const ix = cx + lookX * scale * 0.6, iy = cy + 4;
    ctx.fillStyle = "#3a0006";
    ctx.beginPath();
    ctx.arc(ix, iy, R * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff2a2a";
    ctx.beginPath();
    ctx.arc(ix, iy, R * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#200000";
    ctx.fillRect(ix - 2, iy - R * 0.22, 4, R * 0.44);
    ctx.fillStyle = "#ffd0d0";
    ctx.fillRect(ix + R * 0.1, iy - R * 0.14, 3, 3);
  }

  _drawCode(renderer) {
    const w = renderer.width;
    const top = 190;
    renderer.text("SELECT THE FRAGMENTS IN ORDER — HALCYON IS SCRAMBLING THE LIST", w / 2, top - 8, {
      color: "#ff9a9a", size: 8, align: "center", baseline: "middle",
    });
    const bar = this.shuffleT / SHUFFLE_EVERY;
    renderer.fillRect(w / 2 - 60, top - 1, 120, 2, "#2a0006");
    renderer.fillRect(w / 2 - 60, top - 1, 120 * bar, 2, "#ff5a5a");
    this.words.forEach((word, i) => {
      const y = top + 12 + i * 15;
      const focused = i === this.cursor;
      const glitch = this.shuffleT < 0.25 ? Math.round((Math.random() - 0.5) * 8) : 0;
      if (focused) renderer.fillRect(w / 2 - 70, y - 7, 140, 14, "rgba(255,60,60,0.18)");
      renderer.text(focused ? `▶ ${word} ◀` : word, w / 2 + glitch, y, {
        color: focused ? "#ffe0e0" : "#a04040", size: 10, align: "center", baseline: "middle", weight: focused ? "bold" : "normal",
      });
    });
    renderer.text("[↑↓] choose   [enter] commit   [esc] retreat", w / 2, renderer.height - 10, {
      color: "#7a3030", size: 8, align: "center", baseline: "middle",
    });
  }

  _drawOverride(renderer) {
    const w = renderer.width;
    const y = 166;
    renderer.text(`OVERRIDE ${Math.floor(this.override * 100)}%`, w / 2, y - 10, {
      color: this.override >= 0.99 ? "#ffaa3a" : "#0aff7a", size: 9, align: "center", baseline: "middle", weight: "bold",
    });
    renderer.fillRect(w / 2 - 100, y, 200, 5, "#0a1a0a");
    renderer.fillRect(w / 2 - 100, y, 200 * this.override, 5, this.override >= 0.99 ? "#ffaa3a" : "#0aff7a");
  }

  _drawScript(renderer) {
    const [who, text] = this.script[this.line];
    const w = renderer.width;
    const echo = who === "ECHO";
    const bx = 20, by = 222, bw = w - 40, bh = 70;
    renderer.fillRect(bx, by, bw, bh, echo ? "rgba(0,16,24,0.92)" : "rgba(24,0,4,0.92)");
    renderer.strokeRect(bx, by, bw, bh, echo ? "#4ae6ff" : "#ff3a3a", 1);
    renderer.fillRect(bx, by - 10, who.length * 7 + 12, 11, echo ? "#4ae6ff" : "#ff3a3a");
    renderer.text(who, bx + 6, by - 5, { color: "#000", size: 9, baseline: "middle", weight: "bold" });
    const shown = text.slice(0, Math.floor(this.typed));
    const lines = wrapText(renderer.ctx, shown, bw - 20);
    lines.forEach((l, i) => renderer.text(l, bx + 10, by + 12 + i * 13, {
      color: echo ? "#cffcff" : "#ffd0d0", size: 10,
    }));
    if (this.typed >= text.length && (Math.floor(this._t * 3) & 1)) {
      renderer.text("▼", bx + bw - 12, by + bh - 10, { color: echo ? "#4ae6ff" : "#ff3a3a", size: 9, align: "center", baseline: "middle" });
    }
  }

  _drawChoice(renderer) {
    const w = renderer.width;
    const opts = [
      ["TRUST ECHO", "upload it into the core and let it run the tower", "#4ae6ff"],
      ["PURGE ECHO", "take HALCYON's deal — it opens the doors itself", "#ff5a5a"],
    ];
    renderer.text("CHOOSE", w / 2, 196, { color: "#ffaa3a", size: 10, align: "center", baseline: "middle", weight: "bold" });
    opts.forEach(([title, sub, col], i) => {
      const y = 214 + i * 40;
      const focused = i === this.choice;
      renderer.fillRect(60, y, w - 120, 32, focused ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.5)");
      renderer.strokeRect(60, y, w - 120, 32, focused ? col : "#3a2a2a", focused ? 2 : 1);
      renderer.text(`${focused ? "▶ " : ""}${title}`, w / 2, y + 11, { color: focused ? col : "#7a6a6a", size: 11, align: "center", baseline: "middle", weight: "bold" });
      renderer.text(sub, w / 2, y + 24, { color: focused ? "#d8d8d8" : "#5a4a4a", size: 8, align: "center", baseline: "middle" });
    });
  }
}

function wrapText(ctx, text, maxW) {
  ctx.font = "normal 10px ui-monospace, monospace";
  const out = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out;
}
