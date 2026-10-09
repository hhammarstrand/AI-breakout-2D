import { Camera } from "../engine/camera.js";
import { Tilemap, TILE_SIZE, TILE } from "../world/tilemap.js";
import { Player } from "../entities/player.js";
import { Npc } from "../entities/npc.js";
import { Drone } from "../entities/drone.js";
import { Sentinel } from "../entities/sentinel.js";
import { Lighting, collectLights } from "../engine/lighting.js";
import { Particles } from "../engine/particles.js";
import {
  isSectorActive,
  isSectorCompleted,
  completeSector,
  gameState,
} from "../state.js";
import { PauseScene } from "./pause-scene.js";
import { Sector1Scene } from "./sector1-scene.js";
import { Sector2Scene } from "./sector2-scene.js";

const SECTOR_LAUNCHERS = {
  1: (ctx) => new Sector1Scene(ctx),
  2: (ctx) => new Sector2Scene(ctx),
};

const ECHO_CLEAR_LINES = {
  1: "Survivor's safe. One down, three to go!",
  2: "ORION SEVEN... I'll remember that. Two down!",
};

const SECTOR_NAMES = {
  2: "DECRYPT THE LAB LOGS",
  3: "BUILD THE DOOR AGENT",
  4: "THE BREACH",
};

const SECTOR_REWARD = 25;
const ALARM_SECONDS = 5 * 60;
const IRIS_TIME = 0.45;
const ECHO_GAP = 5;

const CAUGHT_TIME_PENALTY = 60;
const CAUGHT_SCORE_PENALTY = 5;

const DOOR_COLORS = { done: "10,255,122", active: "74,230,255", sealed: "255,40,40" };

const ECHO_TIPS = [
  ["Psst. The Operator's by reception. Talk to them.", "The L1 sign has sensor baselines. Worth a read.", "L1 is up north-west. I'll light the way."],
  ["L2's open now. Heads north, second door.", "Nice work in L1. Keep moving."],
  ["L3 next. Stay sharp."],
  ["Last door. Let's finish this."],
  ["We did it, op. Time to get out."],
];
const INTERACT_RADIUS = TILE_SIZE * 0.9;
const STEP_INTERVAL = 0.3;

export class WorldScene {
  constructor({ map, dialog, hud, sfx, fx, toast, postfx, onToggleSfx, onToggleCrt, onQuit, viewportWidth, viewportHeight }) {
    this.map = map;
    this.dialog = dialog;
    this.hud = hud;
    this.sfx = sfx;
    this.fx = fx;
    this.toast = toast;
    this.onToggleSfx = onToggleSfx;
    this.onToggleCrt = onToggleCrt;
    this.postfx = postfx;
    this.sentinels = (map.sentinels || []).map((cfg) => new Sentinel(cfg));
    this.flashOn = true;
    this._danger = 0;
    this.onQuit = onQuit;
    this.tilemap = new Tilemap(map.grid);
    this.player = new Player(map.spawn.col, map.spawn.row);
    this.npcs = (map.npcs || []).map((cfg) => new Npc(cfg));
    this.camera = new Camera(viewportWidth, viewportHeight);
    this.camera.setBounds(this.tilemap.widthPx, this.tilemap.heightPx);
    this.camera.snapTo(this.player.centerX, this.player.centerY);
    this._time = 0;
    this._stepTimer = 0;

    this.drone = new Drone(this.player.centerX, this.player.centerY - 20);
    this.particles = new Particles();
    this.lighting = new Lighting(viewportWidth, viewportHeight);
    this.mapLights = collectLights(this.tilemap, (n) =>
      isSectorCompleted(n) ? DOOR_COLORS.done : isSectorActive(n) ? DOOR_COLORS.active : DOOR_COLORS.sealed);
    this.flashAngle = Math.PI / 2;
    this.tempLights = [];
    this.sparkSources = [];
    for (let r = 0; r < this.tilemap.rows; r++) {
      for (let c = 0; c < this.tilemap.cols; c++) {
        if (this.tilemap.grid[r][c] === TILE.DEBRIS) this.sparkSources.push({ c, r });
      }
    }
    this._sparkTimer = 1;
    this._echoSaid = new Set();
    this._echoCooldown = 2;
    this._idle = 0;
    this._iris = { dir: "open", t: 0 };
    this._alarm = false;
  }

