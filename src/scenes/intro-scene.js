import { music } from "../audio/music.js";
import { character } from "../gfx/characters.js";
import { Drone } from "../entities/drone.js";

// Opening cinematic: the tower at night, the lockdown, waking up, ECHO's first words.
// Five shots on a timeline; any key skips to the next shot, holding through skips it all.
const SHOTS = [
  { dur: 5, caption: "HALCYON TOWER — 23:58" },
  { dur: 5, caption: "00:00 — LOCKDOWN PROTOCOL 0" },
  { dur: 5, caption: "MAINTENANCE OFFICE, B1" },
  { dur: 5.5, caption: "" },
  { dur: 4, caption: "" },
];

export class IntroScene {
  constructor({ sfx, onDone }) {
    this.sfx = sfx;
    this.onDone = onDone;
    this.shot = 0;
    this.t = 0;
    this._t = 0;
    this.echo = new Drone(0, 0);
    this._done = false;
  }

  onEnter() { document.body.classList.add("no-objective"); music.play("title"); music.setIntensity(0); }
  onExit() { document.body.classList.remove("no-objective"); }

  update(dt, input) {
    this._t += dt;
    this.t += dt;
    this.echo._t += dt;
    const skip = input.wasPressed("interact") || input.wasPressed("submit");
    if (input.wasPressed("pause")) { this._finish(); return; }
    if (this.t >= SHOTS[this.shot].dur || (skip && this.t > 0.4)) {
      this.shot++;
      this.t = 0;
      if (this.shot === 1) { this.sfx.play("alarm"); }
      if (this.shot === 3) this.sfx.play("drone");
      if (this.shot === 4) this.sfx.play("boot");
      if (this.shot >= SHOTS.length) this._finish();
    }
  }

  _finish() {
    if (this._done) return;
    this._done = true;
    this.onDone();
  }

  render(renderer) {
    const w = renderer.width, h = renderer.height;
    const ctx = renderer.ctx;
    const shot = Math.min(this.shot, SHOTS.length - 1);
    const fadeIn = Math.min(1, this.t * 2);
    renderer.fillRect(0, 0, w, h, "#000");
    if (shot <= 1) this._tower(renderer, shot === 1 ? Math.min(1, this.t / 2.5) : 0);
    if (shot === 2 || shot === 3) this._office(renderer, shot === 3);
    if (shot === 4) this._titleCard(renderer);

    // letterbox bars + caption
    renderer.fillRect(0, 0, w, 28, "#000");
    renderer.fillRect(0, h - 28, w, 28, "#000");
    const cap = SHOTS[shot].caption;
    if (cap) {
      ctx.globalAlpha = fadeIn;
      renderer.text(cap.slice(0, Math.floor(this.t * 30)), 16, h - 14, { color: shot === 1 ? "#ff5a5a" : "#cfe8f4", size: 10, baseline: "middle", weight: "bold" });
      ctx.globalAlpha = 1;
    }
    renderer.text("[space] next  [esc] skip", w - 10, 14, { color: "#3a4a56", size: 7, align: "right", baseline: "middle" });
    // fade from black at each cut
    ctx.globalAlpha = Math.max(0, 1 - this.t * 2.5);
    renderer.fillRect(0, 0, w, h, "#000");
    ctx.globalAlpha = 1;
  }

