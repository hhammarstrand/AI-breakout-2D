import { t } from "../i18n/index.js";

const LIFETIME_MS = 3200;
const RELEASE_GAP_MS = 900;

export class Toasts {
  constructor(rootEl, sfx) {
    this.root = rootEl;
    this.sfx = sfx;
    this._held = false;
    this._queue = [];
  }

  // While held (an act title card, the ending text), trophy toasts wait instead of covering it.
  hold() { this._held = true; }

  release(delayMs = RELEASE_GAP_MS) {
    this._held = false;
    const queued = this._queue.splice(0);
    queued.forEach(([text, kind], i) => setTimeout(() => this.show(text, kind), delayMs + i * RELEASE_GAP_MS));
  }

  show(text, kind = "info") {
    if (this._held && kind === "good") { this._queue.push([text, kind]); return; }
    const el = document.createElement("div");
    el.className = `toast toast-${kind}`;
    el.textContent = t(text);
    this.root.appendChild(el);
    if (kind === "info" || kind === "good") this.sfx?.play("toast");
    setTimeout(() => {
      el.classList.add("leaving");
      el.addEventListener("animationend", () => el.remove(), { once: true });
    }, LIFETIME_MS);
  }
}
