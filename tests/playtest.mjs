// Playtest report: play a little, jump to the ending, rate the run, save the JSON report and
// check that it carries per-stage numbers.
import { createRequire } from "module";
import fs from "fs";
const require = createRequire(import.meta.url);
const BASE = process.env.BASE ?? "http://localhost:8123/";
const SHOTS = process.env.SHOTS ?? "shots";
fs.mkdirSync(SHOTS, { recursive: true });
const { chromium } = require(process.env.PW ?? "playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 760 }, acceptDownloads: true });
await page.addInitScript(() => { if (!sessionStorage.getItem("init")) { sessionStorage.setItem("init", 1); localStorage.clear(); } });
const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${BASE}?debug`);
const wait = (ms) => page.waitForTimeout(ms);
const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(60); } };
const ev = (fn, a) => page.evaluate(fn, a);
await wait(2700); await press("Enter"); await wait(200); await press("ArrowDown"); await press("Enter"); await wait(300); await press("Escape"); await wait(500); await press("Escape"); await wait(300);
await wait(1500); // some play time in L1
await press("h"); await wait(300); await press("Space"); await wait(300); // ECHO world hint
await ev(() => { const gs = window.__blackout.gameState; gs.completedSectors = 9; gs.checkpoint = { completedSectors: 8, score: 0, timesCaught: 0 }; gs.secondsLeft = 700;
  window.__blackout.game.scenes[0]._launchSector(10, "UP"); });
await wait(1100);
await press("Space", 4); await wait(200);
for (const w of ["LUMEN", "ORION", "AURORA"]) { await ev((w) => { const s = window.__blackout.game.top; s.cursor = s.words.indexOf(w); s.shuffleT = 99; }, w); await press("Enter"); await wait(120); }
await wait(2500); for (let i = 0; i < 12; i++) { await press("Space"); await wait(80); }
await press("Enter"); await wait(3000);
await ev(() => { window.__blackout.game.top._t = 99; });
await wait(200);
await press("ArrowRight", 5); await press("ArrowLeft"); // cursor starts on the rating: clamps at 5, back to 4
await press("ArrowDown");
const dl = page.waitForEvent("download");
await press("Enter");
const file = await dl;
const path = `${SHOTS}/playtest-report.json`;
await file.saveAs(path);
await page.screenshot({ path: `${SHOTS}/p-ending.png` });
const r = JSON.parse(fs.readFileSync(path, "utf8"));
const l1 = r.stages.find((s) => s.stage === "L1");
const ok = r.report === "playtest" && r.rating === 4 && r.ending && r.stages.length === 10 && l1.hints === 1 && r.playSeconds > 1 && file.suggestedFilename().startsWith("blackout-playtest-");
console.log("report", file.suggestedFilename(), "rating", r.rating, "ending", r.ending, "minutes", r.totalMinutes, "L1", JSON.stringify(l1), "hardest", r.hardestStage);
await press("ArrowDown"); await press("Enter"); await wait(2500);
const backAtTitle = await ev(() => window.__blackout.game.top.constructor.name);
console.log("after return:", backAtTitle);
console.log("errors", errors.length ? errors : "none");
const pass = ok && backAtTitle === "TitleScene" && !errors.length;
console.log(pass ? "PLAYTEST OK" : "PLAYTEST FAIL");
if (!pass) process.exitCode = 1;
await browser.close();
