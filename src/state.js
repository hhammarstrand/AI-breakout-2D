import { STAGES, ACTS, FRAGMENTS as FRAGMENT_DEFS, CELL_BONUS, CAUGHT_TIME_PENALTY, CAUGHT_SCORE_PENALTY } from "./story.js";

const TOTAL_SECTORS = STAGES.length;

// The uplink override code words, in order.
export const FRAGMENTS = FRAGMENT_DEFS.map((f) => f.word);
const SAVE_KEY = "blackout2d.save.v1";
const SETTINGS_KEY = "blackout2d.settings.v1";

// Private modes and locked-down browsers can refuse storage; the title tells the player.
export const storageOk = (() => {
  try { localStorage.setItem("blackout2d.probe", "1"); localStorage.removeItem("blackout2d.probe"); return true; } catch { return false; }
})();
const SETTINGS = (() => { const v = readJson(SETTINGS_KEY); return v && typeof v === "object" ? v : {}; })();
const bool = (v, dflt) => (typeof v === "boolean" ? v : dflt);
const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

export const gameState = {
  totalSectors: TOTAL_SECTORS,
  completedSectors: 0,
  score: 0,
  secondsLeft: ACTS[1].seconds,
  timesCaught: 0,
  everCaught: 0, // whole run, never rolled back by a checkpoint
  pendingCatch: false, // spotted, battle not won yet
  timesSpotted: 0, // sentinel encounters; a retry rolls it back with the act (Ghost)
  everSpotted: 0, // encounters over the whole run (Untouchable, the ending stats)
  checkpoint: null,
  collected: [],
  items: {},
  telemetry: null,
  pos: null,
  parts: {},
  heard: [], // NPCs and signs the player has read, so puzzles can show what they were told
  echoSaid: [], // one-off ECHO barks and radio calls already played this run
  difficulty: "normal",
  endingsSeen: strings(SETTINGS.endingsSeen),
  achievements: strings(SETTINGS.achievements),
  sfxOn: bool(SETTINGS.sfxOn, true),
  // off by default: the bloom used to wash out the light UI panels, and software GL can't keep up
  crtOn: bool(SETTINGS.crtOn, false),
  musicOn: bool(SETTINGS.musicOn, true),
  calmFx: bool(SETTINGS.calmFx, false),
  textSpeed: ["slow", "normal", "fast"].includes(SETTINGS.textSpeed) ? SETTINGS.textSpeed : "normal",
  lang: ["en", "sv"].includes(SETTINGS.lang) ? SETTINGS.lang : (navigator.language?.toLowerCase().startsWith("sv") ? "sv" : "en"),
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

// two pickups and a safe per floor, plus the three floor-puzzle rooms; cells carry across acts
const MAX_CELLS = 12;

export function difficulty() { return DIFFICULTY[gameState.difficulty] ?? DIFFICULTY.normal; }

export function actSeconds(act = currentAct()) { return Math.round(ACTS[act].seconds * difficulty().time); }

export function scaledPenalty(seconds) { return Math.round(seconds * difficulty().penalty); }

let onPenalty = null;
export function setPenaltyListener(fn) { onPenalty = fn; }

// Mistakes cost time, scaled by difficulty; never ends the game by itself. Saved at once so a
// reload can't undo it. kind: "puzzle" for a wrong answer, "caught" for a lost sentinel battle.
export function penalize(seconds, kind = "puzzle") {
  const cost = Math.round(seconds * difficulty().penalty);
  onPenalty?.(kind);
  gameState.secondsLeft = Math.max(1, gameState.secondsLeft - cost);
  saveGame();
  return cost;
}

// Called as soon as an act begins (new game, or stepping into the lift): refill the clock and
// remember where to restart. Runs before the lift ride so a reload mid-ride lands in the new act.
export function startAct() {
  gameState.secondsLeft = actSeconds();
  gameState.pos = null;
  gameState.parts = {};
  gameState.checkpoint = {
    completedSectors: gameState.completedSectors,
    score: gameState.score,
    timesCaught: gameState.timesCaught,
    timesSpotted: gameState.timesSpotted,
    collected: [...gameState.collected],
    items: { ...gameState.items },
  };
  saveGame();
}

// Ghost: no sentinel spotted the player since this act's checkpoint
export function actUnspotted() {
  const cp = gameState.checkpoint;
  return !!cp && gameState.timesSpotted === (Number(cp.timesSpotted ?? cp.timesCaught) || 0);
}

export function restoreCheckpoint() {
  const cp = gameState.checkpoint;
  if (!cp) return false;
  gameState.completedSectors = cp.completedSectors;
  gameState.score = cp.score;
  gameState.timesCaught = cp.timesCaught;
  gameState.timesSpotted = Number(cp.timesSpotted ?? cp.timesCaught) || 0;
  if (Array.isArray(cp.collected)) gameState.collected = [...cp.collected];
  if (cp.items && typeof cp.items === "object") gameState.items = { ...cp.items };
  gameState.secondsLeft = actSeconds();
  gameState.pos = null;
  gameState.parts = {};
  gameState.pendingCatch = false;
  partSource = null;
  saveGame();
  return true;
}

// Running out of time costs the stage in hand, not the act: stages cleared since the lift stay
// cleared, and so do pickups and catches. The clock refills to the remaining stages' share of the
// act plus some slack, since whoever timed out is slower than par (never more than the full act).
const RETRY_SLACK = 1.25;
const RETRY_MIN = 180;

export function stageRetrySeconds() {
  const act = currentAct();
  const stages = STAGES.filter((s) => s.act === act && !s.lift);
  const left = stages.filter((s) => s.id > gameState.completedSectors).length;
  const full = actSeconds(act);
  return Math.round(Math.min(full, Math.max(RETRY_MIN * difficulty().time, (full * left * RETRY_SLACK) / stages.length)));
}

// True when a stage retry keeps something a full act restart would throw away.
export function clearedThisAct() {
  return Math.max(0, gameState.completedSectors - (gameState.checkpoint?.completedSectors ?? gameState.completedSectors));
}

export function retryStage() {
  gameState.secondsLeft = stageRetrySeconds();
  gameState.pos = null;
  gameState.parts = {};
  gameState.pendingCatch = false;
  partSource = null;
  saveGame();
}

function actOf(completed) { return STAGES[Math.min(completed, STAGES.length - 1)].act; }

export function resetGame() {
  gameState.completedSectors = 0;
  gameState.score = 0;
  gameState.timesCaught = 0;
  gameState.everCaught = 0;
  gameState.timesSpotted = 0;
  gameState.everSpotted = 0;
  gameState.pendingCatch = false;
  gameState.checkpoint = null;
  gameState.difficulty = "normal";
  gameState.collected = [];
  gameState.items = {};
  gameState.telemetry = null;
  gameState.pos = null;
  gameState.parts = {};
  gameState.heard = [];
  gameState.echoSaid = [];
  clearSave();
}

export function hasSave() {
  const save = readJson(SAVE_KEY);
  return !!save && (save.secondsLeft > 0 || !!save.checkpoint);
}

// A save that can't be read (hand-edited, half-written, older schema) starts a clean slate
// instead of throwing on the title screen. Returns false if there was nothing usable.
export function loadGame() {
  const save = readJson(SAVE_KEY);
  if (!save || typeof save !== "object") return false;
  try {
    applySave(save);
    return true;
  } catch (err) {
    console.warn("unreadable save, starting over", err);
    resetGame();
    return false;
  }
}

function applySave(save) {
  gameState.completedSectors = clampInt(save.completedSectors, 0, TOTAL_SECTORS);
  gameState.score = Number(save.score) || 0;
  gameState.timesCaught = Number(save.timesCaught) || 0;
  gameState.everCaught = Math.max(Number(save.everCaught) || 0, gameState.timesCaught);
  // every catch began with being spotted, so older saves still count those
  gameState.timesSpotted = Math.max(Number(save.timesSpotted) || 0, gameState.timesCaught);
  gameState.everSpotted = Math.max(Number(save.everSpotted) || 0, gameState.everCaught, gameState.timesSpotted);
  gameState.checkpoint = validCheckpoint(save.checkpoint);
  gameState.difficulty = DIFFICULTY[save.difficulty] ? save.difficulty : "normal";
  gameState.collected = strings(save.collected);
  gameState.items = plainObject(save.items) ? save.items : {};
  gameState.telemetry = plainObject(save.telemetry) ? save.telemetry : null;
  gameState.pos = validPos(save.pos);
  gameState.parts = plainObject(save.parts) ? save.parts : {};
  gameState.heard = strings(save.heard);
  // no usable checkpoint: rebuild one at the start of the current act, so a game over still retries
  if (!gameState.checkpoint) {
    gameState.checkpoint = {
      completedSectors: Math.min(gameState.completedSectors, STAGES.findIndex((st) => st.act === currentAct())),
      score: gameState.score, timesCaught: gameState.timesCaught,
      collected: [...gameState.collected], items: { ...gameState.items },
    };
  }
  gameState.echoSaid = strings(save.echoSaid);
  // backup cells can push the clock past the act's full time, never past every cell in the game
  const secs = Number(save.secondsLeft);
  gameState.secondsLeft = Number.isFinite(secs) ? Math.max(0, Math.min(actSeconds() + MAX_CELLS * CELL_BONUS, secs)) : actSeconds();
  // reloading during an encounter or a battle doesn't dodge the catch
  gameState.pendingCatch = false;
  if (save.pendingCatch && gameState.secondsLeft > 0) {
    gameState.timesCaught++;
    gameState.everCaught++;
    gameState.score -= CAUGHT_SCORE_PENALTY;
    gameState.secondsLeft = Math.max(1, gameState.secondsLeft - Math.round(CAUGHT_TIME_PENALTY * difficulty().penalty));
    gameState.pos = null;
  }
  // an older save taken mid-lift still holds the previous act's clock and checkpoint
  if (gameState.checkpoint && actOf(gameState.checkpoint.completedSectors) !== currentAct()) startAct();
  else if (gameState.secondsLeft <= 0) retryStage(); // the game over already chose the retry point
  return true;
}

// the open puzzle reports its solved parts at every save, so a reload mid-puzzle keeps them
let partSource = null;
export function setPartSource(fn) { partSource = fn; }

// main.js shows a small save indicator; ok is false when the browser refused the write
let onSave = null;
export function setSaveListener(fn) { onSave = fn; }

export function saveGame() {
  partSource?.();
  const ok = writeJson(SAVE_KEY, {
    completedSectors: gameState.completedSectors,
    score: gameState.score,
    secondsLeft: gameState.secondsLeft,
    timesCaught: gameState.timesCaught,
    everCaught: gameState.everCaught,
    timesSpotted: gameState.timesSpotted,
    everSpotted: gameState.everSpotted,
    pendingCatch: gameState.pendingCatch,
    checkpoint: gameState.checkpoint,
    difficulty: gameState.difficulty,
    collected: gameState.collected,
    items: gameState.items,
    telemetry: gameState.telemetry,
    pos: gameState.pos,
    parts: gameState.parts,
    heard: gameState.heard,
    echoSaid: gameState.echoSaid,
  });
  onSave?.(ok);
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

const plainObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);

// a checkpoint missing its stage count would crash actOf(); anything else gets safe defaults
function validCheckpoint(cp) {
  if (!plainObject(cp) || !Number.isFinite(cp.completedSectors)) return null;
  return {
    completedSectors: clampInt(cp.completedSectors, 0, TOTAL_SECTORS),
    score: Number(cp.score) || 0,
    timesCaught: Number(cp.timesCaught) || 0,
    ...(Number.isFinite(cp.timesSpotted) ? { timesSpotted: cp.timesSpotted } : {}),
    collected: strings(cp.collected),
    items: plainObject(cp.items) ? cp.items : {},
  };
}

function validPos(pos) {
  if (!plainObject(pos) || typeof pos.map !== "string" || !Number.isInteger(pos.col) || !Number.isInteger(pos.row)) return null;
  return pos;
}

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; /* storage unavailable */ }
}

// --- collectibles ----------------------------------------------------------------------------

export function hasCollected(id) { return gameState.collected.includes(id); }

export function collect(id) {
  if (!hasCollected(id)) gameState.collected.push(id);
  saveGame();
}

// What the player has been told survives a checkpoint retry: you can't unhear a rule.
export function hear(id) {
  if (gameState.heard.includes(id)) return;
  gameState.heard.push(id);
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
