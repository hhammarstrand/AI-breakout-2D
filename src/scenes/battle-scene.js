import { music } from "../audio/music.js";
import { Drone } from "../entities/drone.js";
import { t } from "../i18n/index.js";

// Pokémon-style hack battle, triggered when a sentinel spots you. ECHO fights with four moves;
// the sentinel telegraphs its next move, so reading the intent is the whole strategy:
// SPOOF the big LOCK-ON, PATCH when low, OVERLOAD when it's charging.
const MOVES = [
  { id: "ping", name: "PING", desc: "Reliable probe. 18 damage.", dmg: 18 },
  { id: "spoof", name: "SPOOF", desc: "Fake your signature. Blocks the next attack.", cooldown: 2 },
  { id: "overload", name: "OVERLOAD", desc: "45 damage, costs 10 of your integrity. Cooldown 3.", dmg: 45, self: 10, cooldown: 3 },
  { id: "patch", name: "PATCH", desc: "Restore 28 integrity.", heal: 28, cooldown: 2 },
];
const ENEMY_MOVES = {
  trace: { name: "TRACE", dmg: 16, tell: "is tracing your signal…" },
  scan: { name: "SCAN", dmg: 9, tell: "is sweeping its scanner…" },
  lockon: { name: "LOCK-ON", charge: true, tell: "is charging a LOCK-ON!" },
  fire: { name: "PURGE BOLT", dmg: 42, tell: "fires the PURGE BOLT!" },
};
const TYPE_SPEED = 45;
const INTRO_TIME = 1.1;

export class BattleScene {
  constructor({ sentinel, sfx, fx, onResult }) {
    this.hints = ["Read NEXT: under its HP bar. That's what it will do after your move.", "SPOOF right before a PURGE BOLT — it blocks the whole hit.", "PATCH when you drop below 40. OVERLOAD is your big hit; PING fills the cooldowns."];
    this.sentinel = sentinel;
    this.sfx = sfx;
    this.fx = fx;
    this.onResult = onResult;
    this.echo = new Drone(0, 0);
    this.me = { hp: 100, max: 100 };
    this.foe = { hp: 90, max: 90, level: 10 + (sentinel.name.charCodeAt(sentinel.name.length - 1) % 6) };
    this.cooldowns = {};
    this.cursor = 0;
    this._t = 0;
    this.phase = "intro";
    this.queue = [];
    this.text = null;
    this.shown = 0;
    this.spoofed = false;
    this.flashFoe = 0;
    this.flashMe = 0;
    this._pickIntent();
    this._say(`${sentinel.name} wants to fight!`, `${sentinel.name} ${this.intent.tell}`);
  }

  onEnter() {
    document.body.classList.add("no-objective", "in-battle");
    this._prevMusic = music.wanted;
    music.play("battle");
    music.setIntensity(0.8);
  }

  onExit() {
    document.body.classList.remove("no-objective", "in-battle");
    if (this._prevMusic) music.play(this._prevMusic);
  }

  _pickIntent() {
    if (this.intent?.charge) { this.intent = ENEMY_MOVES.fire; return; }
    const r = Math.random();
    this.intent = r < 0.3 ? ENEMY_MOVES.lockon : r < 0.7 ? ENEMY_MOVES.trace : ENEMY_MOVES.scan;
  }

  _say(...lines) { this.queue.push(...lines.map(t)); if (!this.text) this._next(); }

  _next() {
    this.text = this.queue.shift() ?? null;
    this.shown = 0;
  }

  update(dt, input) {
    this._t += dt;
    this.echo._t += dt;
    this.flashFoe = Math.max(0, this.flashFoe - dt);
    this.flashMe = Math.max(0, this.flashMe - dt);
    const ok = input.wasPressed("interact") || input.wasPressed("submit");

    if (this.phase === "intro" && this._t < INTRO_TIME) return;
    if (this.text) {
      if (this.shown < this.text.length) {
        this.shown = Math.min(this.text.length, this.shown + dt * TYPE_SPEED);
        if (ok) this.shown = this.text.length;
        return;
      }
      if (!ok) return;
      this.sfx.play("select");
      this._next();
      if (!this.text) this._afterMessages();
      return;
    }
    if (this.phase !== "choose") return;

    if (input.wasPressed("left") || input.wasPressed("right")) { this.cursor ^= 1; this.sfx.play("select"); }
    if (input.wasPressed("up") || input.wasPressed("down")) { this.cursor ^= 2; this.sfx.play("select"); }
    if (ok) {
      const move = MOVES[this.cursor];
      if (this.cooldowns[move.id] > 0) { this.sfx.play("denied"); return; }
      this._playerTurn(move);
    }
  }

  _afterMessages() {
    if (this.phase === "intro") { this.phase = "choose"; return; }
    if (this.phase === "won" || this.phase === "lost") {
      this.game.pop();
      this.onResult(this.phase === "won");
      return;
    }
    if (this.phase === "enemy") { this._enemyTurn(); return; }
    if (this.phase === "end-turn") { this.phase = "choose"; }
  }

