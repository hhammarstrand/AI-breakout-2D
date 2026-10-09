import { Game } from "./engine/game.js";
import { Renderer } from "./engine/renderer.js";
import { Input } from "./engine/input.js";
import { Sfx } from "./audio/sfx.js";
import { TitleScene } from "./scenes/title-scene.js";
import { WorldScene } from "./scenes/world-scene.js";
import { GameOverScene } from "./scenes/gameover-scene.js";
import { Dialog } from "./ui/dialog.js";
import { Hud } from "./ui/hud.js";
import { Toasts } from "./ui/toast.js";
import { Fx } from "./ui/fx.js";
import { PostFx } from "./engine/postfx.js";
import { smartBuildingMap } from "./world/maps/smart-building.js";
import {
  gameState, hasSave, loadGame, resetGame, saveGame, clearSave, setSfx, setCrt,
} from "./state.js";

const canvas = document.getElementById("game");
const stageEl = document.getElementById("stage");

const renderer = new Renderer(canvas);
const input = new Input(window);
const sfx = new Sfx(gameState.sfxOn);
const toast = new Toasts(document.getElementById("toasts"), sfx);
const postfx = new PostFx(canvas);
postfx.setEnabled(gameState.crtOn);
const fx = new Fx(stageEl, postfx);
const dialog = new Dialog(document.getElementById("dialog"), sfx);
const game = new Game({ renderer, input, afterRender: (t, dt) => postfx.render(t, dt) });

const toggleCrt = () => {
  setCrt(!gameState.crtOn);
  postfx.setEnabled(gameState.crtOn);
  fx.glitch();
};

const toggleSfx = () => {
  setSfx(!gameState.sfxOn);
  sfx.setEnabled(gameState.sfxOn);
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

const operatorProfile = smartBuildingMap.npcs.find((n) => n.id === "operator");

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
    postfx,
    onQuit: () => { saveGame(); showTitle(); },
    viewportWidth: renderer.width,
    viewportHeight: renderer.height,
  }));
  if (fresh) {
    dialog.show("Operator", [
      "Booting up. Welcome back, op.",
      "Use WASD or arrows to move. Press E or space to interact.",
      "Find the four sector doors. Clear them in order before containment runs out.",
    ], null, operatorProfile);
  } else {
    toast.show("◉ SAVE RESTORED", "info");
  }
};

function showTitle() {
  dialog.close();
  game.replace(new TitleScene({
    hasSave: hasSave(),
    sfx,
    onToggleSfx: toggleSfx,
    onToggleCrt: toggleCrt,
    onNew: () => { resetGame(); startWorld(true); },
    onContinue: () => { loadGame(); startWorld(false); },
  }));
}

showTitle();
game.start();

// ?debug exposes internals for automated smoke tests.
if (new URLSearchParams(location.search).has("debug")) window.__blackout = { game, gameState, postfx };
