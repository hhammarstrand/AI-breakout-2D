import { music } from "../audio/music.js";
import { gameState, penalize, scaledPenalty } from "../state.js";
import { Drone } from "../entities/drone.js";

// Sector 3 — program ECHO. The player writes a queue of commands (moves and waits); ECHO then
// executes it literally. Laser gates alternate every step: A gates are live on even steps,
// B gates on odd steps. Level 2 also requires picking up the lift keycard.
const LEVELS = [
  {
    name: "CALIBRATION",
    slots: 16,
    rows: [
      "#########",
      "#S..#...#",
      "##.##.#.#",
      "#...#.#G#",
      "#.#...###",
      "#########",
    ],
    brief: "Walk ECHO to the door controller (G). No gates yet.",
  },
  {
    name: "LASER GRID",
    slots: 22,
    rows: [
      "#########",
      "#S.A..#C#",
      "#.###.#.#",
      "#G.B....#",
      "#########",
    ],
    brief: "Grab the lift keycard (C), then reach G. Mind the gate rhythm.",
  },
];

const CELL = 22;
const GRID_X = 14;
const GRID_Y = 44;
const STEP_TIME = 0.3;
const PENALTY = { gate: 20, wall: 10, short: 10, chip: 10 };
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0], wait: [0, 0] };
const GLYPH = { up: "↑", down: "↓", left: "←", right: "→", wait: "W" };

export function gateLive(tile, step) {
  if (tile === "A") return step % 2 === 0;
  if (tile === "B") return step % 2 === 1;
  return false;
}

export class Sector3Scene {
  constructor({ hud, sfx, fx, onResult }) {
    this.hints = ["Count every command as one step, starting from 1. A gates are live on even steps, B gates on odd.", "A WAIT (space) before a gate shifts your timing by one step. Never wait while standing on a gate.", "Level 2: get the keycard (C) first, then come back west. You'll need two waits in total."];
    this.hud = hud;
    this.sfx = sfx;
    this.fx = fx;
    this.onResult = onResult;
    this.level = 0;
    this._t = 0;
    this.echo = new Drone(0, 0);
    this._load();
  }

  onEnter() { document.body.classList.add("no-objective", "in-puzzle"); music.play("sector"); music.setIntensity(0); }
  onExit() { document.body.classList.remove("no-objective", "in-puzzle"); }

  _load() {
    const lv = LEVELS[this.level];
    this.grid = lv.rows.map((r) => [...r]);
    for (let y = 0; y < this.grid.length; y++) {
      for (let x = 0; x < this.grid[y].length; x++) {
        if (this.grid[y][x] === "S") this.start = { x, y };
      }
    }
    this.queue = [];
    this._reset();
    this.message = { text: lv.brief, color: "#4ae6ff", time: 5 };
  }

  _reset() {
    this.mode = "edit";
    this.pos = { ...this.start };
    this.step = 0;
    this.runIndex = 0;
    this.runTimer = 0;
    this.hasChip = false;
    this._placeEcho(true);
  }

  _placeEcho(snap) {
    const tx = GRID_X + this.pos.x * CELL + CELL / 2;
    const ty = GRID_Y + this.pos.y * CELL + CELL / 2 - 2;
    if (snap) { this.echo.x = tx; this.echo.y = ty; }
    this.echoTarget = { x: tx, y: ty };
  }

  tile(x, y) { return this.grid[y]?.[x] ?? "#"; }

