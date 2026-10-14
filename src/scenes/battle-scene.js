import { music } from "../audio/music.js";
import { Drone } from "../entities/drone.js";
import { t } from "../i18n/index.js";
import { gameState, hear, scaledPenalty, useItem } from "../state.js";
import { MOVES, FOE_MOVES, CELL_HEAL, RUN_COST, newBattle, playerMove, enemyTurn, useCell, tryRun, ready, shielded } from "./battle-rules.js";

// Pokémon-style hack battle, triggered when a sentinel spots you. The rules live in
// battle-rules.js; this scene turns their events into text, effects and HP drains. The purge
// clock keeps running the whole time, so every fight costs real seconds.
const TYPE_SPEED = 45;
const INTRO_TIME = 1.1;
const OUTRO_TIME = 0.8;
const HP_DRAIN = 70; // displayed HP per second
const HIT_STOP = 0.08;
const DIFF_SCALE = { story: 0.7, normal: 1, hard: 1.15 }; // sentinel damage

// per class: battle sprite palette and hints, from a nudge to the class weakness
const LOOKS = {
  watcher: { body: "#4a2020", top: "#6a3030", skirt: "#2a1414", stripe: "#ffaa1a", eye: "#ff2a2a" },
  hunter: { body: "#2a1a4a", top: "#4a2e7a", skirt: "#160c2a", stripe: "#4ae6ff", eye: "#4ae6ff" },
  warden: { body: "#3a3a46", top: "#5a5a6a", skirt: "#1a1a22", stripe: "#ff3a4a", eye: "#ff3a4a" },
};
const HINTS = {
  watcher: ["Read NEXT: under its HP bar. That's what it will do after your move.", "A LOCK-ON turns into a PURGE BOLT next turn. SPOOF right before it fires: the bolt is lethal at low integrity.", "WATCHERs run hot: OVERLOAD hits them for half again. PATCH below 45."],
  hunter: ["Read NEXT: HUNTERs LEECH your integrity back into their own.", "When NEXT says PURGE BOLT, JAM breaks the charge before it fires. SPOOF works too.", "HUNTERs are weak to JAM. Save it for the turn they charge: it breaks the bolt and hits for half again."],
  warden: ["Read NEXT: while it says FIREWALL, the shield is up and your hits do half.", "SPOOF or JAM its PURGE BOLT; it hits harder than any other.", "WARDENs are weak to FORK, and FORK slips through the FIREWALL. PATCH on shield turns if FORK is cooling down."],
};

// the option grid: moves fill two columns, BAG and RUN sit in the third
const COLS_X = [22, 112, 206];
const ROW_Y = [20, 36, 52];

export class BattleScene {
  constructor({ sentinel, act = 1, hud, sfx, fx, onResult }) {
    this.sentinel = sentinel;
    this.hud = hud;
    this.sfx = sfx;
    this.fx = fx;
    this.onResult = onResult;
    this.s = newBattle({ kind: sentinel.kind, act, scale: DIFF_SCALE[gameState.difficulty] ?? 1 });
    this.kind = this.s.arch.id;
    this.hints = HINTS[this.kind];
    this.me = this.s.me;
    this.foe = this.s.foe;
    this.view = { me: this.me.hp, foe: this.foe.hp };
    this.shown = { me: this.me.hp, foe: this.foe.hp }; // where the bars drain to, set on impact
    this.echo = new Drone(0, 0);
    this.options = [...this.s.moves.map((id) => MOVES[id]), { id: "bag", name: "BAG" }, { id: "run", name: "RUN" }];
    this.cursor = 0;
    this._t = 0;
    this._anim = 0;
    this._stop = 0;
    this.phase = "intro";
    this.queue = [];
    this.text = null;
    this.shownChars = 0;
    this.flashFoe = 0;
    this.flashMe = 0;
    this.effects = [];
    this.timers = [];
    this.numbers = [];
    this.sparks = [];
    this.lunge = 0;
    this.result = null;
    this._say(`${sentinel.name} wants to fight!`, `${sentinel.name} ${this.intent.tell}`);
    if (!gameState.heard.includes("battle-clock")) { hear("battle-clock"); this._say("The purge clock doesn't stop for a fight. Make it quick."); }
  }

  // the test drivers and the hint overlay read these
  get intent() { return this.s.intent; }
  get cooldowns() { return this.s.cd; }
  get spoofed() { return this.s.spoofed; }
  get knowsWeakness() { return gameState.heard.includes(`weak:${this.kind}`); }

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

  // lines are strings or { text, fn }: fn runs when the line comes up, so hits land with their text
  _say(...lines) {
    this.queue.push(...lines.map((l) => (typeof l === "string" ? { text: l } : l)));
    if (!this.text) this._next();
  }

