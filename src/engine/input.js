import { setDevice } from "../ui/prompts.js";

const KEY_ALIASES = {
  ArrowUp: "up", w: "up", W: "up",
  ArrowDown: "down", s: "down", S: "down",
  ArrowLeft: "left", a: "left", A: "left",
  ArrowRight: "right", d: "right", D: "right",
  " ": "interact", Spacebar: "interact", e: "interact", E: "interact",
  Enter: "submit",
  Escape: "pause",
  f: "flashlight", F: "flashlight",
  Backspace: "back", Delete: "back",
  Shift: "run",
  h: "hint", H: "hint",
  Tab: "menu", q: "menu", Q: "menu",
};

export class Input {
  constructor(target = window) {
    this._down = new Set();
    this._pressed = new Set();
    this._anyPressed = false;

    target.addEventListener("keydown", (event) => {
      const action = KEY_ALIASES[event.key];
      if (!action) return;
      setDevice("keyboard");
      if (!this._down.has(action)) this._pressed.add(action);
      this._down.add(action);
      this._anyPressed = true;
      if (action !== "flashlight") event.preventDefault();
    });

    target.addEventListener("keyup", (event) => {
      const action = KEY_ALIASES[event.key];
      if (!action) return;
      this._down.delete(action);
    });

    target.addEventListener("blur", () => this._down.clear());
    this.tap = null; // {x, y} in canvas pixels for one frame after a click or tap on the canvas
    this.hover = null; // last mouse position over the canvas, while it is there
    this.hoverMoved = false;
  }

  // Pointer on the canvas, already mapped to canvas pixels by the caller.
  tapAt(x, y) { this.tap = { x, y }; this._anyPressed = true; }
  hoverAt(x, y) { this.hover = x === null ? null : { x, y }; this.hoverMoved = x !== null; }

  // virtual buttons (touch controls) feed the same action stream as the keyboard
  press(action) {
    if (!this._down.has(action)) this._pressed.add(action);
    this._down.add(action);
    this._anyPressed = true;
  }

  release(action) { this._down.delete(action); }

  // Standard-mapping gamepads: D-pad/left stick move, A interact, B back, X flashlight, Y hint,
  // shoulders run, SELECT pause, START submit/menu. Polled once per animation frame.
  pollGamepads() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const want = new Set();
    for (const pad of pads) {
      if (!pad) continue;
      const b = (i) => pad.buttons[i]?.pressed;
      if (b(12) || pad.axes[1] < -0.5) want.add("up");
      if (b(13) || pad.axes[1] > 0.5) want.add("down");
      if (b(14) || pad.axes[0] < -0.5) want.add("left");
      if (b(15) || pad.axes[0] > 0.5) want.add("right");
      if (b(0)) want.add("interact");
      if (b(1)) want.add("back");
      if (b(2)) want.add("flashlight");
      if (b(3)) want.add("hint");
      if (b(4) || b(5) || b(6) || b(7)) want.add("run");
      if (b(8)) want.add("pause");
      if (b(9)) want.add("submit");
    }
    this._pad ??= new Set();
    for (const a of want) if (!this._pad.has(a)) { this.press(a); setDevice("gamepad"); }
    for (const a of this._pad) if (!want.has(a)) this.release(a);
    this._pad = want;
  }

  isDown(action) { return this._down.has(action); }
  wasPressed(action) { return this._pressed.has(action); }
  consumeAnyPressed() { const v = this._anyPressed; this._anyPressed = false; return v; }
  endFrame() { this._pressed.clear(); this.tap = null; this.hoverMoved = false; }
}