  update(dt, input) {
    this._t += dt;
    this.hud.update(dt);
    this.echo._t += dt;
    this.echo.x += (this.echoTarget.x - this.echo.x) * Math.min(1, dt * 14);
    this.echo.y += (this.echoTarget.y - this.echo.y) * Math.min(1, dt * 14);
    if (this.message) {
      this.message.time -= dt;
      if (this.message.time <= 0) this.message = null;
    }

    if (this.mode === "run") { this._tickRun(dt); return; }
    if (this.mode === "done") {
      this.runTimer -= dt;
      if (this.runTimer <= 0) this._advanceLevel();
      return;
    }
    if (this.mode === "fail") {
      this.runTimer -= dt;
      if (this.runTimer <= 0) this._reset();
      return;
    }

    if (input.wasPressed("pause")) { this.onResult({ success: false, aborted: true }); return; }
    for (const dir of ["up", "down", "left", "right"]) {
      if (input.wasPressed(dir)) this._push(dir);
    }
    if (input.wasPressed("interact")) this._push("wait");
    if (input.wasPressed("back") && this.queue.length) { this.queue.pop(); this.sfx.play("select"); }
    if (input.wasPressed("submit")) {
      if (!this.queue.length) { this.message = { text: "Queue is empty. Give ECHO a route first.", color: "#ffaa3a", time: 2 }; return; }
      this.mode = "run";
      this.runTimer = 0.35;
      this.sfx.play("drone");
    }
  }

  _push(cmd) {
    if (this.queue.length >= LEVELS[this.level].slots) {
      this.sfx.play("denied");
      this.message = { text: "Command buffer full.", color: "#ffaa3a", time: 1.5 };
      return;
    }
    this.queue.push(cmd);
    this.sfx.play("blip");
  }

  _tickRun(dt) {
    this.runTimer -= dt;
    if (this.runTimer > 0) return;
    this.runTimer = STEP_TIME;

    if (this.runIndex >= this.queue.length) {
      this._fail("short", "ECHO ran out of instructions short of the goal.");
      return;
    }
    const cmd = this.queue[this.runIndex++];
    const [dx, dy] = DIRS[cmd];
    const nx = this.pos.x + dx, ny = this.pos.y + dy;
    this.step++;
    if (this.tile(nx, ny) === "#") {
      this._fail("wall", `Step ${this.step}: ECHO walked into a wall.`);
      return;
    }
    this.pos = { x: nx, y: ny };
    this._placeEcho(false);
    this.sfx.play("step");
    const t = this.tile(nx, ny);
    if (gateLive(t, this.step)) {
      this._fail("gate", `Step ${this.step}: gate ${t} was live. ECHO got zapped.`);
      return;
    }
    if (t === "C" && !this.hasChip) {
      this.hasChip = true;
      this.sfx.play("toast");
      this.message = { text: "Lift keycard acquired", color: "#0aff7a", time: 2.5 };
    }
    if (t === "G") {
      const needsChip = LEVELS[this.level].rows.some((r) => r.includes("C"));
      if (needsChip && !this.hasChip) {
        this._fail("chip", "ECHO reached the controller without the keycard.");
        return;
      }
      this.mode = "done";
      this.runTimer = 1.4;
      this.sfx.play("success");
      this.fx.flash("#0aff7a");
    }
  }

  _fail(kind, text) {
    const penalty = PENALTY[kind];
    penalize(penalty);
    this.mode = "fail";
    this.runTimer = 1.4;
    this.message = { text: `${text} (-${scaledPenalty(penalty)}s)`, color: "#ff5a5a", time: 2.8 };
    this.sfx.play(kind === "gate" ? "zap" : "error");
    this.fx.shake();
    if (kind === "gate") this.fx.flash("#ff4040");
  }

  _advanceLevel() {
    this.level++;
    if (this.level < LEVELS.length) {
      this.sfx.play("door");
      this.fx.glitch();
      this._load();
      return;
    }
    this.onResult({
      success: true,
      aborted: false,
      report: [
        "[L3] Door control is ours. ECHO walked the grid exactly as you wrote it.",
        "It rerouted SENTINEL-A, so the corridor is clear.",
        "And it unlocked the service lift in the north-east corner. The research floor is above us.",
        "The last fragment has to be up there. I'll stay on the radio, tech.",
      ],
    });
  }

  // --- rendering -------------------------------------------------------------

