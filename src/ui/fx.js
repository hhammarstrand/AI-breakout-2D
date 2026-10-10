import { gameState } from "../state.js";

// Screen-level CSS effects layered over the canvas. "Calm FX" (accessibility) removes shakes,
// full-screen flashes and glitch tears for players sensitive to motion or flashing.
export class Fx {
  constructor(stageEl, postfx) {
    this.stage = stageEl;
    this.postfx = postfx;
    this.flashEl = stageEl.querySelector("#flash");
  }

  shake() {
    if (gameState.calmFx) return;
    this._retrigger(this.stage, "shake");
    this.postfx.kick(0.35);
  }

  glitch() {
    if (gameState.calmFx) return;
    this._retrigger(this.stage, "glitch");
    this.postfx.kick(1);
  }

  flash(color = "#0aff7a") {
    if (gameState.calmFx) return;
    this.flashEl.style.setProperty("--flash", color);
    this._retrigger(this.flashEl, "on");
  }

  _retrigger(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    el.addEventListener("animationend", () => el.classList.remove(cls), { once: true });
  }
}
