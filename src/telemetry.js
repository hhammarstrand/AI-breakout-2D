import { gameState, saveGame } from "./state.js";
import { STAGES } from "./story.js";

// Local-only playtest log. Nothing leaves the browser unless the player saves the report file
// from the ending screen and hands it over. Used to tune difficulty with real testers.
export function newRun() {
  gameState.telemetry = {
    version: 1,
    startedAt: new Date().toISOString(),
    difficulty: gameState.difficulty,
    lang: gameState.lang,
    stages: {},
    battles: { won: 0, lost: 0 },
    deaths: 0,
    caught: 0,
    cellsUsed: 0,
    playSeconds: 0,
  };
}

function tel() {
  if (!gameState.telemetry) newRun();
  return gameState.telemetry;
}

function stage(id = gameState.completedSectors + 1) {
  const s = tel().stages;
  return (s[id] ??= { attempts: 0, fails: 0, hints: 0, seconds: 0, cleared: false });
}

export const track = {
  tick(dt) { tel().playSeconds += dt; stage().seconds += dt; },
  enterStage() { stage().attempts++; },
  fail() { stage().fails++; },
  caught() { tel().caught = (tel().caught ?? 0) + 1; },
  hint() { stage().hints++; },
  cleared(id) { stage(id).cleared = true; saveGame(); },
  battle(won) { tel().battles[won ? "won" : "lost"]++; },
  gameOver() { tel().deaths++; },
  cellUsed() { tel().cellsUsed++; },
};

export function buildReport({ ending, rating }) {
  const t = tel();
  const stages = STAGES.map((s) => {
    const d = t.stages[s.id] ?? {};
    return {
      stage: s.label, name: s.name, act: s.act,
      minutes: +((d.seconds ?? 0) / 60).toFixed(1),
      attempts: d.attempts ?? 0, fails: d.fails ?? 0, hints: d.hints ?? 0, cleared: !!d.cleared,
    };
  });
  return {
    game: "BLACKOUT // Operation Lifeline",
    report: "playtest",
    ...t,
    finishedAt: new Date().toISOString(),
    ending,
    rating,
    totalMinutes: +(t.playSeconds / 60).toFixed(1),
    timesSpotted: gameState.timesCaught,
    score: gameState.score,
    logsFound: gameState.collected.filter((id) => id.startsWith("log-")).length,
    safesOpened: gameState.collected.filter((id) => id.startsWith("safe-")).length,
    trophies: gameState.achievements.length,
    stages,
    hardestStage: stages.reduce((a, b) => (b.minutes + b.fails * 2 > a.minutes + a.fails * 2 ? b : a)).stage,
  };
}

export function downloadReport(report) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `blackout-playtest-${report.finishedAt.slice(0, 16).replace(/[:T]/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
