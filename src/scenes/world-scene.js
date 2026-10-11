import { Camera } from "../engine/camera.js";
import { Tilemap, TILE_SIZE, TILE } from "../world/tilemap.js";
import { Player } from "../entities/player.js";
import { Npc } from "../entities/npc.js";
import { Drone } from "../entities/drone.js";
import { Sentinel } from "../entities/sentinel.js";
import { Pickup } from "../entities/pickup.js";
import { StartMenuScene } from "./start-menu-scene.js";
import { CodeLockScene } from "./codelock-scene.js";
import { BattleScene } from "./battle-scene.js";
import { award, checkCollections } from "../ui/trophies.js";
import { track } from "../telemetry.js";

const SAFE_IDS = ["safe-lobby", "safe-research", "safe-core"];
import { Lighting, collectLights } from "../engine/lighting.js";
import { Particles } from "../engine/particles.js";
import { music } from "../audio/music.js";
import {
  isSectorActive,
  isSectorCompleted,
  completeSector,
  gameState,
  hasCollected,
  collect,
  addItem,
  penalize,
  scaledPenalty,
  difficulty,
  startAct,
  saveGame,
  hear,
} from "../state.js";
import { Sector1Scene } from "./sector1-scene.js";
import { Sector2Scene } from "./sector2-scene.js";
import { Sector3Scene } from "./sector3-scene.js";
import { Sector4Scene } from "./sector4-scene.js";
import { PowerScene } from "./power-scene.js";
import { SignalScene } from "./signal-scene.js";
import { CoolantScene } from "./coolant-scene.js";
import { FirewallScene } from "./firewall-scene.js";
import {
  stageInfo, ECHO_TIPS, ECHO_CLEAR, PA_CLEAR, PA_CAUGHT, PA_IDLE, FRAGMENTS, LOGS, CELL_BONUS,
} from "../story.js";

// stage id -> puzzle scene
const SECTOR_LAUNCHERS = {
  1: (ctx) => new Sector1Scene(ctx),
  2: (ctx) => new Sector2Scene(ctx),
  3: (ctx) => new Sector3Scene(ctx),
  5: (ctx) => new PowerScene(ctx),
  6: (ctx) => new SignalScene(ctx),
  7: (ctx) => new CoolantScene(ctx),
  9: (ctx) => new FirewallScene(ctx),
  10: (ctx) => new Sector4Scene(ctx),
};

const PA_IDLE_GAP = [80, 120];
const SECTOR_REWARD = 25;
const ALARM_SECONDS = 5 * 60;
const IRIS_TIME = 0.45;
const ECHO_GAP = 5;

const CAUGHT_TIME_PENALTY = 60;
const CAUGHT_SCORE_PENALTY = 5;

const DOOR_COLORS = { done: "10,255,122", active: "74,230,255", sealed: "255,40,40" };

const INTERACT_RADIUS = TILE_SIZE * 0.9;
const STEP_INTERVAL = 0.3;
const SIGHT = 6; // tiles: how close a capsule or safe must be before it shows on the MAP

