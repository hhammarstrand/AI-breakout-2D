import { t as t_ } from "../i18n/index.js";

// Shared keyboard menu used by the title and pause screens.
export class Menu {
  constructor(items, sfx) {
    this.items = items;
    this.sfx = sfx;
    this.index = 0;
  }

  update(input) {
    const n = this.items.length;
    if (input.wasPressed("up")) { this.index = (this.index + n - 1) % n; this.sfx.play("select"); }
    if (input.wasPressed("down")) { this.index = (this.index + 1) % n; this.sfx.play("select"); }
    if (input.wasPressed("interact") || input.wasPressed("submit")) {
      this.sfx.play("confirm");
      this.items[this.index].action();
    }
  }

  draw(renderer, cx, y, t, spacing = 16) {
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const label = typeof item.label === "function" ? item.label() : item.label;
      const focused = i === this.index;
      const iy = y + i * spacing;
      if (focused) {
        const wobble = Math.sin(t * 8) * 2;
        // the arrows clear the label, which runs longer in Swedish
        renderer.ctx.font = "bold 11px ui-monospace, \"SF Mono\", Menlo, Consolas, monospace";
        const half = Math.max(78, Math.ceil(renderer.ctx.measureText(t_(label)).width / 2) + 20);
        renderer.fillRect(cx - half, iy - 7, half * 2, 14, "rgba(10,255,122,0.14)");
        renderer.text("▶", cx - half + 8 + wobble, iy, { color: "#4ae6ff", size: 10, baseline: "middle", weight: "bold" });
        renderer.text("◀", cx + half - 8 - wobble, iy, { color: "#4ae6ff", size: 10, align: "right", baseline: "middle", weight: "bold" });
      }
      renderer.text(label, cx, iy, {
        color: focused ? "#cffcff" : "#0a8a4a",
        size: 11,
        align: "center",
        baseline: "middle",
        weight: focused ? "bold" : "normal",
      });
    }
  }
}