  _next() {
    const line = this.queue.shift();
    this.text = line ? t(line.text) : null;
    this.shownChars = 0;
    this._lineT = 0;
    line?.fn?.();
  }

  _after(sec, fn) { this.timers.push({ at: this._anim + sec, fn }); }

  update(dt, input) {
    this._t += dt;
    this.hud?.update(dt); // the clock runs during battles
    if (this._stop > 0) { this._stop -= dt; return; } // hit-stop: the whole fight freezes a beat
    this._anim += dt;
    this.echo._t += dt;
    this.flashFoe = Math.max(0, this.flashFoe - dt);
    this.flashMe = Math.max(0, this.flashMe - dt);
    this.lunge = Math.max(0, this.lunge - dt * 3);
    this._lineT += dt;
    for (const tm of this.timers.filter((x) => x.at <= this._anim)) { this.timers.splice(this.timers.indexOf(tm), 1); tm.fn(); }
    this.effects = this.effects.filter((e) => this._anim - e.t0 < e.dur);
    this.numbers = this.numbers.filter((n) => this._anim - n.t0 < 0.9);
    for (const p of this.sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g ?? 0) * dt; p.life -= dt; }
    this.sparks = this.sparks.filter((p) => p.life > 0);
    for (const k of ["me", "foe"]) {
      const d = this.shown[k] - this.view[k];
      this.view[k] += Math.sign(d) * Math.min(Math.abs(d), HP_DRAIN * dt);
    }

    if (this.phase === "outro") {
      if ((this._outroT -= dt) <= 0) {
        this.phase = "done";
        this.game.pop();
        this.onResult(this.result);
      }
      return;
    }
    const ok = input.wasPressed("interact") || input.wasPressed("submit");
    if (this.phase === "intro" && this._t < INTRO_TIME) return;
    if (this.text) {
      if (this.shownChars < this.text.length) {
        this.shownChars = Math.min(this.text.length, this.shownChars + dt * TYPE_SPEED);
        if (ok) this.shownChars = this.text.length;
        return;
      }
      if (!ok || this._lineT < 0.25) return; // a beat per line, so mashing can't skip the hits
      this.sfx.play("select");
      this._next();
      if (!this.text) this._afterMessages();
      return;
    }
    if (this.phase !== "choose") return;

