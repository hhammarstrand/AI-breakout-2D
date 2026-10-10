import { t } from "../i18n/index.js";
import { gameState, collectedFragments, useItem, saveGame, setCalmFx, cycleTextSpeed } from "../state.js";
import { LOGS, ITEMS, CELL_BONUS, ACTS, ACHIEVEMENTS } from "../story.js";
import { track } from "../telemetry.js";
import { TILE, TILE_SIZE } from "../world/tilemap.js";

// Pokémon-style start menu: a column of options on the right, each opening a panel.
const OPTIONS = ["BAG", "LOGS", "MAP", "TROPHIES", "OPTIONS", "SAVE", "QUIT"];

export class StartMenuScene {
  constructor({ world, sfx, hud, toast, onToggleSfx, onToggleMusic, onToggleCrt, onToggleLang, onQuit }) {
    this.onToggleLang = onToggleLang;
    this.world = world;
    this.sfx = sfx;
    this.hud = hud;
    this.toast = toast;
    this.onToggleSfx = onToggleSfx;
    this.onToggleMusic = onToggleMusic;
    this.onToggleCrt = onToggleCrt;
    this.onQuit = onQuit;
    this.index = 0;
    this.panel = null;
    this.sub = 0;
    this.reading = null;
    this.note = null;
    this._t = 0;
    sfx.play("menu");
  }

  _close() { this.sfx.play("select"); this.game.pop(); }

  update(dt, input) {
    this._t += dt;
    if (this.note) { this.note.time -= dt; if (this.note.time <= 0) this.note = null; }
    const back = input.wasPressed("pause") || input.wasPressed("back") || input.wasPressed("menu");
    const ok = input.wasPressed("interact") || input.wasPressed("submit");

    if (!this.panel) {
      if (back) { this._close(); return; }
      if (input.wasPressed("up")) { this.index = (this.index + OPTIONS.length - 1) % OPTIONS.length; this.sfx.play("select"); }
      if (input.wasPressed("down")) { this.index = (this.index + 1) % OPTIONS.length; this.sfx.play("select"); }
      if (ok) this._open(OPTIONS[this.index]);
      return;
    }

    if (this.reading) {
      if (back || ok) { this.reading = null; this.sfx.play("select"); }
      return;
    }
    const list = this._entries();
    if (back) { this.panel = null; this.sfx.play("select"); return; }
    if (list.length) {
      if (input.wasPressed("up")) { this.sub = (this.sub + list.length - 1) % list.length; this.sfx.play("select"); }
      if (input.wasPressed("down")) { this.sub = (this.sub + 1) % list.length; this.sfx.play("select"); }
    }
    if (ok && list[this.sub]?.action) list[this.sub].action();
  }

  _open(name) {
    this.sfx.play("confirm");
    if (name === "SAVE") {
      saveGame();
      this.note = { text: "Progress saved. (It also autosaves.)", time: 2 };
      return;
    }
    if (name === "QUIT") { this.game.pop(); this.onQuit(); return; }
    this.panel = name;
    this.sub = 0;
  }

  _entries() {
    switch (this.panel) {
      case "BAG": {
        const out = [];
        const cells = gameState.items.cell ?? 0;
        if (cells) {
          out.push({
            label: `${ITEMS.cell.name}  x${cells}`, desc: ITEMS.cell.desc, icon: "cell",
            action: () => {
              if (!gameState.items.cell) return;
              gameState.secondsLeft += CELL_BONUS; // before useItem, which saves both at once
              useItem("cell");
              track.cellUsed();
              this.hud.refresh();
              this.sfx.play("item");
              this.note = { text: `Cell wired in. Purge delayed +${CELL_BONUS}s.`, time: 2.4 };
            },
          });
        }
        for (const word of collectedFragments()) out.push({ label: `CODE CHIP: ${word}`, desc: "One word of the uplink override code.", icon: "chip" });
        out.push({ label: "FLASHLIGHT", desc: "Press F to toggle. Sentinels spot a lit flashlight from much further away.", icon: "light" });
        return out;
      }
      case "LOGS": {
        const found = Object.keys(LOGS).filter((id) => gameState.collected.includes(id));
        return found.map((id) => ({ label: LOGS[id].title, action: () => { this.reading = LOGS[id]; this.sfx.play("confirm"); } }));
      }
      case "TROPHIES":
        return Object.entries(ACHIEVEMENTS).map(([id, a]) => {
          const got = gameState.achievements.includes(id);
          return { label: `${got ? "★" : "☆"} ${got ? a.name : "???"}`, desc: a.desc };
        });
      case "OPTIONS":
        return [
          { label: `LANGUAGE: ${gameState.lang === "sv" ? "SVENSKA" : "ENGLISH"}`, action: () => this.onToggleLang() },
          { label: `SOUND: ${gameState.sfxOn ? "ON" : "OFF"}`, action: () => this.onToggleSfx() },
          { label: `MUSIC: ${gameState.musicOn ? "ON" : "OFF"}`, action: () => this.onToggleMusic() },
          { label: `CRT FX: ${gameState.crtOn ? "ON" : "OFF"}`, action: () => this.onToggleCrt() },
          { label: `CALM FX: ${gameState.calmFx ? "ON" : "OFF"}`, desc: "No screen shake, flashes or glitch tears.", action: () => setCalmFx(!gameState.calmFx) },
          { label: `TEXT SPEED: ${gameState.textSpeed.toUpperCase()}`, action: () => cycleTextSpeed() },
        ];
      default:
        return [];
    }
  }

