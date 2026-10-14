const FIXED_DT = 1000 / 60;

export class Game {
  constructor({ renderer, input, afterRender, onHint, onError }) {
    this.onHint = onHint;
    this.onError = onError;
    this.halted = false; // set while the error overlay is up: no updates, last frame stays
    this.renderer = renderer;
    this.afterRender = afterRender;
    this.input = input;
    this.scenes = [];
    this._deferred = [];
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

  // Runs fn after the current update step, once no scene code is still executing; used for
  // stack-wide changes (game over) that must not race the scene that triggered them.
  defer(fn) { this._deferred.push(fn); }

  start() {
    if (this._running) return;
    this._running = true;
    this._lastTime = performance.now();
    requestAnimationFrame(this._frame);
  }

  // One bad frame must not end the session: the next frame is always queued, and the error is
  // handed to onError (main.js shows the fault overlay) instead of killing the loop.
  _frame = (now) => {
    if (!this._running) return;
    try {
      this.input.pollGamepads?.();
      const delta = Math.min(now - this._lastTime, 250);
      this._lastTime = now;
      if (this.halted) { this._accumulator = 0; this.input.endFrame(); return; }
      this._accumulator += delta;

      while (this._accumulator >= FIXED_DT) {
        this._accumulator -= FIXED_DT;
        this._update(FIXED_DT / 1000);
        this.input.endFrame();
      }

      this._render();
      if (this.afterRender) this.afterRender(now / 1000, delta / 1000);
    } catch (err) {
      this._accumulator = 0;
      this._deferred.length = 0;
      this.input.endFrame(); // a key that triggered the throw must not fire again next frame
      if (this.onError) this.onError(err); else console.error(err);
    } finally {
      requestAnimationFrame(this._frame);
    }
  };

  _update(dt) {
    const top = this.top;
    if (top?.hints?.length && this.onHint && this.input.wasPressed("hint")) this.onHint(top);
    else if (top && top.update) top.update(dt, this.input);
    while (this._deferred.length) this._deferred.shift()();
  }

  _render() {
    this.renderer.clear("#000");
    for (const scene of this.scenes) {
      if (scene.render) scene.render(this.renderer);
    }
  }
}