    for (const dir of ["left", "right", "up", "down"]) if (input.wasPressed(dir)) this._moveCursor(dir);
    if (ok) this._choose(this.options[this.cursor], input.wasPressed("submit"));
  }

  _pos(i) {
    const o = this.options[i];
    if (o.id === "bag") return [2, 0];
    if (o.id === "run") return [2, 1];
    return [i % 2, Math.floor(i / 2)];
  }

  _moveCursor(dir) {
    const [c, r] = this._pos(this.cursor);
    const want = { left: [c - 1, r], right: [c + 1, r], up: [c, r - 1], down: [c, r + 1] }[dir];
    let best = -1, bestD = Infinity;
    this.options.forEach((_, i) => {
      const [oc, or] = this._pos(i);
      if (oc !== want[0] || (dir === "up" || dir === "down") && or !== want[1]) return;
      const d = Math.abs(or - want[1]);
      if (d < bestD) { best = i; bestD = d; }
    });
    if (best < 0) return;
    this.cursor = best;
    this.sfx.play("select");
  }

  _choose(opt, submitted) {
    if (opt.id === "run") {
      // running costs time, so Space alone won't do it
      if (!submitted) { this.sfx.play("denied"); this._runNudge = this._anim; return; }
      this.phase = "busy";
      return this._resolve(tryRun(this.s));
    }
    if (opt.id === "bag") {
      if (!useItem("cell")) { this.sfx.play("denied"); this._bagNudge = this._anim; return; } // saved at once
      this.phase = "busy";
      return this._resolve(useCell(this.s));
    }
    if (!ready(this.s, opt.id)) { this.sfx.play("denied"); return; }
    this.phase = "busy";
    this._resolve(playerMove(this.s, opt.id));
  }

  _afterMessages() {
    if (this.phase === "intro") { this.phase = "choose"; return; }
    this.shown = { me: this.me.hp, foe: this.foe.hp };
    if (this.phase === "won" || this.phase === "lost" || this.phase === "fled") {
      this.result = this.phase;
      this.phase = "outro";
      this._outroT = OUTRO_TIME;
      return;
    }
    if (this.phase === "enemy") { this.phase = "busy"; this._resolve(enemyTurn(this.s)); return; }
    if (this.phase === "end-turn") this.phase = "choose";
  }

  // --- events -> lines and effects ----------------------------------------------------------

  _resolve(events) {
    const name = this.sentinel.name;
    const lines = [];
    const hits = events.filter((e) => e.type === "hit");
    for (const e of events) {
      switch (e.type) {
        case "use":
          lines.push({ text: `ECHO used ${e.move.name}!`, fn: () => this._moveFx(e.move, hits) });
          break;
        case "hit":
          if (e.target === "foe") {
            if (e.crit) lines.push("A critical exploit!");
            if (e.weak && !lines.some((l) => l.weak)) {
              const first = !this.knowsWeakness;
              hear(`weak:${this.kind}`);
              lines.push({ text: first ? `EXPLOIT FOUND! ${this.s.arch.cls}s are weak to ${e.move.name}.` : "It's an exploit! Half again the damage.", weak: true });
            }
            if (e.blunt && !lines.some((l) => l.blunt)) lines.push({ text: "The FIREWALL soaked up half of it.", blunt: true });
          }
          break;
        case "self":
          lines.push({ text: "ECHO took feedback damage.", fn: () => { this.shown.me = this.me.hp; this.flashMe = 0.3; } });
          break;
        case "break":
          lines.push({ text: "The LOCK-ON broke! The charge fizzled out.", fn: () => this._burst(350, 92, "#4ae6ff", 18) });
          break;
        case "spoof":
          lines.push("ECHO is broadcasting a fake signature.");
          break;
        case "heal":
          if (e.target === "me") lines.push({ text: "Integrity restored.", fn: () => { this.shown.me = this.me.hp; this._number(120, 176, `+${e.amount}`, "#2ad86a"); } });
          else lines.push({ text: `${name} drained ECHO's power!`, fn: () => { this.shown.foe = this.foe.hp; this._number(350, 70, `+${e.amount}`, "#b07aff"); } });
          break;
        case "cell":
          lines.push({ text: `ECHO burned a BACKUP CELL. +${e.amount} integrity.`, fn: () => {
            this.sfx.play("item"); this.shown.me = this.me.hp; this._number(120, 176, `+${e.amount}`, "#e8d84a");
            this._burst(120, 186, "#e8d84a", 20, -60);
          } });
          break;
        case "fled":
          lines.push({ text: "ECHO scrambled the trace. You broke away!", fn: () => { this.sfx.play("iris"); this.effects.push({ kind: "flee", t0: this._anim, dur: 1.2 }); } });
          lines.push(`Shaking it off cost ${scaledPenalty(RUN_COST)} s of the purge clock.`);
          break;
        case "run-failed":
          lines.push({ text: "Couldn't shake it! It's still locked on.", fn: () => this.sfx.play("denied") });
          break;
        case "charge":
          lines.push({ text: `${name} locked on. Its PURGE BOLT is charging!`, fn: () => { this.sfx.play("detect"); this._converge(); } });
          break;
        case "reel":
          lines.push(`${name} is rebooting its targeting. It lost its turn!`);
          break;
        case "shield":
          lines.push({ text: `${name} hid behind its FIREWALL and patched itself.`, fn: () => { this.shown.foe = this.foe.hp; if (e.amount) this._number(350, 70, `+${e.amount}`, "#ff8a9a"); } });
          break;
        case "foe-use":
          lines.push({ text: `${name} used ${e.move.name}!`, fn: () => this._foeFx(e.move, events) });
          break;
        case "blocked":
          lines.push({ text: "…but it hit the spoofed signature. No damage!", fn: () => this.sfx.play("denied") });
          break;
        case "intent":
          lines.push(`${name} ${this.intent.tell}`);
          break;
      }
    }
    const s = this.s;
    if (s.over === "won") {
      this.phase = "won";
      lines.push({ text: `${name} crashed!`, fn: () => this._victory() }, "It will be rebooting for a while. Slip past while you can.");
    } else if (s.over === "lost") {
      this.phase = "lost";
      lines.push({ text: "ECHO's cover is blown!", fn: () => this._defeat() }, "The sentinel tags you…");
    } else if (s.over === "fled") {
      this.phase = "fled";
    } else {
      this.phase = events.some((e) => e.type === "intent") ? "end-turn" : "enemy";
    }
    this._say(...lines);
  }

  // ECHO's move: an effect from ECHO to the sentinel, then the hits land at its impact time(s)
  _moveFx(move, hits) {
    const t0 = this._anim;
    const foeHits = hits.filter((h) => h.target === "foe");
    const fx = { ping: 0.32, overload: 0.3, jam: 0.3, fork: 0.24 }[move.id];
    if (move.id === "spoof") { this.sfx.play("confirm"); this.effects.push({ kind: "spoof", t0, dur: 0.7 }); return; }
    if (move.id === "patch") { this.sfx.play("item"); this._burst(120, 196, "#2ad86a", 16, -70); this.effects.push({ kind: "patch", t0, dur: 0.7 }); return; }
    this.effects.push({ kind: move.id, t0, dur: fx + 0.25 });
    this.sfx.play(move.id === "overload" ? "zap" : move.id === "ping" ? "blip" : "spark");
    foeHits.forEach((h, i) => this._after(fx + i * 0.22, () => {
      this.shown.foe = Math.max(0, this.shown.foe - h.dmg);
      this.flashFoe = 0.35;
      this._stop = HIT_STOP * (h.crit || h.weak ? 1.6 : 1);
      this._shake(move.id === "overload" || h.crit ? 5 : 2.5);
      this._number(350 + i * 10, 64, `${h.dmg}${h.crit ? "!" : ""}`, h.weak ? "#ffd15a" : "#ffffff");
      this._burst(350, 92, move.id === "overload" ? "#ffe08a" : "#9ae6ff", 12);
      this.sfx.play("stamp");
      if (move.id === "overload") this.fx.shake();
    }));
  }

  _foeFx(move, events) {
    const t0 = this._anim;
    const hit = events.find((e) => e.type === "hit" && e.target === "me");
    const blocked = events.some((e) => e.type === "blocked");
    const bolt = move === FOE_MOVES.fire;
    const at = bolt ? 0.4 : 0.3;
    this.effects.push({ kind: `foe-${move.id}`, t0, dur: at + 0.2 });
    if (move.id === "crush") this.lunge = 1;
    this.sfx.play(bolt ? "zap" : "detect");
    this._after(at, () => {
      if (blocked) { this.effects.push({ kind: "deflect", t0: this._anim, dur: 0.4 }); this._burst(120, 186, "#4ae6ff", 14); return; }
      if (!hit) return;
      this.shown.me = Math.max(0, this.shown.me - hit.dmg);
      this.flashMe = 0.4;
      this._stop = HIT_STOP * (bolt ? 2 : 1);
      this._shake(bolt ? 7 : 3);
      this._number(120, 160, `-${hit.dmg}`, bolt ? "#ff5a5a" : "#ffb0b0");
      this._burst(120, 186, "#ff4a4a", bolt ? 26 : 10);
      this.sfx.play(bolt ? "zap" : "error");
      if (bolt) { this.fx.shake(); this.fx.flash("#ff2040"); }
      else this.fx.flash("#ff2040");
    });
  }

  _victory() {
    this.sfx.play("success");
    this.effects.push({ kind: "crash", t0: this._anim, dur: 99 });
    this._burst(350, 92, "#ff8a3a", 40, -40, 220);
    this._shake(6);
  }

  _defeat() {
    this.sfx.play("zap");
    this.effects.push({ kind: "tagged", t0: this._anim, dur: 99 });
    this._burst(120, 186, "#ff3a3a", 30);
    this._shake(6);
    this.fx.glitch();
  }

  _shake(n) { if (!gameState.calmFx) this._shakeAmt = Math.max(this._shakeAmt ?? 0, n); }
  _number(x, y, text, color) { this.numbers.push({ x, y, text, color, t0: this._anim }); }
  _burst(x, y, color, n, vy = 0, g = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 90;
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + vy, g, life: 0.4 + Math.random() * 0.4, color });
    }
  }
  _converge() {
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 20;
      this.sparks.push({ x: 350 + Math.cos(a) * r, y: 92 + Math.sin(a) * r, vx: -Math.cos(a) * r * 2, vy: -Math.sin(a) * r * 2, life: 0.45, color: "#ff5a5a" });
    }
  }

  // --- rendering -----------------------------------------------------------------

  render(renderer) {
    const w = renderer.width, h = renderer.height;
    const ctx = renderer.ctx;
    const a = this._anim;
    ctx.save();
    if (this._shakeAmt > 0.2) {
      ctx.translate((Math.random() - 0.5) * this._shakeAmt, (Math.random() - 0.5) * this._shakeAmt);
      this._shakeAmt *= 0.85;
    }
    // backdrop: grid horizon, tinted by the sentinel class
    const tint = { watcher: ["#14060c", "#2a0c18", "255,60,100"], hunter: ["#0a0614", "#1a0c2e", "150,90,255"], warden: ["#0a0c12", "#1a1e2a", "150,170,210"] }[this.kind];
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, tint[0]);
    sky.addColorStop(0.6, tint[1]);
    sky.addColorStop(1, "#0a0408");
    ctx.fillStyle = sky;
    ctx.fillRect(-8, -8, w + 16, h + 16);
    ctx.strokeStyle = `rgba(${tint[2]},0.18)`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const y = 120 + i * i * 1.4;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (let i = -10; i <= 10; i++) {
      ctx.beginPath(); ctx.moveTo(w / 2 + i * 12, 120); ctx.lineTo(w / 2 + i * 80, h); ctx.stroke();
    }

    this._platform(ctx, 350, 108, 120, tint[2]);
    this._platform(ctx, 120, 210, 140, tint[2]);

    // intro: sprites slide in
    const k = Math.min(1, this._t / INTRO_TIME);
    const ease = 1 - Math.pow(1 - k, 3);
    const foeX = 350 + (1 - ease) * 200 - this.lunge * 40, meX = 120 - (1 - ease) * 200;
    const fled = this.effects.find((e) => e.kind === "flee");
    const meOff = fled ? -Math.min(1, (a - fled.t0) / 0.8) * 220 : 0;

    const crash = this.effects.find((e) => e.kind === "crash");
    if (!(this.flashFoe > 0 && Math.floor(this._t * 20) & 1)) this._drawSentinel(ctx, foeX, 90, crash ? a - crash.t0 : 0);
    if (shielded(this.s) && this.phase !== "won") this._drawShield(ctx, foeX, 90);
    if (this.intent === FOE_MOVES.fire && !crash) {
      // charging: a pulsing glow that says "this one hurts"
      ctx.fillStyle = `rgba(255,60,60,${0.15 + 0.12 * Math.sin(a * 12)})`;
      ctx.beginPath(); ctx.arc(foeX, 92, 30 + 4 * Math.sin(a * 12), 0, Math.PI * 2); ctx.fill();
    }
    const tagged = this.effects.find((e) => e.kind === "tagged");
    if (!(this.flashMe > 0 && Math.floor(this._t * 20) & 1)) {
      ctx.save();
      if (tagged) ctx.globalAlpha = Math.max(0.15, 1 - (a - tagged.t0));
      ctx.translate(meX + meOff + (tagged ? (Math.random() - 0.5) * 6 : 0), 186);
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
    for (const e of this.effects) this._drawEffect(ctx, e, a - e.t0, foeX, meX);
    for (const p of this.sparks) { ctx.fillStyle = p.color; ctx.globalAlpha = Math.min(1, p.life * 3); ctx.fillRect(p.x | 0, p.y | 0, 2, 2); }
    ctx.globalAlpha = 1;
    for (const n of this.numbers) {
      const age = a - n.t0;
      ctx.globalAlpha = Math.min(1, 2 * (0.9 - age) / 0.9 + 0.2);
      renderer.text(n.text, n.x, n.y - age * 26, { color: "#000", size: 12, weight: "bold", align: "center" });
      renderer.text(n.text, n.x - 1, n.y - age * 26 - 1, { color: n.color, size: 12, weight: "bold", align: "center" });
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // status boxes
    const weak = this.knowsWeakness ? `  WEAK: ${MOVES[this.s.arch.weak].name}` : "";
    this._status(renderer, 16, 18, this.sentinel.name, this.view.foe, this.foe.max, `${this.s.arch.cls} Lv.${this.s.arch.level}`, false);
    this._status(renderer, 268, 166, "ECHO", this.view.me, this.me.max, `Lv.${String(this.me.level).padStart(2, "0")}`, true);
    if (weak) renderer.text(weak.trim(), 206, 62, { color: "#ffd15a", size: 8, weight: "bold", align: "right" });
    // telegraphed intent
    if (["choose", "busy", "enemy", "end-turn"].includes(this.phase)) {
      const danger = this.intent.charge || this.intent === FOE_MOVES.fire;
      renderer.text(`NEXT: ${this.intent.name}`, 22, 62, { color: danger ? "#ff5a5a" : this.intent.shield ? "#ff8a9a" : "#ffaa3a", size: 8, weight: "bold" });
    }
    // the purge clock keeps running in here
    const secs = Math.max(0, Math.ceil(gameState.secondsLeft));
    const clock = `◷ ${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
    renderer.text(clock, w - 12, 10, { color: Math.floor(this._t * 2) & 1 ? "#ff8a8a" : "#ff5a5a", size: 9, weight: "bold", align: "right" });

    // message / move box
    const by = 236;
    renderer.fillRect(0, by, w, h - by, "#0a0812");
    renderer.fillRect(4, by + 4, w - 8, h - by - 8, "#e8eef4");
    renderer.strokeRect(8, by + 8, w - 16, h - by - 16, "#5a7a9a", 1);
    if (this.text) {
      ctx.font = "normal 10px ui-monospace, monospace";
      const s = this.text.slice(0, Math.floor(this.shownChars));
      wrapText(ctx, s, w - 60, false).slice(0, 3).forEach((part, i) => renderer.text(part, 22, by + 22 + i * 14, { color: "#0a0812", size: 10, baseline: "middle" }));
      if (this.shownChars >= this.text.length && Math.floor(this._t * 3) & 1) renderer.text("▼", w - 26, h - 22, { color: "#2a5a8a", size: 9, baseline: "middle" });
    } else if (this.phase === "choose") {
      this.options.forEach((m, i) => {
        const [c, r] = this._pos(i);
        const mx = COLS_X[c], my = by + ROW_Y[r];
        const cd = this.s.cd[m.id] > 0;
        const empty = m.id === "bag" && !(gameState.items.cell > 0);
        const label = m.id === "bag" ? `${t("BAG")} (${gameState.items.cell ?? 0})` : m.name + (cd ? ` (${this.s.cd[m.id]})` : "");
        if (i === this.cursor) renderer.text("▶", mx - 10, my, { color: "#0a0812", size: 9, baseline: "middle" });
        renderer.text(label, mx, my, { color: cd || empty ? "#7a808a" : m.id === "run" ? "#8a2a2a" : "#0a0812", size: 10, baseline: "middle", weight: "bold" });
      });
      renderer.fillRect(196, by + 14, 1, h - by - 28, "#9aaabb");
      renderer.fillRect(300, by + 12, 1, h - by - 24, "#5a7a9a");
      ctx.font = "normal 8px ui-monospace, monospace";
      let ly = by + 20;
      for (const part of wrapText(ctx, this._desc(this.options[this.cursor]), 160).slice(0, 5)) {
        renderer.text(part, 308, ly, { color: "#1a2632", size: 8, baseline: "middle" });
        ly += 11;
      }
    }

    // battle intro wipe, outro fade
    if (this._t < 0.45) {
      const p = this._t / 0.45;
      ctx.fillStyle = "#000";
      for (let i = 0; i < 8; i++) {
        const bw = w * (1 - p);
        ctx.fillRect(i % 2 ? 0 : w - bw, (h / 8) * i, bw, h / 8 + 1);
      }
    }
    if (this.phase === "outro" || this.phase === "done") {
      const p = 1 - Math.max(0, this._outroT) / OUTRO_TIME;
      const banner = { won: ["SENTINEL CRASHED", "#0aff7a"], lost: ["TAGGED", "#ff4a4a"], fled: ["GOT AWAY", "#4ae6ff"] }[this.result];
      ctx.fillStyle = `rgba(0,0,0,${0.7 * p})`;
      ctx.fillRect(0, 0, w, h);
      if (banner) {
        ctx.fillStyle = "rgba(0,0,0,0.75)";
        ctx.fillRect(0, h / 2 - 22, w, 44);
        renderer.text(banner[0], w / 2, h / 2, { color: banner[1], size: 18, weight: "bold", align: "center", baseline: "middle" });
      }
    }
  }

  _desc(o) {
    if (o.id === "bag") {
      const n = gameState.items.cell ?? 0;
      if (this._bagNudge !== undefined && this._anim - this._bagNudge < 1.5 && !n) return "No backup cells. Find them in capsules and safes.";
      return `Burn a BACKUP CELL: +${CELL_HEAL} integrity. That cell won't buy purge time later.`;
    }
    if (o.id === "run") {
      const pct = Math.round(this.s.arch.flee * 100);
      const msg = `${pct}% chance to break away. Costs ${scaledPenalty(RUN_COST)} s. Press Enter.`;
      return this._runNudge !== undefined && this._anim - this._runNudge < 1.5 ? `Enter to run. ${msg}` : msg;
    }
    return o.desc;
  }

  _platform(ctx, cx, cy, rw, rgb) {
    ctx.fillStyle = `rgba(${rgb},0.18)`;
    ctx.beginPath(); ctx.ellipse(cx, cy, rw / 2, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(${rgb},0.5)`;
    ctx.beginPath(); ctx.ellipse(cx, cy, rw / 2, 12, 0, 0, Math.PI * 2); ctx.stroke();
  }

  _drawShield(ctx, x, y) {
    ctx.save();
    ctx.strokeStyle = `rgba(255,120,140,${0.5 + 0.25 * Math.sin(this._anim * 6)})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const a0 = (i / 6) * Math.PI * 2 + this._anim * 0.6;
      ctx.beginPath();
      for (let j = 0; j <= 6; j++) {
        const a1 = a0 + (j / 6) * Math.PI * 2;
        const px = x + Math.cos(a1) * 6 + Math.cos(a0) * 26, py = y + Math.sin(a1) * 6 + Math.sin(a0) * 22;
        j ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawEffect(ctx, e, age, foeX, meX) {
    const fx = foeX, fy = 92, ex = meX, ey = 186;
    const lerp = (p) => [ex + (fx - ex) * p, ey + (fy - ey) * p];
    ctx.save();
    switch (e.kind) {
      case "ping": // rings travelling out to the target
        for (let i = 0; i < 3; i++) {
          const p = Math.min(1, (age - i * 0.05) / 0.32);
          if (p <= 0) continue;
          const [x, y] = lerp(p);
          ctx.strokeStyle = `rgba(154,230,255,${1 - p * 0.6})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x, y, 4 + p * 8, 0, Math.PI * 2); ctx.stroke();
        }
        break;
      case "overload": case "fork": { // jagged arcs; FORK throws two
        const n = e.kind === "fork" ? 2 : 1;
        for (let b = 0; b < n; b++) {
          const p = Math.min(1, (age - b * 0.22) / 0.3);
          if (p <= 0 || age - b * 0.22 > 0.45) continue;
          ctx.strokeStyle = e.kind === "fork" ? "#9affc8" : "#ffe08a";
          ctx.lineWidth = e.kind === "fork" ? 1.5 : 2.5;
          ctx.beginPath(); ctx.moveTo(ex, ey - 6);
          for (let s = 1; s <= 8; s++) {
            const [x, y] = lerp((s / 8) * p);
            ctx.lineTo(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10 + (b ? 6 : 0));
          }
          ctx.stroke();
        }
        break;
      }
      case "jam": // static blocks around the target
        for (let i = 0; i < 24; i++) {
          ctx.fillStyle = Math.random() < 0.5 ? "rgba(74,230,255,0.8)" : "rgba(255,255,255,0.7)";
          ctx.fillRect(fx - 30 + Math.random() * 60, fy - 24 + Math.random() * 48, 3, 2);
        }
        break;
      case "spoof": { // a hologram double sliding out of ECHO
        const p = Math.min(1, age / 0.5);
        ctx.globalAlpha = 0.5 * (1 - p * 0.5);
        ctx.strokeStyle = "#4ae6ff";
        ctx.lineWidth = 1;
        for (const dx of [-1, 1]) { ctx.beginPath(); ctx.arc(ex + dx * p * 22, ey + 2, 14, 0, Math.PI * 2); ctx.stroke(); }
        break;
      }
      case "patch": {
        ctx.fillStyle = `rgba(42,216,106,${1 - age / 0.7})`;
        for (let i = 0; i < 4; i++) { const x = ex - 24 + i * 16, y = ey - 10 - age * 40 - (i % 2) * 8; ctx.fillRect(x - 3, y, 7, 1); ctx.fillRect(x, y - 3, 1, 7); }
        break;
      }
      case "foe-trace": { // a dashed lock line onto ECHO
        const p = Math.min(1, age / 0.3);
        ctx.strokeStyle = "rgba(255,90,90,0.9)";
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(fx, fy); const [x, y] = lerp(1 - p); ctx.lineTo(x, y); ctx.stroke();
        break;
      }
      case "foe-scan": { // a sweep bar across ECHO
        const p = Math.min(1, age / 0.3);
        ctx.fillStyle = "rgba(255,170,58,0.35)";
        ctx.fillRect(ex - 40 + p * 60, ey - 30, 6, 60);
        break;
      }
      case "foe-leech": { // ECHO's power flowing over
        for (let i = 0; i < 6; i++) {
          const p = Math.min(1, Math.max(0, (age - i * 0.04) / 0.4));
          const [x, y] = lerp(p);
          ctx.fillStyle = "#b07aff";
          ctx.fillRect(x + Math.sin(i + age * 20) * 4, y, 3, 3);
        }
        break;
      }
      case "foe-crush": break; // the lunge is the animation
      case "foe-fire": { // the charged beam
        const p = Math.min(1, age / 0.4);
        const [x, y] = lerp(1 - p);
        ctx.strokeStyle = "rgba(255,60,60,0.85)";
        ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(x, y); ctx.stroke();
        ctx.strokeStyle = "#fff0f0";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(x, y); ctx.stroke();
        break;
      }
      case "deflect": {
        ctx.strokeStyle = `rgba(74,230,255,${1 - age / 0.4})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(ex, ey + 4, 30 + age * 30, 0, Math.PI * 2); ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }

  // one sprite per class: WATCHER is the squat dome, HUNTER a spiked diamond, WARDEN a plated block
  _drawSentinel(ctx, x, y, crashAge) {
    const L = LOOKS[this.kind];
    ctx.save();
    const sink = crashAge ? Math.min(1, crashAge / 0.8) : 0;
    ctx.translate(x + (crashAge ? (Math.random() - 0.5) * 4 * (1 - sink) : 0), y + Math.sin(this._anim * 3) * 2 * (1 - sink) + sink * 14);
    ctx.scale(3, 3);
    if (sink) ctx.globalAlpha = 1 - sink * 0.6;
    const eye = crashAge ? "#3a1010" : L.eye;
    if (this.kind === "hunter") {
      ctx.fillStyle = "#0a0812"; ctx.fillRect(-7, -9, 14, 16);
      ctx.fillStyle = L.skirt; ctx.fillRect(-5, 3, 10, 3);
      ctx.fillStyle = L.body; ctx.fillRect(-6, -4, 12, 7); ctx.fillRect(-4, -7, 8, 3);
      ctx.fillStyle = L.top; ctx.fillRect(-3, -8, 6, 2);
      ctx.fillStyle = L.stripe; ctx.fillRect(-7, -11, 1, 5); ctx.fillRect(6, -11, 1, 5); // antennae
      ctx.fillStyle = "#08040e"; ctx.fillRect(-5, -3, 10, 2);
      ctx.fillStyle = eye; ctx.fillRect(-4, -3, 8, 1);
    } else if (this.kind === "warden") {
      ctx.fillStyle = "#0a0812"; ctx.fillRect(-10, -8, 20, 15);
      ctx.fillStyle = L.skirt; ctx.fillRect(-9, 2, 18, 4);
      ctx.fillStyle = L.body; ctx.fillRect(-8, -6, 16, 9);
      ctx.fillStyle = L.top; ctx.fillRect(-10, -7, 4, 5); ctx.fillRect(6, -7, 4, 5); // shoulder plates
      ctx.fillStyle = L.stripe; for (let i = -8; i < 9; i += 4) ctx.fillRect(i, 3, 2, 1);
      ctx.fillStyle = "#200000"; ctx.fillRect(-5, -4, 10, 3);
      ctx.fillStyle = eye; for (const ex of [-4, -1, 2]) ctx.fillRect(ex, -3, 2, 1);
    } else {
      ctx.fillStyle = "#0a0812"; ctx.fillRect(-8, -7, 16, 14);
      ctx.fillStyle = L.skirt; ctx.fillRect(-7, 2, 14, 4);
      ctx.fillStyle = L.body; ctx.fillRect(-6, -5, 12, 8);
      ctx.fillStyle = L.top; ctx.fillRect(-5, -6, 10, 2);
      ctx.fillStyle = L.stripe; for (let i = -6; i < 7; i += 4) ctx.fillRect(i, 3, 2, 1);
      ctx.fillStyle = "#200000"; ctx.fillRect(-4, -3, 8, 3);
      ctx.fillStyle = eye; ctx.fillRect(-3, -2, 6, 1);
      ctx.fillStyle = "#ffd0d0"; ctx.fillRect(0, -2, 1, 1);
    }
    ctx.restore();
  }

  _status(renderer, x, y, name, hp, max, lvl, showNum) {
    renderer.fillRect(x, y, 196, showNum ? 52 : 40, "#0a0812");
    renderer.fillRect(x + 2, y + 2, 192, (showNum ? 52 : 40) - 4, "#e8eef4");
    renderer.text(name, x + 10, y + 12, { color: "#0a0812", size: 10, baseline: "middle", weight: "bold" });
    renderer.text(lvl, x + 186, y + 12, { color: "#0a0812", size: 9, baseline: "middle", align: "right" });
    renderer.text("HP", x + 10, y + 27, { color: "#b06a00", size: 8, baseline: "middle", weight: "bold" });
    renderer.fillRect(x + 28, y + 23, 156, 8, "#3a3a46");
    const f = Math.max(0, hp / max);
    renderer.fillRect(x + 29, y + 24, Math.round(154 * f), 6, f > 0.5 ? "#2ad86a" : f > 0.2 ? "#e8c020" : "#e83a3a");
    if (showNum) renderer.text(`${Math.round(hp)}/${max}`, x + 186, y + 42, { color: "#0a0812", size: 9, baseline: "middle", align: "right" });
  }
}

function wrapText(ctx, text, maxW, translate = true) {
  if (translate) text = t(text);
  const out = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out;
}
