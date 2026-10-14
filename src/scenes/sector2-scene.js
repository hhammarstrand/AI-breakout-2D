import { music } from "../audio/music.js";
import { penalize, scaledPenalty } from "../state.js";
import { t } from "../i18n/index.js";
import { LOGS, ALPHA, mod, crypt, wheelOf, letterCounts } from "./cipher-logs.js";

// Sector 2 — three intercepted logs that escalate (see cipher-logs.js). Log 1 is the tutorial: the
// frequency panel says the tallest bar is about E and only the three commonest letters decode
// live, so the player has to use that rule. Log 2 breaks the rule (T beats E) and drops the label,
// but decodes everything live so word shapes can be tested. Log 3 needs a keyword from the lobby;
// with 26^4 settings, turning reels until it reads is hopeless.
const REVEALED = 3;
const TIME_PENALTY = 30;

// per log, from nudge to near-answer
const HINTS = [
  [
    "The bars count how often each letter appears in the intercept. In English, E is nearly always the commonest letter.",
    "The orange letter on the outer ring is the commonest one. Turn the wheel until E sits right under it.",
    "The key is how far the orange letter lies past E, counting forward. E to G would be 2.",
  ],
  [
    "Short notes don't follow the rules: E isn't the tallest bar here. Read the words instead.",
    "A one-letter word can only be A or I. A three-letter word that keeps coming back is almost always THE.",
    "Turn the wheel until the three-letter word that appears three times reads THE. The lone letter should then read A.",
  ],
  [
    "Each wheel is its own Caesar shift, and they take turns: wheel 1 decodes letter 1, wheel 2 letter 2, and so on.",
    "The key is Dr. Lind's password. She told you what she uses for every key she sets. Find out that name.",
    "Lind's daughter signed the drawing on Lind's workstation, south-west in the lobby. Lind's voice memo names her too. Dial the name, one letter per wheel.",
  ],
];

const NOISE = "#$%&*<>?/\\!=+0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const WHEEL_COLORS = ["#7ae8ff", "#ffd15a", "#ff8ad8", "#b8ff6a"];
const HEADER_H = 24;
const FOOTER_H = 22;
const WHEEL_X = 118;
const WHEEL_Y = 176;
const R_OUTER = 92;
const R_INNER = 70;
const PANEL_X = 236;
const PANEL_W = 232;
const WRAP = 34;
const STAMP_TIME = 1.3;
const REEL_W = 22;
const REEL_GAP = 6;

function wrap(text, width) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && (line + " " + word).length > width) { lines.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

// word-wrap already translated text to a pixel width (the penalty line is longer in Swedish)
function fitLines(ctx, text, maxW) {
  const out = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) { out.push(line); line = word; }
    else line = next;
  }
  if (line) out.push(line);
  return out;
}

export class Sector2Scene {
  constructor({ hud, sfx, fx, onResult }) {
    this.hud = hud;
    this.sfx = sfx;
    this.fx = fx;
    this.onResult = onResult;
    this.index = 0;
    this._t = 0;
    this.message = null;
    this._loadLog();
  }

  // ECHO's hints follow the log on screen
  get hints() { return HINTS[this.index]; }

  // which log the player is on; the world restores it if they step out and come back
  get part() { return this.index; }
  resume(i) { this.index = i; this._loadLog(); }

  // the big wheel always shows the selected key wheel
  get rotation() { return this.keys[this.sel]; }

  onEnter() { document.body.classList.add("no-objective", "in-puzzle"); music.play("sector"); music.setIntensity(0); }
  onExit() { document.body.classList.remove("no-objective", "in-puzzle"); }

  _loadLog() {
    this.log = LOGS[this.index];
    this.cipher = crypt(this.log.plain, this.log.shifts, 1);
    this.wheels = this.log.shifts.length;
    this.wheelAt = wheelOf(this.cipher, this.wheels);
    this.keys = new Array(this.wheels).fill(0);
    this.sel = 0;
    this.visual = 0;
    this.scramble = [...this.cipher].map((_, i) => 0.4 + i * 0.012);
    this.stamp = 0;
    this.freq = letterCounts(this.cipher);
    this.freqMax = Math.max(...this.freq);
    // the tutorial decodes only the commonest ciphertext letters live; later logs decode it all
    this.revealed = this.log.tutorial ? new Set(
      [...ALPHA].map((ch, i) => [ch, this.freq[i]]).sort((a, b) => b[1] - a[1]).slice(0, REVEALED).map(([ch]) => ch),
    ) : null;
    this._hintsShown = 0; // a new log starts again from the gentlest hint
  }

