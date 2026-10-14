import { TILE_SIZE } from "./tilemap.js";
import { key, charAt, cells, find, gateLive, nextBeat, slideEnd, latticeStep, isPanel } from "./puzzle-rules.js";
import { hasCollected, collect, penalize, scaledPenalty } from "../state.js";

// Optional puzzles built into the walkable world, one per floor (map.puzzles). The rules live in
// puzzle-rules.js so the solver can prove the same layouts; this file is the live version: step
// hooks, canisters, drawing and lights. Solving one saves its id in gameState.collected.
//   lasers  — lobby B1 wing: gates swap on every step, cracked panels skip a beat
//   slide   — research cold store: canisters slide on ice until something stops them
//   lattice — core vault: light every panel in one stroke and end on the vault socket
// The cold store and the lattice can dead-end, so holding E inside either resets it from anywhere.

const T = TILE_SIZE;
const ZAP_PENALTY = 5;
const SOLVE_SCORE = 20;
const PUSH_HOLD = 0.12;   // lean on a canister this long before it moves (no accidental shoves)
const RESET_HOLD = 1;     // hold E this long inside a room to reset its puzzle
const SLIDE_SPEED = 260;  // px/s
const GATE = { M: { rgb: "255,79,216", hex: "#ff4fd8" }, C: { rgb: "54,232,255", hex: "#36e8ff" } };
const INK = "#0a0812";

export function makeFloorPuzzles(map, world) {
  return (map.puzzles ?? []).map((cfg) => new KINDS[cfg.kind](cfg, world));
}

class FloorPuzzle {
  constructor(cfg, world) {
    this.cfg = cfg;
    this.id = cfg.id;
    this.hints = cfg.hints;
    this.world = world;
    this.cells = cells(cfg);
    this.solved = hasCollected(cfg.id);
    this._t = 0;
  }

  // inside the room: sentinels can't see in, and H gives this puzzle's hints
  contains(c, r) { const ch = this.cells.get(key(c, r)); return !!ch && ch !== "D"; }
  blocks() { return false; }
  blockedOnMap(c, r) { return this.blocks(c, r); }
  update(dt) { this._t += dt; }
  onStart() {}
  onArrive() { return false; } // true when the player was sent somewhere else
  sprites() { return []; }
  lights() { return []; }
  drawFloor() {}
  drawGlow() {}

  _solve(toast, echo) {
    this.solved = true;
    collect(this.id);
    const w = this.world;
    w.hud.addScore(SOLVE_SCORE);
    w.sfx.play("success");
    w.fx.flash("#0aff7a");
    w.toast.show(toast, "good");
    w._echoCooldown = 0;
    w._echo(echo, true);
  }

  // a mistake: time penalty, sparks, and back to `to`
  _zap(label, to, echoKey, echo) {
    const w = this.world;
    penalize(ZAP_PENALTY);
    const x = w.player.centerX, y = w.player.centerY;
    w.sfx.play("zap");
    w.fx.shake();
    w.fx.flash("#ff4040");
    w.toast.show(`${label} (-${scaledPenalty(ZAP_PENALTY)}s)`, "danger");
    w.particles.burst(24, () => {
      const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 90;
      return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3, life: 0.4 + Math.random() * 0.4,
               color: Math.random() < 0.5 ? "#ff4fd8" : "#ffe0f0", additive: true, trail: true };
    });
    w.tempLights.push({ x, y, radius: 70, base: 1, intensity: 1, color: "255,60,90", life: 0.35, maxLife: 0.35 });
    w.player.teleport(to.c, to.r);
    w._echoCooldown = 0;
    w._echoOnce(echoKey, echo);
  }

  // true once E has been held long enough inside the room (the press has to start in the room,
  // so the E that closes a sign doesn't count)
  _holdToReset(dt, input, allowed) {
    if (input?.wasPressed("interact")) this._armed = true;
    if (!input?.isDown("interact")) this._armed = false;
    const p = this.world.player;
    this._hold = this._armed && allowed && this.contains(p.col, p.row) ? (this._hold ?? 0) + dt : 0;
    if (this._hold < RESET_HOLD) return false;
    this._hold = 0;
    this._armed = false;
    return true;
  }

  _drawHold(renderer, cam) {
    if (!(this._hold > 0.15)) return;
    const ctx = renderer.ctx, p = this.world.player;
    const px = Math.round(p.centerX - cam.x), py = Math.round(p.y - cam.y) - 10;
    ctx.strokeStyle = "#ffd15a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, this._hold / RESET_HOLD));
    ctx.stroke();
  }

  _onScreen(cam, c, r) { return c * T - cam.x > -T && r * T - cam.y > -T && c * T - cam.x < cam.vw && r * T - cam.y < cam.vh; }
}

