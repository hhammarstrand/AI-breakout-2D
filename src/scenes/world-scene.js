import { Camera } from "../engine/camera.js";
import { Tilemap, TILE_SIZE } from "../world/tilemap.js";
import { Player } from "../entities/player.js";
import { Npc } from "../entities/npc.js";

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
  }

  update(dt, input) {
    this.hud.update(dt);

    if (this.dialog.isOpen) {
      this.dialog.update(dt, input);
      return;
    }

    this.player.update(dt, input, this.tilemap);
    for (const npc of this.npcs) npc.update(dt);
    this.camera.follow(this.player.centerX, this.player.centerY);

    if (input.wasPressed("interact")) this._tryInteract();
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
      const message = this.map.doorMessages?.[door.label] ?? `[${door.label}] Locked.`;
      this.dialog.show("Sector lock", [message]);
    }
  }

  render(renderer) {
    this.tilemap.draw(renderer, this.camera);
    for (const npc of this.npcs) npc.draw(renderer, this.camera);
    this.player.draw(renderer, this.camera);
    this._drawInteractHint(renderer);
  }

  _drawInteractHint(renderer) {
    if (this.dialog.isOpen) return;
    const reach = this.player.facingTilePx();
    const door = this.tilemap.doorAtPx(reach.x, reach.y);
    let target = null;

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