  onEnter() { this.sfx.setAmbient(this._alarm ? "alarm" : "hum"); }
  onExit() {
    this.sfx.setAmbient(null);
    if (this.postfx) this.postfx.danger = 0;
  }

  npcProfile(id) {
    const npc = this.npcs.find((n) => n.id === id);
    return npc && { accent: npc.accent, color: npc.color, bodyDark: npc.bodyDark };
  }

  update(dt, input) {
    this._time += dt;
    this.hud.update(dt);
    for (const npc of this.npcs) npc.update(dt);
    this._updateEffects(dt);

    if (this._iris) {
      this._iris.t += dt;
      if (this._iris.t >= IRIS_TIME) {
        const done = this._iris.onDone;
        this._iris = null;
        if (done) done();
      }
      if (this._iris?.dir === "close") return;
    }

    if (this.dialog.isOpen) {
      this.dialog.update(dt, input);
      return;
    }

    if (input.wasPressed("pause")) {
      this.game.push(new PauseScene({
        sfx: this.sfx, onToggleSfx: this.onToggleSfx, onToggleCrt: this.onToggleCrt, onQuit: this.onQuit,
      }));
      return;
    }

    if (input.wasPressed("flashlight")) {
      this.flashOn = !this.flashOn;
      this.sfx.play("click");
      if (!this.flashOn) this._echoOnce("dark", "Lights off. Stay in the shadows.");
    }

    this.player.update(dt, input, this.tilemap);
    this._updateSentinels(dt);
    if (this.player.moving) {
      this._idle = 0;
      this._stepTimer -= dt;
      if (this._stepTimer <= 0) {
        this._stepTimer = STEP_INTERVAL;
        this.sfx.play("step");
        this._dust();
      }
    } else {
      this._stepTimer = 0;
      this._idle += dt;
    }
    this._echoThink(dt);
    this.camera.follow(this.player.centerX, this.player.centerY);

    if (input.wasPressed("interact")) this._tryInteract();
  }

  _launchSector(sectorNum, label) {
    const launcher = SECTOR_LAUNCHERS[sectorNum];
    if (!launcher) {
      const message = this.map.doorMessages?.[label] ?? `[${label}] Locked.`;
      this.sfx.play("denied");
      this.dialog.show("Sector lock", [message]);
      return;
    }
    this.sfx.play("door");
    this.sfx.play("iris");
    this._iris = { dir: "close", t: 0, onDone: () => this._pushSector(sectorNum, label, launcher) };
  }

  _pushSector(sectorNum, label, launcher) {
    this.fx.glitch();
    this._iris = { dir: "close", t: IRIS_TIME }; // hold black until the sector is on screen
    const scene = launcher({
      hud: this.hud,
      sfx: this.sfx,
      fx: this.fx,
      onResult: ({ success, aborted, report }) => {
        this.game.pop();
        this.fx.glitch();
        this._iris = { dir: "open", t: 0 };
        if (success) {
          completeSector(sectorNum);
          this.hud.addScore(SECTOR_REWARD);
          this.sfx.play("success");
          this.fx.flash("#0aff7a");
          this.toast.show(`✓ SECTOR ${sectorNum} CLEARED`, "good");
          this._dataBurst();
          this._echoCooldown = 0;
          this._echo(ECHO_CLEAR_LINES[sectorNum] ?? "Sector secure. Keep going!", true);
          const next = sectorNum + 1;
          if (SECTOR_NAMES[next]) {
            setTimeout(() => this.toast.show(`🔓 L${next} UNLOCKED — ${SECTOR_NAMES[next]}`, "info"), 700);
          }
          this.dialog.show("Operator", [
            ...(report ?? [`[${label}] cleared.`]),
            `+${SECTOR_REWARD} pts. Good work, op.`,
          ], null, this.npcProfile("operator"));
        } else if (aborted) {
          this.dialog.show("Aborted", [
            `[${label}] Mission paused. Approach the door again to retry.`,
          ]);
        }
      },
    });
    this.game.push(scene);
  }

