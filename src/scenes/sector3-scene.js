import { music } from "../audio/music.js";
import { penalize, scaledPenalty } from "../state.js";
import { Drone } from "../entities/drone.js";

// Sector 3 — program ECHO. The player writes a queue of commands (moves and waits); ECHO then
// executes it literally, one step per command. A gates are live on even steps, B gates on odd;
// stepping onto a plate flips every door (O starts open, D starts shut). Each level adds one idea,
// and the slot limits match the shortest queues (11 of 12, 20, 18, 24) so spare waits don't fit.
// A BFS over (cell, step parity, doors, keycard) found nothing shorter.
export const LEVELS = [
  {
    name: "CALIBRATION",
    slots: 12,
    rows: [
      "#########",
      "#S..#...#",
      "###.#.#.#",
      "#....A#G#",
      "#.###...#",
      "#########",
    ],
    brief: "Reach the door controller (G). Mind the A gate.",
    hints: [
      "The number on each tile is the step ECHO lands there. Every command is one step, waits too.",
      "Compare the number on the A gate with A's rule. A detour won't help: it adds two steps, so odd stays odd and even stays even.",
      "The A gate's number is even, and A is live on even steps. One WAIT anywhere before the gate, never on it, makes that number odd.",
    ],
  },
  {
    name: "LASER GRID",
    slots: 20,
    rows: [
      "#########",
      "#S..A.BC#",
      "#######.#",
      "#G..AA..#",
      "#.#####.#",
      "#..B.A..#",
      "#########",
    ],
    brief: "Keycard (C) first, then G. Now there are B gates too.",
    hints: [
      "No step numbers from here on: count them. The slot counter shows how many commands are queued, so the next command lands on that number plus one.",
      "Two tiles side by side are always reached on back-to-back steps: one odd, one even. ECHO can't wait on a gate, so a timing fix has to happen on a free tile between gates.",
      "Two A gates in a row can never both be dark, so that corridor is closed: look for another way to G. Before each gate, count its step; where the gate would be live, add one wait on the free tile just before it.",
    ],
  },
  {
    name: "SWITCHBACK",
    slots: 18,
    rows: [
      "#########",
      "#S.P.O.C#",
      "####.####",
      "#G.D.####",
      "#########",
    ],
    brief: "New: a pressure plate. Each step onto it flips every door.",
    hints: [
      "Only moving onto the plate flips the doors. Waiting on it does nothing.",
      "You can't avoid crossing the plate, and that shuts the door to the keycard. Count how many times ECHO steps on it before each door.",
      "Count plate arrivals: after an odd number the doors are flipped, after an even number they're back. Before each door, work out which it needs, and step off and back onto the plate to change the count.",
    ],
  },
  {
    name: "FULL CIRCUIT",
    slots: 24,
    rows: [
      "##########",
      "#S.APB.OC#",
      "######.###",
      "#G.D...###",
      "##########",
    ],
    brief: "Gates, plate and doors together. No slot to spare.",
    hints: [
      "Same doors as before, now with gates around the plate. Fix each gate's timing with as few waits as possible.",
      "The A and B gates beside the plate need a wait between them, and the plate is the only free tile there. Stepping back off and on again keeps the timing.",
      "Solve it in two halves: first the gates around the plate (a wait on the plate fixes the timing without flipping anything), then the door count, as in SWITCHBACK. Recount every gate after each change.",
    ],
  },
];

const CELL = 22;
const GRID_X = 14;
const STEP_TIME = 0.3;
const CLEAR_HOLD = 0.6;
const PENALTY = { gate: 20, wall: 10, door: 10, short: 10, chip: 10 };
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0], wait: [0, 0] };
const GLYPH = { up: "↑", down: "↓", left: "←", right: "→", wait: "W" };
// tiles whose effect depends on timing (they get stacked step numbers in level 1's preview)
const TIMED = new Set(["A", "B", "P", "O", "D"]);

export function gateLive(tile, step) {
  if (tile === "A") return step % 2 === 0;
  if (tile === "B") return step % 2 === 1;
  return false;
}

export function doorShut(tile, flipped) {
  if (tile === "D") return !flipped;
  if (tile === "O") return flipped;
  return false;
}

