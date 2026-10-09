// HALCYON's public-address voice: a non-blocking subtitle bar that types itself out.
const CHAR_INTERVAL = 0.03;
const HOLD = 3.2;

export class PublicAddress {
  constructor(rootEl, sfx) {
    this.root = rootEl;
    this.textEl = rootEl.querySelector(".pa-text");
    this.sfx = sfx;
    this.queue = [];
    this.current = null;
  }

  say(text) {
    this.queue.push(text);
    if (!this.current) this._next();
  }

  clear() {
    this.queue = [];
    this.current = null;
    this.root.classList.remove("on");
  }

  _next() {
    const text = this.queue.shift();
    if (!text) { this.current = null; this.root.classList.remove("on"); return; }
    this.current = { text, typed: 0, timer: 0, hold: HOLD + text.length * 0.02 };
    this.textEl.textContent = "";
    this.root.classList.add("on");
    this.sfx.play("pa");
  }

  update(dt) {
    const c = this.current;
    if (!c) return;
    if (c.typed < c.text.length) {
      c.timer += dt;
      while (c.timer >= CHAR_INTERVAL && c.typed < c.text.length) {
        c.timer -= CHAR_INTERVAL;
        c.typed++;
        if (c.typed % 4 === 0) this.sfx.play("paBlip");
      }
      this.textEl.textContent = c.text.slice(0, c.typed);
      return;
    }
    c.hold -= dt;
    if (c.hold <= 0) this._next();
  }
}
