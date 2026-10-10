import { gameState, penalize, scaledPenalty } from "../state.js";
import { music } from "../audio/music.js";

// C1 — firewall run. An action beat: steer a data packet up and down through scrolling firewall
// gates for RUN_TIME seconds. ECHO flies ahead and its cyan wake marks the next open gap.
// Three hits and the packet is deleted (time penalty, restart the run).
const RUN_TIME = 55;
const SPEED_START = 90;
const SPEED_END = 165;
const GAP_START = 82;
const GAP_END = 52;
const SPACING_START = 150;
const SPACING_END = 105;
const MAX_HP = 3;
const TIME_PENALTY = 30;
const TOP = 34;
const CHECKPOINT = 0.5; // dying past the halfway mark restarts from there
// wider gaps and slower scrolling on Story, a little meaner on Hard
const TUNING = { story: { gap: 1.35, speed: 0.85 }, normal: { gap: 1, speed: 1 }, hard: { gap: 0.9, speed: 1.1 } };
const BOTTOM = 290;

export class FirewallScene {
  constructor({ hud, sfx, fx, onResult }) {
    this.hints = ["Follow ECHO's dotted cyan line — it always points at the next gap.", "Use short taps. The packet keeps drifting after you let go.", "Past the halfway mark the gaps start sliding. Aim for the middle of each one."];
    this.hud = hud;
    this.sfx = sfx;
    this.fx = fx;
    this.onResult = onResult;
    this._t = 0;
    this.attempt = 0;
    this._reset();
  }

  onEnter() { document.body.classList.add("no-objective", "in-puzzle"); music.play("finale"); music.setIntensity(0.6); }
  onExit() { document.body.classList.remove("no-objective", "in-puzzle"); }

  _reset() {
    this.mode = "ready";
    this.timer = 0;
    this.elapsed = 0;
    this.y = (TOP + BOTTOM) / 2;
    this.vy = 0;
    this.hp = MAX_HP;
    this.invuln = 0;
    this.gates = [];
    this.nextGate = 220;
    this.lastGapY = this.y;
    this.trail = [];
    this.particles = [];
    this.attempt++;
    if (this.reachedCheckpoint) {
      this.elapsed = RUN_TIME * CHECKPOINT;
      this.nextGate = 160;
    }
  }

  get tuning() { return TUNING[gameState.difficulty] ?? TUNING.normal; }

  get progress() { return Math.min(1, this.elapsed / RUN_TIME); }

