import { Game } from "./engine/game.js";
import { Renderer } from "./engine/renderer.js";
import { Input } from "./engine/input.js";
import { TitleScene } from "./scenes/title-scene.js";
import { WorldScene } from "./scenes/world-scene.js";
import { Dialog } from "./ui/dialog.js";
import { Hud } from "./ui/hud.js";
import { smartBuildingMap } from "./world/maps/smart-building.js";

const canvas = document.getElementById("game");
const dialogEl = document.getElementById("dialog");
const hudEl = document.getElementById("hud");

const renderer = new Renderer(canvas);
const input = new Input(window);
const dialog = new Dialog(dialogEl);
const hud = new Hud(hudEl);
const game = new Game({ renderer, input });

const startWorld = () => {
  game.replace(new WorldScene({
    map: smartBuildingMap,
    dialog,
    hud,
    viewportWidth: renderer.width,
    viewportHeight: renderer.height,
  }));
  dialog.show("Operator", [
    "Booting up. Welcome back, op.",
    "Use WASD or arrows to move. Press E or space to interact.",
    "Find the four sector doors. We'll patch puzzles in soon.",
  ]);
};

game.push(new TitleScene({ onStart: startWorld }));
game.start();