// --- lobby: laser grid ------------------------------------------------------------------------

class LaserGrid extends FloorPuzzle {
  constructor(cfg, world) {
    super(cfg, world);
    this.k = 0;
    this.start = find(cfg, "S")[0];
    this.goal = find(cfg, "G")[0];
    this.panels = find(cfg, "*");
    // a gate set in a wall gap: beams run between the walls on either side of it
    this.gates = [...find(cfg, "M").map((g) => ({ ...g, ch: "M" })), ...find(cfg, "C").map((g) => ({ ...g, ch: "C" }))]
      .map((g) => ({ ...g, across: charAt(cfg, g.c - 1, g.r) === "#" && charAt(cfg, g.c + 1, g.r) === "#" }));
    this._swapT = 0;
    this._sparkT = 1;
  }

  live(ch) { return !this.solved && gateLive(ch, this.k); }

  update(dt) {
    super.update(dt);
    this._swapT = Math.max(0, this._swapT - dt);
    this._sparkT -= dt;
    if (this._sparkT <= 0) {
      this._sparkT = 1.5 + Math.random() * 2.5;
      const p = this.panels[Math.floor(Math.random() * this.panels.length)];
      if (p) this._spark(p, 5);
    }
  }

  onStart(from, to) {
    if (this.solved) return;
    if (!this.contains(to.col, to.row)) { this._beat(0); return; } // out the door: back to the first beat
    const ch = charAt(this.cfg, to.col, to.row);
    if (ch === "*") {
      this._spark({ c: to.col, r: to.row }, 10);
      this.world.sfx.play("spark");
      this.world._echoOnce("lasers:panel", "That panel's cracked. The gates didn't feel that step.");
    }
    this._beat(nextBeat(this.k, ch));
  }

  _beat(k) {
    if (k === this.k) return;
    this.k = k;
    this._swapT = 0.12;
    this.world.sfx.play("click");
  }

  onArrive(c, r) {
    if (this.solved) return false;
    const ch = charAt(this.cfg, c, r);
    if ((ch === "M" || ch === "C") && gateLive(ch, this.k)) {
      this.k = 0;
      this._zap("⚡ ZAPPED", this.start, "lasers:zap", "It switched on as you stepped in. Walk into a gate while it's lit — it flips off under you.");
      return true;
    }
    if (ch === "G") this._solve("◆ LASER GRID OFFLINE", "Grid's down. That spare cell is ours.");
    return false;
  }

  _spark(p, n) {
    const x = p.c * T + 8, y = p.r * T + 9;
    this.world.particles.burst(n, () => ({
      x, y, vx: (Math.random() - 0.5) * 60, vy: -20 - Math.random() * 50, gravity: 260, drag: 0.6,
      life: 0.3 + Math.random() * 0.4, color: Math.random() < 0.5 ? "#ffd27a" : "#ff8a3a", additive: true, floor: y + 4,
    }));
  }

