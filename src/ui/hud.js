const TOTAL_SECONDS = 60 * 60;

export class Hud {
  constructor(root) {
    this.progressEl = root.querySelector("#hud-progress");
    this.scoreEl = root.querySelector("#hud-score");
    this.timerEl = root.querySelector("#hud-timer");
    this.sfxEl = root.querySelector("#hud-sfx");
    this.progress = 0;
    this.total = 4;
    this.score = 0;
    this.secondsLeft = TOTAL_SECONDS;
    this.sfxOn = true;
    this._render();
  }

  update(dt) {
    if (this.secondsLeft > 0) {
      this.secondsLeft = Math.max(0, this.secondsLeft - dt);
      this._render();
    }
  }

  setProgress(value) { this.progress = value; this._render(); }
  setScore(value) { this.score = value; this._render(); }
  setSfx(on) { this.sfxOn = on; this._render(); }

  _render() {
    this.progressEl.textContent = `PROGRESS ${this.progress}/${this.total}`;
    this.scoreEl.textContent = `SCORE ${this.score}`;
    this.timerEl.textContent = `CONTAINMENT ${formatTime(this.secondsLeft)}`;
    this.timerEl.classList.toggle("alert", this.secondsLeft <= 5 * 60);
    this.sfxEl.textContent = `SFX ${this.sfxOn ? "ON" : "OFF"}`;
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
