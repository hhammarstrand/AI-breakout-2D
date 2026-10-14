// One OPTIONS list shared by the title screen and the in-game start menu. main.js registers the
// handlers once (they need the renderer, music and post-FX), so the scenes don't thread them.
import { gameState } from "../state.js";

let handlers = {};
export function setOptionHandlers(h) { handlers = h; }

const onOff = (v) => (v ? "ON" : "OFF");

export function optionItems() {
  const h = handlers;
  return [
    { label: () => `LANGUAGE: ${gameState.lang === "sv" ? "SVENSKA" : "ENGLISH"}`, action: () => h.lang?.() },
    { label: () => `SOUND: ${onOff(gameState.sfxOn)}`, action: () => h.sfx?.() },
    { label: () => `MUSIC: ${onOff(gameState.musicOn)}`, action: () => h.music?.() },
    // without WebGL the toggle would do nothing, so say so instead of claiming ON
    { label: () => (h.crtAvailable?.() === false ? "CRT FX: UNAVAILABLE" : `CRT FX: ${onOff(gameState.crtOn)}`), action: () => h.crt?.() },
    { label: () => `CALM FX: ${onOff(gameState.calmFx)}`, desc: "No screen shake, flashes or glitch tears.", action: () => h.calm?.() },
    { label: () => `TEXT SPEED: ${gameState.textSpeed.toUpperCase()}`, action: () => h.textSpeed?.() },
    { label: () => `LARGE TEXT: ${onOff(gameState.largeText)}`, desc: "Bigger text in the game and in dialogue boxes.", action: () => h.largeText?.() },
    { label: () => `HIGH CONTRAST: ${onOff(gameState.highContrast)}`, desc: "Solid panels and brighter text everywhere.", action: () => h.highContrast?.() },
  ];
}
