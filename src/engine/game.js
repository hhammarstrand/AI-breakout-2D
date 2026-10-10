const FIXED_DT = 1000 / 60;

export class Game {
  constructor({ renderer, input, afterRender, onHint }) {
    this.onHint = onHint;
    this.renderer = renderer;
    this.afterRender = afterRender;
    this.input = input;
    this.scenes = [];
    this._lastTime = 0;
    this._accumulator = 0;
    this._running = false;
  }

  push(scene) {
    scene.game = this;
    if (scene.onEnter) scene.onEnter();
    this.scenes.push(scene);
  }

  pop() {
    const scene = this.scenes.pop();
    if (scene && scene.onExit) scene.onExit();
    if (this.top?.onResume) this.top.onResume();
    return scene;
  }

  replace(scene) {
    while (this.scenes.length) {
      const scene = this.scenes.pop();
      if (scene.onExit) scene.onExit();
    }
    this.push(scene);
  }

  get top() { return this.scenes[this.scenes.length - 1]; }

  start() {
    if (this._running) return;
    this._running = true;
    this._lastTime = performance.now();
    requestAnimationFrame(this._frame);
  }

  _frame = (now) => {
    if (!this._running) return;
    this.input.pollGamepads?.();
    const delta = Math.min(now - this._lastTime, 250);
    this._lastTime = now;
    this._accumulator += delta;

    while (this._accumulator >= FIXED_DT) {
      this._update(FIXED_DT / 1000);
      this.input.endFrame();
      this._accumulator -= FIXED_DT;
    }

    this._render();
    if (this.afterRender) this.afterRender(now / 1000, delta / 1000);
    requestAnimationFrame(this._frame);
  };

  _update(dt) {
    const top = this.top;
    if (top?.hints && this.onHint && this.input.wasPressed("hint")) { this.onHint(top); return; }
    if (top && top.update) top.update(dt, this.input);
  }

  _render() {
    this.renderer.clear("#000");
    for (const scene of this.scenes) {
      if (scene.render) scene.render(this.renderer);
    }
  }
}
