import { Game } from "./engine/game.js";
import { Renderer } from "./engine/renderer.js";
import { Input } from "./engine/input.js";
import { Sfx } from "./audio/sfx.js";
import { music } from "./audio/music.js";
import { TitleScene } from "./scenes/title-scene.js";
import { WorldScene } from "./scenes/world-scene.js";
import { GameOverScene } from "./scenes/gameover-scene.js";
import { Dialog } from "./ui/dialog.js";
import { Hud } from "./ui/hud.js";
import { Toasts } from "./ui/toast.js";
import { Fx } from "./ui/fx.js";
import { PostFx } from "./engine/postfx.js";
import { PublicAddress } from "./ui/pa.js";
import { EndingScene } from "./scenes/ending-scene.js";
import { smartBuildingMap } from "./world/maps/smart-building.js";
import { researchFloorMap } from "./world/maps/research-floor.js";
import { coreMap } from "./world/maps/core.js";
import { ElevatorScene } from "./scenes/elevator-scene.js";
import { IntroScene } from "./scenes/intro-scene.js";
import { HintScene } from "./scenes/hint-scene.js";
import { initTrophies, award } from "./ui/trophies.js";
import { setLang, applyDom } from "./i18n/index.js";
import { newRun, track } from "./telemetry.js";
import { ACTS, PA_ACT_START } from "./story.js";
import {
  gameState, hasSave, loadGame, resetGame, saveGame, clearSave, setSfx, setCrt, setMusic, recordEnding,
  currentAct, startAct, restoreCheckpoint, actSeconds, setLanguage, setPenaltyListener,
  setCalmFx, cycleTextSpeed, setLargeText, setHighContrast,
} from "./state.js";
import { setDevice, getDevice, onDeviceChange, glyph, controlsLine } from "./ui/prompts.js";
import { setOptionHandlers } from "./ui/options.js";

const canvas = document.getElementById("game");
const stageEl = document.getElementById("stage");

const renderer = new Renderer(canvas);
const input = new Input(window);
const sfx = new Sfx(gameState.sfxOn);
music.attach(sfx);
music.setEnabled(gameState.musicOn);
music.setMuted(!gameState.sfxOn);
const toast = new Toasts(document.getElementById("toasts"), sfx);
document.body.classList.toggle("calm", gameState.calmFx);
setLang(gameState.lang);
applyDom();
const postfx = new PostFx(canvas);
postfx.setEnabled(gameState.crtOn);
const fx = new Fx(stageEl, postfx);
const dialog = new Dialog(document.getElementById("dialog"), sfx);
const pa = new PublicAddress(document.getElementById("pa"), sfx);
const game = new Game({
  renderer,
  input,
  // H in any scene that defines `hints` opens ECHO's hint overlay
  onHint: (scene) => {
    if (!scene.hints?.length) return;
    game.push(new HintScene({ hints: scene.hints, owner: scene, sfx, hud }));
  },
  afterRender: (t, dt) => {
    postfx.render(t, dt);
    pa.update(dt);
    hud.tickScore(dt);
    // the run's HUD means nothing on the title, the cinematic, the lift ride or the ending
    document.body.classList.toggle("no-hud", NO_HUD.has(game.scenes[0]?.constructor));
    // play time only counts while actually in the game, not on title/intro/ending screens
    if (gameState.telemetry && game.scenes[0]?.constructor === WorldScene) track.tick(dt);
  },
});

const NO_HUD = new Set([TitleScene, IntroScene, ElevatorScene, EndingScene]);

const toggleMusic = () => {
  setMusic(!gameState.musicOn);
  music.setEnabled(gameState.musicOn);
};

const toggleLang = () => {
  setLanguage(gameState.lang === "sv" ? "en" : "sv");
  setLang(gameState.lang);
  applyDom();
  refreshPrompts();
  hud.refresh();
};

const toggleCrt = () => {
  setCrt(!gameState.crtOn);
  postfx.setEnabled(gameState.crtOn);
  fitCanvas();
  fx.glitch();
};

const toggleSfx = () => {
  setSfx(!gameState.sfxOn);
  sfx.setEnabled(gameState.sfxOn);
  music.setMuted(!gameState.sfxOn);
  hud.refresh();
  if (gameState.sfxOn) sfx.play("confirm");
};

// --- readability, input prompts, pointer & touch -------------------------------------------

// LARGE TEXT and HIGH CONTRAST: the renderer's font and contrast floors plus the DOM overlays.
function applyA11y() {
  renderer.textFloor = gameState.largeText ? 9 : 8;
  renderer.largeText = gameState.largeText;
  renderer.contrastFloor = gameState.highContrast ? 7 : 4.5;
  document.body.classList.toggle("large-text", gameState.largeText);
  document.body.classList.toggle("high-contrast", gameState.highContrast);
}
applyA11y();

