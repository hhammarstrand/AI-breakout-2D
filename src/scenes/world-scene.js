import { Camera } from "../engine/camera.js";
import { Tilemap, TILE_SIZE, TILE } from "../world/tilemap.js";
import { Player } from "../entities/player.js";
import { Npc } from "../entities/npc.js";
import {
  isSectorActive,
  isSectorCompleted,
  completeSector,
  gameState,
} from "../state.js";
import { PauseScene } from "./pause-scene.js";
import { Sector1Scene } from "./sector1-scene.js";

const SECTOR_LAUNCHERS = {
  1: ({ hud, onResult }) => new Sector1Scene({ hud, onResult }),
};

const SECTOR_SUCCESS_DIALOG = {
  1: [
    "[L1] LOCATED. Survivor confirmed in WASHROOM. +25 pts.",
    "Hostile profiles flagged in 7B, LAB ANNEX and STAIRWELL B.",
    "Sector 2 — DECRYPT THE LAB LOGS — now unlocked.",
  ],
};

const INTERACT_RADIUS = TILE_SIZE * 0.9;

export class WorldScene {
  constructor({ map, dialog, hud, viewportWidth, viewportHeight }) {
    this.map = map;
    this.dialog = dialog;
    this.hud = hud;
    this.tilemap = new Tilemap(map.grid);
    this.player = new Player(map.spawn.col, map.spawn.row);
    this.npcs = (map.npcs || []).map((cfg) => new Npc(cfg));
    this.camera = new Camera(viewportWidth, viewportHeight);
    this.camera.setBounds(this.tilemap.widthPx, this.tilemap.heightPx);
    this.camera.snapTo(this.player.centerX, this.player.centerY);
    this._time = 0;
  }

  update(dt, input) {
    this._time += dt;
    this.hud.update(dt);

    if (this.dialog.isOpen) {
      this.dialog.update(dt, input);
      return;
    }

    if (input.wasPressed("pause")) {
      this.game.push(new PauseScene());
      return;
    }

    this.player.update(dt, input, this.tilemap);
    for (const npc of this.npcs) npc.update(dt);
    this.camera.follow(this.player.centerX, this.player.centerY);

    if (input.wasPressed("interact")) this._tryInteract();
  }

  _launchSector(sectorNum, label) {
    const launcher = SECTOR_LAUNCHERS[sectorNum];
    if (!launcher) {
      const message = this.map.doorMessages?.[label] ?? `[${label}] Locked.`;
      this.dialog.show("Sector lock", [message]);
      return;
    }
    const scene = launcher({
      hud: this.hud,
      onResult: ({ success, aborted }) => {
        this.game.pop();
        if (success) {
          completeSector(sectorNum);
          this.hud.setProgress(gameState.completedSectors);
          this.hud.setScore(this.hud.score + 25);
          const lines = SECTOR_SUCCESS_DIALOG[sectorNum] ?? [
            `[${label}] cleared. +25 pts.`,
          ];
          this.dialog.show("Sector clear", lines);
        } else if (aborted) {
          this.dialog.show("Aborted", [
            `[${label}] Mission paused. Approach the door again to retry.`,
          ]);
        }
      },
    });
    this.game.push(scene);
  }

  _tryInteract() {
    const reach = this.player.facingTilePx();

    for (const npc of this.npcs) {
      const dx = (npc.x + npc.w / 2) - reach.x;
      const dy = (npc.y + npc.h / 2) - reach.y;
      if (dx * dx + dy * dy <= INTERACT_RADIUS * INTERACT_RADIUS) {
        this.dialog.show(npc.name, npc.lines);
        return;
      }
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
        this.dialog.show("Sealed", [
          `[${door.label}] SEALED.`,
          `Building authorisation requires sector ${prereq} to be cleared first.`,
        ]);
      }
      return;
    }

    const interactive = this.tilemap.interactiveAtPx(reach.x, reach.y);
    if (interactive) {
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

    const door = this.tilemap.doorAtPx(reach.x, reach.y);
    if (door) {
      target = { x: door.col * TILE_SIZE + TILE_SIZE / 2, y: door.row * TILE_SIZE - 4 };
    } else {
      for (const npc of this.npcs) {
        const dx = (npc.x + npc.w / 2) - reach.x;
        const dy = (npc.y + npc.h / 2) - reach.y;
        if (dx * dx + dy * dy <= INTERACT_RADIUS * INTERACT_RADIUS) {
          target = { x: npc.x + npc.w / 2, y: npc.y - 12 };
          break;
        }
      }
      if (!target) {
        const interactive = this.tilemap.interactiveAtPx(reach.x, reach.y);
        if (interactive) {
          target = { x: interactive.col * TILE_SIZE + TILE_SIZE / 2, y: interactive.row * TILE_SIZE - 4 };
        }
      }
    }
    if (!target) return;

    renderer.text("[E]", target.x - this.camera.x, target.y - this.camera.y, {
      color: "#4ae6ff",
      size: 9,
      align: "center",
      weight: "bold",
    });
  }
}
