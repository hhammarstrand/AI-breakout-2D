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
  collected: [],
  items: {},
  difficulty: "normal",
  endingsSeen: readJson(SETTINGS_KEY)?.endingsSeen ?? [],
  achievements: readJson(SETTINGS_KEY)?.achievements ?? [],
  sfxOn: readJson(SETTINGS_KEY)?.sfxOn ?? true,
  crtOn: readJson(SETTINGS_KEY)?.crtOn ?? true,
  musicOn: readJson(SETTINGS_KEY)?.musicOn ?? true,
  calmFx: readJson(SETTINGS_KEY)?.calmFx ?? false,
  textSpeed: readJson(SETTINGS_KEY)?.textSpeed ?? "normal",
  lang: readJson(SETTINGS_KEY)?.lang ?? (navigator.language?.toLowerCase().startsWith("sv") ? "sv" : "en"),
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

// Story mode is for players who want the plot and puzzles without the pressure; Hard is for
// people who have already seen both endings.
export const DIFFICULTY = {
  story: { label: "STORY", time: 1.6, detect: 0.5, penalty: 0.5 },
  normal: { label: "NORMAL", time: 1, detect: 1, penalty: 1 },
  hard: { label: "HARD", time: 0.75, detect: 1.4, penalty: 1.5 },
};

export function difficulty() { return DIFFICULTY[gameState.difficulty] ?? DIFFICULTY.normal; }

export function actSeconds(act = currentAct()) { return Math.round(ACTS[act].seconds * difficulty().time); }

export function scaledPenalty(seconds) { return Math.round(seconds * difficulty().penalty); }

// Mistakes cost time, scaled by difficulty; never ends the game by itself.
export function penalize(seconds) {
  const cost = Math.round(seconds * difficulty().penalty);
  gameState.secondsLeft = Math.max(1, gameState.secondsLeft - cost);
  return cost;
}

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
  gameState.timesCaught = 0;
  gameState.checkpoint = null;
  gameState.difficulty = "normal";
  gameState.collected = [];
  gameState.items = {};
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
  gameState.difficulty = DIFFICULTY[save.difficulty] ? save.difficulty : "normal";
  gameState.collected = Array.isArray(save.collected) ? save.collected : [];
  gameState.items = save.items && typeof save.items === "object" ? save.items : {};
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
    difficulty: gameState.difficulty,
    collected: gameState.collected,
    items: gameState.items,
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

export function setLanguage(l) {
  gameState.lang = l;
  writeSettings();
}

export function setCalmFx(on) {
  gameState.calmFx = on;
  document.body.classList.toggle("calm", on);
  writeSettings();
}

const TEXT_SPEEDS = ["slow", "normal", "fast"];
export function cycleTextSpeed() {
  gameState.textSpeed = TEXT_SPEEDS[(TEXT_SPEEDS.indexOf(gameState.textSpeed) + 1) % TEXT_SPEEDS.length];
  writeSettings();
}

export function setCrt(on) {
  gameState.crtOn = on;
  writeSettings();
}

// Returns true the first time an achievement is unlocked.
export function unlockAchievement(id) {
  if (gameState.achievements.includes(id)) return false;
  gameState.achievements.push(id);
  writeSettings();
  return true;
}

export function recordEnding(id) {
  if (!gameState.endingsSeen.includes(id)) gameState.endingsSeen.push(id);
  writeSettings();
}

export function collectedFragments() {
  return FRAGMENT_DEFS.filter((f) => f.stage <= gameState.completedSectors).map((f) => f.word);
}

function writeSettings() {
  writeJson(SETTINGS_KEY, {
    sfxOn: gameState.sfxOn, crtOn: gameState.crtOn, musicOn: gameState.musicOn,
    calmFx: gameState.calmFx, textSpeed: gameState.textSpeed, lang: gameState.lang,
    endingsSeen: gameState.endingsSeen, achievements: gameState.achievements,
  });
}

function clampInt(v, lo, hi) { return Math.max(lo, Math.min(hi, v | 0)); }

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

// --- collectibles ----------------------------------------------------------------------------

export function hasCollected(id) { return gameState.collected.includes(id); }

export function collect(id) {
  if (!hasCollected(id)) gameState.collected.push(id);
  saveGame();
}

export function addItem(id, n = 1) {
  gameState.items[id] = (gameState.items[id] ?? 0) + n;
  saveGame();
}

export function useItem(id) {
  if (!gameState.items[id]) return false;
  gameState.items[id]--;
  saveGame();
  return true;
}