  lights() {
    const out = [];
    for (const g of this.gates) {
      const lit = this.live(g.ch);
      out.push({ x: g.c * T + 8, y: g.r * T + 8, radius: lit ? 34 : 14, intensity: lit ? 0.75 : 0.25, color: GATE[g.ch].rgb });
    }
    // dim work lights in each bay, so the walls and floor read in the dark
    for (const [k, ch] of this.cells) {
      const [c, r] = k.split(",").map(Number);
      if (ch === "." && (c - this.cfg.origin.col) % 5 === 3 && (r - this.cfg.origin.row) % 4 === 2) {
        out.push({ x: c * T + 8, y: r * T + 8, radius: 56, intensity: 0.4, color: "170,255,215" });
      }
    }
    out.push({ x: this.goal.c * T + 8, y: this.goal.r * T + 8, radius: 40, intensity: 0.6, color: this.solved ? "10,255,122" : "120,255,170" });
    out.push({ x: this.start.c * T + 8, y: this.start.r * T + 8, radius: 30, intensity: 0.45, color: "200,255,230" });
    for (const p of this.panels) out.push({ x: p.c * T + 8, y: p.r * T + 8, radius: 22, intensity: 0.4, color: "255,150,60" });
    return out;
  }

  drawFloor(renderer, cam) {
    const ctx = renderer.ctx;
    for (const [k, ch] of this.cells) {
      const [c, r] = k.split(",").map(Number);
      if (!this._onScreen(cam, c, r)) continue;
      const x = Math.round(c * T - cam.x), y = Math.round(r * T - cam.y);
      if (ch === "*") {
        // cracked sensor panel
        rect(ctx, x + 1, y + 1, T - 2, T - 2, "#1a2420");
        ctx.strokeStyle = "#060a08";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 3, y + 4); ctx.lineTo(x + 7, y + 8); ctx.lineTo(x + 6, y + 13);
        ctx.moveTo(x + 7, y + 8); ctx.lineTo(x + 13, y + 6);
        ctx.moveTo(x + 9, y + 7); ctx.lineTo(x + 12, y + 12);
        ctx.stroke();
        rect(ctx, x + 12, y + 2, 2, 2, Math.floor(this._t * 3) & 1 ? "#ff5a3a" : "#3a0a08");
      } else if (ch === "S") {
        rect(ctx, x + 2, y + 2, T - 4, T - 4, "#0e2a20");
        ctx.strokeStyle = "#8affc8";
        ctx.strokeRect(x + 3.5, y + 3.5, T - 7, T - 7);
      } else if (ch === "G") {
        rect(ctx, x + 1, y + 1, T - 2, T - 2, this.solved ? "#0a5a30" : "#0e3a24");
        ctx.strokeStyle = this.solved ? "#0aff7a" : "#4ad88a";
        ctx.strokeRect(x + 2.5, y + 2.5, T - 5, T - 5);
        rect(ctx, x + 6, y + 6, 4, 4, this.solved ? "#0aff7a" : "#2a8a5a");
      } else if (ch === "M" || ch === "C") {
        const g = this.gates.find((q) => q.c === c && q.r === r);
        drawGateBase(ctx, x, y, g.across, GATE[ch].hex);
      }
    }
  }

  // beams sit above the darkness so the rhythm reads from across the room
  drawGlow(renderer, cam) {
    const ctx = renderer.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const g of this.gates) {
      if (!this._onScreen(cam, g.c, g.r)) continue;
      const x = Math.round(g.c * T - cam.x), y = Math.round(g.r * T - cam.y);
      const col = GATE[g.ch];
      const lit = this.live(g.ch);
      // emitter LEDs always show the gate's colour
      ctx.globalAlpha = lit ? 1 : 0.55;
      if (g.across) { rect(ctx, x + 1, y + 6, 2, 4, col.hex); rect(ctx, x + T - 3, y + 6, 2, 4, col.hex); }
      else { rect(ctx, x + 6, y + 1, 4, 2, col.hex); rect(ctx, x + 6, y + T - 3, 4, 2, col.hex); }
      if (lit) {
        ctx.globalAlpha = (this._swapT > 0 ? 0.5 : 0.75) + 0.25 * Math.sin(this._t * 40 + g.c);
        for (const o of [4, 8, 12]) {
          if (g.across) { rect(ctx, x + 3, y + o - 1, T - 6, 1, col.hex); rect(ctx, x + 3, y + o - 2, T - 6, 3, `rgba(${col.rgb},0.25)`); }
          else { rect(ctx, x + o - 1, y + 3, 1, T - 6, col.hex); rect(ctx, x + o - 2, y + 3, 3, T - 6, `rgba(${col.rgb},0.25)`); }
        }
      } else {
        ctx.globalAlpha = 0.22;
        for (let i = 3; i < T - 3; i += 3) {
          if (g.across) rect(ctx, x + i, y + 8, 1, 1, col.hex);
          else rect(ctx, x + 8, y + i, 1, 1, col.hex);
        }
      }
    }
    ctx.restore();
  }
}

