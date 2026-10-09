import { drawPortrait, profileFor } from "./portrait.js";

const CHAR_INTERVAL = 0.018;
const BLIP_EVERY = 3;

export class Dialog {
  constructor(rootEl, sfx) {
    this.root = rootEl;
    this.sfx = sfx;
    this.speakerEl = rootEl.querySelector(".dialog-speaker");
    this.textEl = rootEl.querySelector(".dialog-text");
    this.pageEl = rootEl.querySelector(".dialog-page");
    this.portrait = rootEl.querySelector(".dialog-portrait");
    this._queue = [];
    this._current = null;
    this._typed = 0;
    this._timer = 0;
    this._t = 0;
    this._onClose = null;
  }

  get isOpen() { return this._current !== null || this._queue.length > 0; }

  show(speaker, lines, onClose, profile) {
    this._queue = lines.slice();
    this._total = lines.length;
    this._onClose = onClose || null;
    this._speaker = speaker;
    this._profile = profile || profileFor(speaker);
    this.root.style.setProperty("--speaker", this._profile.accent || this._profile.tint);
    this.root.classList.remove("hidden");
    this.root.classList.remove("pop");
    void this.root.offsetWidth;
    this.root.classList.add("pop");
    this._advance();
  }

  close() {
    this._queue = [];
    this._current = null;
    this._onClose = null;
    this.root.classList.add("hidden");
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
    this.pageEl.textContent = this._total > 1 ? `${this._total - this._queue.length}/${this._total}` : "";
    this.textEl.textContent = "";
    this.root.classList.remove("done");
  }

  update(dt, input) {
    if (!this._current) return;
    this._t += dt;
    drawPortrait(this.portrait, this._profile, this._t);

    const fullyTyped = this._typed >= this._current.length;
    if (input.wasPressed("interact")) {
      if (!fullyTyped) {
        this._typed = this._current.length;
        this.textEl.textContent = this._current;
        this.root.classList.add("done");
      } else {
        this.sfx.play("select");
        this._advance();
      }
      return;
    }
    if (input.wasPressed("pause") || input.wasPressed("back")) {
      this._queue = [];
      this._advance();
      return;
    }

    if (!fullyTyped) {
      this._timer += dt;
      while (this._timer >= CHAR_INTERVAL && this._typed < this._current.length) {
        this._timer -= CHAR_INTERVAL;
        this._typed++;
        if (this._typed % BLIP_EVERY === 0 && this._current[this._typed - 1] !== " ") this.sfx.play("blip");
      }
      this.textEl.textContent = this._current.slice(0, this._typed);
      if (this._typed >= this._current.length) this.root.classList.add("done");
    }
  }
}
