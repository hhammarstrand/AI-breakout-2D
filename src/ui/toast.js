const LIFETIME_MS = 3200;

export class Toasts {
  constructor(rootEl, sfx) {
    this.root = rootEl;
    this.sfx = sfx;
  }

  show(text, kind = "info") {
    const el = document.createElement("div");
    el.className = `toast toast-${kind}`;
    el.textContent = text;
    this.root.appendChild(el);
    if (kind === "info" || kind === "good") this.sfx?.play("toast");
    setTimeout(() => {
      el.classList.add("leaving");
      el.addEventListener("animationend", () => el.remove(), { once: true });
    }, LIFETIME_MS);
  }
}
