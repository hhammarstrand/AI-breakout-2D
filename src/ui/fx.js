// Screen-level CSS effects layered over the canvas.
export class Fx {
  constructor(stageEl, postfx) {
    this.stage = stageEl;
    this.postfx = postfx;
    this.flashEl = stageEl.querySelector("#flash");
  }

  shake() { this._retrigger(this.stage, "shake"); this.postfx.kick(0.35); }
  glitch() { this._retrigger(this.stage, "glitch"); this.postfx.kick(1); }

  flash(color = "#0aff7a") {
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