// --- research: sliding canisters -------------------------------------------------------------

class SlideBay extends FloorPuzzle {
  constructor(cfg, world) {
    super(cfg, world);
    this.vents = find(cfg, "o");
    this.pad = find(cfg, "R")[0];
    this.door = find(cfg, "V")[0];
    this.home = find(cfg, "$");
    this.cans = (this.solved ? this.vents : this.home).map((p) => ({ c: p.c, r: p.r, x: p.c * T, y: p.r * T }));
    this._lean = 0;
    this._frostT = 0;
    this._pending = false;
  }

  canAt(c, r) { return this.cans.find((k) => k.c === c && k.r === r); }
  capped(v) { return !!this.canAt(v.c, v.r); }
  blocks(c, r) { return !!this.canAt(c, r) || (!this.solved && c === this.door.c && r === this.door.r); }
  get moved() { return this.cans.some((k, i) => k.c !== this.home[i].c || k.r !== this.home[i].r); }

  update(dt, input) {
    super.update(dt);
    let sliding = false;
    for (const k of this.cans) {
      const tx = k.c * T, ty = k.r * T, dx = tx - k.x, dy = ty - k.y, d = Math.hypot(dx, dy);
      if (d <= SLIDE_SPEED * dt) { k.x = tx; k.y = ty; } else { k.x += (dx / d) * SLIDE_SPEED * dt; k.y += (dy / d) * SLIDE_SPEED * dt; sliding = true; }
    }
    if (this._pending && !sliding) this._settle();
    if (this.solved) return;
    const p = this.world.player;
    // lean into a canister to push it
    const [fx, fy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[p.facing];
    const can = p.bumped && !sliding ? this.canAt(p.col + fx, p.row + fy) : null;
    this._lean = can ? this._lean + dt : 0;
    if (can && this._lean >= PUSH_HOLD) { this._lean = 0; this._push(can, fx, fy); }
    if (this._holdToReset(dt, input, this.moved)) this._recall();
    this._frostT -= dt;
    if (this._frostT <= 0) { this._frostT = 0.35; for (const v of this.vents) if (!this.capped(v)) this._frost(v); }
  }

  _push(can, dx, dy) {
    const others = new Set(this.cans.filter((k) => k !== can).map((k) => key(k.c, k.r)));
    const to = slideEnd(this.cfg, others, can.c, can.r, dx, dy);
    if (to.c === can.c && to.r === can.r) return; // jammed: the world's bump sound already plays
    can.c = to.c; can.r = to.r;
    this.world.sfx.play("stamp");
    this._pending = true;
    this.world._echoOnce("cold:first", "See? It just keeps going. Something has to be in its way.");
  }

  // a canister came to rest
  _settle() {
    this._pending = false;
    const onVent = this.cans.filter((k) => this.vents.some((v) => v.c === k.c && v.r === k.r)).length;
    this.world.sfx.play(onVent ? "confirm" : "bump");
    if (onVent === this.vents.length) this._solve("◆ COLD STORE UNSEALED", "All three vents capped. The inner store's open.");
  }

  onArrive(c, r) {
    if (!this.solved && c === this.pad.c && r === this.pad.r && this.moved) this._recall();
    return false;
  }

  _recall() {
    this.cans.forEach((k, i) => { k.c = this.home[i].c; k.r = this.home[i].r; });
    this._pending = false;
    this.world.sfx.play("iris");
    this.world.toast.show("↺ CANISTERS RECALLED", "info");
    for (const h of this.home) this._frost(h, 10);
  }

  _frost(v, n = 2) {
    const x = v.c * T + 8, y = v.r * T + 10;
    this.world.particles.burst(n, () => ({
      x: x + (Math.random() - 0.5) * 8, y, vx: (Math.random() - 0.5) * 10, vy: -12 - Math.random() * 14, drag: 1.5,
      life: 0.6 + Math.random() * 0.5, color: "rgba(220,245,255,0.7)",
    }));
  }

  sprites() {
    return this.cans.map((k) => ({ y: k.y, draw: (renderer, cam) => this._drawCan(renderer.ctx, k, cam) }));
  }

  lights() {
    const out = [];
    const cx = (this.cfg.origin.col + 4) * T, cy = (this.cfg.origin.row + 5) * T;
    out.push({ x: cx, y: cy - 40, radius: 70, intensity: 0.5, color: "150,220,255" });
    out.push({ x: cx, y: cy + 40, radius: 70, intensity: 0.5, color: "150,220,255" });
    for (const v of this.vents) out.push({ x: v.c * T + 8, y: v.r * T + 8, radius: 22, intensity: 0.5, color: this.capped(v) ? "10,255,122" : "180,240,255" });
    out.push({ x: this.pad.c * T + 8, y: this.pad.r * T + 8, radius: 24, intensity: 0.5, color: "255,210,90" });
    out.push({ x: this.door.c * T + 8, y: this.door.r * T + 8, radius: 26, intensity: 0.6, color: this.solved ? "10,255,122" : "255,60,60" });
    return out;
  }

  drawFloor(renderer, cam) {
    const ctx = renderer.ctx;
    for (const [k, ch] of this.cells) {
      const [c, r] = k.split(",").map(Number);
      if (!this._onScreen(cam, c, r)) continue;
      const x = Math.round(c * T - cam.x), y = Math.round(r * T - cam.y);
      if (ch === "." || ch === "o" || ch === "$") {
        // iced-over floor: pale and streaky, so it reads as slippery
        rect(ctx, x, y, T, T, (c + r) & 1 ? "#1e3a48" : "#21404e");
        rect(ctx, x + ((c * 5 + r * 3) % 9) + 1, y + ((c * 3 + r * 7) % 9) + 2, 5, 1, "rgba(220,245,255,0.35)");
        rect(ctx, x + ((c * 7 + r) % 7) + 4, y + ((c + r * 5) % 7) + 6, 3, 1, "rgba(220,245,255,0.2)");
      }
      if (ch === "o") {
        box(ctx, x + 2, y + 2, T - 4, T - 4, "#081016");
        for (let i = 5; i < T - 4; i += 2) rect(ctx, x + 4, y + i, T - 8, 1, "#2a4a5a");
      } else if (ch === "R") {
        rect(ctx, x + 1, y + 1, T - 2, T - 2, "#2a2410");
        ctx.strokeStyle = "#ffd15a";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x + 8, y + 8, 4.5, 0.6, Math.PI * 1.9); ctx.stroke();
        rect(ctx, x + 11, y + 3, 3, 3, "#ffd15a");
      } else if (ch === "V") {
        drawVaultDoor(ctx, x, y, this.solved, this._t, "#2a3e4c");
      }
    }
  }

