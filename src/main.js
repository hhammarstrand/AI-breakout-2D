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
import { PauseScene } from "./scenes/pause-scene.js";
import { StartMenuScene } from "./scenes/start-menu-scene.js";
import { initTrophies, award } from "./ui/trophies.js";
import { setLang, applyDom } from "./i18n/index.js";
import { newRun, track } from "./telemetry.js";
import { ACTS, PA_ACT_START, STAGES, stageInfo } from "./story.js";
import {
  gameState, hasSave, loadGame, resetGame, saveGame, clearSave, setSfx, setCrt, setMusic, recordEnding,
  currentAct, startAct, restoreCheckpoint, actSeconds, setLanguage, setPenaltyListener,
  retryStage, clearedThisAct,
} from "./state.js";

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
    const top = game.top;
    if (top) top._activeT = (top._activeT ?? 0) + dt; // time a scene spent on top: ECHO's hint gap
    const inRun = game.scenes[0]?.constructor === WorldScene;
    hud.showPaused(inRun);
    // play time only counts while actually in the game, not on title/intro/ending screens or paused
    if (gameState.telemetry && inRun && !isPause(top)) track.tick(dt);
  },
});

const toggleMusic = () => {
  setMusic(!gameState.musicOn);
  music.setEnabled(gameState.musicOn);
};

const toggleLang = () => {
  setLanguage(gameState.lang === "sv" ? "en" : "sv");
  setLang(gameState.lang);
  applyDom();
  hud.refresh();
};

const toggleCrt = () => {
  setCrt(!gameState.crtOn);
  postfx.setEnabled(gameState.crtOn);
  fx.glitch();
};

const toggleSfx = () => {
  setSfx(!gameState.sfxOn);
  sfx.setEnabled(gameState.sfxOn);
  music.setMuted(!gameState.sfxOn);
  hud.refresh();
  if (gameState.sfxOn) sfx.play("confirm");
};

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
    // the save on disk already holds the stage retry (refilled clock, floor start), so a reload
    // can't dodge it; RESTART ACT is the player's own choice
    retryStage();
    const act = currentAct();
    const retry = {
      act,
      stage: stageInfo(gameState.completedSectors + 1),
      seconds: gameState.secondsLeft,
      actSeconds: actSeconds(act),
      kept: STAGES.slice(gameState.completedSectors - clearedThisAct(), gameState.completedSectors).filter((st) => !st.lift).map((st) => st.label),
    };
    dialog.close();
    pa.clear();
    pa.say("Purge complete. Goodnight, technician.");
    fx.glitch();
    fx.flash("#ff5a5a");
    game.replace(new GameOverScene({
      sfx,
      stats,
      retry,
      onRetry: () => { retryStage(); startWorld({ retry: "stage" }); },
      onRestartAct: () => { restoreCheckpoint(); startWorld({ retry: "act" }); },
      onQuit: () => showTitle(),
    }));
  }),
});

// on-screen buttons feed the same input actions as the keyboard
for (const btn of document.querySelectorAll("#touch button")) {
  const action = btn.dataset.action;
  const down = (e) => { e.preventDefault(); btn.classList.add("held"); input.press(action); };
  const up = (e) => { e.preventDefault(); btn.classList.remove("held"); input.release(action); };
  btn.addEventListener("pointerdown", down);
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointercancel", up);
  btn.addEventListener("pointerleave", up);
}

window.addEventListener("keydown", (e) => {
  if (e.key === "m" || e.key === "M") toggleSfx();
});
// A live run pauses whenever the window loses focus or is hidden: alt-tabbing never costs clock
// or gets you caught. Saved at once too, since mobile browsers may never fire beforeunload.
const isPause = (scene) => scene instanceof PauseScene || scene instanceof StartMenuScene;
const autoPause = () => {
  if (!(game.scenes[0] instanceof WorldScene) || gameState.secondsLeft <= 0) return;
  saveGame();
  if (!isPause(game.top)) game.push(new PauseScene({ sfx }));
};
window.addEventListener("blur", autoPause);
document.addEventListener("visibilitychange", () => { if (document.hidden) autoPause(); });

window.addEventListener("beforeunload", () => {
  // any scene on top of the world (puzzle, menu, battle, hint) still belongs to a live run
  if (gameState.secondsLeft > 0 && game.scenes[0] instanceof WorldScene) saveGame();
});

const operatorProfile = { accent: "#4ae6ff", lookId: "operator" };

const MAPS = { lobby: smartBuildingMap, research: researchFloorMap, core: coreMap };

// fresh: new game · arrived: just came up a lift · retry: "stage" or "act" after a game over
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
      "Move with WASD or the arrows. E or space to talk and interact. F for your flashlight. Now go.",
    ], () => pa.say(paActStart(1)), operatorProfile);
  } else if (arrived) {
    toast.show(ACTS[act].name, "info");
    pa.say(paActStart(act));
  } else if (retry) {
    toast.show(retry === "act" ? "◉ CHECKPOINT — START OF ACT" : `◉ CHECKPOINT — START OF ${stageInfo(gameState.completedSectors + 1).label}`, "info");
    pa.say("Again, technician? I reset the clock. I'm patient like that.");
  } else {
    toast.show("◉ SAVE RESTORED", "info");
    pa.say("Welcome back, technician. I froze the clock while you were gone. Generous of me.");
  }
};

// HALCYON names the act's real clock (it scales with difficulty)
function paActStart(act) { return PA_ACT_START[act].replace("{min}", Math.round(actSeconds(act) / 60)); }

function showEnding(ending) {
  award(ending);
  if (gameState.checkpoint && gameState.timesCaught === gameState.checkpoint.timesCaught) award("ghost");
  if (gameState.everCaught === 0) award("untouchable"); // a retried act still counts its catches
  if (gameState.secondsLeft >= actSeconds(3) / 2) award("speedrun"); // scales with difficulty
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
