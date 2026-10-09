import { Camera } from "../engine/camera.js";
import { Tilemap, TILE_SIZE, TILE } from "../world/tilemap.js";
import { Player } from "../entities/player.js";
import { Npc } from "../entities/npc.js";
import {
  isSectorActive,
  isSectorCompleted,
  completeSector,
} from "../state.js";
import { PauseScene } from "./pause-scene.js";
import { Sector1Scene } from "./sector1-scene.js";

const SECTOR_LAUNCHERS = {
  1: (ctx) => new Sector1Scene(ctx),
};

const SECTOR_NAMES = {
  2: "DECRYPT THE LAB LOGS",
  3: "BUILD THE DOOR AGENT",
  4: "THE BREACH",
};

const SECTOR_REWARD = 25;
const INTERACT_RADIUS = TILE_SIZE * 0.9;
const STEP_INTERVAL = 0.3;

export class WorldScene {
  constructor({ map, dialog, hud, sfx, fx, toast, onToggleSfx, onQuit, viewportWidth, viewportHeight }) {
    this.map = map;
    this.dialog = dialog;
    this.hud = hud;
    this.sfx = sfx;
    this.fx = fx;
    this.toast = toast;
    this.onToggleSfx = onToggleSfx;
    this.onQuit = onQuit;
    this.tilemap = new Tilemap(map.grid);
    this.player = new Player(map.spawn.col, map.spawn.row);
    this.npcs = (map.npcs || []).map((cfg) => new Npc(cfg));
    this.camera = new Camera(viewportWidth, viewportHeight);
    this.camera.setBounds(this.tilemap.widthPx, this.tilemap.heightPx);
    this.camera.snapTo(this.player.centerX, this.player.centerY);
    this._time = 0;
    this._stepTimer = 0;
  }

  npcProfile(id) {
    const npc = this.npcs.find((n) => n.id === id);
    return npc && { accent: npc.accent, color: npc.color, bodyDark: npc.bodyDark };
  }

  update(dt, input) {
    this._time += dt;
    this.hud.update(dt);
    for (const npc of this.npcs) npc.update(dt);

    if (this.dialog.isOpen) {
      this.dialog.update(dt, input);
      return;
    }

    if (input.wasPressed("pause")) {
      this.game.push(new PauseScene({ sfx: this.sfx, onToggleSfx: this.onToggleSfx, onQuit: this.onQuit }));
      return;
    }

    this.player.update(dt, input, this.tilemap);
    if (this.player.moving) {
      this._stepTimer -= dt;
      if (this._stepTimer <= 0) { this._stepTimer = STEP_INTERVAL; this.sfx.play("step"); }
    } else {
      this._stepTimer = 0;
    }
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
    this.fx.glitch();
    const scene = launcher({
      hud: this.hud,
      sfx: this.sfx,
      fx: this.fx,
      onResult: ({ success, aborted, report }) => {
        this.game.pop();
        this.fx.glitch();
        if (success) {
          completeSector(sectorNum);
          this.hud.addScore(SECTOR_REWARD);
          this.sfx.play("success");
          this.fx.flash("#0aff7a");
          this.toast.show(`✓ SECTOR ${sectorNum} CLEARED`, "good");
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
    this.tilemap.draw(renderer, this.camera, this._time);
    for (const npc of this.npcs) npc.draw(renderer, this.camera);
    this.player.draw(renderer, this.camera);
    this._drawInteractHint(renderer);
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
