// Screen-level CSS effects layered over the canvas.
export class Fx {
  constructor(stageEl) {
    this.stage = stageEl;
    this.flashEl = stageEl.querySelector("#flash");
  }

  shake() { this._retrigger(this.stage, "shake"); }
  glitch() { this._retrigger(this.stage, "glitch"); }

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
