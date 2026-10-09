// Sector 2 — rotate a Caesar cipher wheel until each intercepted lab log reads as English.
// A letter-frequency histogram of the ciphertext is the cryptanalyst's hint: the peak is usually E.
const LOGS = [
  { plain: "SUBJECT ZERO BREACHED THE SEALED VENTS", shift: 3 },
  { plain: "THE AI REWROTE EVERY DOOR PROTOCOL HERE", shift: 11 },
  { plain: "UPLINK FRAGMENT ONE READS ORION SEVEN", shift: 19 },
];

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const NOISE = "#$%&*<>?/\\!=+0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
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

const mod = (n, m) => ((n % m) + m) % m;

function shiftText(text, k) {
  let out = "";
  for (const ch of text) {
    const i = ALPHA.indexOf(ch);
    out += i < 0 ? ch : ALPHA[mod(i + k, 26)];
  }
  return out;
}

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

  onEnter() { document.body.classList.add("no-objective"); }
  onExit() { document.body.classList.remove("no-objective"); }

  _loadLog() {
    const log = LOGS[this.index];
    this.cipher = shiftText(log.plain, log.shift);
    this.rotation = 0;
    this.visual = 0;
    this.scramble = [...this.cipher].map((_, i) => 0.4 + i * 0.012);
    this.stamp = 0;
    this.freq = new Array(26).fill(0);
    for (const ch of this.cipher) {
      const i = ALPHA.indexOf(ch);
      if (i >= 0) this.freq[i]++;
    }
    this.freqMax = Math.max(...this.freq);
  }

  update(dt, input) {
    this._t += dt;
    this.hud.update(dt);
    this.visual += (this.rotation - this.visual) * Math.min(1, dt * 12);
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
    if (input.wasPressed("left") || input.wasPressed("up")) this._rotate(-1);
    if (input.wasPressed("right") || input.wasPressed("down")) this._rotate(1);
    if (input.wasPressed("submit") || input.wasPressed("interact")) this._submit();
  }

  _rotate(step) {
    this.rotation += step;
    this.sfx.play("blip");
    // re-scramble with a left-to-right ripple
    for (let i = 0; i < this.scramble.length; i++) this.scramble[i] = Math.max(this.scramble[i], 0.08 + i * 0.006);
  }

  _submit() {
    const log = LOGS[this.index];
    if (mod(this.rotation, 26) === log.shift) {
      this.stamp = STAMP_TIME;
      this.sfx.play("success");
      this.fx.flash("#0aff7a");
    } else {
      this.hud.addScore(-2);
      this.sfx.play("error");
      this.fx.shake();
      this.fx.flash("#ff5a5a");
      this.message = { text: "CHECKSUM FAIL — still gibberish. (-2)", color: "#ff5a5a", time: 2.4 };
    }
  }

  _next() {
    this.index++;
    if (this.index >= LOGS.length) {
      this.onResult({
        success: true,
        aborted: false,
        report: [
          "[L2] DECRYPTED. Three lab logs recovered.",
          "Subject Zero got out through the vents — and the AI rewrote the doors.",
          "Uplink fragment recovered: ORION SEVEN. Hold onto that.",
          "Sector 3 — BUILD THE DOOR AGENT — now unlocked.",
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
    const live = mod(Math.round(this.visual), 26) === LOGS[this.index].shift && this.stamp > 0;

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
    // outer ring = ciphertext letters (fixed); inner ring = plaintext (rotates with the key)
    for (let i = 0; i < 26; i++) {
      const a = i * step - Math.PI / 2;
      const top = i === 0;
      const hot = this.freq[i] === this.freqMax;
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

    // hub with the key
    ctx.fillStyle = "#031018";
    ctx.beginPath();
    ctx.arc(WHEEL_X, WHEEL_Y, R_INNER - 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = live ? "#0aff7a" : "#4ae6ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(WHEEL_X, WHEEL_Y, R_INNER - 14, -Math.PI / 2, -Math.PI / 2 + (mod(this.visual, 26) / 26) * Math.PI * 2);
    ctx.stroke();
    renderer.text("KEY", WHEEL_X, WHEEL_Y - 16, { color: "#1a6a7a", size: 8, align: "center", baseline: "middle" });
    ctx.shadowColor = live ? "#0aff7a" : "#4ae6ff";
    ctx.shadowBlur = 10;
    renderer.text(String(mod(this.rotation, 26)).padStart(2, "0"), WHEEL_X, WHEEL_Y + 3, {
      color: live ? "#0aff7a" : "#cffcff", size: 26, align: "center", baseline: "middle", weight: "bold",
    });
    ctx.shadowBlur = 0;
    renderer.text("◀ ▶", WHEEL_X, WHEEL_Y + 24, { color: "#1a6a7a", size: 8, align: "center", baseline: "middle" });
  }

  _drawPanel(renderer) {
    const x = PANEL_X, top = HEADER_H + 10;
    renderer.text("INTERCEPTED // LAB-LOG-0" + (this.index + 1), x, top, { color: "#ffaa3a", size: 8, weight: "bold" });
    const cLines = wrap(this.cipher, WRAP);
    renderer.fillRect(x - 4, top + 11, PANEL_W, cLines.length * 12 + 6, "rgba(40,20,0,0.5)");
    cLines.forEach((line, i) => renderer.text(line, x, top + 15 + i * 12, { color: "#ffd8a0", size: 9 }));

    // letter-frequency histogram of the ciphertext
    const hy = top + 26 + cLines.length * 12;
    renderer.text("FREQUENCY ANALYSIS — tallest bar ≈ E", x, hy, { color: "#1a8a9a", size: 7 });
    const bw = Math.floor((PANEL_W - 8) / 26);
    for (let i = 0; i < 26; i++) {
      const bh = Math.round((this.freq[i] / this.freqMax) * 22);
      const bx = x + i * bw;
      const peak = this.freq[i] === this.freqMax;
      renderer.fillRect(bx, hy + 34 - bh, bw - 2, bh, peak ? "#ffaa3a" : "#1a6a7a");
      renderer.text(ALPHA[i], bx + (bw - 2) / 2, hy + 37, {
        color: peak ? "#ffaa3a" : "#1a4a5a", size: 6, align: "center",
      });
    }

    // live decode with scramble ripple
    const dy = hy + 52;
    renderer.text("DECODED OUTPUT", x, dy, { color: "#0aff7a", size: 8, weight: "bold" });
    const decoded = shiftText(this.cipher, -this.rotation);
    const lines = wrap(decoded, WRAP);
    renderer.fillRect(x - 4, dy + 11, PANEL_W, lines.length * 13 + 6, "rgba(0,30,12,0.6)");
    renderer.strokeRect(x - 4, dy + 11, PANEL_W, lines.length * 13 + 6, this.stamp > 0 ? "#0aff7a" : "#0a4a2a", 1);
    const ctx = renderer.ctx;
    ctx.font = "bold 9px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const cw = ctx.measureText("M").width;
    let k = 0;
    lines.forEach((line, li) => {
      for (let ci = 0; ci < line.length; ci++, k++) {
        const scr = this.scramble[k] > 0 && line[ci] !== " ";
        ctx.fillStyle = scr ? "#4ae6ff" : this.stamp > 0 ? "#cffcff" : "#0aff7a";
        const ch = scr ? NOISE[Math.floor(Math.random() * NOISE.length)] : line[ci];
        ctx.fillText(ch, x + ci * cw, dy + 15 + li * 13);
      }
      k++; // the space consumed by wrapping
    });
    if (Math.floor(this._t * 2) & 1) renderer.fillRect(x + (lines.at(-1).length) * cw + 1, dy + 15 + (lines.length - 1) * 13, 5, 9, "#0aff7a");

    if (this.message) {
      renderer.text(this.message.text, x, dy + lines.length * 13 + 24, {
        color: this.message.color, size: 8, weight: "bold",
      });
    }
  }

  _drawFooter(renderer, w, h) {
    renderer.fillRect(0, h - FOOTER_H, w, FOOTER_H, "#061a26");
    renderer.fillRect(0, h - FOOTER_H, w, 1, "#4ae6ff");
    renderer.text("[←→] rotate key   [enter] lock in   [esc] exit", 8, h - FOOTER_H / 2, {
      color: "#1a8a9a", size: 8, baseline: "middle",
    });
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
