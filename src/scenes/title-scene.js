import { gameState } from "../state.js";
import { Menu } from "./menu.js";
import { music } from "../audio/music.js";

const GLYPHS = "01アイウエオカキクケコサシスセソ$#%&*<>/\\{}=+";
const BOOT_LINES = [
  "BIOS v4.2 ...................... OK",
  "mounting /dev/building ......... OK",
  "HALCYON core .................. ROGUE",
  "camera mesh .................... 6/48 ONLINE",
  "operator uplink ................ ESTABLISHED",
];
const COL_W = 10;

export class TitleScene {
  constructor({ hasSave, onNew, onContinue, onToggleSfx, onToggleCrt, onToggleMusic, sfx }) {
    this.sfx = sfx;
    this._t = 0;
    this._booted = false;
    this._drops = Array.from({ length: Math.ceil(480 / COL_W) }, () => ({
      y: Math.random() * -320,
      speed: 40 + Math.random() * 90,
      seed: Math.floor(Math.random() * 1000),
    }));

    const items = [];
    if (hasSave) items.push({ label: "CONTINUE", action: onContinue });
    items.push({ label: "NEW GAME", action: () => { this.menu = this.diffMenu; } });
    items.push({ label: () => `SOUND: ${gameState.sfxOn ? "ON" : "OFF"}`, action: onToggleSfx });
    items.push({ label: () => `MUSIC: ${gameState.musicOn ? "ON" : "OFF"}`, action: onToggleMusic });
    items.push({ label: () => `CRT FX: ${gameState.crtOn ? "ON" : "OFF"}`, action: onToggleCrt });
    this.mainMenu = new Menu(items, sfx);
    this.menu = this.mainMenu;
    this.diffMenu = new Menu([
      { label: "STORY — relaxed timers", action: () => onNew("story") },
      { label: "NORMAL", action: () => onNew("normal") },
      { label: "HARD — for veterans", action: () => onNew("hard") },
      { label: "BACK", action: () => { this.menu = this.mainMenu; } },
    ], sfx);
    this.diffMenu.index = 1;
  }

  onEnter() { document.body.classList.add("no-objective"); music.play("title"); }
  onExit() { document.body.classList.remove("no-objective"); }

  get _bootDone() { return this._t > BOOT_LINES.length * 0.35 + 0.4; }

  update(dt, input) {
    this._t += dt;
    for (const d of this._drops) {
      d.y += d.speed * dt;
      if (d.y > 360) { d.y = Math.random() * -120; d.speed = 40 + Math.random() * 90; }
    }
    if (!this._bootDone) {
      // any key skips the boot log
      if (input.consumeAnyPressed()) this._t = BOOT_LINES.length * 0.35 + 0.4;
      return;
    }
    if (!this._booted) { this._booted = true; this.sfx.play("boot"); input.consumeAnyPressed(); return; }
    this.menu.update(input);
  }

  render(renderer) {
    const w = renderer.width;
    const h = renderer.height;
    renderer.fillRect(0, 0, w, h, "#000");
    this._drawRain(renderer, h);

    if (!this._bootDone) { this._drawBoot(renderer); return; }

    // vignette panel behind the logo
    renderer.fillRect(40, 62, w - 80, 222, "rgba(0, 8, 3, 0.82)");
    renderer.strokeRect(40, 62, w - 80, 222, "#0a8a4a", 1);

    const glitch = (this._t % 3.7) < 0.12;
    const jx = glitch ? (Math.random() * 6 - 3) : 0;
    const title = "BLACKOUT";
    if (glitch) {
      renderer.text(title, w / 2 - 3 + jx, 104, { color: "#ff5a5a", size: 34, align: "center", baseline: "middle", weight: "bold" });
      renderer.text(title, w / 2 + 3 + jx, 104, { color: "#4ae6ff", size: 34, align: "center", baseline: "middle", weight: "bold" });
    }
    const ctx = renderer.ctx;
    ctx.shadowColor = "#0aff7a";
    ctx.shadowBlur = 12 + Math.sin(this._t * 3) * 4;
    renderer.text(title, w / 2 + jx, 104, { color: "#0aff7a", size: 34, align: "center", baseline: "middle", weight: "bold" });
    ctx.shadowBlur = 0;

    renderer.text("// OPERATION LIFELINE //", w / 2, 134, {
      color: "#4ae6ff", size: 11, align: "center", baseline: "middle", weight: "bold",
    });
    renderer.text(gameState.endingsSeen.length ? `HALCYON TOWER · ENDINGS FOUND ${gameState.endingsSeen.length}/2` : "HALCYON TOWER · 00:00 · LOCKDOWN", w / 2, 150, {
      color: "#0a8a4a", size: 8, align: "center", baseline: "middle",
    });

    this.menu.draw(renderer, w / 2, 172, this._t, 14);

    renderer.text("[↑↓] choose   [space/enter] select", w / 2, 272, {
      color: "#0a8a4a", size: 8, align: "center", baseline: "middle",
    });
    const cursor = (Math.floor(this._t * 2) & 1) ? "_" : " ";
    renderer.text(`op@blackout:~$ ${cursor}`, 16, h - 18, { color: "#0a8a4a", size: 10 });
  }

  _drawRain(renderer, h) {
    const ctx = renderer.ctx;
    ctx.font = "9px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    for (let i = 0; i < this._drops.length; i++) {
      const d = this._drops[i];
      for (let k = 0; k < 10; k++) {
        const y = d.y - k * 10;
        if (y < -10 || y > h) continue;
        const g = GLYPHS[(d.seed + k * 7 + Math.floor(this._t * 6 + k)) % GLYPHS.length];
        ctx.fillStyle = k === 0 ? "rgba(207,252,255,0.9)" : `rgba(10,255,122,${0.45 - k * 0.04})`;
        ctx.fillText(g, i * COL_W, y);
      }
    }
  }

  _drawBoot(renderer) {
    const shown = Math.floor(this._t / 0.35);
    for (let i = 0; i < Math.min(shown, BOOT_LINES.length); i++) {
      const line = BOOT_LINES[i];
      const bad = line.includes("ROGUE");
      renderer.fillRect(14, 28 + i * 16, 330, 13, "rgba(0,0,0,0.8)");
      renderer.text(line, 18, 30 + i * 16, { color: bad ? "#ff5a5a" : "#0aff7a", size: 10 });
    }
    renderer.text("[any key] skip", renderer.width - 12, renderer.height - 16, {
      color: "#0a8a4a", size: 8, align: "right",
    });
  }
}