  render(renderer) {
    const w = renderer.width, h = renderer.height;
    const ctx = renderer.ctx;
    renderer.fillRect(0, 0, w, h, "#05040a");
    for (let y = 0; y < h; y += 4) renderer.fillRect(0, y, w, 1, "rgba(160,90,255,0.04)");

    renderer.fillRect(0, 0, w, 24, "#120a22");
    renderer.fillRect(0, 22, w, 2, "#b07aff");
    renderer.text(`SECTOR 3 // BUILD THE DOOR AGENT — ${LEVELS[this.level].name}`, 8, 12, {
      color: "#d0b0ff", size: 11, weight: "bold", baseline: "middle",
    });
    renderer.text(`${this.level + 1}/${LEVELS.length}`, w - 8, 12, {
      color: "#b07aff", size: 10, weight: "bold", baseline: "middle", align: "right",
    });

    this._drawGrid(renderer);
    this._drawGhost(renderer);
    this.echo.draw(renderer, { x: 0, y: 0 });
    this._drawPanel(renderer);

    if (this.message) {
      renderer.fillRect(0, h - 44, w, 18, "rgba(0,0,0,0.85)");
      renderer.text(this.message.text, w / 2, h - 35, {
        color: this.message.color, size: 9, align: "center", baseline: "middle", weight: "bold",
      });
    }
    renderer.fillRect(0, h - 22, w, 22, "#120a22");
    renderer.fillRect(0, h - 22, w, 1, "#b07aff");
    renderer.text("[arrows] add move  [space] wait  [backspace] undo  [enter] run  [esc] exit", 8, h - 11, {
      color: "#8a6aba", size: 8, baseline: "middle",
    });
    ctx.globalAlpha = 1;
  }

  _currentStep() { return this.mode === "edit" ? Math.floor(this._t / 0.9) % 2 : this.step; }

  _drawGrid(renderer) {
    const ctx = renderer.ctx;
    const step = this._currentStep();
    for (let y = 0; y < this.grid.length; y++) {
      for (let x = 0; x < this.grid[y].length; x++) {
        const t = this.grid[y][x];
        const px = GRID_X + x * CELL, py = GRID_Y + y * CELL;
        if (t === "#") {
          renderer.fillRect(px, py, CELL, CELL, "#1c1430");
          renderer.fillRect(px, py, CELL, 2, "#3a2a60");
          continue;
        }
        renderer.fillRect(px, py, CELL, CELL, (x + y) & 1 ? "#0c0a16" : "#0f0c1c");
        renderer.strokeRect(px, py, CELL, CELL, "#1a1430", 1);
        if (t === "A" || t === "B") {
          const live = gateLive(t, step);
          const col = t === "A" ? "#ff5aa0" : "#b07aff";
          renderer.fillRect(px + 2, py + 2, 2, CELL - 4, col);
          renderer.fillRect(px + CELL - 4, py + 2, 2, CELL - 4, col);
          if (live) {
            const flick = 0.6 + 0.4 * Math.sin(this._t * 40);
            ctx.globalAlpha = flick;
            for (let i = 0; i < 3; i++) renderer.fillRect(px + 4, py + 5 + i * 6, CELL - 8, 1, "#ff3030");
            ctx.globalAlpha = 1;
          }
          renderer.text(t, px + CELL / 2, py + CELL / 2, {
            color: live ? "#ffd0d0" : col, size: 8, align: "center", baseline: "middle", weight: "bold",
          });
        } else if (t === "G") {
          const pulse = 0.5 + 0.5 * Math.sin(this._t * 4);
          renderer.fillRect(px + 3, py + 3, CELL - 6, CELL - 6, `rgba(10,255,122,${0.2 + 0.25 * pulse})`);
          renderer.strokeRect(px + 3, py + 3, CELL - 6, CELL - 6, "#0aff7a", 1);
          renderer.text("G", px + CELL / 2, py + CELL / 2, { color: "#0aff7a", size: 9, align: "center", baseline: "middle", weight: "bold" });
        } else if (t === "C" && !this.hasChip) {
          const bob = Math.round(Math.sin(this._t * 5) * 1.5);
          renderer.fillRect(px + 7, py + 7 + bob, 8, 8, "#ffd15a");
          renderer.fillRect(px + 9, py + 9 + bob, 4, 4, "#7a5a10");
        } else if (t === "S") {
          renderer.strokeRect(px + 4, py + 4, CELL - 8, CELL - 8, "#4ae6ff", 1);
        }
      }
    }
  }