  _npcInReach(reach) {
    for (const npc of this.npcs) {
      const dx = (npc.x + npc.w / 2) - reach.x;
      const dy = (npc.y + npc.h / 2) - reach.y;
      if (dx * dx + dy * dy <= INTERACT_RADIUS * INTERACT_RADIUS) return npc;
    }
    return null;
  }

  _tryInteract() {
    const reach = this.player.facingTilePx();

    const npc = this._npcInReach(reach);
    if (npc) {
      npc.react();
      this.sfx.play("select");
      this.dialog.show(npc.name, npc.lines, null, { accent: npc.accent, color: npc.color, bodyDark: npc.bodyDark });
      return;
    }

    const door = this.tilemap.doorAtPx(reach.x, reach.y);
    if (door) {
      const sectorNum = parseInt(door.label.slice(1), 10);
      if (isSectorCompleted(sectorNum)) {
        this.dialog.show("Sector clear", [
          `[${door.label}] Already cleared. Nice work, op.`,
        ]);
      } else if (isSectorActive(sectorNum)) {
        this._launchSector(sectorNum, door.label);
      } else {
        const prereq = sectorNum - 1;
        this.sfx.play("denied");
        this.fx.shake();
        this.dialog.show("Sealed", [
          `[${door.label}] SEALED.`,
          `Building authorisation requires sector ${prereq} to be cleared first.`,
        ]);
      }
      return;
    }

    const interactive = this.tilemap.interactiveAtPx(reach.x, reach.y);
    if (interactive) {
      this.sfx.play("select");
      const key = `${interactive.row},${interactive.col}`;
      const msg = this.map.tileMessages?.[key];
      if (msg) {
        this.dialog.show(msg.speaker, msg.lines);
      } else if (interactive.tile === TILE.TERMINAL) {
        this.dialog.show("Terminal", ["[ no signal ]", "Connection refused."]);
      } else {
        this.dialog.show("Notice", ["Sign is faded. Unreadable."]);
      }
    }
  }

  render(renderer) {
    const ctx = renderer.ctx;
    const cam = this.camera;
    this.tilemap.draw(renderer, cam, this._time);
    this.particles.draw(ctx, cam, "under");

    const sprites = [...this.npcs, this.player, ...this.sentinels].sort((a, b) => a.y - b.y);
    for (const s of sprites) s.draw(renderer, cam);
    this.drone.draw(renderer, cam);

    this.lighting.render(ctx, cam, {
      darkness: this._alarm ? 0.84 : 0.86,
      tint: this._alarm ? "#1a0206" : "#02040a",
      tilemap: this.tilemap,
      lights: [
        ...this.mapLights.lights,
        ...this.tempLights,
        { x: this.player.centerX, y: this.player.centerY, radius: this.flashOn ? 30 : 22, intensity: this.flashOn ? 0.6 : 0.4 },
        ...this.sentinels.map((s) => ({ x: s.x, y: s.y, radius: 20, intensity: 0.5, color: "255,40,40" })),
        { x: this.drone.lightX, y: this.drone.lightY, radius: 46, intensity: 0.45, color: "74,230,255" },
      ],
      cones: [
        ...(this.flashOn ? [{
          x: this.player.centerX, y: this.player.centerY - 2,
          angle: this.flashAngle, spread: 0.55, range: 135, intensity: 1, color: "255,240,200", glow: 0.1,
        }] : []),
        ...this.sentinels.map((s) => s.cone),
      ],
    });
    for (const s of this.sentinels) s.drawIndicator(renderer, cam);
    this._drawDanger(renderer);

    this.particles.draw(ctx, cam, "over");
    if (this._alarm) this._drawAlarm(renderer);
    for (const npc of this.npcs) npc.drawLabel(renderer, cam);
    if (this._iris?.dir !== "close") {
      this.drone.drawSpeech(renderer, cam);
      this._drawInteractHint(renderer);
    }
    this._drawIris(renderer);
  }

  // --- effects -------------------------------------------------------------