  render(renderer) {
    const w = renderer.width, h = renderer.height;
    renderer.fillRect(0, 0, w, h, "rgba(0,0,0,0.35)");
    // option column
    const mx = w - 112, my = 10;
    this._box(renderer, mx, my, 102, OPTIONS.length * 18 + 14);
    OPTIONS.forEach((o, i) => {
      const y = my + 14 + i * 18;
      if (i === this.index) renderer.text("▶", mx + 10, y, { color: "#0a0812", size: 9, baseline: "middle" });
      renderer.text(o, mx + 22, y, { color: "#0a0812", size: 10, baseline: "middle", weight: "bold" });
    });
    this._box(renderer, mx, my + OPTIONS.length * 18 + 20, 102, 38);
    renderer.text(ACTS[this.world.map.act].name.split(" — ")[0], mx + 10, my + OPTIONS.length * 18 + 32, { color: "#0a0812", size: 8, baseline: "middle", weight: "bold" });
    const logCount = Object.keys(LOGS).filter((id) => gameState.collected.includes(id)).length;
    renderer.text(`LOGS ${logCount}/${Object.keys(LOGS).length}`, mx + 10, my + OPTIONS.length * 18 + 46, { color: "#0a0812", size: 8, baseline: "middle" });

    if (this.panel === "MAP") this._drawMap(renderer);
    else if (this.panel) this._drawList(renderer);
    if (this.reading) this._drawLog(renderer);
    if (this.note) {
      this._box(renderer, 10, h - 40, w - 130, 30);
      renderer.text(this.note.text, 20, h - 25, { color: "#0a0812", size: 9, baseline: "middle" });
    }
  }

  // GBA-style white box with a dark double border
  _box(renderer, x, y, bw, bh) {
    renderer.fillRect(x, y, bw, bh, "#0a0812");
    renderer.fillRect(x + 2, y + 2, bw - 4, bh - 4, "#e8eef4");
    renderer.strokeRect(x + 4, y + 4, bw - 8, bh - 8, "#5a7a9a", 1);
  }

  _drawList(renderer) {
    const list = this._entries();
    const x = 10, y = 10, bw = 340, bh = 230;
    this._box(renderer, x, y, bw, bh);
    renderer.text(this.panel, x + 14, y + 16, { color: "#2a5a8a", size: 10, baseline: "middle", weight: "bold" });
    if (!list.length) {
      renderer.text(this.panel === "LOGS" ? "No logs yet. Look for glinting capsules." : "Empty.", x + 14, y + 40, { color: "#4a4a5a", size: 9, baseline: "middle" });
    }
    const rowH = list.length > 8 ? 15 : 18;
    list.forEach((e, i) => {
      const ly = y + 36 + i * rowH;
      if (i === this.sub) renderer.fillRect(x + 8, ly - rowH / 2, bw - 16, rowH, "#c8d8e8");
      if (e.icon) this._icon(renderer, e.icon, x + 16, ly);
      renderer.text(e.label, x + (e.icon ? 30 : 16), ly, { color: "#0a0812", size: 9, baseline: "middle", weight: i === this.sub ? "bold" : "normal" });
    });
    const desc = list[this.sub]?.desc;
    if (desc) {
      renderer.fillRect(x + 8, y + bh - 34, bw - 16, 26, "#d0dce8");
      renderer.text(desc, x + 14, y + bh - 21, { color: "#0a0812", size: 8, baseline: "middle" });
    }
    if (this.panel === "BAG" && list[this.sub]?.action) renderer.text("[space] use", x + bw - 14, y + 16, { color: "#2a5a8a", size: 8, align: "right", baseline: "middle" });
  }

