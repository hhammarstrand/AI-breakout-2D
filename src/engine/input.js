const KEY_ALIASES = {
  ArrowUp: "up", w: "up", W: "up",
  ArrowDown: "down", s: "down", S: "down",
  ArrowLeft: "left", a: "left", A: "left",
  ArrowRight: "right", d: "right", D: "right",
  " ": "interact", Spacebar: "interact", e: "interact", E: "interact",
  Escape: "pause",
};

export class Input {
  constructor(target = window) {
    this._down = new Set();
    this._pressed = new Set();
    this._anyPressed = false;

    target.addEventListener("keydown", (event) => {
      const action = KEY_ALIASES[event.key];
      if (!action) return;
      if (!this._down.has(action)) this._pressed.add(action);
      this._down.add(action);
      this._anyPressed = true;
      if (action === "interact" || action === "pause") event.preventDefault();
    });

    target.addEventListener("keyup", (event) => {
      const action = KEY_ALIASES[event.key];
      if (!action) return;
      this._down.delete(action);
    });

    target.addEventListener("blur", () => this._down.clear());
  }

  isDown(action) { return this._down.has(action); }
  wasPressed(action) { return this._pressed.has(action); }
  consumeAnyPressed() { const v = this._anyPressed; this._anyPressed = false; return v; }
  endFrame() { this._pressed.clear(); }
}