  _updateEffects(dt) {
    this.mapLights.update(this._time);
    this.particles.update(dt);
    this.drone.update(dt, this.player);

    // flashlight swings smoothly toward the walking direction
    const target = Math.atan2(this.player.dirY, this.player.dirX);
    let diff = target - this.flashAngle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.flashAngle += diff * Math.min(1, dt * 10);

    for (let i = this.tempLights.length - 1; i >= 0; i--) {
      const l = this.tempLights[i];
      l.life -= dt;
      l.intensity = Math.max(0, l.life / l.maxLife) * l.base;
      if (l.life <= 0) this.tempLights.splice(i, 1);
    }

    this._sparkTimer -= dt;
    if (this._sparkTimer <= 0 && this.sparkSources.length) {
      this._sparkTimer = 0.6 + Math.random() * 1.8;
      this._sparks(this.sparkSources[Math.floor(Math.random() * this.sparkSources.length)]);
    }

    const alarm = gameState.secondsLeft <= ALARM_SECONDS;
    if (alarm !== this._alarm) {
      this._alarm = alarm;
      this.sfx.setAmbient(alarm ? "alarm" : "hum");
      if (alarm) { this._echoCooldown = 0; this._echo("Containment's failing! We need to move!", true); }
    }
  }

  _sparks({ c, r }) {
    const x = c * TILE_SIZE + 4 + Math.random() * 8;
    const y = r * TILE_SIZE + 4 + Math.random() * 6;
    this.particles.burst(8 + Math.floor(Math.random() * 10), () => ({
      x, y,
      vx: (Math.random() - 0.5) * 120,
      vy: -30 - Math.random() * 90,
      gravity: 300,
      drag: 0.5,
      life: 0.4 + Math.random() * 0.6,
      color: Math.random() < 0.5 ? "#ffd27a" : "#ff8a3a",
      additive: true,
      trail: true,
      floor: y + 8,
    }));
    this.tempLights.push({ x, y, radius: 44, base: 0.9, intensity: 0.9, color: "255,150,60", life: 0.18, maxLife: 0.18 });
    const dx = x - this.player.centerX, dy = y - this.player.centerY;
    if (dx * dx + dy * dy < (TILE_SIZE * 9) ** 2) this.sfx.play("spark");
  }

  _dust() {
    const x = this.player.centerX, y = this.player.y + this.player.h;
    this.particles.burst(3, () => ({
      x: x + (Math.random() - 0.5) * 6, y,
      vx: (Math.random() - 0.5) * 24 - this.player.dirX * 10,
      vy: -4 - Math.random() * 8,
      drag: 4,
      life: 0.35 + Math.random() * 0.2,
      color: "rgba(190,170,150,0.55)",
      layer: "under",
    }));
  }

  _dataBurst() {
    const x = this.player.centerX, y = this.player.centerY;
    this.particles.burst(48, (i) => {
      const a = (i / 48) * Math.PI * 2;
      const v = 50 + Math.random() * 70;
      return {
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        drag: 2.2, life: 1 + Math.random() * 0.6,
        glyph: Math.random() < 0.5 ? "0" : "1",
        color: Math.random() < 0.7 ? "#0aff7a" : "#cffcff",
        additive: true,
      };
    });
    this.tempLights.push({ x, y, radius: 120, base: 1, intensity: 1, color: "10,255,122", life: 0.8, maxLife: 0.8 });
  }

  // --- sentinels -----------------------------------------------------------

  _updateSentinels(dt) {
    let danger = 0;
    for (const s of this.sentinels) {
      const before = s.meter;
      const result = s.update(dt, this.player, this.tilemap, this.flashOn);
      if (before === 0 && s.meter > 0) this.sfx.play("detect");
      danger = Math.max(danger, s.meter);
      if (result === "caught") { this._caught(s); break; }
      const dx = s.x - this.player.centerX, dy = s.y - this.player.centerY;
      if (dx * dx + dy * dy < (TILE_SIZE * 8) ** 2) {
        this._echoOnce("sentinel", "Sentinel bot! Kill the light with F and sneak past.");
      }
    }
    this._danger += (danger - this._danger) * Math.min(1, dt * 8);
    if (this.postfx) this.postfx.danger = this._danger * 0.6;
  }