  _drawCan(ctx, k, cam) {
    const x = Math.round(k.x - cam.x), y = Math.round(k.y - cam.y);
    const sealed = this.vents.some((v) => v.c === k.c && v.r === k.r) && k.x === k.c * T && k.y === k.r * T;
    rect(ctx, x + 3, y + 13, 10, 2, "rgba(0,0,0,0.45)");
    box(ctx, x + 3, y - 1, 10, 15, sealed ? "#3aa0d0" : "#5a8aa8");
    rect(ctx, x + 4, y, 8, 2, sealed ? "#9aeaff" : "#cfe8f4");
    rect(ctx, x + 5, y + 3, 1, 8, "rgba(255,255,255,0.45)");
    rect(ctx, x + 4, y + 7, 8, 2, "#ffd15a");
    rect(ctx, x + 10, y + 3, 1, 1, sealed ? "#0aff7a" : "#ff5a3a");
  }

  drawGlow(renderer, cam) {
    const ctx = renderer.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const v of this.vents) {
      if (!this._onScreen(cam, v.c, v.r)) continue;
      const x = Math.round(v.c * T - cam.x), y = Math.round(v.r * T - cam.y);
      ctx.globalAlpha = this.capped(v) ? 0.5 : 0.3 + 0.15 * Math.sin(this._t * 4 + v.c);
      ctx.strokeStyle = this.capped(v) ? "#0aff7a" : "#9adcff";
      ctx.strokeRect(x + 1.5, y + 1.5, T - 3, T - 3);
    }
    ctx.restore();
    this._drawHold(renderer, cam);
  }
}