  update(dt, input) {
    this._t += dt;
    this.hud.update(dt);
    // shortest way round, so switching between key wheels never spins the long way
    const d = mod(this.rotation - this.visual + 13, 26) - 13;
    this.visual += d * Math.min(1, dt * 12);
    for (let i = 0; i < this.scramble.length; i++) this.scramble[i] = Math.max(0, this.scramble[i] - dt);
    if (this.message) {
      this.message.time -= dt;
      if (this.message.time <= 0) this.message = null;
    }

    if (this.stamp > 0) {
      this.stamp -= dt;
      if (this.stamp <= 0) this._next();
      return;
    }

    if (input.wasPressed("pause")) { this.onResult({ success: false, aborted: true }); return; }
    if (this.wheels > 1) {
      if (input.wasPressed("left")) this._select(-1);
      if (input.wasPressed("right")) this._select(1);
      if (input.wasPressed("up")) this._turn(1);
      if (input.wasPressed("down")) this._turn(-1);
    } else {
      if (input.wasPressed("left") || input.wasPressed("up")) this._turn(-1);
      if (input.wasPressed("right") || input.wasPressed("down")) this._turn(1);
    }
    if (input.wasPressed("submit")) this._submit(); // only Enter commits: Space must never cost time
  }

  _select(step) {
    this.sel = mod(this.sel + step, this.wheels);
    this.sfx.play("select");
  }

  _turn(step) {
    this.keys[this.sel] = mod(this.keys[this.sel] + step, 26);
    this.sfx.play("blip");
    // re-scramble what this wheel decodes with a left-to-right ripple, so the player sees which
    // letters belong to it
    for (let i = 0; i < this.scramble.length; i++) {
      if (this.wheelAt[i] === this.sel) this.scramble[i] = Math.max(this.scramble[i], 0.08 + i * 0.006);
    }
  }

  _submit() {
    if (this.keys.every((k, i) => k === this.log.shifts[i])) {
      this.stamp = STAMP_TIME;
      this.scramble = this.scramble.map((_, i) => 0.1 + i * 0.008);
      this.sfx.play("success");
      this.fx.flash("#0aff7a");
    } else {
      this.hud.addScore(-2);
      penalize(TIME_PENALTY);
      this.sfx.play("error");
      this.fx.shake();
      this.fx.flash("#ff5a5a");
      this.message = { text: `CHECKSUM FAIL — HALCYON logged the attempt. (-${scaledPenalty(TIME_PENALTY)}s)`, color: "#ff5a5a", time: 2.4 };
    }
  }

  _next() {
    this.index++;
    if (this.index >= LOGS.length) {
      this.onResult({
        success: true,
        aborted: false,
        report: [
          "[L2] All three logs decrypted.",
          "...Tech. That last line. I'm not going to pretend I didn't read it.",
          "Second fragment is ORION. That's two of three.",
          "L3 is open. HALCYON says only an agent can walk the door-control maze. That means ECHO.",
        ],
      });
      return;
    }
    this.sfx.play("door");
    this.fx.glitch();
    this._loadLog();
  }

  // --- rendering -------------------------------------------------------------

  render(renderer) {
    const w = renderer.width, h = renderer.height;
    renderer.fillRect(0, 0, w, h, "#02060a");
    // drifting hex grid backdrop
    const ctx = renderer.ctx;
    ctx.fillStyle = "rgba(74,230,255,0.05)";
    const off = (this._t * 6) % 12;
    for (let y = HEADER_H - 12 + off; y < h; y += 12) {
      for (let x = (Math.floor(y / 12) & 1) * 6; x < w; x += 12) ctx.fillRect(x, y, 1, 1);
    }

    this._drawHeader(renderer, w);
    this._drawWheel(renderer);
    if (this.wheels > 1) this._drawReels(renderer);
    this._drawPanel(renderer);
    this._drawFooter(renderer, w, h);
    if (this.stamp > 0) this._drawStamp(renderer);
  }

