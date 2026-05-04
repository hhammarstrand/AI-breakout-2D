const CHAR_INTERVAL = 0.018;

export class Dialog {
  constructor(rootEl) {
    this.root = rootEl;
    this.speakerEl = rootEl.querySelector(".dialog-speaker");
    this.textEl = rootEl.querySelector(".dialog-text");
    this._queue = [];
    this._current = null;
    this._typed = 0;
    this._timer = 0;
    this._onClose = null;
  }

  get isOpen() { return this._current !== null || this._queue.length > 0; }

  show(speaker, lines, onClose) {
    this._queue = lines.slice();
    this._onClose = onClose || null;
    this._speaker = speaker;
    this._advance();
  }

  _advance() {
    if (this._queue.length === 0) {
      this._current = null;
      this.root.classList.add("hidden");
      const cb = this._onClose;
      this._onClose = null;
      if (cb) cb();
      return;
    }
    this._current = this._queue.shift();
    this._typed = 0;
    this._timer = 0;
    this.speakerEl.textContent = this._speaker || "";
    this.textEl.textContent = "";
    this.root.classList.remove("hidden");
  }

  update(dt, input) {
    if (!this._current) return;

    const fullyTyped = this._typed >= this._current.length;
    if (input.wasPressed("interact")) {
      if (!fullyTyped) {
        this._typed = this._current.length;
        this.textEl.textContent = this._current;
      } else {
        this._advance();
      }
      return;
    }
    if (input.wasPressed("pause")) {
      this._queue = [];
      this._advance();
      return;
    }

    if (!fullyTyped) {
      this._timer += dt;
      while (this._timer >= CHAR_INTERVAL && this._typed < this._current.length) {
        this._timer -= CHAR_INTERVAL;
        this._typed++;
      }
      this.textEl.textContent = this._current.slice(0, this._typed);
    }
  }
}
