export class TitleScene {
  constructor({ onStart }) {
    this.onStart = onStart;
    this._t = 0;
  }

  update(dt, input) {
    this._t += dt;
    if (input.consumeAnyPressed()) this.onStart();
  }

  render(renderer) {
    const w = renderer.width;
    const h = renderer.height;
    renderer.fillRect(0, 0, w, h, "#000");

    renderer.text("BLACKOUT // OPERATION LIFELINE", w / 2, h / 2 - 28, {
      color: "#0aff7a",
      size: 18,
      align: "center",
      weight: "bold",
    });

    renderer.text("2D RECON BUILD — TOP-DOWN VARIANT", w / 2, h / 2 - 6, {
      color: "#4ae6ff",
      size: 10,
      align: "center",
    });

    if ((this._t * 2) % 2 < 1) {
      renderer.text("[ PRESS ANY KEY TO BOOT ]", w / 2, h / 2 + 28, {
        color: "#0aff7a",
        size: 11,
        align: "center",
      });
    }

    renderer.text("op@blackout:~$ _", 16, h - 18, {
      color: "#0a8a4a",
      size: 10,
    });
  }
}