// One command applied to ECHO's state { x, y, step, flipped, chip }. Shared by the run and by
// the solver that checks the levels, so both follow exactly the same rules.
export function stepEcho(rows, s, cmd) {
  const [dx, dy] = DIRS[cmd];
  const x = s.x + dx, y = s.y + dy, step = s.step + 1;
  const t = rows[y]?.[x] ?? "#";
  if (t === "#") return { fail: "wall", step };
  if (doorShut(t, s.flipped)) return { fail: "door", step };
  // only arriving on a plate presses it; waiting there doesn't
  const flipped = t === "P" && cmd !== "wait" ? !s.flipped : s.flipped;
  const next = { x, y, step, flipped, chip: s.chip || t === "C" };
  if (gateLive(t, step)) return { ...next, fail: "gate", tile: t };
  if (t === "G") {
    if (rows.some((r) => r.includes("C")) && !next.chip) return { ...next, fail: "chip" };
    return { ...next, goal: true };
  }
  return next;
}

export class Sector3Scene {
  constructor({ hud, sfx, fx, onResult }) {
    this.hud = hud;
    this.sfx = sfx;
    this.fx = fx;
    this.onResult = onResult;
    this.level = 0;
    this._t = 0;
    this.echo = new Drone(0, 0);
    this._load();
  }

  onEnter() { document.body.classList.add("no-objective", "in-puzzle"); music.play("timing"); music.setIntensity(0); }
  onExit() { document.body.classList.remove("no-objective", "in-puzzle"); }

  get part() { return this.level; }
  resume(i) { this.level = Math.max(0, Math.min(LEVELS.length - 1, i | 0)); this._load(); }

  // ECHO's hints follow the level on screen
  get hints() {
    if (this._hintLevel !== this.level) { this._hintLevel = this.level; this._hintsShown = 0; }
    return LEVELS[this.level].hints;
  }