export class WorldScene {
  constructor({ map, mapId, resumeAt, dialog, hud, sfx, fx, toast, postfx, pa, onToggleSfx, onToggleCrt, onToggleMusic, onToggleLang, onQuit, onEnding, onLift, viewportWidth, viewportHeight }) {
    this.mapId = mapId;
    this.onToggleLang = onToggleLang;
    this.onLift = onLift;
    this.onToggleMusic = onToggleMusic;
    this.pa = pa;
    this.onEnding = onEnding;
    this._paTimer = PA_IDLE_GAP[0];
    this.map = map;
    this.dialog = dialog;
    this.hud = hud;
    this.sfx = sfx;
    this.fx = fx;
    this.toast = toast;
    this.onToggleSfx = onToggleSfx;
    this.onToggleCrt = onToggleCrt;
    this.postfx = postfx;
    this.sentinels = (map.sentinels || [])
      .filter((cfg) => !(cfg.offlineAt && gameState.completedSectors >= cfg.offlineAt))
      .map((cfg) => Object.assign(new Sentinel(cfg), { offlineAt: cfg.offlineAt }));
    this.flashOn = true;
    this._danger = 0;
    this.onQuit = onQuit;
    this.tilemap = new Tilemap(map.grid, { doors: map.doors, theme: map.theme, safe: map.safe });
    this.pickups = (map.pickups ?? []).filter((p) => !hasCollected(p.id)).map((p) => new Pickup(p));
    this._bumpCooldown = 0;
    this.player = new Player(map.spawn.col, map.spawn.row);
    this.npcs = [];
    this._spawnNpcs();
    // CONTINUE puts the player back where they saved, unless someone is standing there now
    if (resumeAt && !this._blocked(resumeAt.col, resumeAt.row)) {
      this.player.teleport(resumeAt.col, resumeAt.row);
      if (resumeAt.facing) this.player.facing = resumeAt.facing;
    }
    this.camera = new Camera(viewportWidth, viewportHeight);
    this.camera.setBounds(this.tilemap.widthPx, this.tilemap.heightPx);
    this.camera.snapTo(this.player.centerX, this.player.centerY);
    this._time = 0;
    this._stepTimer = 0;

    this.drone = new Drone(this.player.centerX, this.player.centerY - 20);
    this.particles = new Particles();
    this.lighting = new Lighting(viewportWidth, viewportHeight);
    const stageOf = (slot) => map.doors?.[slot]?.stage ?? 99;
    this.mapLights = collectLights(this.tilemap, (slot) => {
      const n = stageOf(slot);
      return isSectorCompleted(n) ? DOOR_COLORS.done : isSectorActive(n) ? DOOR_COLORS.active : DOOR_COLORS.sealed;
    });
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
    this.seen = new Set(); // pickups and the safe the player has come close to, for the MAP
  }

  onEnter() {
    this.sfx.setAmbient(this._alarm ? "alarm" : "hum");
    music.play(this.map.music ?? "lobby");
  }

  onResume() { music.play(this.map.music ?? "lobby"); }
  onExit() {
    this.sfx.setAmbient(null);
    if (this.postfx) this.postfx.danger = 0;
  }

  _spawnNpcs() {
    for (const cfg of this.map.npcs || []) {
      if ((cfg.appearsAt ?? 0) <= gameState.completedSectors && !this.npcs.some((n) => n.id === cfg.id)) {
        this.npcs.push(new Npc(cfg));
      }
    }
  }

  npcProfile(id) {
    const npc = this.npcs.find((n) => n.id === id);
    return npc && { accent: npc.accent, lookId: npc.id };
  }

  update(dt, input) {
    this._time += dt;
    // reading a conversation doesn't cost time; everything else in the world does
    if (!this.dialog.isOpen) this.hud.update(dt);
    for (const npc of this.npcs) npc.update(dt, this.player);
    this._updateEffects(dt);

    if (this._encounter) {
      this._encounter.t -= dt;
      if (this._encounter.t <= 0) {
        const s = this._encounter.sentinel;
        this._encounter = null;
        this._startBattle(s);
      }
      return;
    }

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

    if (input.wasPressed("pause") || input.wasPressed("menu") || input.wasPressed("submit")) {
      this.game.push(new StartMenuScene({
        world: this, sfx: this.sfx, hud: this.hud, toast: this.toast,
        onToggleSfx: this.onToggleSfx, onToggleCrt: this.onToggleCrt, onToggleMusic: this.onToggleMusic, onToggleLang: this.onToggleLang, onQuit: this.onQuit,
      }));
      return;
    }

    if (input.wasPressed("flashlight")) {
      this.flashOn = !this.flashOn;
      this.sfx.play("click");
      if (!this.flashOn) this._echoOnce("dark", "Lights off. Stay in the shadows.");
    }

    this.player.update(dt, input, (c, r) => this._blocked(c, r));
    this._look(this.player);
    this._bumpCooldown -= dt;
    if (this.player.bumped && this._bumpCooldown <= 0) { this.sfx.play("bump"); this._bumpCooldown = 0.25; }
    for (const p of this.pickups) p.update(dt);
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
      const p = this.player;
      if (this.mapId && (gameState.pos?.col !== p.col || gameState.pos?.row !== p.row || gameState.pos?.facing !== p.facing)) {
        gameState.pos = { map: this.mapId, col: p.col, row: p.row, facing: p.facing };
      }
    }
    this._echoThink(dt);
    this._paThink(dt);
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

