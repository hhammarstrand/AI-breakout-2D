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
import { ACTS, PA_ACT_START } from "./story.js";
import {
  gameState, hasSave, loadGame, resetGame, saveGame, clearSave, setSfx, setCrt, setMusic, recordEnding,
  currentAct, startAct, restoreCheckpoint, actSeconds,
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
const postfx = new PostFx(canvas);
postfx.setEnabled(gameState.crtOn);
const fx = new Fx(stageEl, postfx);
const dialog = new Dialog(document.getElementById("dialog"), sfx);
const pa = new PublicAddress(document.getElementById("pa"), sfx);
const game = new Game({
  renderer,
  input,
  // H in any scene that defines `hints` opens ECHO's hint overlay
  onHint: (scene) => { if (scene.hints?.length) game.push(new HintScene({ hints: scene.hints, owner: scene, sfx })); },
  afterRender: (t, dt) => { postfx.render(t, dt); pa.update(dt); hud.tickScore(dt); },
});

const toggleMusic = () => {
  setMusic(!gameState.musicOn);
  music.setEnabled(gameState.musicOn);
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

const hud = new Hud(document.getElementById("hud"), {
  toast,
  sfx,
  onToggleSfx: toggleSfx,
  onTimeout: () => {
    saveGame();
    dialog.close();
    pa.clear();
    pa.say("Purge complete. Goodnight, technician.");
    fx.glitch();
    fx.flash("#ff5a5a");
    game.replace(new GameOverScene({
      sfx,
      onRetry: () => { restoreCheckpoint(); startWorld({ retry: true }); },
      onQuit: () => { restoreCheckpoint(); showTitle(); },
    }));
  },
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
window.addEventListener("beforeunload", () => {
  if (gameState.secondsLeft > 0 && game.top instanceof WorldScene) saveGame();
});

const operatorProfile = { accent: "#4ae6ff", lookId: "operator" };

const MAPS = { lobby: smartBuildingMap, research: researchFloorMap, core: coreMap };

// fresh: new game · arrived: just came up a lift · retry: restarting the act after a game over
const startWorld = ({ fresh = false, arrived = false, retry = false } = {}) => {
  const act = currentAct();
  if (fresh || arrived) startAct();
  hud.refresh();
  fx.glitch();
  game.replace(new WorldScene({
    map: MAPS[ACTS[act].map],
    dialog,
    hud,
    sfx,
    fx,
    toast,
    onToggleSfx: toggleSfx,
    onToggleCrt: toggleCrt,
    onToggleMusic: toggleMusic,
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
      "We have twenty-five minutes. Your maintenance badge still opens the sector doors, one at a time.",
      "Somewhere in this tower are the three words of the uplink override code. Find them, reach HALCYON's core, shut it down.",
      "Move with WASD or the arrows. E or space to talk and interact. F for your flashlight. Now go.",
    ], () => pa.say(PA_ACT_START[1]), operatorProfile);
  } else if (arrived) {
    toast.show(ACTS[act].name, "info");
    pa.say(PA_ACT_START[act]);
  } else if (retry) {
    toast.show("◉ CHECKPOINT — START OF ACT", "info");
    pa.say("Again, technician? I reset the clock. I'm patient like that.");
  } else {
    toast.show("◉ SAVE RESTORED", "info");
    pa.say("Welcome back, technician. The purge clock did not wait for you.");
  }
};

function showEnding(ending) {
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
    onNew: (diff) => {
      resetGame();
      gameState.difficulty = diff;
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