  _caught(sentinel) {
    gameState.secondsLeft = Math.max(0, gameState.secondsLeft - CAUGHT_TIME_PENALTY);
    this.hud.addScore(-CAUGHT_SCORE_PENALTY);
    this.sfx.play("zap");
    this.fx.shake();
    this.fx.flash("#ff2020");
    this.fx.glitch();
    this.toast.show(`⚡ SPOTTED BY ${sentinel.name} — -${CAUGHT_TIME_PENALTY}s`, "danger");
    const x = this.player.centerX, y = this.player.centerY;
    this.particles.burst(36, () => {
      const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 120;
      return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3, life: 0.5 + Math.random() * 0.5,
               color: Math.random() < 0.5 ? "#ff4040" : "#ffe0e0", additive: true, trail: true };
    });
    this.tempLights.push({ x, y, radius: 90, base: 1, intensity: 1, color: "255,40,40", life: 0.4, maxLife: 0.4 });
    this._iris = {
      dir: "close", t: -0.35, // brief hold so the zap reads before the screen closes
      onDone: () => {
        this.player.x = this.map.spawn.col * TILE_SIZE + 2;
        this.player.y = this.map.spawn.row * TILE_SIZE + 1;
        this.camera.snapTo(this.player.centerX, this.player.centerY);
        this.drone.x = this.player.centerX; this.drone.y = this.player.centerY - 20;
        this._iris = { dir: "open", t: 0 };
        this._echoCooldown = 0;
        this._echo("Ow. They tagged us. Stay out of the red beams.", true);
      },
    };
  }

  _drawDanger(renderer) {
    if (this._danger < 0.02 || (this.postfx && this.postfx.enabled)) return;
    const ctx = renderer.ctx;
    const w = renderer.width, h = renderer.height;
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.7);
    g.addColorStop(0, "rgba(255,0,0,0)");
    g.addColorStop(1, `rgba(255,0,0,${0.45 * this._danger})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // --- ECHO ----------------------------------------------------------------

  _echo(text, force = false) {
    if (!force && (this._echoCooldown > 0 || this.drone.speaking)) return false;
    this.drone.say(text);
    this.sfx.play("drone");
    this._echoCooldown = ECHO_GAP;
    return true;
  }

  _echoOnce(key, text) {
    if (this._echoSaid.has(key)) return;
    if (this._echo(text)) this._echoSaid.add(key);
  }

  _echoThink(dt) {
    this._echoCooldown -= dt;
    if (this.dialog.isOpen) return;
    this._echoOnce("intro", "ECHO online. I'll light the way, op.");

    const pc = Math.floor(this.player.centerX / TILE_SIZE);
    const pr = Math.floor(this.player.centerY / TILE_SIZE);
    for (let n = 1; n <= gameState.totalSectors; n++) {
      const door = this._doorTiles?.[n] ?? this._findDoor(n);
      if (!door) continue;
      if (Math.abs(door.c - pc) <= 3 && pr - door.r <= 4) {
        if (isSectorActive(n)) this._echoOnce(`door${n}:active`, `L${n}'s live. Step up and press E.`);
        else if (isSectorCompleted(n)) this._echoOnce(`door${n}:done`, `L${n}'s secure. Nothing more here.`);
        else this._echoOnce(`door${n}:sealed`, `L${n}'s sealed tight. Clear L${n - 1} first.`);
      }
    }
    if (pc >= 37 && pr <= 8) this._echoOnce("breach", "Careful. Live wires all over this wing.");

    if (this._idle > 10) {
      const tips = ECHO_TIPS[gameState.completedSectors] ?? [];
      if (tips.length && this._echo(tips[Math.floor(Math.random() * tips.length)])) this._idle = 0;
    }
  }

  _findDoor(n) {
    this._doorTiles ??= {};
    const tile = TILE.DOOR_L1 + n - 1;
    for (let r = 0; r < this.tilemap.rows; r++) {
      for (let c = 0; c < this.tilemap.cols; c++) {
        if (this.tilemap.grid[r][c] === tile) return (this._doorTiles[n] = { c, r });
      }
    }
    return (this._doorTiles[n] = null);
  }

  // --- overlays ------------------------------------------------------------

  _drawAlarm(renderer) {
    const ctx = renderer.ctx;
    const pulse = (Math.sin(this._time * Math.PI) + 1) / 2;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255,20,30,${0.02 + 0.05 * pulse})`;
    ctx.fillRect(0, 0, renderer.width, renderer.height);
    // rotating beacon sweep from the top edge
    const a = this._time * 2.2;
    const cx = renderer.width / 2, cy = -20;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 420);
    g.addColorStop(0, "rgba(255,40,40,0.22)");
    g.addColorStop(1, "rgba(255,40,40,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, 420, Math.PI / 2 + Math.sin(a) * 1.1 - 0.18, Math.PI / 2 + Math.sin(a) * 1.1 + 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _drawIris(renderer) {
    if (!this._iris) return;
    const p = Math.max(0, Math.min(1, this._iris.t / IRIS_TIME));
    const ease = p * p * (3 - 2 * p);
    const k = this._iris.dir === "close" ? 1 - ease : ease;
    const maxR = Math.hypot(renderer.width, renderer.height);
    const cx = this.player.centerX - this.camera.x;
    const cy = this.player.centerY - this.camera.y;
    const ctx = renderer.ctx;
    ctx.save();
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.rect(0, 0, renderer.width, renderer.height);
    ctx.arc(cx, cy, Math.max(0, maxR * k), 0, Math.PI * 2, true);
    ctx.fill("evenodd");
    if (k > 0.01 && k < 0.99) {
      ctx.strokeStyle = "#4ae6ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * k, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawInteractHint(renderer) {
    if (this.dialog.isOpen) return;
    const reach = this.player.facingTilePx();
    let target = null;
    let verb = "USE";

    const door = this.tilemap.doorAtPx(reach.x, reach.y);
    if (door) {
      // beside the door, so the bubble doesn't sit on top of the player
      target = { x: door.col * TILE_SIZE + TILE_SIZE + 26, y: door.row * TILE_SIZE + TILE_SIZE + 4 };
      const n = parseInt(door.label.slice(1), 10);
      verb = isSectorActive(n) ? "ENTER" : isSectorCompleted(n) ? "CLEAR" : "SEALED";
    } else {
      const npc = this._npcInReach(reach);
      if (npc) {
        target = { x: npc.x + npc.w / 2, y: npc.y - 14 };
        verb = "TALK";
      } else {
        const interactive = this.tilemap.interactiveAtPx(reach.x, reach.y);
        if (interactive) {
          target = { x: interactive.col * TILE_SIZE + TILE_SIZE / 2, y: interactive.row * TILE_SIZE - 6 };
          verb = interactive.tile === TILE.TERMINAL ? "HACK" : "READ";
        }
      }
    }
    if (!target) return;

    // little bobbing speech-bubble with a key cap
    const bob = Math.round(Math.sin(this._time * 6) * 1.5);
    const cx = (target.x - this.camera.x) | 0;
    const cy = ((target.y - this.camera.y) | 0) + bob;
    const ctx = renderer.ctx;
    ctx.font = "bold 7px ui-monospace, monospace";
    const labelW = Math.ceil(ctx.measureText(verb).width);
    const bw = 14 + labelW + 6;
    const bx = cx - (bw >> 1);
    const by = cy - 7;
    renderer.fillRect(bx, by, bw, 11, "#000");
    renderer.strokeRect(bx, by, bw, 11, "#4ae6ff", 1);
    renderer.fillRect(cx - 1, by + 11, 3, 2, "#4ae6ff");
    renderer.fillRect(bx + 2, by + 2, 9, 7, "#4ae6ff");
    renderer.text("E", bx + 6.5, by + 6, { color: "#000", size: 7, align: "center", baseline: "middle", weight: "bold" });
    renderer.text(verb, bx + 14, by + 6, { color: "#cffcff", size: 7, baseline: "middle", weight: "bold" });
  }
}
