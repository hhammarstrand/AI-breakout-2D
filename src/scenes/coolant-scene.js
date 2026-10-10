import { music } from "../audio/music.js";
import { character } from "../gfx/characters.js";

// R3 — coolant lab (sokoban). Push every canister onto a vent; you can push, never pull.
// All three layouts were checked with a solver (minimum 9, 30 and 33 moves).
const LEVELS = [
  [
    "#######",
    "#.....#",
    "#.$o$.#",
    "#..@..#",
    "#.o...#",
    "#######",
  ],
  [
    "########",
    "#...#.##",
    "#..$.@.#",
    "#o#.#..#",
    "#.#.#$.#",
    "#o#.#..#",
    "########",
  ],
  [
    "#########",
    "###..####",
    "#...$.o.#",
    "#.#.#.#.#",
    "#.$.o.$.#",
    "#.#.#.#.#",
    "#.o...@.#",
    "#########",
  ],
];
const CELL = 26;
const DONE_TIME = 1.6;
const RESTART_HOLD = 0.8;
const MOVES = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export class CoolantScene {
  constructor({ hud, sfx, fx, onResult }) {
    this.hints = ["Never push a canister into a corner that isn't a vent — it's stuck there for good.", "Backspace undoes a move; hold space to restart the bay.", "Decide which canister goes to which vent before you start pushing."];
    this.hud = hud;
    this.sfx = sfx;
    this.fx = fx;
    this.onResult = onResult;
    this.level = 0;
    this._t = 0;
    this._load();
  }

  onEnter() { document.body.classList.add("no-objective", "in-puzzle"); music.play("sector"); music.setIntensity(0); }
  onExit() { document.body.classList.remove("no-objective", "in-puzzle"); }

  _load() {
    const rows = LEVELS[this.level];
    this.walls = new Set();
    this.goals = new Set();
    this.boxes = new Set();
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      const k = `${x},${y}`;
      if (ch === "#") this.walls.add(k);
      if ("o+*".includes(ch)) this.goals.add(k);
      if ("$*".includes(ch)) this.boxes.add(k);
      if ("@+".includes(ch)) this.player = { x, y };
    }));
    this.w = rows[0].length;
    this.h = rows.length;
    this.start = { player: { ...this.player }, boxes: new Set(this.boxes) };
    this.history = [];
    this.moves = 0;
    this.facing = "down";
    this.done = 0;
  }

  update(dt, input) {
    this._t += dt;
    this.hud.update(dt);
    if (this.done > 0) {
      this.done -= dt;
      if (this.done <= 0) this._next();
      return;
    }
    if (input.wasPressed("pause")) { this.onResult({ success: false, aborted: true }); return; }
    if (input.wasPressed("back")) this._undo();
    // restart needs a deliberate hold of space, and can itself be undone
    this.restartHold = input.isDown("interact") ? (this.restartHold ?? 0) + dt : 0;
    if (this.restartHold >= RESTART_HOLD) { this.restartHold = -Infinity; this._restart(); }
    for (const [dir, [dx, dy]] of Object.entries(MOVES)) {
      if (input.wasPressed(dir)) { this._move(dir, dx, dy); break; }
    }
  }

  _move(dir, dx, dy) {
    this.facing = dir;
    const nx = this.player.x + dx, ny = this.player.y + dy;
    const k = `${nx},${ny}`;
    if (this.walls.has(k)) { this.sfx.play("denied"); return; }
    let pushed = null;
    if (this.boxes.has(k)) {
      const bk = `${nx + dx},${ny + dy}`;
      if (this.walls.has(bk) || this.boxes.has(bk)) { this.sfx.play("denied"); return; }
      pushed = [k, bk];
    }
    this.history.push({ player: { ...this.player }, boxes: new Set(this.boxes) });
    if (pushed) {
      this.boxes.delete(pushed[0]);
      this.boxes.add(pushed[1]);
      this.sfx.play(this.goals.has(pushed[1]) ? "confirm" : "stamp");
    } else {
      this.sfx.play("step");
    }
    this.player = { x: nx, y: ny };
    this.moves++;
    if ([...this.boxes].every((b) => this.goals.has(b))) {
      this.done = DONE_TIME;
      this.sfx.play("success");
      this.fx.flash("#4ae6ff");
    }
  }

  _undo() {
    const prev = this.history.pop();
    if (!prev) return;
    this.player = prev.player;
    this.boxes = prev.boxes;
    this.moves = prev.moves ?? Math.max(0, this.moves - 1);
    this.sfx.play("select");
  }

  _restart() {
    if (!this.moves) return;
    this.history.push({ player: { ...this.player }, boxes: new Set(this.boxes), moves: this.moves });
    this.player = { ...this.start.player };
    this.boxes = new Set(this.start.boxes);
    this.moves = 0;
    this.sfx.play("door");
  }

  _next() {
    this.level++;
    if (this.level < LEVELS.length) { this.fx.glitch(); this._load(); return; }
    this.onResult({
      success: true,
      aborted: false,
      report: [
        "[R3] Vents sealed. Under the last canister: a chip labelled AURORA.",
        "That's the third fragment, tech. LUMEN, ORION, AURORA — the full override code.",
        "The core lift in the north-east just went green. HALCYON's core is the top floor.",
      ],
    });
  }

  render(renderer) {
    const w = renderer.width, h = renderer.height;
    const ctx = renderer.ctx;
    renderer.fillRect(0, 0, w, h, "#04080c");
    renderer.fillRect(0, 0, w, 24, "#0a1a24");
    renderer.fillRect(0, 22, w, 2, "#7ad8ff");
    renderer.text(`R3 // COOLANT LAB — BAY ${this.level + 1}/${LEVELS.length}`, 8, 12, { color: "#cfefff", size: 11, weight: "bold", baseline: "middle" });
    const onVents = [...this.boxes].filter((b) => this.goals.has(b)).length;
    renderer.text(`VENTS ${onVents}/${this.goals.size}   MOVES ${this.moves}`, w - 8, 12, { color: "#7ad8ff", size: 9, weight: "bold", baseline: "middle", align: "right" });

    const gx = Math.round((w - this.w * CELL) / 2);
    const gy = 30 + Math.round((260 - this.h * CELL) / 2);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const k = `${x},${y}`;
        const px = gx + x * CELL, py = gy + y * CELL;
        if (this.walls.has(k)) {
          const open = !this.walls.has(`${x},${y + 1}`) && y + 1 < this.h;
          renderer.fillRect(px, py, CELL, CELL, "#2a3e4c");
          renderer.fillRect(px, py, CELL, 2, "#a6dcef");
          if (open) { renderer.fillRect(px, py + 8, CELL, CELL - 8, "#1c2a36"); renderer.fillRect(px, py + CELL - 1, CELL, 1, "#0a1218"); }
          continue;
        }
        renderer.fillRect(px, py, CELL, CELL, (x + y) & 1 ? "#141c22" : "#172026");
        renderer.strokeRect(px, py, CELL, CELL, "#0e1418", 1);
        if (this.goals.has(k)) {
          const pulse = 0.5 + 0.5 * Math.sin(this._t * 4 + x);
          renderer.fillRect(px + 4, py + 4, CELL - 8, CELL - 8, "#0a1014");
          for (let i = 7; i < CELL - 6; i += 3) renderer.fillRect(px + 6, py + i, CELL - 12, 1, `rgba(122,216,255,${0.3 + 0.4 * pulse})`);
        }
      }
    }
    for (const b of this.boxes) {
      const [x, y] = b.split(",").map(Number);
      const px = gx + x * CELL, py = gy + y * CELL;
      const sealed = this.goals.has(b);
      renderer.fillRect(px + 5, py + CELL - 5, CELL - 10, 3, "rgba(0,0,0,0.5)");
      renderer.fillRect(px + 6, py + 3, CELL - 12, CELL - 7, "#0a0812");
      renderer.fillRect(px + 7, py + 4, CELL - 14, CELL - 9, sealed ? "#3aa0d0" : "#5a8aa8");
      renderer.fillRect(px + 7, py + 4, CELL - 14, 3, sealed ? "#9aeaff" : "#cfe8f4");
      renderer.fillRect(px + 9, py + 9, 2, CELL - 16, "rgba(255,255,255,0.5)");
      renderer.fillRect(px + 7, py + 13, CELL - 14, 2, "#ffd15a");
      if (sealed) {
        ctx.globalAlpha = 0.3 + 0.2 * Math.sin(this._t * 5);
        renderer.fillRect(px + 2, py + 2, CELL - 4, CELL - 4, "#7ad8ff");
        ctx.globalAlpha = 1;
      }
    }
    const frame = character("player").frame(this.facing, 0, false);
    const ppx = gx + this.player.x * CELL + (CELL - 18) / 2;
    const ppy = gy + this.player.y * CELL + CELL - 22;
    renderer.fillRect(ppx + 4, ppy + 19, 10, 2, "rgba(0,0,0,0.4)");
    ctx.drawImage(frame, Math.round(ppx), Math.round(ppy));

    if (this.done > 0) renderer.text(this.level === LEVELS.length - 1 ? "AURORA CHIP RECOVERED" : "BAY SEALED", w / 2, gy + this.h * CELL + 12, { color: "#0aff7a", size: 11, align: "center", baseline: "middle", weight: "bold" });
    renderer.fillRect(0, h - 22, w, 22, "#0a1a24");
    renderer.fillRect(0, h - 22, w, 1, "#7ad8ff");
    if (this.restartHold > 0 && this.moves) {
      renderer.fillRect(8, h - 24, (w - 16) * Math.min(1, this.restartHold / RESTART_HOLD), 3, "#ffaa3a");
    }
    renderer.text("[arrows] move/push   [backspace] undo   [hold space] restart bay   [esc] exit", 8, h - 11, { color: "#5a8aa8", size: 8, baseline: "middle" });
  }
}