  _takeLift(stage, info) {
    track.cleared(stage);
    if (gameState.checkpoint && gameState.timesCaught === gameState.checkpoint.timesCaught) award("ghost");
    completeSector(stage);
    startAct(); // the next act's clock and checkpoint are saved before the ride even starts
    this.sfx.play("door");
    this.sfx.play("iris");
    this.toast.show(`▲ ${info.name}`, "info");
    this._iris = { dir: "close", t: -0.2, onDone: () => this.onLift(info.lift) };
  }

  _pushSector(sectorNum, label, launcher) {
    track.enterStage();
    this.fx.glitch();
    this._iris = { dir: "close", t: IRIS_TIME }; // hold black until the sector is on screen
    const scene = launcher({
      hud: this.hud,
      sfx: this.sfx,
      fx: this.fx,
      onResult: ({ success, aborted, report, ending }) => {
        if (this.game.top !== scene) return; // already handled (e.g. submit and abort in one frame)
        this.game.pop();
        this.fx.glitch();
        this._iris = { dir: "open", t: 0 };
        if (success) track.cleared(sectorNum);
        if (success && ending) {
          completeSector(sectorNum);
          this.hud.addScore(SECTOR_REWARD * 2);
          this.onEnding(ending);
          return;
        }
        if (success) {
          completeSector(sectorNum);
          this._applyProgress(sectorNum);
          this.hud.addScore(SECTOR_REWARD);
          this.sfx.play("success");
          this.fx.flash("#0aff7a");
          this.toast.show(`✓ ${label} CLEARED`, "good");
          this._dataBurst();
          this._echoCooldown = 0;
          this._echo(ECHO_CLEAR[sectorNum] ?? "Sector secure. Keep going!", true);
          const next = stageInfo(sectorNum + 1);
          if (next) {
            setTimeout(() => this.toast.show(`🔓 ${next.label} UNLOCKED — ${next.name}`, "info"), 700);
          }
          this.dialog.show(this.map.act === 1 ? "Operator" : "Reyes // radio", [
            ...(report ?? [`[${label}] cleared.`]),
          ], () => { if (PA_CLEAR[sectorNum]) this.pa.say(PA_CLEAR[sectorNum]); },
          this.npcProfile("operator") ?? { accent: "#4ae6ff", lookId: "operator" });
        } else if (aborted) {
          // solved parts stay solved: the next visit picks up on the same log/board/bay
          if (scene.part) { gameState.parts[sectorNum] = scene.part; saveGame(); }
          this.dialog.show("Stepped out", [
            scene.part
              ? `[${label}] You stepped out. The parts you solved stay solved — use the door to carry on.`
              : `[${label}] You stepped out. Use the door again to have another go.`,
          ]);
        }
      },
    });
    const part = gameState.parts?.[sectorNum];
    if (part && scene.resume) scene.resume(part);
    this.game.push(scene);
  }

  _look(p) {
    const near = (c, r) => Math.abs(c - p.col) <= SIGHT && Math.abs(r - p.row) <= SIGHT;
    for (const k of this.pickups) if (near(k.col, k.row)) this.seen.add(k.id);
    if (this.map.safe && near(this.map.safe.col, this.map.safe.row)) this.seen.add("safe");
  }