  update(dt, input) {
    this._t += dt;
    this.hud.update(dt);
    if (this.mode === "ready") {
      if (input.wasPressed("pause")) { this.onResult({ success: false, aborted: true }); return; }
      if (input.wasPressed("interact") || input.wasPressed("submit") || input.wasPressed("up") || input.wasPressed("down")) {
        this.mode = "run";
        this.sfx.play("door");
      }
      return;
    }
    if (this.mode === "dead" || this.mode === "won") {
      this.timer -= dt;
      if (this.timer > 0) return;
      if (this.mode === "won") {
        this.onResult({
          success: true,
          aborted: false,
          report: [
            "[C1] You're through the firewall. ECHO's signature carried you in.",
            "The uplink is the last door. HALCYON knows you're coming.",
            "Enter the code. LUMEN, ORION, AURORA. Then this night is over.",
          ],
        });
      } else {
        this._reset();
      }
      return;
    }

    const p = this.progress;
    const speed = (SPEED_START + (SPEED_END - SPEED_START) * p) * this.tuning.speed;
    this.elapsed += dt;
    if (!this.reachedCheckpoint && this.progress >= CHECKPOINT) {
      this.reachedCheckpoint = true;
      this.sfx.play("confirm");
      this.checkpointFlash = 1.5;
    }
    this.checkpointFlash = Math.max(0, (this.checkpointFlash ?? 0) - dt);
    // steering with a little inertia
    const dir = (input.isDown("down") ? 1 : 0) - (input.isDown("up") ? 1 : 0);
    this.vy += dir * 900 * dt;
    this.vy *= Math.pow(0.0015, dt);
    this.y = Math.max(TOP + 6, Math.min(BOTTOM - 6, this.y + this.vy * dt));
    this.invuln = Math.max(0, this.invuln - dt);

    for (const g of this.gates) g.x -= speed * dt;
    this.gates = this.gates.filter((g) => g.x > -20);
    this.nextGate -= speed * dt;
    if (this.nextGate <= 0 && this.elapsed < RUN_TIME - 1.5) {
      const gap = (GAP_START + (GAP_END - GAP_START) * p) * this.tuning.gap;
      // keep consecutive gaps reachable
      const reach = 70 + 60 * (1 - p);
      const gy = Math.max(TOP + gap / 2 + 4, Math.min(BOTTOM - gap / 2 - 4, this.lastGapY + (Math.random() * 2 - 1) * reach));
      this.lastGapY = gy;
      this.gates.push({ x: 500, gapY: gy, gap, w: 12, moving: p > 0.45 && Math.random() < 0.5, phase: Math.random() * 6 });
      this.nextGate = SPACING_START + (SPACING_END - SPACING_START) * p;
    }
    for (const g of this.gates) if (g.moving) g.gapY += Math.sin(this._t * 2 + g.phase) * 22 * dt;

    // collision
    const px = 90;
    for (const g of this.gates) {
      if (px + 6 < g.x || px - 6 > g.x + g.w) continue;
      const inGap = Math.abs(this.y - g.gapY) < g.gap / 2 - 5;
      if (!inGap && this.invuln <= 0 && !g.hit) {
        g.hit = true;
        this.hp--;
        this.invuln = 1;
        this.sfx.play("zap");
        this.fx.shake();
        this.fx.flash("#ff2020");
        this._burst(px, this.y, "#ff4060");
        if (this.hp <= 0) {
          this.mode = "dead";
          this.timer = 1.8;
          penalize(TIME_PENALTY);
          this.sfx.play("error");
          this.fx.glitch();
        }
      }
    }
    this.trail.unshift({ x: px, y: this.y });
    if (this.trail.length > 16) this.trail.pop();
    for (const q of this.particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
    this.particles = this.particles.filter((q) => q.life > 0);

    if (this.elapsed >= RUN_TIME && this.mode === "run") {
      this.mode = "won";
      this.timer = 1.8;
      this.sfx.play("success");
      this.fx.flash("#0aff7a");
      this._burst(px, this.y, "#0aff7a");
    }
  }

  _burst(x, y, color) {
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 120;
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6, color });
    }
  }

  render(renderer) {
    const w = renderer.width, h = renderer.height;
    const ctx = renderer.ctx;
    renderer.fillRect(0, 0, w, h, "#080206");
    // scrolling data grid
    const off = (this._t * (SPEED_START + 60 * this.progress)) % 24;
    for (let x = -off; x < w; x += 24) renderer.fillRect(x, TOP, 1, BOTTOM - TOP, "rgba(255,40,80,0.08)");
    for (let y = TOP; y <= BOTTOM; y += 24) renderer.fillRect(0, y, w, 1, "rgba(255,40,80,0.06)");
    renderer.fillRect(0, TOP - 2, w, 2, "#ff3a5a");
    renderer.fillRect(0, BOTTOM, w, 2, "#ff3a5a");

    // ECHO's wake toward the next gap
    const next = this.gates.find((g) => g.x > 90);
    if (next && this.mode === "run") {
      ctx.strokeStyle = "rgba(74,230,255,0.35)";
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(110, this.y);
      ctx.quadraticCurveTo((110 + next.x) / 2, next.gapY, next.x, next.gapY);
      ctx.stroke();
      ctx.setLineDash([]);
      renderer.fillRect(next.x + 16, next.gapY - 3, 6, 4, "#4ae6ff");
    }

    for (const g of this.gates) {
      const top = g.gapY - g.gap / 2, bot = g.gapY + g.gap / 2;
      const col = g.hit ? "#5a1020" : "#ff2a4a";
      renderer.fillRect(g.x, TOP, g.w, top - TOP, col);
      renderer.fillRect(g.x, bot, g.w, BOTTOM - bot, col);
      renderer.fillRect(g.x + g.w / 2 - 1, TOP, 2, top - TOP, "#ffc0c8");
      renderer.fillRect(g.x + g.w / 2 - 1, bot, 2, BOTTOM - bot, "#ffc0c8");
      renderer.fillRect(g.x - 3, top - 2, g.w + 6, 2, "#ffe0e4");
      renderer.fillRect(g.x - 3, bot, g.w + 6, 2, "#ffe0e4");
    }

    // packet + trail
    this.trail.forEach((t, i) => {
      ctx.globalAlpha = (1 - i / this.trail.length) * 0.5;
      renderer.fillRect(t.x - 2 - i * 3, t.y - 2, 4, 4, "#4ae6ff");
    });
    ctx.globalAlpha = this.invuln > 0 && Math.floor(this._t * 20) & 1 ? 0.3 : 1;
    if (this.mode !== "dead") {
      ctx.fillStyle = "#cffcff";
      ctx.beginPath();
      ctx.moveTo(98, this.y); ctx.lineTo(90, this.y - 7); ctx.lineTo(82, this.y); ctx.lineTo(90, this.y + 7);
      ctx.fill();
      renderer.fillRect(88, this.y - 2, 4, 4, "#4ae6ff");
    }
    ctx.globalAlpha = 1;
    for (const q of this.particles) {
      ctx.globalAlpha = q.life / 0.6;
      renderer.fillRect(q.x, q.y, 2, 2, q.color);
    }
    ctx.globalAlpha = 1;

    // HUD strip
    renderer.fillRect(0, 0, w, 26, "#1a0610");
    renderer.text("C1 // FIREWALL RUN", 8, 13, { color: "#ff8a9a", size: 11, weight: "bold", baseline: "middle" });
    for (let i = 0; i < MAX_HP; i++) renderer.fillRect(170 + i * 14, 8, 10, 10, i < this.hp ? "#4ae6ff" : "#2a0a14");
    renderer.fillRect(230, 10, 200, 6, "#2a0a14");
    renderer.fillRect(230, 10, 200 * this.progress, 6, "#0aff7a");
    renderer.fillRect(230 + 200 * CHECKPOINT - 1, 7, 2, 12, this.reachedCheckpoint ? "#0aff7a" : "#ffaa3a");
    renderer.text(`${Math.floor(this.progress * 100)}%`, w - 8, 13, { color: "#0aff7a", size: 9, align: "right", baseline: "middle", weight: "bold" });

    renderer.fillRect(0, h - 26, w, 26, "#1a0610");
    renderer.text("[↑↓] steer the packet — follow ECHO's wake through the gaps", 8, h - 13, { color: "#a85a6a", size: 8, baseline: "middle" });

    if (this.mode === "ready") {
      renderer.fillRect(w / 2 - 130, 120, 260, 70, "rgba(0,0,0,0.85)");
      renderer.strokeRect(w / 2 - 130, 120, 260, 70, "#ff3a5a", 1);
      renderer.text(this.attempt > 1 ? "PACKET DELETED — TRY AGAIN" : "HALCYON FIREWALL", w / 2, 138, { color: "#ff5a6a", size: 11, align: "center", baseline: "middle", weight: "bold" });
      renderer.text(this.reachedCheckpoint ? "Restarting from the checkpoint at 50%." : `Survive ${RUN_TIME}s. Three hits and you're deleted.`, w / 2, 156, { color: "#ffc0c8", size: 8, align: "center", baseline: "middle" });
      if (Math.floor(this._t * 2) & 1) renderer.text("[space] start run", w / 2, 174, { color: "#4ae6ff", size: 9, align: "center", baseline: "middle" });
    }
    if (this.checkpointFlash > 0 && this.mode === "run") renderer.text("CHECKPOINT — 50%", w / 2, 50, { color: "#0aff7a", size: 10, align: "center", baseline: "middle", weight: "bold" });
    if (this.mode === "dead") renderer.text(`DELETED (-${scaledPenalty(TIME_PENALTY)}s)`, w / 2, 160, { color: "#ff3a5a", size: 16, align: "center", baseline: "middle", weight: "bold" });
    if (this.mode === "won") renderer.text("FIREWALL BREACHED", w / 2, 160, { color: "#0aff7a", size: 16, align: "center", baseline: "middle", weight: "bold" });
  }
}
