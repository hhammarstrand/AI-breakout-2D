const FIXED_DT = 1000 / 60;

export class Game {
  constructor({ renderer, input }) {
    this.renderer = renderer;
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
    return scene;
  }

  replace(scene) {
    while (this.scenes.length) this.pop();
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
    const delta = Math.min(now - this._lastTime, 250);
    this._lastTime = now;
    this._accumulator += delta;

    while (this._accumulator >= FIXED_DT) {
      this._update(FIXED_DT / 1000);
      this.input.endFrame();
      this._accumulator -= FIXED_DT;
    }

    this._render();
    requestAnimationFrame(this._frame);
  };

  _update(dt) {
    const top = this.top;
    if (top && top.update) top.update(dt, this.input);
  }

  _render() {
    this.renderer.clear("#000");
    for (const scene of this.scenes) {
      if (scene.render) scene.render(this.renderer);
    }
  }
}