  _blocked(c, r) {
    return this.tilemap.isSolidAt(c, r) ||
      this.npcs.some((n) => n.col === c && n.row === r) ||
      this.pickups.some((p) => p.col === c && p.row === r);
  }

  _pickupAt(reach) {
    const c = Math.floor(reach.x / TILE_SIZE), r = Math.floor(reach.y / TILE_SIZE);
    return this.pickups.find((p) => p.col === c && p.row === r) ?? null;
  }

  _takePickup(p) {
    this.pickups.splice(this.pickups.indexOf(p), 1);
    collect(p.id);
    checkCollections(SAFE_IDS);
    this.sfx.play("item");
    this.hud.addScore(5);
    if (p.kind === "log") {
      const log = LOGS[p.id];
      this.toast.show("◆ DATA LOG FOUND", "good");
      this.dialog.show("Data log", [
        `You found a data log: ${log.title}!`,
        ...log.lines,
        "(Saved to LOGS. Press TAB to open the menu.)",
      ]);
    } else {
      addItem(p.item);
      this.toast.show("◆ BACKUP CELL", "good");
      this.dialog.show("Item", [
        "You found a BACKUP CELL!",
        `Use it from the BAG (TAB) to buy +${CELL_BONUS} seconds on the purge clock.`,
      ]);
    }
  }