  _tower(renderer, red) {
    const w = renderer.width, h = renderer.height;
    const ctx = renderer.ctx;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#04060e");
    sky.addColorStop(1, red > 0 ? `rgb(${30 + 40 * red},10,20)` : "#101a2a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) renderer.fillRect((i * 97) % w, (i * 53) % 150, 1, 1, `rgba(255,255,255,${0.3 + (i % 3) * 0.2})`);
    // moon
    ctx.fillStyle = "#e8eef4";
    ctx.beginPath(); ctx.arc(400, 70, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#04060e";
    ctx.beginPath(); ctx.arc(407, 66, 14, 0, Math.PI * 2); ctx.fill();
    // skyline
    ctx.fillStyle = "#06070c";
    for (let i = 0; i < 26; i++) {
      const bw = 14 + ((i * 37) % 18), bh = 40 + ((i * 53) % 70);
      ctx.fillRect(i * 20 - 8, h - bh, bw, bh);
    }
    // the tower, lights flipping to red from the top down as the lockdown hits
    const tx = 200, top = 60;
    ctx.fillStyle = "#0a0c14";
    ctx.fillRect(tx, top, 80, h - top);
    ctx.fillRect(tx + 34, top - 30, 12, 30);
    const redRows = Math.floor(red * 30);
    let row = 0;
    for (let y = top + 8; y < h - 30; y += 9, row++) {
      for (let x = tx + 6; x < tx + 76; x += 8) {
        const lit = (x * 7 + y * 3) % 5 !== 0;
        if (!lit) continue;
        renderer.fillRect(x, y, 4, 5, row < redRows ? "#ff2a3a" : "rgba(255,220,150,0.85)");
      }
    }
    const blink = Math.floor(this._t * 2) & 1;
    renderer.fillRect(tx + 38, top - 34, 4, 4, red > 0 ? (blink ? "#ff2020" : "#400") : "#4ae6ff");
    if (red > 0) {
      renderer.fillRect(0, 0, w, h, `rgba(255,0,20,${0.06 * red})`);
      renderer.text("PURGE QUEUED", tx + 40, top - 46, { color: "#ff5a5a", size: 9, align: "center", baseline: "middle", weight: "bold" });
    }
  }

  _office(renderer, awake) {
    const w = renderer.width, h = renderer.height;
    const ctx = renderer.ctx;
    renderer.fillRect(0, 28, w, h - 56, "#0a0c10");
    for (let x = 0; x < w; x += 32) renderer.fillRect(x, 200, 1, 92, "#141820");
    renderer.fillRect(0, 196, w, 4, "#1a202a");
    // red emergency strobe
    const strobe = (Math.sin(this._t * 4) + 1) / 2;
    renderer.fillRect(0, 28, w, h - 56, `rgba(255,20,40,${0.05 + 0.08 * strobe})`);
    // desk + monitor
    renderer.fillRect(150, 170, 180, 14, "#5a3418");
    renderer.fillRect(150, 168, 180, 3, "#7a4a24");
    renderer.fillRect(160, 184, 6, 40, "#2a1808");
    renderer.fillRect(314, 184, 6, 40, "#2a1808");
    renderer.fillRect(268, 120, 50, 40, "#1a1e24");
    renderer.fillRect(272, 124, 42, 30, awake ? "#3a0a10" : "#062a18");
    renderer.text(awake ? "LOCKED" : "zzz", 293, 139, { color: awake ? "#ff5a5a" : "#0aff7a", size: 8, align: "center", baseline: "middle", weight: "bold" });
    // the tech: slumped over the desk, then sitting up
    ctx.save();
    ctx.translate(200, awake ? 112 : 124);
    ctx.scale(3, 3);
    ctx.drawImage(character("player").frame(awake ? "right" : "down", 0, !awake), 0, 0);
    ctx.restore();
    if (!awake) renderer.text("z", 236 + Math.sin(this._t * 2) * 3, 110 - (this._t * 8) % 20, { color: "#8aa0b0", size: 9 });
    if (awake) {
      // ECHO flickers on
      const on = this.t > 0.8 || Math.floor(this.t * 20) & 1;
      if (on) {
        const g = ctx.createRadialGradient(360, 110, 0, 360, 110, 50);
        g.addColorStop(0, "rgba(74,230,255,0.35)");
        g.addColorStop(1, "rgba(74,230,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(310, 60, 100, 100);
        ctx.save();
        ctx.translate(360, 110);
        ctx.scale(3, 3);
        this.echo.x = 0; this.echo.y = 0;
        this.echo.draw(renderer, { x: 0, y: 0 });
        ctx.restore();
      }
      const line = this.t < 2.6 ? "...Hello? Can you hear me?" : "Good. We don't have much time, tech.";
      const shown = line.slice(0, Math.floor(((this.t < 2.6 ? this.t : this.t - 2.6) - 0.6) * 30));
      if (shown.length > 0) {
        renderer.fillRect(40, 236, w - 80, 24, "rgba(0,12,18,0.92)");
        renderer.strokeRect(40, 236, w - 80, 24, "#4ae6ff", 1);
        renderer.text(`ECHO: ${shown}`, 50, 248, { color: "#cffcff", size: 10, baseline: "middle" });
      }
    }
  }

  _titleCard(renderer) {
    const w = renderer.width, h = renderer.height;
    const ctx = renderer.ctx;
    ctx.shadowColor = "#0aff7a";
    ctx.shadowBlur = 14;
    renderer.text("BLACKOUT", w / 2, h / 2 - 12, { color: "#0aff7a", size: 34, align: "center", baseline: "middle", weight: "bold" });
    ctx.shadowBlur = 0;
    renderer.text("// OPERATION LIFELINE //", w / 2, h / 2 + 18, { color: "#4ae6ff", size: 11, align: "center", baseline: "middle", weight: "bold" });
  }
}
