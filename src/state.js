const TOTAL_SECTORS = 4;
export const TOTAL_SECONDS = 25 * 60;

// The uplink override code; each cleared sector (L1-L3) yields one word.
export const FRAGMENTS = ["LUMEN", "ORION", "AURORA"];
const SAVE_KEY = "blackout2d.save.v1";
const SETTINGS_KEY = "blackout2d.settings.v1";

export const gameState = {
  totalSectors: TOTAL_SECTORS,
  completedSectors: 0,
  score: 0,
  secondsLeft: TOTAL_SECONDS,
  timesCaught: 0,
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

export function resetGame() {
  gameState.completedSectors = 0;
  gameState.score = 0;
  gameState.secondsLeft = TOTAL_SECONDS;
  gameState.timesCaught = 0;
  clearSave();
}

export function hasSave() {
  const save = readJson(SAVE_KEY);
  return !!save && save.secondsLeft > 0;
}

export function loadGame() {
  const save = readJson(SAVE_KEY);
  if (!save) return false;
  gameState.completedSectors = clampInt(save.completedSectors, 0, TOTAL_SECTORS);
  gameState.score = Number(save.score) || 0;
  gameState.secondsLeft = Math.max(0, Math.min(TOTAL_SECONDS, Number(save.secondsLeft) || TOTAL_SECONDS));
  gameState.timesCaught = Number(save.timesCaught) || 0;
  return true;
}

export function saveGame() {
  writeJson(SAVE_KEY, {
    completedSectors: gameState.completedSectors,
    score: gameState.score,
    secondsLeft: gameState.secondsLeft,
    timesCaught: gameState.timesCaught,
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
  return FRAGMENTS.slice(0, Math.min(gameState.completedSectors, FRAGMENTS.length));
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
