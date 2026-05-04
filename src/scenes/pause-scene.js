export class PauseScene {
  constructor() {
    this._t = 0;
  }

  update(dt, input) {
    this._t += dt;
    if (input.wasPressed("pause")) this.game.pop();
  }

  render(renderer) {
    const w = renderer.width;
    const h = renderer.height;
    renderer.fillRect(0, 0, w, h, "rgba(0, 0, 0, 0.72)");

    renderer.fillRect(w / 2 - 60, h / 2 - 22, 120, 44, "#031a0d");
    renderer.strokeRect(w / 2 - 60, h / 2 - 22, 120, 44, "#0aff7a", 1);

    renderer.text("PAUSED", w / 2, h / 2 - 6, {
      color: "#0aff7a",
      size: 14,
      align: "center",
      baseline: "middle",
      weight: "bold",
    });

    if ((this._t * 2) % 2 < 1) {
      renderer.text("[esc] resume", w / 2, h / 2 + 10, {
        color: "#4ae6ff",
        size: 8,
        align: "center",
        baseline: "middle",
      });
    }
  }
}