  _playerTurn(move) {
    for (const k of Object.keys(this.cooldowns)) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - 1);
    if (move.cooldown) this.cooldowns[move.id] = move.cooldown;
    const lines = [`ECHO used ${move.name}!`];
    if (move.dmg) {
      const crit = Math.random() < 0.12;
      const dmg = Math.round(move.dmg * (crit ? 1.5 : 1) * (0.9 + Math.random() * 0.2));
      this.foe.hp = Math.max(0, this.foe.hp - dmg);
      this.flashFoe = 0.5;
      this.fx.shake();
      this.sfx.play(move.id === "overload" ? "zap" : "stamp");
      if (crit) lines.push("A critical exploit!");
      if (move.self) { this.me.hp = Math.max(1, this.me.hp - move.self); lines.push("ECHO took feedback damage."); }
    }
    if (move.id === "spoof") { this.spoofed = true; this.sfx.play("confirm"); lines.push("ECHO is broadcasting a fake signature."); }
    if (move.heal) { this.me.hp = Math.min(this.me.max, this.me.hp + move.heal); this.sfx.play("item"); lines.push("Integrity restored."); }
    if (this.foe.hp <= 0) {
      this.phase = "won";
      this.sfx.play("success");
      this._say(...lines, `${this.sentinel.name} crashed!`, "It will be rebooting for a while. Slip past while you can.");
      return;
    }
    this.phase = "enemy";
    this._say(...lines);
  }

  _enemyTurn() {
    const m = this.intent;
    const lines = [];
    if (m.charge) {
      lines.push(`${this.sentinel.name} locked on. Its PURGE BOLT is charging!`);
    } else if (this.spoofed) {
      lines.push(`${this.sentinel.name} used ${m.name}!`, "…but it hit the spoofed signature. No damage!");
      this.spoofed = false;
      this.sfx.play("denied");
    } else {
      const dmg = Math.round(m.dmg * (0.9 + Math.random() * 0.2));
      this.me.hp = Math.max(0, this.me.hp - dmg);
      this.flashMe = 0.5;
      this.fx.flash("#ff2040");
      this.sfx.play(m === ENEMY_MOVES.fire ? "zap" : "error");
      lines.push(`${this.sentinel.name} used ${m.name}!`);
    }
    if (this.me.hp <= 0) {
      this.phase = "lost";
      this._say(...lines, "ECHO's cover is blown!", "The sentinel tags you…");
      return;
    }
    this._pickIntent();
    lines.push(`${this.sentinel.name} ${this.intent.tell}`);
    this.phase = "end-turn";
    this._say(...lines);
  }

  // --- rendering -----------------------------------------------------------------

  render(renderer) {
    const w = renderer.width, h = renderer.height;
    const ctx = renderer.ctx;
    // backdrop: red grid horizon
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#14060c");
    sky.addColorStop(0.6, "#2a0c18");
    sky.addColorStop(1, "#0a0408");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,60,100,0.18)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const y = 120 + i * i * 1.4;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (let i = -10; i <= 10; i++) {
      ctx.beginPath(); ctx.moveTo(w / 2 + i * 12, 120); ctx.lineTo(w / 2 + i * 80, h); ctx.stroke();
    }

    // platforms
    this._platform(ctx, 350, 108, 120);
    this._platform(ctx, 120, 210, 140);

    // intro: sprites slide in
    const k = Math.min(1, this._t / INTRO_TIME);
    const ease = 1 - Math.pow(1 - k, 3);
    const foeX = 350 + (1 - ease) * 200, meX = 120 - (1 - ease) * 200;

    this._drawSentinel(ctx, foeX, 90, this.flashFoe > 0 && Math.floor(this._t * 20) & 1);
    if (!(this.flashMe > 0 && Math.floor(this._t * 20) & 1)) {
      ctx.save();
      ctx.translate(meX, 186);
      ctx.scale(3, 3);
      this.echo.x = 0; this.echo.y = 0;
      this.echo.draw(renderer, { x: 0, y: 0 });
      ctx.restore();
    }
    if (this.spoofed) {
      ctx.strokeStyle = `rgba(74,230,255,${0.4 + 0.3 * Math.sin(this._t * 8)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(meX, 190, 30, 0, Math.PI * 2); ctx.stroke();
    }

    // status boxes
    this._status(renderer, 16, 18, this.sentinel.name, this.foe, `Lv.${this.foe.level}`, false);
    this._status(renderer, 268, 166, "ECHO", this.me, "Lv.07", true);
    // telegraphed intent
    if (this.phase !== "intro" && this.phase !== "won") {
      renderer.text(`NEXT: ${this.intent.name}`, 22, 62, { color: this.intent.charge || this.intent === ENEMY_MOVES.fire ? "#ff5a5a" : "#ffaa3a", size: 8, weight: "bold" });
    }

    // message / move box
    const by = 236;
    renderer.fillRect(0, by, w, h - by, "#0a0812");
    renderer.fillRect(4, by + 4, w - 8, h - by - 8, "#e8eef4");
    renderer.strokeRect(8, by + 8, w - 16, h - by - 16, "#5a7a9a", 1);
    if (this.text) {
      const s = this.text.slice(0, Math.floor(this.shown));
      renderer.text(s, 22, by + 26, { color: "#0a0812", size: 10, baseline: "middle" });
      if (this.shown >= this.text.length && Math.floor(this._t * 3) & 1) renderer.text("▼", w - 26, h - 22, { color: "#2a5a8a", size: 9, baseline: "middle" });
    } else if (this.phase === "choose") {
      MOVES.forEach((m, i) => {
        const mx = 22 + (i % 2) * 150, my = by + 22 + Math.floor(i / 2) * 24;
        const cd = this.cooldowns[m.id] > 0;
        if (i === this.cursor) renderer.text("▶", mx - 10, my, { color: "#0a0812", size: 9, baseline: "middle" });
        renderer.text(m.name + (cd ? ` (${this.cooldowns[m.id]})` : ""), mx, my, { color: cd ? "#9aa0aa" : "#0a0812", size: 10, baseline: "middle", weight: "bold" });
      });
      renderer.fillRect(320, by + 12, 1, h - by - 24, "#5a7a9a");
      const ctx2 = renderer.ctx;
      ctx2.font = "normal 8px ui-monospace, monospace";
      let ly = by + 22;
      for (const part of wrapText(ctx2, MOVES[this.cursor].desc, 130)) {
        renderer.text(part, 330, ly, { color: "#2a3a4a", size: 8, baseline: "middle" });
        ly += 11;
      }
    }

    // battle intro wipe
    if (this._t < 0.45) {
      const p = this._t / 0.45;
      ctx.fillStyle = "#000";
      for (let i = 0; i < 8; i++) {
        const bw = w * (1 - p);
        ctx.fillRect(i % 2 ? 0 : w - bw, (h / 8) * i, bw, h / 8 + 1);
      }
    }
  }

  _platform(ctx, cx, cy, rw) {
    ctx.fillStyle = "rgba(255,80,120,0.18)";
    ctx.beginPath(); ctx.ellipse(cx, cy, rw / 2, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,120,150,0.5)";
    ctx.beginPath(); ctx.ellipse(cx, cy, rw / 2, 12, 0, 0, Math.PI * 2); ctx.stroke();
  }

  _drawSentinel(ctx, x, y, hidden) {
    if (hidden) return;
    ctx.save();
    ctx.translate(x, y + Math.sin(this._t * 3) * 2);
    ctx.scale(3, 3);
    const hover = 0;
    ctx.fillStyle = "#0a0812"; ctx.fillRect(-8, -7, 16, 14);
    ctx.fillStyle = "#2a1414"; ctx.fillRect(-7, 2 + hover, 14, 4);
    ctx.fillStyle = "#4a2020"; ctx.fillRect(-6, -5, 12, 8);
    ctx.fillStyle = "#6a3030"; ctx.fillRect(-5, -6, 10, 2);
    ctx.fillStyle = "#ffaa1a"; for (let i = -6; i < 7; i += 4) ctx.fillRect(i, 3, 2, 1);
    ctx.fillStyle = "#200000"; ctx.fillRect(-4, -3, 8, 3);
    ctx.fillStyle = "#ff2a2a"; ctx.fillRect(-3, -2, 6, 1);
    ctx.fillStyle = "#ffd0d0"; ctx.fillRect(0, -2, 1, 1);
    ctx.restore();
  }

  _status(renderer, x, y, name, who, lvl, showNum) {
    renderer.fillRect(x, y, 196, showNum ? 52 : 40, "#0a0812");
    renderer.fillRect(x + 2, y + 2, 192, (showNum ? 52 : 40) - 4, "#e8eef4");
    renderer.text(name, x + 10, y + 12, { color: "#0a0812", size: 10, baseline: "middle", weight: "bold" });
    renderer.text(lvl, x + 186, y + 12, { color: "#0a0812", size: 9, baseline: "middle", align: "right" });
    renderer.text("HP", x + 10, y + 27, { color: "#ffaa1a", size: 8, baseline: "middle", weight: "bold" });
    renderer.fillRect(x + 28, y + 23, 156, 8, "#3a3a46");
    const f = who.hp / who.max;
    renderer.fillRect(x + 29, y + 24, Math.round(154 * f), 6, f > 0.5 ? "#2ad86a" : f > 0.2 ? "#e8c020" : "#e83a3a");
    if (showNum) renderer.text(`${who.hp}/${who.max}`, x + 186, y + 42, { color: "#0a0812", size: 9, baseline: "middle", align: "right" });
  }
}

function wrapText(ctx, text, maxW) {
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