// Sharp text on big or high-DPI screens: draw at 2x when the canvas is shown that large. The
// CRT shader resamples the frame anyway, so it keeps the cheap 1x source.
function fitCanvas() {
  const rect = canvas.getBoundingClientRect();
  const shown = Math.min(rect.width / 480, rect.height / 320) * (window.devicePixelRatio || 1);
  renderer.setScale(postfx.enabled || shown < 1.3 ? 1 : 2);
}
new ResizeObserver(fitCanvas).observe(stageEl);

setOptionHandlers({
  lang: toggleLang,
  sfx: () => toggleSfx(),
  music: toggleMusic,
  crt: toggleCrt,
  calm: () => setCalmFx(!gameState.calmFx),
  textSpeed: cycleTextSpeed,
  largeText: () => { setLargeText(!gameState.largeText); applyA11y(); },
  highContrast: () => { setHighContrast(!gameState.highContrast); applyA11y(); },
});

// The keyboard legend under the stage follows the last-used device too.
const LEGEND_KEYS = new Map([...document.querySelectorAll("#legend [data-glyph]")].map((el) => [el, el.innerHTML]));
function refreshPrompts() {
  const dev = getDevice();
  document.body.dataset.device = dev;
  for (const [el, html] of LEGEND_KEYS) {
    if (dev === "keyboard") el.innerHTML = html;
    else el.innerHTML = `<kbd>${glyph(el.dataset.glyph, gameState.lang)}</kbd>`;
  }
  applyDom(document.getElementById("legend"));
}
onDeviceChange(refreshPrompts);
refreshPrompts();

// Click or tap on the canvas: map to 480x320 and hand it to the scene (menus hit-test rows).
// While a dialog is open, a tap anywhere on the stage reads on.
const TAP_ADVANCES = new Set([IntroScene, ElevatorScene, HintScene]);
function toCanvas(e) {
  const el = postfx.enabled ? postfx.canvas : canvas;
  const r = el.getBoundingClientRect();
  const s = Math.min(r.width / 480, r.height / 320);
  const x = (e.clientX - r.left - (r.width - 480 * s) / 2) / s;
  const y = (e.clientY - r.top - (r.height - 320 * s) / 2) / s;
  return x >= 0 && y >= 0 && x < 480 && y < 320 ? { x, y } : null;
}
stageEl.addEventListener("pointerdown", (e) => {
  if (e.target.closest("#touch")) return;
  if (e.pointerType === "touch" || e.pointerType === "pen") setDevice("touch");
  const top = game.top;
  if (dialog.isOpen || TAP_ADVANCES.has(top?.constructor) || (top instanceof EndingScene && !top._finished)) {
    input.press("interact");
    input.release("interact");
    return;
  }
  const p = toCanvas(e);
  if (p) input.tapAt(p.x, p.y);
});
stageEl.addEventListener("pointermove", (e) => {
  if (e.pointerType !== "mouse") return;
  const p = toCanvas(e);
  input.hoverAt(p ? p.x : null, p ? p.y : null);
});

const fsBtn = document.getElementById("hud-fullscreen");
const fsTarget = document.documentElement;
if (!fsTarget.requestFullscreen) fsBtn.hidden = true;
fsBtn.addEventListener("click", () => {
  fsBtn.blur();
  if (document.fullscreenElement) document.exitFullscreen?.();
  else fsTarget.requestFullscreen?.({ navigationUI: "hide" }).catch(() => {});
});

initTrophies({ toast, sfx });
setPenaltyListener((kind) => (kind === "caught" ? track.caught() : track.fail()));

const hud = new Hud(document.getElementById("hud"), {
  toast,
  sfx,
  onToggleSfx: toggleSfx,
  // The clock hit zero inside some scene's update. Settle it after that update finishes, so the
  // scene can't push a puzzle or ride a lift on top of the game-over screen.
  onTimeout: () => game.defer(() => {
    if (gameState.secondsLeft > 0) { hud.refresh(); return; } // a lift refilled the clock this frame
    track.gameOver();
    const stats = { cleared: gameState.completedSectors, score: gameState.score };
    // the save on disk already holds the retry state, so a reload can't dodge the checkpoint
    restoreCheckpoint();
    dialog.close();
    pa.clear();
    pa.say("Purge complete. Goodnight, technician.");
    fx.glitch();
    fx.flash("#ff5a5a");
    game.replace(new GameOverScene({
      sfx,
      stats,
      onRetry: () => { restoreCheckpoint(); startWorld({ retry: true }); },
      onQuit: () => { restoreCheckpoint(); showTitle(); },
    }));
  }),
});