// --- core: memory lattice --------------------------------------------------------------------

class Lattice extends FloorPuzzle {
  constructor(cfg, world) {
    super(cfg, world);
    this.entry = find(cfg, "_")[0];
    this.door = find(cfg, "V")[0];
    this.vault = find(cfg, "E")[0];
    this.panels = [...this.cells].filter(([, ch]) => isPanel(ch)).map(([k]) => k.split(",").map(Number));
    this.lit = [];
    this._flash = 0;
  }

  // a spent panel is hot: it won't take a second step
  blocks(c, r) { return !this.solved && ((c === this.door.c && r === this.door.r) || this.lit.includes(key(c, r))); }
  blockedOnMap(c, r) { return !this.solved && c === this.door.c && r === this.door.r; }
  isLit(c, r) { return this.solved || this.lit.includes(key(c, r)); }

  update(dt, input) {
    super.update(dt);
    this._flash = Math.max(0, this._flash - dt);
    if (this.solved) return;
    const p = this.world.player;
    const [fx, fy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[p.facing];
    if (p.bumped && this.lit.includes(key(p.col + fx, p.row + fy))) {
      this.world._echoOnce("lattice:spent", "Spent panels won't take another step. Stuck? Hold E to clear the trace.");
    }
    if (this._holdToReset(dt, input, this.lit.length > 0)) {
      this.lit = [];
      this.world.player.teleport(this.entry.c, this.entry.r);
      this.world.sfx.play("iris");
      this.world.toast.show("↺ TRACE CLEARED", "info");
    }
  }

  onArrive(c, r) {
    if (this.solved) return false;
    const res = latticeStep(this.cfg, this.lit, c, r);
    if (res === "off") {
      if (this.lit.length) { this.lit = []; this.world.sfx.play("iris"); }
      return false;
    }
    if (res === "overload") {
      // only the vault socket can get here: spent panels block
      this.lit = [];
      this._flash = 0.4;
      this._zap("⚡ LATTICE OVERLOAD", this.entry, "lattice:early", "The vault socket only takes a finished trace. Every panel first.");
      return true;
    }
    this.lit.push(key(c, r));
    this.world.sfx.play("blip");
    if (res === "solved") {
      this.world.sfx.play("door");
      this._solve("◆ VAULT 0 OPEN", "One stroke, every panel. The vault's open.");
    }
    return false;
  }

  lights() {
    const out = [];
    for (const [c, r] of this.panels) {
      const lit = this.isLit(c, r);
      out.push({ x: c * T + 8, y: r * T + 8, radius: lit ? 26 : 16, intensity: lit ? 0.55 : 0.3, color: lit ? "54,232,255" : "255,70,90" });
    }
    out.push({ x: this.door.c * T + 8, y: this.door.r * T + 8, radius: 26, intensity: 0.6, color: this.solved ? "10,255,122" : "255,60,60" });
    return out;
  }

  drawFloor(renderer, cam) {
    const ctx = renderer.ctx;
    for (const [c, r] of this.panels) {
      if (!this._onScreen(cam, c, r)) continue;
      const x = Math.round(c * T - cam.x), y = Math.round(r * T - cam.y);
      const lit = this.isLit(c, r);
      box(ctx, x + 1, y + 1, T - 2, T - 2, lit ? "#0e3a48" : "#1a0c12");
      rect(ctx, x + 3, y + 3, T - 6, 1, lit ? "#2a7a8a" : "#3a1820");
      rect(ctx, x + 3, y + T - 4, T - 6, 1, lit ? "#2a7a8a" : "#3a1820");
    }
    const d = this.door;
    if (this._onScreen(cam, d.c, d.r)) drawVaultDoor(ctx, Math.round(d.c * T - cam.x), Math.round(d.r * T - cam.y), this.solved, this._t, "#2a1016");
  }

  // panel outlines, sockets and the trace sit above the darkness so the whole lattice reads
  drawGlow(renderer, cam) {
    const ctx = renderer.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const [c, r] of this.panels) {
      if (!this._onScreen(cam, c, r)) continue;
      const x = Math.round(c * T - cam.x), y = Math.round(r * T - cam.y);
      const lit = this.isLit(c, r);
      ctx.globalAlpha = lit ? 0.9 : this._flash > 0 ? 0.9 : 0.4;
      ctx.strokeStyle = lit ? "#36e8ff" : this._flash > 0 ? "#ff3a3a" : "#ff4a5a";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 2.5, y + 2.5, T - 5, T - 5);
      const ch = charAt(this.cfg, c, r);
      if (ch === "S" || ch === "E") {
        ctx.strokeStyle = ch === "S" ? "#8affc8" : "#ffd15a";
        ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.arc(x + 8, y + 8, 3.5, 0, Math.PI * 2); ctx.stroke();
      }
    }
    // the trace so far
    if (this.lit.length) {
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = "#9af4ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      this.lit.forEach((k, i) => {
        const [c, r] = k.split(",").map(Number);
        const x = c * T + 8 - cam.x, y = r * T + 8 - cam.y;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.stroke();
    }
    ctx.restore();
    this._drawHold(renderer, cam);
    // trace counter above the vault door
    const d = this.door;
    if (this._onScreen(cam, d.c, d.r - 1)) {
      const x = Math.round(d.c * T - cam.x), y = Math.round((d.r - 1) * T - cam.y);
      rect(ctx, x - 2, y + 4, T + 4, 9, INK);
      renderer.text(`${this.solved ? this.panels.length : this.lit.length}/${this.panels.length}`, x + 8, y + 9,
        { color: this.solved ? "#0aff7a" : "#36e8ff", size: 7, align: "center", baseline: "middle", weight: "bold" });
    }
  }
}