  _load() {
    const lv = LEVELS[this.level];
    this.rows = lv.rows;
    this.w = lv.rows[0].length;
    this.h = lv.rows.length;
    this.ox = GRID_X + Math.round(((11 - this.w) * CELL) / 2);
    this.oy = Math.max(32, Math.round(152 - (this.h * CELL) / 2));
    this.rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === "S") this.start = { x, y }; }));
    this.queue = [];
    this.failMark = null;
    this._reset();
    this.message = { text: lv.brief, color: "#4ae6ff", time: 6 };
  }

  _reset() {
    this.mode = "edit";
    this.sim = { ...this.start, step: 0, flipped: false, chip: false };
    this.runIndex = 0;
    this.runTimer = 0;
    this._backHeld = 0;
    this._placeEcho(true);
  }

  get step() { return this.sim.step; }

  _placeEcho(snap) {
    const tx = this.ox + this.sim.x * CELL + CELL / 2;
    const ty = this.oy + this.sim.y * CELL + CELL / 2 - 5;
    if (snap) { this.echo.x = tx; this.echo.y = ty; }
    this.echoTarget = { x: tx, y: ty };
  }

  tile(x, y) { return this.rows[y]?.[x] ?? "#"; }

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
    if (input.wasPressed("back") && this.queue.length) { this.queue.pop(); this.failMark = null; this.sfx.play("select"); }
    // holding backspace wipes the whole queue, so a long route can be rewritten quickly
    this._backHeld = input.isDown("back") ? this._backHeld + dt : 0;
    if (this._backHeld >= CLEAR_HOLD && this.queue.length) {
      this.queue = [];
      this.sfx.play("denied");
    }
    if (input.wasPressed("submit")) {
      if (!this.queue.length) { this.message = { text: "Queue is empty. Give ECHO a route first.", color: "#ffaa3a", time: 2 }; return; }
      this.mode = "run";
      this.runTimer = 0.35;
      this.message = null;
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
    this.failMark = null;
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
    const r = stepEcho(this.rows, this.sim, this.queue[this.runIndex++]);
    if (r.fail) {
      // the tile it failed on keeps that step number in the preview until the queue changes
      const [dx, dy] = DIRS[this.queue[this.runIndex - 1]];
      this.failMark = { x: this.sim.x + dx, y: this.sim.y + dy, step: r.step };
    }
    if (r.fail === "wall" || r.fail === "door") {
      this.sim.step = r.step;
      this._fail(r.fail, r.fail === "wall" ? `Step ${r.step}: ECHO walked into a wall.` : `Step ${r.step}: ECHO hit a shut door.`);
      return;
    }
    const before = this.sim;
    this.sim = r;
    this._placeEcho(false);
    this.sfx.play("step");
    if (r.flipped !== before.flipped) this.sfx.play("door");
    if (r.fail === "gate") { this._fail("gate", `Step ${r.step}: gate ${r.tile} was live. ECHO got zapped.`); return; }
    if (r.fail === "chip") { this._fail("chip", "ECHO reached the controller without the keycard."); return; }
    if (r.chip && !before.chip) {
      this.sfx.play("toast");
      this.message = { text: "Lift keycard acquired", color: "#0aff7a", time: 2.5 };
    }
    if (r.goal) {
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

    // floor, then the planned route, then tile contents and step numbers on top of it
    const plan = this.mode === "edit" ? this._plan() : null;
    this._drawFloor(renderer);
    if (plan) this._drawRoute(renderer, plan);
    this._drawTiles(renderer);
    if (plan) this._drawNumbers(renderer, plan);
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
    renderer.text("[arrows] move  [space] wait  [backspace] undo (hold: clear)  [enter] run  [esc] exit", 8, h - 11, {
      color: "#8a6aba", size: 8, baseline: "middle",
    });
    ctx.globalAlpha = 1;
  }

  _drawFloor(renderer) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const px = this.ox + x * CELL, py = this.oy + y * CELL;
        if (this.rows[y][x] === "#") {
          renderer.fillRect(px, py, CELL, CELL, "#1c1430");
          renderer.fillRect(px, py, CELL, 2, "#3a2a60");
        } else {
          renderer.fillRect(px, py, CELL, CELL, (x + y) & 1 ? "#0c0a16" : "#110d20");
          renderer.strokeRect(px, py, CELL, CELL, "#1a1430", 1);
        }
      }
    }
  }

  _drawTiles(renderer) {
    const ctx = renderer.ctx;
    // gates and doors only show their real state while ECHO runs; the plan has to predict it
    const live = this.mode !== "edit";
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const t = this.rows[y][x];
        const px = this.ox + x * CELL, py = this.oy + y * CELL;
        if (t === "A" || t === "B") {
          const hot = live && this.step > 0 && gateLive(t, this.step);
          const col = t === "A" ? "#ff5aa0" : "#b07aff";
          renderer.fillRect(px + 2, py + 2, 2, CELL - 4, col);
          renderer.fillRect(px + CELL - 4, py + 2, 2, CELL - 4, col);
          ctx.globalAlpha = hot ? 0.6 + 0.4 * Math.sin(this._t * 40) : 0.18;
          for (let i = 0; i < 3; i++) renderer.fillRect(px + 4, py + 5 + i * 6, CELL - 8, 1, hot ? "#ff3030" : col);
          ctx.globalAlpha = 1;
          renderer.text(t, px + CELL / 2, py + CELL / 2, {
            color: hot ? "#ffd0d0" : col, size: 9, align: "center", baseline: "middle", weight: "bold",
          });
        } else if (t === "P") {
          this._plateIcon(renderer, px + 4, py + 4, CELL - 8, live && this.sim.x === x && this.sim.y === y);
        } else if (t === "O" || t === "D") {
          this._doorIcon(renderer, px + 2, py + 2, CELL - 4, doorShut(t, this.sim.flipped));
        } else if (t === "G") {
          const pulse = 0.5 + 0.5 * Math.sin(this._t * 4);
          renderer.fillRect(px + 3, py + 3, CELL - 6, CELL - 6, `rgba(10,255,122,${0.2 + 0.25 * pulse})`);
          renderer.strokeRect(px + 3, py + 3, CELL - 6, CELL - 6, "#0aff7a", 1);
          renderer.text("G", px + CELL / 2, py + CELL / 2, { color: "#0aff7a", size: 9, align: "center", baseline: "middle", weight: "bold" });
        } else if (t === "C" && !this.sim.chip) {
          const bob = Math.round(Math.sin(this._t * 5) * 1.5);
          renderer.fillRect(px + 7, py + 7 + bob, 8, 8, "#ffd15a");
          renderer.fillRect(px + 9, py + 9 + bob, 4, 4, "#7a5a10");
        } else if (t === "S") {
          renderer.strokeRect(px + 4, py + 4, CELL - 8, CELL - 8, "#4ae6ff", 1);
        }
      }
    }
  }

  _plateIcon(renderer, x, y, size, pressed) {
    renderer.fillRect(x, y, size, size, pressed ? "#1a6a5a" : "#0e3a34");
    renderer.strokeRect(x, y, size, size, "#4affc8", 1);
    const m = Math.round(size * 0.3);
    renderer.fillRect(x + m, y + m, size - 2 * m, size - 2 * m, pressed ? "#4affc8" : "#2a9a80");
  }

  // shut: barred panel; open: an empty amber frame
  _doorIcon(renderer, x, y, size, shut) {
    if (shut) {
      renderer.fillRect(x, y, size, size, "#4a3010");
      for (let by = y + 2; by < y + size - 2; by += 4) renderer.fillRect(x + 1, by, size - 2, 2, "#ffaa3a");
      renderer.strokeRect(x, y, size, size, "#ffaa3a", 1);
    } else {
      renderer.ctx.globalAlpha = 0.65;
      renderer.strokeRect(x, y, size, size, "#ffaa3a", 1);
      renderer.fillRect(x + 1, y + 1, size - 2, 2, "#ffaa3a");
      renderer.ctx.globalAlpha = 1;
    }
  }

  // Where the queued route goes, without timing: walls are the only thing the preview checks
  // (red X); gates and doors depend on the step count, which the player has to work out. Level 1
  // is the tutorial and numbers every tile; later levels number nothing but the tile a failed run
  // stopped on (the slot counter still says how many steps are queued).
  _plan() {
    const all = this.level === 0;
    let { x, y } = this.start;
    const path = [{ x, y }], waits = [], bumps = [];
    const marks = new Map(); // tile -> step numbers ECHO spends on it
    this.queue.forEach((cmd, i) => {
      const [dx, dy] = DIRS[cmd];
      if (this.tile(x + dx, y + dy) !== "#") { x += dx; y += dy; } else bumps.push({ x: x + dx, y: y + dy });
      if (cmd === "wait") waits.push({ x, y });
      path.push({ x, y });
      if (all) {
        const k = `${x},${y}`;
        if (!marks.has(k)) marks.set(k, { x, y, steps: [] });
        marks.get(k).steps.push(i + 1);
      }
    });
    return { path, waits, bumps, marks };
  }

  _drawRoute(renderer, { path, waits, bumps }) {
    const ctx = renderer.ctx;
    const cx = (gx) => this.ox + gx * CELL + CELL / 2 + 0.5;
    const cy = (gy) => this.oy + gy * CELL + CELL / 2 + 0.5;
    ctx.strokeStyle = "rgba(74,230,255,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    path.forEach((p, i) => (i ? ctx.lineTo(cx(p.x), cy(p.y)) : ctx.moveTo(cx(p.x), cy(p.y))));
    ctx.stroke();
    for (const p of path.slice(1)) renderer.fillRect(cx(p.x) - 1.5, cy(p.y) - 1.5, 3, 3, "rgba(74,230,255,0.75)");
    ctx.strokeStyle = "#4ae6ff";
    for (const p of waits) {
      ctx.beginPath();
      ctx.arc(cx(p.x), cy(p.y), 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = "#ff3a5a";
    ctx.lineWidth = 2;
    for (const b of bumps) {
      const px = this.ox + b.x * CELL, py = this.oy + b.y * CELL;
      ctx.beginPath();
      ctx.moveTo(px + 4, py + 4); ctx.lineTo(px + CELL - 4, py + CELL - 4);
      ctx.moveTo(px + CELL - 4, py + 4); ctx.lineTo(px + 4, py + CELL - 4);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
  }

  // Step numbers stacked in the middle of each tile (two per line once there are more than
  // three), so numbers on neighbouring tiles never run together. Plain tiles keep the latest.
  _drawNumbers(renderer, { marks }) {
    const ctx = renderer.ctx;
    ctx.font = "bold 7px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const fm = this.failMark;
    if (fm && !marks.has(`${fm.x},${fm.y}`)) {
      const label = String(fm.step), tw = Math.ceil(ctx.measureText(label).width);
      const mx = this.ox + fm.x * CELL + CELL / 2, my = this.oy + fm.y * CELL + CELL / 2;
      renderer.fillRect(mx - tw / 2 - 1, my - 4, tw + 2, 8, "rgba(40,0,8,0.95)");
      ctx.fillStyle = "#ff5a5a";
      ctx.fillText(label, mx, my);
    }
    for (const { x, y, steps } of marks.values()) {
      const timed = TIMED.has(this.tile(x, y));
      if (!timed) {
        ctx.fillStyle = "#4ae6ff";
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText(String(steps.at(-1)), this.ox + x * CELL + CELL - 2, this.oy + y * CELL + CELL - 1);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        continue;
      }
      const lines = [];
      if (steps.length <= 3) steps.forEach((n) => lines.push(String(n)));
      else for (let i = 0; i < steps.length && lines.length < 3; i += 2) lines.push(steps.slice(i, i + 2).join(" "));
      if (steps.length > 6) lines[2] = `${steps[4]}…`;
      const mx = this.ox + x * CELL + CELL / 2;
      const top = this.oy + y * CELL + CELL / 2 - (lines.length * 7) / 2;
      lines.forEach((line, i) => {
        const tw = Math.ceil(ctx.measureText(line).width);
        renderer.fillRect(mx - tw / 2 - 1, top + i * 7, tw + 2, 7, "rgba(5,4,10,0.9)");
        ctx.fillStyle = "#e8ffff";
        ctx.fillText(line, mx, top + i * 7 + 4);
      });
    }
  }

  _drawPanel(renderer) {
    const lv = LEVELS[this.level];
    const x = GRID_X + 11 * CELL + 14;
    let y = 40;
    renderer.text("ECHO // COMMAND QUEUE", x, y, { color: "#d0b0ff", size: 8, weight: "bold" });
    y += 10;
    const perRow = 8;
    for (let i = 0; i < lv.slots; i++) {
      const sx = x + (i % perRow) * 25;
      const sy = y + Math.floor(i / perRow) * 21;
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
    y += Math.ceil(lv.slots / perRow) * 21 + 8;
    renderer.text(`${this.queue.length}/${lv.slots} slots`, x, y, { color: "#8a6aba", size: 8 });
    y += 16;
    renderer.text("RULES", x, y, { color: "#d0b0ff", size: 8, weight: "bold" });
    y += 12;
    const has = (ch) => lv.rows.some((r) => r.includes(ch));
    if (has("A")) { this._legend(renderer, "A", x, y); renderer.text("live on EVEN steps (2, 4, 6…)", x + 14, y, { color: "#ff5aa0", size: 8 }); y += 12; }
    if (has("B")) { this._legend(renderer, "B", x, y); renderer.text("live on ODD steps (1, 3, 5…)", x + 14, y, { color: "#b07aff", size: 8 }); y += 12; }
    if (has("P")) {
      this._plateIcon(renderer, x, y - 1, 10, false);
      renderer.text("stepping onto it flips all doors", x + 14, y, { color: "#4affc8", size: 8 });
      y += 12;
      this._doorIcon(renderer, x, y - 1, 10, true);
      this._doorIcon(renderer, x + 13, y - 1, 10, false);
      renderer.text("door shut / open", x + 27, y, { color: "#ffaa3a", size: 8 });
      y += 12;
    }
    renderer.text("Every command is one step. Wait = stay put.", x, y, { color: "#8a6aba", size: 7 });
    y += 16;
    const status = this.mode === "run" ? `RUNNING — step ${this.step}` : this.mode === "fail" ? "RESETTING…" : this.mode === "done" ? "DOOR CONTROLLER REACHED" : "EDITING";
    renderer.text(status, x, y, { color: this.mode === "fail" ? "#ff5a5a" : this.mode === "done" ? "#0aff7a" : "#4ae6ff", size: 9, weight: "bold" });
  }

  // tiny gate icon in front of a rule line (the text's top edge is at y)
  _legend(renderer, t, x, y) {
    const col = t === "A" ? "#ff5aa0" : "#b07aff";
    renderer.fillRect(x, y - 1, 1, 10, col);
    renderer.fillRect(x + 9, y - 1, 1, 10, col);
    renderer.text(t, x + 5, y + 4, { color: col, size: 8, weight: "bold", align: "center", baseline: "middle" });
  }
}
