import { music } from "../audio/music.js";

// R1 — restore power. A conduit grid is generated as a random spanning tree from the source,
// then every piece is rotated at random. The grid is online when every piece is powered and no
// conduit ends loose (into a wall or a piece that doesn't connect back), as in the classic "Net"
// puzzle: lighting the outlets alone isn't enough, so edges and dead ends have to be reasoned out.
// Board 3 has bolted pieces that can't be turned.
const BOARDS = [
  { cols: 5, rows: 4, outlets: 2, bolts: 0 },
  { cols: 6, rows: 5, outlets: 3, bolts: 0 },
  { cols: 7, rows: 5, outlets: 3, bolts: 3 },
];
const N = 1, E = 2, S = 4, Wd = 8;
const DIRS = [[N, 0, -1, S], [E, 1, 0, Wd], [S, 0, 1, N], [Wd, -1, 0, E]];
const CELL = 34;
const DONE_TIME = 1.6;

const rotCW = (m) => ((m << 1) | (m >> 3)) & 15;
const rotCCW = (m) => ((m >> 1) | ((m & 1) << 3)) & 15;

function generate(spec) {
  // keep drawing trees until there are enough dead ends to hang every outlet on
  for (;;) {
    const board = tryGenerate(spec);
    if (board.outs.length === spec.outlets) return board;
  }
}

function tryGenerate({ cols, rows, outlets, bolts }) {
  const mask = Array.from({ length: rows }, () => Array(cols).fill(0));
  const seen = Array.from({ length: rows }, () => Array(cols).fill(false));
  const src = { x: 0, y: Math.floor(Math.random() * rows) };
  const stack = [src];
  seen[src.y][src.x] = true;
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const opts = DIRS.filter(([, dx, dy]) => {
      const nx = cur.x + dx, ny = cur.y + dy;
      return nx >= 0 && ny >= 0 && nx < cols && ny < rows && !seen[ny][nx];
    });
    if (!opts.length) { stack.pop(); continue; }
    const [bit, dx, dy, back] = opts[Math.floor(Math.random() * opts.length)];
    const nx = cur.x + dx, ny = cur.y + dy;
    mask[cur.y][cur.x] |= bit;
    mask[ny][nx] |= back;
    seen[ny][nx] = true;
    stack.push({ x: nx, y: ny });
  }
  // outlets: leaf cells far from the source, preferring the right side
  const leaves = [];
  for (let y = 0; y < rows; y++) for (let x = 1; x < cols; x++) {
    const m = mask[y][x];
    if ([N, E, S, Wd].includes(m)) leaves.push({ x, y, score: x * 3 + Math.random() * 4 });
  }
  leaves.sort((a, b) => b.score - a.score);
  const outs = leaves.slice(0, outlets);
  const cells = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    cells.push({ x, y, solved: mask[y][x], mask: mask[y][x], bolted: false });
  }
  // bolt a few non-trivial pieces in their solved orientation
  const boltable = cells.filter((c) => !(c.x === src.x && c.y === src.y) && c.mask !== 15 && c.mask !== 0);
  for (let i = 0; i < bolts && boltable.length; i++) {
    boltable.splice(Math.floor(Math.random() * boltable.length), 1)[0].bolted = true;
  }
  for (const c of cells) {
    if (c.bolted) continue;
    const turns = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < turns; i++) c.mask = rotCW(c.mask);
  }
  return { cols, rows, cells, src, outs };
}

export class PowerScene {
  constructor({ hud, sfx, fx, onResult }) {
    this.hints = ["Every piece must carry power, and no conduit may end loose — red sparks show where one does.", "Pieces at the edges and corners can only point inward — set those first, they're your anchors.", "A dead-end piece next to another dead end can't point at it: two dead ends would cut themselves off. Bolted pieces show part of the true route."];
    this.hud = hud;
    this.sfx = sfx;
    this.fx = fx;
    this.onResult = onResult;
    this.index = 0;
    this._t = 0;
    this._load();
  }

  onEnter() { document.body.classList.add("no-objective", "in-puzzle"); music.play("circuit"); music.setIntensity(0); }
  onExit() { document.body.classList.remove("no-objective", "in-puzzle"); }

  get part() { return this.index; }
  resume(i) { this.index = i; this._load(); }

  _load() {
    do { this.board = generate(BOARDS[this.index]); } while (this._flood().allLit);
    this.cursor = { x: 0, y: 0 };
    this.done = 0;
    this.lit = this._flood();
  }

