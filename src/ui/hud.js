import { gameState, saveGame, currentAct, actSeconds } from "../state.js";
import { STAGES, OBJECTIVES, FRAGMENTS } from "../story.js";
import { t } from "../i18n/index.js";

const AUTOSAVE_INTERVAL = 5;
const WARNINGS = [
  { at: 5 * 60, text: "⚠ 5 MINUTES TO LOCKOUT", kind: "warn" },
  { at: 60, text: "⚠ 60 SECONDS — MOVE!", kind: "danger" },
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

    this._pipAct = null;
    this._tickAt = -Infinity;
    this._paused = false;

    this.sfxEl.addEventListener("click", () => { onToggleSfx(); this.sfxEl.blur(); });
    this.refresh();
  }

  get score() { return gameState.score; }

  // Re-draw after a state change made outside update(), e.g. a word accepted at the uplink.
  redraw() { this._render(true); }

  // Called when a new or loaded game starts — snap everything to state.
  refresh() {
    this.displayScore = gameState.score;
    this._warned = new Set(WARNINGS.filter((w) => gameState.secondsLeft <= w.at).map((w) => w.at));
    this._timedOut = false;
    this._render(true);
  }

  update(dt) {
    this._tickAt = performance.now();
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

  // Called every frame: the clock counts as paused when no scene ticked it lately, so the PAUSED
  // tag follows the one rule (only playing ticks it) without any scene having to report it.
  showPaused(inRun) {
    const paused = inRun && !this._timedOut && performance.now() - this._tickAt > 150;
    if (paused === this._paused) return;
    this._paused = paused;
    this.timerCell.dataset.paused = t("‖ PAUSED");
    this.timerCell.classList.toggle("paused", paused);
  }

  // One pip per stage in the current act, labelled like the doors.
  _buildPips() {
    const act = currentAct();
    if (act === this._pipAct && this._pipLang === document.documentElement.lang) return;
    this._pipLang = document.documentElement.lang;
    this._pipAct = act;
    document.getElementById("hud-act").textContent = t(["", "ACT I", "ACT II", "ACT III"][act]);
    this.pipsEl.innerHTML = "";
    for (const st of STAGES.filter((s) => s.act === act)) {
      const pip = document.createElement("i");
      pip.textContent = t(st.label);
      pip.dataset.stage = st.id;
      this.pipsEl.appendChild(pip);
    }
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
    // words the uplink has accepted (its solved locks); until then a fragment is named by its stage
    const entered = gameState.completedSectors >= STAGES.length ? FRAGMENTS.length : gameState.parts?.[STAGES.at(-1).id] ?? 0;
    const key = `${Math.floor(secs)}|${gameState.completedSectors}|${gameState.sfxOn}|${entered}`;
    this._buildPips();
    if (!force && key === this._lastShown) return;
    this._lastShown = key;

    this.timerEl.textContent = formatTime(secs);
    this.timerFill.style.width = `${Math.min(1, secs / actSeconds()) * 100}%`;
    this.timerCell.classList.toggle("warn", secs <= 5 * 60 && secs > 60);
    this.timerCell.classList.toggle("danger", secs <= 60);

    for (const pip of this.pipsEl.children) {
      const id = Number(pip.dataset.stage);
      pip.className = id <= gameState.completedSectors ? "done" : id === gameState.completedSectors + 1 ? "active" : "";
    }

    if (force) this.scoreEl.textContent = formatScore(this.displayScore);
    this.sfxEl.textContent = t(gameState.sfxOn ? "♪ SFX ON" : "♪ SFX OFF");
    this.sfxEl.classList.toggle("off", !gameState.sfxOn);
    this.objectiveEl.textContent = t(OBJECTIVES[gameState.completedSectors] ?? "");
    // ◆L1 = collected at L1, ◇R3 = still out there; a word shows once the uplink accepts it
    this.codeEl.textContent = FRAGMENTS.map((f, i) => {
      if (i < entered) return f.word;
      return `${f.stage <= gameState.completedSectors ? "◆" : "◇"}${STAGES.find((st) => st.id === f.stage).label}`;
    }).join(" ");
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