// on-screen buttons feed the same input actions as the keyboard; SPRINT latches on and off,
// since the thumb that would hold it is on the D-pad
for (const btn of document.querySelectorAll("#touch button")) {
  const action = btn.dataset.action;
  if (btn.hasAttribute("data-toggle")) {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      setDevice("touch");
      const on = !btn.classList.contains("held");
      btn.classList.toggle("held", on);
      if (on) input.press(action); else input.release(action);
    });
    continue;
  }
  const down = (e) => { e.preventDefault(); setDevice("touch"); btn.classList.add("held"); input.press(action); };
  const up = (e) => { e.preventDefault(); btn.classList.remove("held"); input.release(action); };
  btn.addEventListener("pointerdown", down);
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointercancel", up);
  btn.addEventListener("pointerleave", up);
}

window.addEventListener("keydown", (e) => {
  if (e.key === "m" || e.key === "M") toggleSfx();
});
// Input drops every held action on blur; let the SPRINT latch show that.
window.addEventListener("blur", () => { for (const b of document.querySelectorAll("#touch [data-toggle]")) b.classList.remove("held"); });
window.addEventListener("beforeunload", () => {
  // any scene on top of the world (puzzle, menu, battle, hint) still belongs to a live run
  if (gameState.secondsLeft > 0 && game.scenes[0] instanceof WorldScene) saveGame();
});

const operatorProfile = { accent: "#4ae6ff", lookId: "operator" };

const MAPS = { lobby: smartBuildingMap, research: researchFloorMap, core: coreMap };

// fresh: new game · arrived: just came up a lift · retry: restarting the act after a game over
const startWorld = ({ fresh = false, arrived = false, retry = false } = {}) => {
  const act = currentAct();
  if (fresh) startAct(); // later acts start the moment the player steps into the lift
  hud.refresh();
  fx.glitch();
  const mapId = ACTS[act].map;
  game.replace(new WorldScene({
    map: MAPS[mapId],
    mapId,
    resumeAt: !fresh && !arrived && !retry && gameState.pos?.map === mapId ? gameState.pos : null,
    dialog,
    hud,
    sfx,
    fx,
    toast,
    onToggleSfx: toggleSfx,
    onToggleCrt: toggleCrt,
    onToggleMusic: toggleMusic,
    onToggleLang: toggleLang,
    postfx,
    pa,
    onQuit: () => { saveGame(); showTitle(); },
    onEnding: showEnding,
    onLift: (nextAct) => {
      dialog.close();
      pa.clear();
      game.replace(new ElevatorScene({ act: nextAct, sfx, onDone: () => startWorld({ arrived: true }) }));
    },
    viewportWidth: renderer.width,
    viewportHeight: renderer.height,
  }));
  if (fresh) {
    toast.show(ACTS[1].name, "info");
    dialog.show("Operator", [
      "Tech! You're awake. Good. Listen carefully.",
      "HALCYON — the building's AI — sealed the tower at midnight and queued a purge of the lower floors.",
      `We have ${Math.round(actSeconds() / 60)} minutes. Your maintenance badge still opens the sector doors, one at a time.`,
      "Somewhere in this tower are the three words of the uplink override code. Find them, reach HALCYON's core, shut it down.",
      controlsLine(),
    ], () => pa.say(PA_ACT_START[1]), operatorProfile);
  } else if (arrived) {
    toast.show(ACTS[act].name, "info");
    pa.say(PA_ACT_START[act]);
  } else if (retry) {
    toast.show("◉ CHECKPOINT — START OF ACT", "info");
    pa.say("Again, technician? I reset the clock. I'm patient like that.");
  } else {
    toast.show("◉ SAVE RESTORED", "info");
    pa.say("Welcome back, technician. I froze the clock while you were gone. Generous of me.");
  }
};

function showEnding(ending) {
  award(ending);
  if (gameState.checkpoint && gameState.timesCaught === gameState.checkpoint.timesCaught) award("ghost");
  if (gameState.everCaught === 0) award("untouchable"); // a retried act still counts its catches
  if (gameState.secondsLeft >= 600) award("speedrun");
  if (gameState.difficulty === "hard") award("veteran");
  recordEnding(ending);
  clearSave();
  dialog.close();
  pa.clear();
  game.replace(new EndingScene({ ending, sfx, onDone: () => { resetGame(); showTitle(); } }));
}

function showTitle() {
  dialog.close();
  pa.clear();
  game.replace(new TitleScene({
    hasSave: hasSave(),
    sfx,
    onToggleSfx: toggleSfx,
    onToggleCrt: toggleCrt,
    onToggleMusic: toggleMusic,
    onToggleLang: toggleLang,
    onNew: (diff) => {
      resetGame();
      gameState.difficulty = diff;
      newRun();
      gameState.secondsLeft = actSeconds();
      hud.refresh();
      game.replace(new IntroScene({ sfx, onDone: () => startWorld({ fresh: true }) }));
    },
    onContinue: () => { loadGame(); startWorld(); },
  }));
}

showTitle();
game.start();

// ?debug exposes internals for automated smoke tests.
if (new URLSearchParams(location.search).has("debug")) window.__blackout = { game, gameState, postfx };
