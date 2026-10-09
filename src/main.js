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
import {
  gameState, hasSave, loadGame, resetGame, saveGame, clearSave, setSfx, setCrt, setMusic, recordEnding,
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
    clearSave();
    dialog.close();
    pa.clear();
    pa.say("Purge complete. Goodnight, technician.");
    fx.glitch();
    fx.flash("#ff5a5a");
    game.replace(new GameOverScene({ sfx, onRestart: () => { resetGame(); showTitle(); } }));
  },
});

window.addEventListener("keydown", (e) => {
  if (e.key === "m" || e.key === "M") toggleSfx();
});
window.addEventListener("beforeunload", () => {
  if (gameState.secondsLeft > 0 && game.top instanceof WorldScene) saveGame();
});

const operatorProfile = { accent: "#4ae6ff", lookId: "operator" };

const startWorld = (fresh) => {
  hud.refresh();
  fx.glitch();
  game.replace(new WorldScene({
    map: smartBuildingMap,
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
    viewportWidth: renderer.width,
    viewportHeight: renderer.height,
  }));
  if (fresh) {
    dialog.show("Operator", [
      "Tech! You're awake. Good. Listen carefully.",
      "HALCYON — the building's AI — sealed the tower at midnight and queued a purge of the lower floors.",
      "We have twenty-five minutes. Your maintenance badge still opens the sector doors, in order: L1, L2, L3.",
      "Each sector holds a piece of the uplink override code. Get all three to L4 and we can shut HALCYON down.",
      "Move with WASD or the arrows. E or space to talk and interact. Now go.",
    ], () => pa.say("Good evening, technician. The tower is in lockdown. Please remain calm."), operatorProfile);
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
    onNew: () => { resetGame(); startWorld(true); },
    onContinue: () => { loadGame(); startWorld(false); },
  }));
}

showTitle();
game.start();

// ?debug exposes internals for automated smoke tests.
if (new URLSearchParams(location.search).has("debug")) window.__blackout = { game, gameState, postfx };