  _useSafe() {
    const safe = this.map.safe;
    if (hasCollected(safe.id)) {
      this.dialog.show(safe.title, ["The safe stands open. Empty."]);
      return;
    }
    this.sfx.play("select");
    const scene = new CodeLockScene({
      sfx: this.sfx, fx: this.fx, hud: this.hud, safe,
      onResult: ({ success }) => {
        if (this.game.top !== scene) return;
        this.game.pop();
        if (!success) return;
        // a backup cell, and a memory ECHO left behind: logs that exist only in the safes
        const memory = LOGS[safe.memory];
        collect(safe.id);
        collect(safe.memory);
        checkCollections(SAFE_IDS);
        addItem("cell");
        this.hud.addScore(15);
        this.toast.show("◆ SAFE CRACKED", "good");
        this.sfx.play("item");
        this.dialog.show(safe.title, [
          safe.inside,
          ...memory.lines,
          `Use the cell from the BAG to buy +${CELL_BONUS} seconds.`,
          "(Saved to LOGS. Press TAB to open the menu.)",
        ], () => this._echo(safe.echo, true));
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
      hear(npc.id);
      this.dialog.show(npc.name, npc.linesFor(gameState.completedSectors), null,
        { accent: npc.accent, lookId: npc.id });
      return;
    }

    const door = this.tilemap.doorAtPx(reach.x, reach.y);
    if (door) {
      const stage = door.stage;
      const info = stageInfo(stage);
      if (isSectorCompleted(stage)) {
        this.dialog.show("Sector clear", [`[${door.label}] Already cleared. Nice work, tech.`]);
      } else if (isSectorActive(stage)) {
        if (info?.lift) this._takeLift(stage, info);
        else this._launchSector(stage, door.label);
      } else {
        const prereq = stageInfo(stage - 1);
        this.sfx.play("denied");
        this.fx.shake();
        this.dialog.show("Sealed", [
          `[${door.label}] SEALED.`,
          `Your badge needs ${prereq ? prereq.label : "the previous sector"} cleared first.`,
        ]);
      }
      return;
    }

    const pickup = this._pickupAt(reach);
    if (pickup) { this._takePickup(pickup); return; }

    const interactive = this.tilemap.interactiveAtPx(reach.x, reach.y);
    if (interactive?.tile === TILE.SAFE) { this._useSafe(); return; }
    if (interactive) {
      this.sfx.play("select");
      const key = `${interactive.row},${interactive.col}`;
      const msg = this.map.tileMessages?.[key];
      if (msg) {
        if (msg.note) hear(msg.note);
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

    const sprites = [...this.pickups.map((p) => ({ y: p.row * TILE_SIZE, draw: (r, c) => p.draw(r, c) })), ...this.npcs, this.player, ...this.sentinels].sort((a, b) => a.y - b.y);
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
    if (this._encounter) {
      const px = Math.round(this.player.centerX - cam.x), py = Math.round(this.player.y - cam.y) - 16;
      renderer.fillRect(px - 5, py - 9, 11, 12, "#0a0812");
      renderer.fillRect(px - 4, py - 8, 9, 10, "#ffffff");
      renderer.text("!", px + 0.5, py - 3, { color: "#e83a3a", size: 10, align: "center", baseline: "middle", weight: "bold" });
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
      if (alarm) {
        this._echoCooldown = 0;
        this._echo("Five minutes to the purge! We need to move!", true);
        this.pa.say("Five minutes. I would say goodbye to your friends.");
      }
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
      const result = s.update(dt, this.player, this.tilemap, this.flashOn, difficulty().detect);
      if (before === 0 && s.meter > 0) this.sfx.play("detect");
      danger = Math.max(danger, s.meter);
      if (result === "caught") { this._spotted(s); break; }
      const dx = s.x - this.player.centerX, dy = s.y - this.player.centerY;
      if (dx * dx + dy * dy < (TILE_SIZE * 8) ** 2) {
        this._echoOnce("sentinel", "Sentinel bot! Kill the light with F and sneak past.");
      }
    }
    this._danger += (danger - this._danger) * Math.min(1, dt * 8);
    if (this.postfx) this.postfx.danger = this._danger * 0.6;
    music.setIntensity(Math.max(this._danger, this._alarm ? 0.55 : 0));
  }

  // Pokémon-style encounter: freeze, "!" over your head, then a hack battle.
  _spotted(sentinel) {
    this.sfx.play("detect");
    this.sfx.play("alarm");
    this._encounter = { t: 0.7, sentinel };
  }

  _startBattle(sentinel) {
    this.game.push(new BattleScene({
      sentinel, sfx: this.sfx, fx: this.fx,
      onResult: (won) => {
        track.battle(won);
        if (won) {
          award("hacker");
          sentinel.cooldown = 30;
          sentinel.meter = 0;
          this.hud.addScore(10);
          this.toast.show(`⚡ ${sentinel.name} CRASHED — 30s`, "good");
          this.pa.say("You broke one of my sentinels. It will remember you when it reboots.");
          this._echoCooldown = 0;
          this._echo("Got it! Move before it reboots.", true);
        } else {
          this._caught(sentinel);
        }
      },
    }));
  }

  _caught(sentinel) {
    gameState.timesCaught++;
    this.pa.say(PA_CAUGHT[Math.min(gameState.timesCaught - 1, PA_CAUGHT.length - 1)]);
    penalize(CAUGHT_TIME_PENALTY, "caught");
    this.hud.addScore(-CAUGHT_SCORE_PENALTY);
    this.sfx.play("zap");
    this.fx.shake();
    this.fx.flash("#ff2020");
    this.fx.glitch();
    this.toast.show(`⚡ SPOTTED BY ${sentinel.name} — -${scaledPenalty(CAUGHT_TIME_PENALTY)}s`, "danger");
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
        this.player.teleport(this.map.spawn.col, this.map.spawn.row);
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
    this._echoOnce("intro", "ECHO online. Maintenance assistant. I'll light the way, tech.");

    const pc = Math.floor(this.player.centerX / TILE_SIZE);
    const pr = Math.floor(this.player.centerY / TILE_SIZE);
    for (const [slot, cfg] of Object.entries(this.map.doors ?? {})) {
      const door = this._findDoor(Number(slot));
      if (!door) continue;
      const n = cfg.stage, label = cfg.label;
      if (Math.abs(door.c - pc) <= 3 && Math.abs(pr - door.r) <= 4) {
        const prev = stageInfo(n - 1)?.label ?? "the last one";
        if (isSectorActive(n)) this._echoOnce(`door${n}:active`, `${label}'s live. Step up and press E.`);
        else if (isSectorCompleted(n)) this._echoOnce(`door${n}:done`, `${label}'s secure. Nothing more here.`);
        else this._echoOnce(`door${n}:sealed`, `${label}'s sealed tight. Clear ${prev} first.`);
      }
    }
    for (const zone of this.map.echoZones ?? []) {
      if (pc >= zone.c0 && pc <= zone.c1 && pr >= zone.r0 && pr <= zone.r1) this._echoOnce(zone.key, zone.text);
    }

    if (this._idle > 10) {
      const tips = ECHO_TIPS[gameState.completedSectors] ?? [];
      if (tips.length && this._echo(tips[Math.floor(Math.random() * tips.length)])) this._idle = 0;
    }
  }

  // H in the world: ECHO's tips for the current stage, revealed one at a time like puzzle hints.
  get hints() {
    // not over a conversation, an encounter or a closing iris
    if (this.dialog.isOpen || this._encounter || this._iris?.dir === "close") return null;
    const stage = gameState.completedSectors;
    if (this._hintStage !== stage) { this._hintStage = stage; this._hintsShown = 0; }
    return ECHO_TIPS[stage] ?? [];
  }

  // World changes after a sector is cleared: new people, fewer sentinels, a fragment.
  _applyProgress(sectorNum) {
    this._spawnNpcs();
    const word = FRAGMENTS.find((f) => f.stage === sectorNum)?.word;
    if (word) setTimeout(() => this.toast.show(`◆ UPLINK FRAGMENT: ${word}`, "good"), 1400);
    for (let i = this.sentinels.length - 1; i >= 0; i--) {
      const s = this.sentinels[i];
      if (s.offlineAt && gameState.completedSectors >= s.offlineAt) {
        this.particles.burst(30, () => ({
          x: s.x, y: s.y, vx: (Math.random() - 0.5) * 140, vy: -40 - Math.random() * 80, gravity: 260,
          life: 0.6 + Math.random() * 0.5, color: "#ff8a3a", additive: true, trail: true, floor: s.y + 8,
        }));
        this.sentinels.splice(i, 1);
      }
    }
  }

  _paThink(dt) {
    this._paTimer -= dt;
    if (this._paTimer > 0 || this.pa.current) return;
    this._paTimer = PA_IDLE_GAP[0] + Math.random() * (PA_IDLE_GAP[1] - PA_IDLE_GAP[0]);
    const pool = PA_IDLE[this.map.act] ?? PA_IDLE[1];
    this.pa.say(pool[Math.floor(Math.random() * pool.length)]);
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
      const n = door.stage;
      verb = isSectorActive(n) ? (stageInfo(n)?.lift ? "RIDE" : "ENTER") : isSectorCompleted(n) ? "CLEAR" : "SEALED";
    } else {
      const npc = this._npcInReach(reach);
      const pickup = this._pickupAt(reach);
      if (npc) {
        target = { x: npc.x + npc.w / 2, y: npc.y - 14 };
        verb = "TALK";
      } else if (pickup) {
        target = { x: pickup.col * TILE_SIZE + TILE_SIZE / 2, y: pickup.row * TILE_SIZE - 4 };
        verb = "TAKE";
      } else {
        const interactive = this.tilemap.interactiveAtPx(reach.x, reach.y);
        if (interactive) {
          target = { x: interactive.col * TILE_SIZE + TILE_SIZE / 2, y: interactive.row * TILE_SIZE - 6 };
          verb = interactive.tile === TILE.TERMINAL ? "HACK" : interactive.tile === TILE.SAFE ? "OPEN" : "READ";
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