  _drawHeader(renderer, w) {
    renderer.fillRect(0, 0, w, HEADER_H, "#061a26");
    renderer.fillRect(0, HEADER_H - 2, w, 2, "#4ae6ff");
    renderer.text("SECTOR 2 // DECRYPT THE LAB LOGS", 8, HEADER_H / 2, {
      color: "#4ae6ff", size: 11, weight: "bold", baseline: "middle",
    });
    for (let i = 0; i < LOGS.length; i++) {
      const x = w - 16 - (LOGS.length - 1 - i) * 22;
      const done = i < this.index || (i === this.index && this.stamp > 0);
      const active = i === this.index;
      renderer.fillRect(x - 7, 5, 14, 14, done ? "#0aff7a" : active ? "#0a3a4a" : "#081820");
      renderer.strokeRect(x - 7, 5, 14, 14, done ? "#0aff7a" : active ? "#4ae6ff" : "#1a3a4a", 1);
      renderer.text(done ? "✓" : String(i + 1), x, 12, {
        color: done ? "#000" : active ? "#cffcff" : "#1a4a5a", size: 9, align: "center", baseline: "middle", weight: "bold",
      });
    }
  }

  _drawWheel(renderer) {
    const ctx = renderer.ctx;
    const step = (Math.PI * 2) / 26;
    const live = this.stamp > 0;

    // glow disc + rings
    const g = ctx.createRadialGradient(WHEEL_X, WHEEL_Y, 10, WHEEL_X, WHEEL_Y, R_OUTER + 14);
    g.addColorStop(0, live ? "rgba(10,255,122,0.25)" : "rgba(74,230,255,0.14)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(WHEEL_X - R_OUTER - 14, WHEEL_Y - R_OUTER - 14, (R_OUTER + 14) * 2, (R_OUTER + 14) * 2);
    for (const [r, c] of [[R_OUTER + 9, "#1a4a5a"], [R_OUTER - 9, "#1a4a5a"], [R_INNER - 9, "#0a2a3a"]]) {
      ctx.strokeStyle = c;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(WHEEL_X, WHEEL_Y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // spinning tick ring
    ctx.save();
    ctx.translate(WHEEL_X, WHEEL_Y);
    ctx.rotate(this._t * 0.2);
    ctx.fillStyle = "#1a4a5a";
    for (let i = 0; i < 52; i++) {
      ctx.rotate((Math.PI * 2) / 52);
      ctx.fillRect(R_OUTER + 11, -0.5, i % 2 ? 2 : 4, 1);
    }
    ctx.restore();

    ctx.font = "bold 10px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // outer ring = ciphertext letters (fixed); inner ring = plaintext (rotates with the key).
    // Only the tutorial paints the commonest ciphertext letter orange.
    for (let i = 0; i < 26; i++) {
      const a = i * step - Math.PI / 2;
      const top = i === 0;
      const hot = this.log.tutorial && this.freq[i] === this.freqMax;
      ctx.fillStyle = top ? "#ffd15a" : hot ? "#ffaa3a" : "#4ae6ff";
      ctx.fillText(ALPHA[i], WHEEL_X + Math.cos(a) * R_OUTER, WHEEL_Y + Math.sin(a) * R_OUTER);
    }
    for (let i = 0; i < 26; i++) {
      const a = (i + this.visual) * step - Math.PI / 2;
      const top = mod(i + Math.round(this.visual), 26) === 0;
      ctx.fillStyle = top ? "#cffcff" : "#0aff7a";
      ctx.globalAlpha = top ? 1 : 0.75;
      ctx.fillText(ALPHA[i], WHEEL_X + Math.cos(a) * R_INNER, WHEEL_Y + Math.sin(a) * R_INNER);
    }
    ctx.globalAlpha = 1;

    // pointer at 12 o'clock
    ctx.fillStyle = "#ffd15a";
    ctx.beginPath();
    ctx.moveTo(WHEEL_X - 5, WHEEL_Y - R_OUTER - 20);
    ctx.lineTo(WHEEL_X + 5, WHEEL_Y - R_OUTER - 20);
    ctx.lineTo(WHEEL_X, WHEEL_Y - R_OUTER - 13);
    ctx.fill();

    // hub with the key: a number for a single shift, the letter for a keyword wheel
    const tint = this.wheels > 1 ? WHEEL_COLORS[this.sel] : "#4ae6ff";
    ctx.fillStyle = "#031018";
    ctx.beginPath();
    ctx.arc(WHEEL_X, WHEEL_Y, R_INNER - 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = live ? "#0aff7a" : tint;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(WHEEL_X, WHEEL_Y, R_INNER - 14, -Math.PI / 2, -Math.PI / 2 + (mod(this.visual, 26) / 26) * Math.PI * 2);
    ctx.stroke();
    const multi = this.wheels > 1;
    renderer.text(multi ? `WHEEL ${this.sel + 1}` : "KEY", WHEEL_X, WHEEL_Y - 16, { color: multi ? tint : "#1a6a7a", size: 8, align: "center", baseline: "middle" });
    ctx.shadowColor = live ? "#0aff7a" : tint;
    ctx.shadowBlur = 10;
    renderer.text(multi ? ALPHA[this.rotation] : String(this.rotation).padStart(2, "0"), WHEEL_X, WHEEL_Y + 3, {
      color: live ? "#0aff7a" : "#cffcff", size: 26, align: "center", baseline: "middle", weight: "bold",
    });
    ctx.shadowBlur = 0;
    renderer.text(multi ? "▲ ▼" : "◀ ▶", WHEEL_X, WHEEL_Y + 24, { color: "#1a6a7a", size: 8, align: "center", baseline: "middle" });
  }

  // keyword logs: one reel per key letter above the wheel, like the floor safes' dials
  _drawReels(renderer) {
    const total = this.wheels * REEL_W + (this.wheels - 1) * REEL_GAP;
    const x0 = WHEEL_X - total / 2, y = 34;
    renderer.text("KEY", x0 - 8, y + 14, { color: "#1a8a9a", size: 8, align: "right", baseline: "middle", weight: "bold" });
    for (let i = 0; i < this.wheels; i++) {
      const x = x0 + i * (REEL_W + REEL_GAP);
      const sel = i === this.sel && this.stamp <= 0;
      renderer.fillRect(x, y, REEL_W, 28, "#031018");
      renderer.fillRect(x + 2, y + 2, REEL_W - 4, 2, WHEEL_COLORS[i]);
      renderer.strokeRect(x, y, REEL_W, 28, sel ? "#ffd15a" : "#1a4a5a", sel ? 2 : 1);
      renderer.text(ALPHA[this.keys[i]], x + REEL_W / 2, y + 16, {
        color: this.stamp > 0 ? "#0aff7a" : sel ? "#ffffff" : "#8acada", size: 13, align: "center", baseline: "middle", weight: "bold",
      });
    }
  }

  // one character at a time so each can carry its own colour and scramble
  _drawChars(ctx, lines, x, y0, lineH, colorOf) {
    const cw = ctx.measureText("M").width;
    let k = 0;
    lines.forEach((line, li) => {
      for (let ci = 0; ci < line.length; ci++, k++) {
        const [ch, color] = colorOf(line[ci], k);
        ctx.fillStyle = color;
        ctx.fillText(ch, x + ci * cw, y0 + li * lineH);
      }
      k++; // the space consumed by wrapping
    });
    return cw;
  }

  _drawPanel(renderer) {
    const x = PANEL_X, top = HEADER_H + 10;
    const solved = this.stamp > 0;
    const multi = this.wheels > 1;
    const ctx = renderer.ctx;
    renderer.text("INTERCEPTED // LAB-LOG-0" + (this.index + 1), x, top, { color: "#ffaa3a", size: 8, weight: "bold" });
    const cLines = wrap(this.cipher, WRAP);
    renderer.fillRect(x - 4, top + 11, PANEL_W, cLines.length * 12 + 6, "rgba(40,20,0,0.5)");
    ctx.font = "9px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    this._drawChars(ctx, cLines, x, top + 15, 12, (ch, k) => [ch, multi && ch !== " " ? WHEEL_COLORS[this.wheelAt[k]] : "#ffd8a0"]);

    const hy = top + 26 + cLines.length * 12;
    if (multi) {
      renderer.text("KEYWORD CIPHER", x, hy, { color: "#4ae6ff", size: 8, weight: "bold" });
      renderer.text("The wheels take turns, one letter each.", x, hy + 12, { color: "#1a8a9a", size: 8 });
      renderer.text("KEY SOURCE: staff password (LIND, I.)", x, hy + 26, { color: "#ffaa3a", size: 8 });
    } else {
      // letter-frequency histogram of the ciphertext; only the tutorial says what the peak means
      renderer.text(this.log.tutorial ? "FREQUENCY ANALYSIS — tallest bar ≈ E" : "FREQUENCY ANALYSIS", x, hy, { color: "#1a8a9a", size: 7 });
      const bw = Math.floor((PANEL_W - 8) / 26);
      for (let i = 0; i < 26; i++) {
        const bh = Math.round((this.freq[i] / this.freqMax) * 22);
        const bx = x + i * bw;
        const peak = this.log.tutorial && this.freq[i] === this.freqMax;
        renderer.fillRect(bx, hy + 34 - bh, bw - 2, bh, peak ? "#ffaa3a" : "#1a6a7a");
        renderer.text(ALPHA[i], bx + (bw - 2) / 2, hy + 37, {
          color: peak ? "#ffaa3a" : "#1a4a5a", size: 6, align: "center",
        });
      }
    }

    // live decode with scramble ripple
    const dy = hy + 52;
    const label = solved ? "DECODED OUTPUT" : this.revealed ? `PARTIAL DECODE — top ${REVEALED} letters` : "LIVE DECODE";
    renderer.text(label, x, dy, { color: "#0aff7a", size: 8, weight: "bold" });
    const full = crypt(this.cipher, this.keys, -1);
    const decoded = [...full].map((ch, i) =>
      solved || ch === " " || !this.revealed || this.revealed.has(this.cipher[i]) ? ch : "·").join("");
    const lines = wrap(decoded, WRAP);
    renderer.fillRect(x - 4, dy + 11, PANEL_W, lines.length * 13 + 6, "rgba(0,30,12,0.6)");
    renderer.strokeRect(x - 4, dy + 11, PANEL_W, lines.length * 13 + 6, solved ? "#0aff7a" : "#0a4a2a", 1);
    ctx.font = "bold 9px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const cw = this._drawChars(ctx, lines, x, dy + 15, 13, (ch, k) => {
      if (this.scramble[k] > 0 && ch !== " " && ch !== "·") return [NOISE[Math.floor(Math.random() * NOISE.length)], "#4ae6ff"];
      if (solved) return [ch, "#cffcff"];
      if (ch === "·") return [ch, "#1a5a3a"];
      return [ch, multi ? WHEEL_COLORS[this.wheelAt[k]] ?? "#0aff7a" : "#0aff7a"];
    });
    if (Math.floor(this._t * 2) & 1) renderer.fillRect(x + (lines.at(-1).length) * cw + 1, dy + 15 + (lines.length - 1) * 13, 5, 9, "#0aff7a");

    if (this.message) {
      ctx.font = 'bold 8px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
      fitLines(ctx, t(this.message.text), PANEL_W - 4).forEach((line, i) => renderer.text(line, x, dy + lines.length * 13 + 24 + i * 11, {
        color: this.message.color, size: 8, weight: "bold",
      }));
    }
  }

  _drawFooter(renderer, w, h) {
    renderer.fillRect(0, h - FOOTER_H, w, FOOTER_H, "#061a26");
    renderer.fillRect(0, h - FOOTER_H, w, 1, "#4ae6ff");
    const keys = this.wheels > 1 ? "[←→] pick wheel   [↑↓] turn   [enter] lock in   [esc] exit" : "[←→] rotate key   [enter] lock in   [esc] exit";
    renderer.text(keys, 8, h - FOOTER_H / 2, { color: "#1a8a9a", size: 8, baseline: "middle" });
  }

  _drawStamp(renderer) {
    const k = Math.min(1, (STAMP_TIME - this.stamp) / 0.2);
    const ctx = renderer.ctx;
    ctx.save();
    ctx.translate(PANEL_X + PANEL_W / 2 - 4, 250);
    ctx.rotate(-0.12);
    const s = 2.2 - 1.2 * k;
    ctx.scale(s, s);
    ctx.globalAlpha = k;
    renderer.fillRect(-62, -12, 124, 24, "rgba(0,20,8,0.9)");
    renderer.strokeRect(-62, -12, 124, 24, "#0aff7a", 2);
    renderer.text("DECRYPTED", 0, 1, { color: "#0aff7a", size: 14, align: "center", baseline: "middle", weight: "bold" });
    ctx.restore();
  }
}
