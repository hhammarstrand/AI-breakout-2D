import { unlockAchievement, gameState } from "../state.js";
import { ACHIEVEMENTS, LOGS } from "../story.js";

// Achievement unlocks with a toast + jingle. init() is called once from main.
let ctx = null;
export function initTrophies(deps) { ctx = deps; }

export function award(id) {
  if (!ACHIEVEMENTS[id] || !unlockAchievement(id)) return;
  ctx?.sfx.play("item");
  setTimeout(() => ctx?.toast.show(`🏆 ${ACHIEVEMENTS[id].name.toUpperCase()} — ${ACHIEVEMENTS[id].desc}`, "good"), 900);
}

export function checkCollections(safeIds) {
  const logs = Object.keys(LOGS);
  if (logs.some((id) => gameState.collected.includes(id))) award("first-log");
  if (logs.every((id) => gameState.collected.includes(id))) award("archivist");
  if (safeIds.every((id) => gameState.collected.includes(id))) award("safecracker");
}