const KINDS = { lasers: LaserGrid, slide: SlideBay, lattice: Lattice };

// --- drawing helpers ---------------------------------------------------------------------------

function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
function box(ctx, x, y, w, h, fill) { rect(ctx, x, y, w, h, INK); rect(ctx, x + 1, y + 1, w - 2, h - 2, fill); }

function drawGateBase(ctx, x, y, across, hex) {
  // hazard strip on the floor and the two emitter housings
  ctx.globalAlpha = 0.35;
  if (across) rect(ctx, x + 2, y + 7, T - 4, 2, hex); else rect(ctx, x + 7, y + 2, 2, T - 4, hex);
  ctx.globalAlpha = 1;
  if (across) { box(ctx, x, y + 4, 4, 8, "#2a3038"); box(ctx, x + T - 4, y + 4, 4, 8, "#2a3038"); }
  else { box(ctx, x + 4, y, 8, 4, "#2a3038"); box(ctx, x + 4, y + T - 4, 8, 4, "#2a3038"); }
}

function drawVaultDoor(ctx, x, y, open, time, frame) {
  rect(ctx, x, y, T, T, frame);
  if (open) {
    rect(ctx, x + 2, y + 2, T - 4, T - 2, "#020406");
    rect(ctx, x + 1, y + 2, 2, T - 2, "#3a4a54");
    rect(ctx, x + T - 3, y + 2, 2, T - 2, "#3a4a54");
    rect(ctx, x + 3, y + T - 2, T - 6, 2, "rgba(10,255,122,0.35)");
    return;
  }
  box(ctx, x + 1, y + 1, T - 2, T - 1, "#3a424a");
  rect(ctx, x + 2, y + 5, T - 4, 1, "#22282e");
  rect(ctx, x + 2, y + 10, T - 4, 1, "#22282e");
  rect(ctx, x + 7, y + 2, 2, T - 3, "#22282e");
  rect(ctx, x + 3, y + 3, T - 6, 1, Math.floor(time * 2) & 1 ? "#ff3a3a" : "#7a1010");
}
