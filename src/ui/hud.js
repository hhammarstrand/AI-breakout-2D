import { gameState, saveGame, TOTAL_SECONDS, FRAGMENTS, collectedFragments } from "../state.js";

const AUTOSAVE_INTERVAL = 5;
const WARNINGS = [
  { at: 5 * 60, text: "⚠ 5 MINUTES TO LOCKOUT", kind: "warn" },
  { at: 60, text: "⚠ 60 SECONDS — MOVE!", kind: "danger" },
];

const OBJECTIVES = [
  "L1 (north-west): find the survivor on the CCTV grid. Ask around for the sensor rules",
  "L2: decrypt HALCYON's lab logs. Dr. Lind knows how its cipher works",
  "L3: program ECHO to walk the door-control maze",
  "L4 (north-east): enter the uplink code and override HALCYON",
  "The tower is open. It's over.",
];

export class Hud {
  constructor(root, { toast, sfx, onToggleSfx, onTimeout }) {
    this.root = root;
    this.toast = toast;
    this.sfx = sfx;
    this.onTimeout = onTimeout;
    this.pipsEl = root.querySelector("#hud-pips");
    this.scoreEl = root.querySelector("#hud-score-value");
    this.scoreCell = root.querySelector("#hud-score");
    this.timerEl = root.querySelector("#hud-timer-value");
    this.timerCell = root.querySelector("#hud-timer");
    this.timerFill = root.querySelector("#hud-timer-fill");
    this.sfxEl = root.querySelector("#hud-sfx");
    this.codeEl = root.querySelector("#hud-code-value");
    this.objectiveEl = document.getElementById("objective");
    this.displayScore = gameState.score;
    this._saveTimer = 0;
    this._lastShown = "";

    this.pipsEl.innerHTML = "";
    for (let i = 0; i < gameState.totalSectors; i++) {
      const pip = document.createElement("i");
      pip.textContent = `L${i + 1}`;
      this.pipsEl.appendChild(pip);
    }

    this.sfxEl.addEventListener("click", () => { onToggleSfx(); this.sfxEl.blur(); });
    this.refresh();
  }

  get score() { return gameState.score; }

  // Called when a new or loaded game starts — snap everything to state.
  refresh() {
    this.displayScore = gameState.score;
    this._warned = new Set(WARNINGS.filter((w) => gameState.secondsLeft <= w.at).map((w) => w.at));
    this._timedOut = false;
    this._render(true);
  }

  update(dt) {
    if (this._timedOut) return;
    gameState.secondsLeft = Math.max(0, gameState.secondsLeft - dt);

    for (const w of WARNINGS) {
      if (gameState.secondsLeft <= w.at && !this._warned.has(w.at)) {
        this._warned.add(w.at);
        this.toast.show(w.text, w.kind);
        this.sfx.play("alarm");
      }
    }

    this._saveTimer += dt;
    if (this._saveTimer >= AUTOSAVE_INTERVAL) { this._saveTimer = 0; saveGame(); }

    if (gameState.secondsLeft <= 0) {
      this._timedOut = true;
      this._render();
      this.onTimeout();
      return;
    }
    this._render();
  }

  addScore(delta) {
    gameState.score += delta;
    saveGame();
    const pop = document.createElement("span");
    pop.className = `score-pop ${delta >= 0 ? "gain" : "loss"}`;
    pop.textContent = `${delta >= 0 ? "+" : ""}${delta}`;
    this.scoreCell.appendChild(pop);
    pop.addEventListener("animationend", () => pop.remove());
    this.scoreCell.classList.remove("bump");
    void this.scoreCell.offsetWidth; // restart the CSS animation
    this.scoreCell.classList.add("bump");
    this._render();
  }

  // Rolls the visible score toward the real one, like an arcade counter.
  tickScore(dt) {
    const diff = gameState.score - this.displayScore;
    if (diff === 0) return;
    const step = Math.max(1, Math.ceil(Math.abs(diff) * dt * 6));
    this.displayScore += Math.sign(diff) * Math.min(step, Math.abs(diff));
    this.scoreEl.textContent = formatScore(this.displayScore);
  }

  _render(force = false) {
    const secs = gameState.secondsLeft;
    const key = `${Math.floor(secs)}|${gameState.completedSectors}|${gameState.sfxOn}`;
    if (!force && key === this._lastShown) return;
    this._lastShown = key;

    this.timerEl.textContent = formatTime(secs);
    this.timerFill.style.width = `${(secs / TOTAL_SECONDS) * 100}%`;
    this.timerCell.classList.toggle("warn", secs <= 5 * 60 && secs > 60);
    this.timerCell.classList.toggle("danger", secs <= 60);

    const pips = this.pipsEl.children;
    for (let i = 0; i < pips.length; i++) {
      pips[i].className = i < gameState.completedSectors ? "done"
                        : i === gameState.completedSectors ? "active" : "";
    }

    if (force) this.scoreEl.textContent = formatScore(this.displayScore);
    this.sfxEl.textContent = gameState.sfxOn ? "♪ SFX ON" : "♪ SFX OFF";
    this.sfxEl.classList.toggle("off", !gameState.sfxOn);
    this.objectiveEl.textContent = OBJECTIVES[gameState.completedSectors] ?? "";
    const got = collectedFragments();
    this.codeEl.textContent = FRAGMENTS.map((f, i) => got[i] ?? "·".repeat(f.length)).join(" ");
  }
}

function formatScore(n) {
  return `${n < 0 ? "-" : ""}${String(Math.abs(n)).padStart(4, "0")}`;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