  cell(x, y) { return this.board.cells[y * this.board.cols + x]; }

  // BFS from the source through mutually-connected conduit ends.
  _flood() {
    const { cols, rows, src, outs } = this.board;
    const powered = new Set([`${src.x},${src.y}`]);
    const queue = [src];
    while (queue.length) {
      const { x, y } = queue.shift();
      const m = this.cell(x, y).mask;
      for (const [bit, dx, dy, back] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (!(m & bit) || nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        if (!(this.cell(nx, ny).mask & back)) continue;
        const k = `${nx},${ny}`;
        if (powered.has(k)) continue;
        powered.add(k);
        queue.push({ x: nx, y: ny });
      }
    }
    const litOuts = outs.filter((o) => powered.has(`${o.x},${o.y}`)).length;
    // loose ends on powered pieces: sparks the player can see and reason from
    const leaks = [];
    for (const key of powered) {
      const [x, y] = key.split(",").map(Number);
      const m = this.cell(x, y).mask;
      for (const [bit, dx, dy, back] of DIRS) {
        if (!(m & bit)) continue;
        const nx = x + dx, ny = y + dy;
        const ok = nx >= 0 && ny >= 0 && nx < cols && ny < rows && (this.cell(nx, ny).mask & back);
        if (!ok) leaks.push({ x, y, dx, dy });
      }
    }
    const total = cols * rows;
    return { powered, litOuts, leaks, total, allLit: powered.size === total && leaks.length === 0 };
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
    const { cols, rows } = this.board;
    const c = this.cursor;
    if (input.wasPressed("left")) c.x = (c.x + cols - 1) % cols;
    if (input.wasPressed("right")) c.x = (c.x + 1) % cols;
    if (input.wasPressed("up")) c.y = (c.y + rows - 1) % rows;
    if (input.wasPressed("down")) c.y = (c.y + 1) % rows;
    // Space/Enter turn clockwise, Backspace back the other way, so no piece costs three presses
    const ccw = input.wasPressed("back");
    if (ccw || input.wasPressed("interact") || input.wasPressed("submit")) {
      const cell = this.cell(c.x, c.y);
      if (cell.bolted) { this.sfx.play("denied"); return; }
      cell.mask = ccw ? rotCCW(cell.mask) : rotCW(cell.mask);
      cell.spin = 0.12;
      this.sfx.play("select");
      const before = this.lit.litOuts;
      this.lit = this._flood();
      if (this.lit.litOuts > before) this.sfx.play("confirm");
      if (this.lit.allLit) {
        this.done = DONE_TIME;
        this.sfx.play("success");
        this.fx.flash("#ffd15a");
      }
    }
  }

  _next() {
    this.index++;
    if (this.index < BOARDS.length) { this.sfx.play("door"); this.fx.glitch(); this._load(); return; }
    this.onResult({
      success: true,
      aborted: false,
      report: [
        "[R1] Grid's back. The whole research floor just lit up — I can see you on the cameras again.",
        "Bad news: so can HALCYON. Keep out of the sentinels' light up there.",
        "Kofi says R2 is the signal room. HALCYON talks to its machines on a carrier wave.",
      ],
    });
  }

  render(renderer) {
    const w = renderer.width, h = renderer.height;
    const ctx = renderer.ctx;
    const { cols, rows, src, outs } = this.board;
    renderer.fillRect(0, 0, w, h, "#0a0904");
    for (let y = 0; y < h; y += 8) renderer.fillRect(0, y, w, 1, "rgba(255,200,60,0.03)");
    renderer.fillRect(0, 0, w, 24, "#1e1806");
    renderer.fillRect(0, 22, w, 2, "#ffd15a");
    renderer.text(`R1 // RESTORE POWER — GRID ${this.index + 1}/${BOARDS.length}`, 8, 12, { color: "#ffe08a", size: 11, weight: "bold", baseline: "middle" });
    renderer.text(`POWERED ${this.lit.powered.size}/${this.lit.total}  ·  OUTLETS ${this.lit.litOuts}/${outs.length}`, w - 8, 12, {
      color: this.lit.allLit ? "#0aff7a" : "#ffd15a", size: 10, weight: "bold", baseline: "middle", align: "right",
    });

    const gx = Math.round((w - cols * CELL) / 2) + 10;
    const gy = 40 + Math.round((220 - rows * CELL) / 2);
    // source battery
    const sy = gy + src.y * CELL + CELL / 2;
    renderer.fillRect(gx - 30, sy - 10, 18, 20, "#2a2208");
    renderer.strokeRect(gx - 30, sy - 10, 18, 20, "#ffd15a", 1);
    renderer.text("⚡", gx - 21, sy, { color: "#ffd15a", size: 11, align: "center", baseline: "middle" });
    renderer.fillRect(gx - 12, sy - 2, 12, 4, "#ffd15a");

    for (const cell of this.board.cells) {
      const x = gx + cell.x * CELL, y = gy + cell.y * CELL;
      const on = this.lit.powered.has(`${cell.x},${cell.y}`);
      renderer.fillRect(x + 1, y + 1, CELL - 2, CELL - 2, cell.bolted ? "#1a1810" : "#12100a");
      renderer.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2, "#2a2410", 1);
      if (cell.bolted) for (const [bx, by] of [[4, 4], [CELL - 6, 4], [4, CELL - 6], [CELL - 6, CELL - 6]]) renderer.fillRect(x + bx, y + by, 2, 2, "#6a6050");
      this._drawConduit(ctx, x + CELL / 2, y + CELL / 2, cell.mask, on);
    }
    for (const o of outs) {
      const x = gx + o.x * CELL + CELL / 2, y = gy + o.y * CELL + CELL / 2;
      const on = this.lit.powered.has(`${o.x},${o.y}`);
      if (on) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, 18);
        g.addColorStop(0, "rgba(255,220,120,0.7)");
        g.addColorStop(1, "rgba(255,220,120,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - 18, y - 18, 36, 36);
      }
      ctx.fillStyle = "#0a0812";
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = on ? "#fff2b0" : "#8a7430";
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      if (!on) { ctx.strokeStyle = "#ffd15a"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 7.5, 0, Math.PI * 2); ctx.stroke(); }
    }
    // sparks at loose conduit ends
    for (const l of this.lit.leaks) {
      const x = gx + l.x * CELL + CELL / 2 + l.dx * (CELL / 2 - 3), y = gy + l.y * CELL + CELL / 2 + l.dy * (CELL / 2 - 3);
      const flick = Math.floor(this._t * 12 + l.x * 3 + l.y) & 1;
      renderer.fillRect(x - 2, y - 2, 4, 4, flick ? "#ff5a3a" : "#ffd0a0");
    }
    // cursor
    const cx = gx + this.cursor.x * CELL, cy = gy + this.cursor.y * CELL;
    const pulse = 0.5 + 0.5 * Math.sin(this._t * 8);
    ctx.globalAlpha = 0.6 + 0.4 * pulse;
    renderer.strokeRect(cx - 1, cy - 1, CELL + 2, CELL + 2, "#cffcff", 2);
    ctx.globalAlpha = 1;

    renderer.fillRect(0, h - 22, w, 22, "#1e1806");
    renderer.fillRect(0, h - 22, w, 1, "#ffd15a");
    renderer.text("[arrows] move   [space] rotate ↻   [backspace] ↺   no loose ends   [esc] exit", 8, h - 11, { color: "#a8904a", size: 8, baseline: "middle" });
    if (this.done > 0) {
      renderer.text("GRID ONLINE", w / 2, gy + rows * CELL + 16, { color: "#0aff7a", size: 12, align: "center", baseline: "middle", weight: "bold" });
    }
  }

  _drawConduit(ctx, cx, cy, mask, on) {
    const len = CELL / 2 - 1;
    ctx.lineCap = "square";
    for (const [width, color] of [[8, "#0a0812"], [4, on ? "#ffd15a" : "#4a4232"]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      if (mask & N) { ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - len); }
      if (mask & E) { ctx.moveTo(cx, cy); ctx.lineTo(cx + len, cy); }
      if (mask & S) { ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + len); }
      if (mask & Wd) { ctx.moveTo(cx, cy); ctx.lineTo(cx - len, cy); }
      ctx.stroke();
    }
    ctx.fillStyle = on ? "#fff2b0" : "#5a5040";
    ctx.fillRect(cx - 2, cy - 2, 4, 4);
    if (on) {
      // sparks travelling outwards along the conduit
      const p = (this._t * 2 + cx * 0.01) % 1;
      ctx.fillStyle = "#ffffff";
      for (const [bit, dx, dy] of [[N, 0, -1], [E, 1, 0], [S, 0, 1], [Wd, -1, 0]]) {
        if (mask & bit) ctx.fillRect(cx + dx * len * p - 1, cy + dy * len * p - 1, 2, 2);
      }
    }
  }
}