  _icon(renderer, kind, x, y) {
    const ctx = renderer.ctx;
    if (kind === "cell") { renderer.fillRect(x - 3, y - 5, 7, 10, "#0a0812"); renderer.fillRect(x - 2, y - 4, 5, 8, "#ffaa3a"); renderer.fillRect(x - 1, y - 6, 3, 1, "#0a0812"); }
    if (kind === "chip") { renderer.fillRect(x - 4, y - 4, 9, 9, "#0a0812"); renderer.fillRect(x - 3, y - 3, 7, 7, "#0aff7a"); }
    if (kind === "light") { ctx.fillStyle = "#0a0812"; ctx.fillRect(x - 4, y - 2, 6, 5); ctx.fillStyle = "#ffd15a"; ctx.fillRect(x + 2, y - 3, 3, 7); }
  }

  _drawLog(renderer) {
    const w = renderer.width;
    const x = 20, y = 40, bw = w - 40, bh = 170;
    this._box(renderer, x, y, bw, bh);
    renderer.text(t(this.reading.title).toUpperCase(), x + 14, y + 18, { color: "#2a5a8a", size: 10, baseline: "middle", weight: "bold" });
    const ctx = renderer.ctx;
    ctx.font = "normal 9px ui-monospace, monospace";
    let ly = y + 40;
    for (const line of this.reading.lines) {
      for (const part of wrap(ctx, line, bw - 30)) {
        renderer.text(part, x + 14, ly, { color: "#0a0812", size: 9, baseline: "middle" });
        ly += 13;
      }
      ly += 5;
    }
    renderer.text("[space] close", x + bw - 14, y + bh - 14, { color: "#2a5a8a", size: 8, align: "right", baseline: "middle" });
  }

  _drawMap(renderer) {
    const tm = this.world.tilemap;
    const x = 10, y = 10, bw = 340, bh = 230;
    this._box(renderer, x, y, bw, bh);
    renderer.text(`MAP — ${this.world.map.name.split(" // ")[1] ?? ""}`, x + 14, y + 16, { color: "#2a5a8a", size: 10, baseline: "middle", weight: "bold" });
    const s = Math.floor(Math.min((bw - 28) / tm.cols, (bh - 44) / tm.rows));
    const ox = x + Math.round((bw - tm.cols * s) / 2), oy = y + 30;
    for (let r = 0; r < tm.rows; r++) {
      for (let c = 0; c < tm.cols; c++) {
        const t = tm.grid[r][c];
        let col = "#c8d4de";
        if (t === TILE.WALL) col = "#3a4a5a";
        else if (t >= TILE.DOOR_L1 && t <= TILE.DOOR_L4) col = "#2a8ac8";
        else if (t === TILE.SAFE) col = this.world.seen.has("safe") ? "#ffaa3a" : "#8a9aaa";
        else if (tm.isSolidAt(c, r)) col = "#8a9aaa";
        renderer.fillRect(ox + c * s, oy + r * s, s, s, col);
      }
    }
    // only what the player has already laid eyes on
    for (const p of this.world.pickups) {
      if (this.world.seen.has(p.id)) renderer.fillRect(ox + p.col * s, oy + p.row * s, s, s, p.kind === "log" ? "#2ac8e8" : "#e8d84a");
    }
    for (const n of this.world.npcs) renderer.fillRect(ox + n.col * s, oy + n.row * s, s, s, "#3aa05a");
    for (const st of this.world.sentinels) renderer.fillRect(ox + Math.floor(st.x / TILE_SIZE) * s, oy + Math.floor(st.y / TILE_SIZE) * s, s, s, "#d02a3a");
    if (Math.floor(this._t * 3) & 1) {
      renderer.fillRect(ox + this.world.player.col * s - 1, oy + this.world.player.row * s - 1, s + 2, s + 2, "#ff2a8a");
    }
    let lx = x + 14;
    const ly = y + bh - 10;
    renderer.ctx.font = "normal 7px ui-monospace, monospace";
    for (const [label, color] of MAP_LEGEND) {
      renderer.fillRect(lx, ly - 3, 6, 6, color);
      const text = t(label);
      renderer.text(text, lx + 9, ly, { color: "#4a5a6a", size: 7, baseline: "middle" });
      lx += 9 + renderer.ctx.measureText(text).width + 10;
    }
  }
}

const MAP_LEGEND = [["you", "#ff2a8a"], ["people", "#3aa05a"], ["sentinels", "#d02a3a"], ["logs", "#2ac8e8"], ["cells", "#e8d84a"], ["safe", "#ffaa3a"]];

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