  // Dotted preview of the queued route with step numbers, so players can reason about gate parity.
  _drawGhost(renderer) {
    if (this.mode !== "edit") return;
    let { x, y } = this.start;
    const ctx = renderer.ctx;
    // last step number that lands on each cell (revisits overwrite earlier ones)
    const latest = new Map();
    const bumps = []; // the real run fails on a wall, so the preview must say so
    this.queue.forEach((cmd, i) => {
      const [dx, dy] = DIRS[cmd];
      if (this.tile(x + dx, y + dy) !== "#") { x += dx; y += dy; } else if (dx || dy) bumps.push({ x: x + dx, y: y + dy, n: i + 1 });
      latest.set(`${x},${y}`, { x, y, n: i + 1 });
    });
    for (const b of bumps) {
      const px = GRID_X + b.x * CELL, py = GRID_Y + b.y * CELL;
      ctx.strokeStyle = "#ff3a5a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px + 4, py + 4); ctx.lineTo(px + CELL - 4, py + CELL - 4);
      ctx.moveTo(px + CELL - 4, py + 4); ctx.lineTo(px + 4, py + CELL - 4);
      ctx.stroke();
    }
    ctx.font = "bold 7px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    for (const { x: cx, y: cy, n } of latest.values()) {
      const px = GRID_X + cx * CELL, py = GRID_Y + cy * CELL;
      renderer.fillRect(px + CELL / 2 - 1, py + CELL / 2 - 1, 3, 3, "rgba(74,230,255,0.6)");
      ctx.fillStyle = "#4ae6ff";
      ctx.fillText(String(n), px + CELL - 2, py + CELL - 1);
    }
  }

  _drawPanel(renderer) {
    const lv = LEVELS[this.level];
    const x = GRID_X + 11 * CELL + 14;
    let y = GRID_Y;
    renderer.text("ECHO // COMMAND QUEUE", x, y, { color: "#d0b0ff", size: 8, weight: "bold" });
    y += 12;
    const perRow = 8;
    for (let i = 0; i < lv.slots; i++) {
      const sx = x + (i % perRow) * 25;
      const sy = y + Math.floor(i / perRow) * 22;
      const cmd = this.queue[i];
      const running = this.mode !== "edit" && i === this.runIndex - 1;
      renderer.fillRect(sx, sy, 21, 18, running ? "#3a2a60" : cmd ? "#1c1430" : "#0c0a16");
      renderer.strokeRect(sx, sy, 21, 18, running ? "#4ae6ff" : cmd ? "#b07aff" : "#2a2040", 1);
      if (cmd) {
        renderer.text(GLYPH[cmd], sx + 10.5, sy + 9.5, {
          color: cmd === "wait" ? "#8a6aba" : "#e8dcff", size: 10, align: "center", baseline: "middle", weight: "bold",
        });
      }
    }
    y += Math.ceil(lv.slots / perRow) * 22 + 10;
    renderer.text(`${this.queue.length}/${lv.slots} slots`, x, y, { color: "#8a6aba", size: 8 });
    y += 16;
    renderer.text("GATE RHYTHM", x, y, { color: "#d0b0ff", size: 8, weight: "bold" });
    y += 12;
    renderer.text("A  live on EVEN steps (0, 2, 4…)", x, y, { color: "#ff5aa0", size: 8 });
    y += 11;
    renderer.text("B  live on ODD steps  (1, 3, 5…)", x, y, { color: "#b07aff", size: 8 });
    y += 11;
    renderer.text("Every command is one step. Wait = stay put.", x, y, { color: "#8a6aba", size: 7 });
    y += 16;
    const status = this.mode === "run" ? `RUNNING — step ${this.step}` : this.mode === "fail" ? "RESETTING…" : this.mode === "done" ? "DOOR CONTROLLER REACHED" : "EDITING";
    renderer.text(status, x, y, { color: this.mode === "fail" ? "#ff5a5a" : this.mode === "done" ? "#0aff7a" : "#4ae6ff", size: 9, weight: "bold" });
  }
}
