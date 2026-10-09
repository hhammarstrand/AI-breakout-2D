import { STAGES, ACTS, FRAGMENTS as FRAGMENT_DEFS } from "./story.js";

const TOTAL_SECTORS = STAGES.length;

// The uplink override code words, in order.
export const FRAGMENTS = FRAGMENT_DEFS.map((f) => f.word);
const SAVE_KEY = "blackout2d.save.v1";
const SETTINGS_KEY = "blackout2d.settings.v1";

export const gameState = {
  totalSectors: TOTAL_SECTORS,
  completedSectors: 0,
  score: 0,
  secondsLeft: ACTS[1].seconds,
  timesCaught: 0,
  checkpoint: null,
  endingsSeen: readJson(SETTINGS_KEY)?.endingsSeen ?? [],
  sfxOn: readJson(SETTINGS_KEY)?.sfxOn ?? true,
  crtOn: readJson(SETTINGS_KEY)?.crtOn ?? true,
  musicOn: readJson(SETTINGS_KEY)?.musicOn ?? true,
};

export function isSectorUnlocked(num) { return num <= gameState.completedSectors + 1; }
export function isSectorCompleted(num) { return num <= gameState.completedSectors; }
export function isSectorActive(num) { return num === gameState.completedSectors + 1; }

export function completeSector(num) {
  if (num === gameState.completedSectors + 1 && num <= TOTAL_SECTORS) {
    gameState.completedSectors = num;
    saveGame();
    return true;
  }
  return false;
}

// The act the player is currently in: the act of the next stage to clear.
export function currentAct() {
  const next = STAGES[Math.min(gameState.completedSectors, STAGES.length - 1)];
  return next.act;
}

export function actSeconds(act = currentAct()) { return ACTS[act].seconds; }

// Called on arriving at an act: refill the clock and remember where to restart.
export function startAct() {
  gameState.secondsLeft = actSeconds();
  gameState.checkpoint = {
    completedSectors: gameState.completedSectors,
    score: gameState.score,
    timesCaught: gameState.timesCaught,
  };
  saveGame();
}

export function restoreCheckpoint() {
  const cp = gameState.checkpoint;
  if (!cp) return false;
  gameState.completedSectors = cp.completedSectors;
  gameState.score = cp.score;
  gameState.timesCaught = cp.timesCaught;
  gameState.secondsLeft = actSeconds();
  saveGame();
  return true;
}

export function resetGame() {
  gameState.completedSectors = 0;
  gameState.score = 0;
  gameState.secondsLeft = ACTS[1].seconds;
  gameState.timesCaught = 0;
  gameState.checkpoint = null;
  clearSave();
}

export function hasSave() {
  const save = readJson(SAVE_KEY);
  return !!save && (save.secondsLeft > 0 || !!save.checkpoint);
}

export function loadGame() {
  const save = readJson(SAVE_KEY);
  if (!save) return false;
  gameState.completedSectors = clampInt(save.completedSectors, 0, TOTAL_SECTORS);
  gameState.score = Number(save.score) || 0;
  gameState.timesCaught = Number(save.timesCaught) || 0;
  gameState.checkpoint = save.checkpoint ?? null;
  gameState.secondsLeft = Math.max(0, Math.min(actSeconds(), Number(save.secondsLeft) || actSeconds()));
  if (gameState.secondsLeft <= 0) restoreCheckpoint();
  return true;
}

export function saveGame() {
  writeJson(SAVE_KEY, {
    completedSectors: gameState.completedSectors,
    score: gameState.score,
    secondsLeft: gameState.secondsLeft,
    timesCaught: gameState.timesCaught,
    checkpoint: gameState.checkpoint,
  });
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
}

export function setSfx(on) {
  gameState.sfxOn = on;
  writeSettings();
}

export function setMusic(on) {
  gameState.musicOn = on;
  writeSettings();
}

export function setCrt(on) {
  gameState.crtOn = on;
  writeSettings();
}

export function recordEnding(id) {
  if (!gameState.endingsSeen.includes(id)) gameState.endingsSeen.push(id);
  writeSettings();
}

export function collectedFragments() {
  return FRAGMENT_DEFS.filter((f) => f.stage <= gameState.completedSectors).map((f) => f.word);
}

function writeSettings() {
  writeJson(SETTINGS_KEY, { sfxOn: gameState.sfxOn, crtOn: gameState.crtOn, musicOn: gameState.musicOn, endingsSeen: gameState.endingsSeen });
}

function clampInt(v, lo, hi) { return Math.max(lo, Math.min(hi, v | 0)); }

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}
