import { music } from "../audio/music.js";
import { character } from "../gfx/characters.js";
import { Drone } from "../entities/drone.js";
import { ACTS, ECHO_ACT_START } from "../story.js";

// Between acts: a short ride in the lift with the act title card. Any key skips after a moment.
const DURATION = 7;
const FLOORS = { 2: ["L0", "L1", "L2", "R"], 3: ["R", "R+1", "R+2", "CORE"] };

export class ElevatorScene {
  constructor({ act, sfx, onDone }) {
    this.act = act;
    this.sfx = sfx;
    this.onDone = onDone;
    this._t = 0;
    this.echo = new Drone(0, 0);
    this._finished = false;
    sfx.play("door");
  }

  onEnter() { document.body.classList.add("no-objective"); music.play("title"); music.setIntensity(0); }
  onExit() { document.body.classList.remove("no-objective"); }

  update(dt, input) {
    this._t += dt;
    this.echo._t += dt;
    if (Math.floor(this._t * 2) !== Math.floor((this._t - dt) * 2) && this._t < DURATION - 1) this.sfx.play("paBlip");
    const skip = this._t > 1.5 && (input.wasPressed("interact") || input.wasPressed("submit"));
    if ((this._t >= DURATION || skip) && !this._finished) {
      this._finished = true;
      this.sfx.play("confirm");
      this.onDone();
    }
  }

  render(renderer) {
    const w = renderer.width, h = renderer.height;
    const ctx = renderer.ctx;
    const k = Math.min(1, this._t / (DURATION - 1.5));
    renderer.fillRect(0, 0, w, h, "#05070a");
    // lift shaft: light bars streaming downwards as we rise
    const speed = 160 * Math.sin(Math.min(1, k) * Math.PI) + 20;
    const off = (this._t * speed) % 60;
    for (let y = -60 + off; y < h; y += 60) {
      renderer.fillRect(90, y, w - 180, 3, "rgba(160,220,255,0.18)");
    }
    // cab
    renderer.fillRect(140, 70, 200, 190, "#141a20");
    renderer.strokeRect(140, 70, 200, 190, "#3a4a56", 2);
    renderer.fillRect(140, 70, 200, 6, "#3a4a56");
    renderer.fillRect(146, 82, 188, 2, "rgba(255,240,200,0.4)");
    const floors = FLOORS[this.act] ?? ["?"];
    const fi = Math.min(floors.length - 1, Math.floor(k * floors.length));
    renderer.fillRect(212, 88, 56, 18, "#020406");
    renderer.text(`▲ ${floors[fi]}`, 240, 97, { color: "#ffaa3a", size: 10, align: "center", baseline: "middle", weight: "bold" });

    // player + ECHO
    const bob = Math.round(Math.sin(this._t * 18) * (speed > 60 ? 1 : 0));
    ctx.save();
    ctx.translate(222, 190 + bob);
    ctx.scale(2, 2);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(4, 19, 10, 2);
    ctx.drawImage(character("player").frame("down", 0, (this._t % 3) > 2.85), 0, 0);
    ctx.restore();
    this.echo.x = 290;
    this.echo.y = 186;
    this.echo.draw(renderer, { x: 0, y: 0 });

    // title card
    const a = Math.max(0, Math.min(1, (this._t - 0.6) * 1.5)) * Math.max(0, Math.min(1, (DURATION - this._t) * 1.2));
    ctx.globalAlpha = a;
    renderer.fillRect(0, 22, w, 34, "rgba(0,0,0,0.75)");
    renderer.text(ACTS[this.act].name, w / 2, 39, { color: "#e8f4ff", size: 16, align: "center", baseline: "middle", weight: "bold" });
    ctx.globalAlpha = 1;
    if (this._t > 2.2) {
      const line = ECHO_ACT_START[this.act] ?? "";
      const shown = line.slice(0, Math.floor((this._t - 2.2) * 34));
      renderer.fillRect(40, 274, w - 80, 22, "rgba(0,12,18,0.9)");
      renderer.strokeRect(40, 274, w - 80, 22, "#4ae6ff", 1);
      renderer.text(`ECHO: ${shown}`, 50, 285, { color: "#cffcff", size: 9, baseline: "middle" });
    }
    if (this._t > 1.5) renderer.text("[space] skip", w - 10, h - 8, { color: "#3a5a6a", size: 7, align: "right", baseline: "middle" });
  }
}
