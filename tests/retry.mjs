import { createRequire } from "module";
import fs from "fs";
const require = createRequire(import.meta.url);
const BASE = process.env.BASE ?? "http://localhost:8123/";
const SHOTS = process.env.SHOTS ?? "shots";
fs.mkdirSync(SHOTS, { recursive: true });
const { chromium } = require(process.env.PW ?? "playwright");
// solver output for the three coolant bays
const paths = ["RRULULLDD", "LLLULDDDUURRRRRDDDLUURULLLLULD", "RUULRDDLLLLLLUURRUURRDDDURRDDLLLL"];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
await page.addInitScript(() => {
  localStorage.setItem("blackout2d.settings.v1", JSON.stringify({ sfxOn: true, crtOn: false, musicOn: true }));
  localStorage.setItem("blackout2d.save.v1", JSON.stringify({ completedSectors: 6, score: 125, secondsLeft: 900, timesCaught: 0,
    checkpoint: { completedSectors: 4, score: 75, timesCaught: 0 } }));
});
const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${BASE}?debug`);
const wait = (ms) => page.waitForTimeout(ms);
const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(45); } };
const ev = (fn, a) => page.evaluate(fn, a);
await wait(2700); await press("Enter"); await wait(800); // CONTINUE
console.log("continued", await ev(() => window.__blackout.game.scenes[0].map.id), await ev(() => window.__blackout.gameState.completedSectors));
await ev(() => { const w = window.__blackout.game.scenes[0]; w.sentinels.length = 0; w._launchSector(7, "R3"); }); await wait(1000);
const key = { R: "ArrowRight", L: "ArrowLeft", U: "ArrowUp", D: "ArrowDown" };
for (let lv = 0; lv < 3; lv++) {
  for (const ch of paths[lv]) await press(key[ch]);
  console.log("bay", lv + 1, "done?", await ev(() => window.__blackout.game.top.done > 0 || window.__blackout.game.top.constructor.name));
  await wait(1900);
}
await press("Escape"); await wait(500);
await ev(() => window.__blackout.game.scenes[0].dialog.close()); // the clock is paused while a report is open
console.log("after R3", await ev(() => window.__blackout.gameState.completedSectors));
// force a game over and retry
await ev(() => { window.__blackout.gameState.secondsLeft = 0.2; }); await wait(1800);
console.log("gameover", await ev(() => window.__blackout.game.top.constructor.name));
await page.screenshot({ path: `${SHOTS}/c-13-gameover.png` });
await press("Enter"); await wait(1200);
console.log("retry", await ev(() => JSON.stringify({ map: window.__blackout.game.scenes[0].map.id, c: window.__blackout.gameState.completedSectors, t: Math.round(window.__blackout.gameState.secondsLeft) })));
const r = await ev(() => ({ c: window.__blackout.gameState.completedSectors, t: window.__blackout.gameState.secondsLeft }));
if (r.c !== 4 || r.t < 1100) { console.log("FAIL retry did not restore the act II checkpoint", r); process.exitCode = 1; }
console.log("errors", JSON.stringify(errors));
if (errors.length) process.exitCode = 1;
await browser.close();
