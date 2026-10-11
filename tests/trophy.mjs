import { createRequire } from "module";
import fs from "fs";
import { solveUplink } from "./lib.mjs";
const require = createRequire(import.meta.url);
const BASE = process.env.BASE ?? "http://localhost:8123/";
const SHOTS = process.env.SHOTS ?? "shots";
fs.mkdirSync(SHOTS, { recursive: true });
const { chromium } = require(process.env.PW ?? "playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
await page.addInitScript(() => { if (!sessionStorage.getItem("init")) { sessionStorage.setItem("init", 1); localStorage.clear();
  localStorage.setItem("blackout2d.settings.v1", JSON.stringify({ sfxOn: true, crtOn: false, musicOn: true })); } });
const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${BASE}?debug`);
const wait = (ms) => page.waitForTimeout(ms);
const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(60); } };
const ev = (fn, a) => page.evaluate(fn, a);
await wait(2700); await press("Enter"); await wait(200); await press("ArrowDown"); await press("Enter"); await wait(300); await press("Escape"); await wait(500); await press("Escape"); await wait(300);
console.log("difficulty", await ev(() => window.__blackout.gameState.difficulty));
// log pickup
await ev(() => { const w = window.__blackout.game.scenes[0]; w.sentinels.length = 0; w.player.teleport(3, 23); w.player.facing = "left"; });
await press("e"); await wait(1500); await press("Escape");
// battle win
await ev(() => { const w = window.__blackout.game.scenes[0]; w.sentinels.length = 0; });
await ev(() => { const w = window.__blackout.game.scenes[0]; const S = w.constructor; });
console.log("trophies so far", await ev(() => JSON.stringify(window.__blackout.gameState.achievements)));
// jump to the end: pretend the whole run went cleanly and finish through the uplink
await ev(() => { const gs = window.__blackout.gameState; gs.completedSectors = 9; gs.checkpoint = { completedSectors: 8, score: 0, timesCaught: 0 }; gs.secondsLeft = 700;
  window.__blackout.game.scenes[0]._launchSector(10, "UP"); });
await wait(1100);
await solveUplink({ ev, press, wait });
console.log("trophies", await ev(() => JSON.stringify(window.__blackout.gameState.achievements)));
await wait(16000); await page.screenshot({ path: `${SHOTS}/t-ending.png` });
const got = await ev(() => window.__blackout.gameState.achievements);
if (!["dawn", "ghost", "speedrun", "veteran"].every((id) => got.includes(id))) { console.log("FAIL ending trophies", got); process.exitCode = 1; }
await press("ArrowUp"); await press("Enter"); await wait(2500); // RETURN TO TITLE
if (await ev(() => window.__blackout.game.top.constructor.name) !== "TitleScene") { console.log("FAIL not back at title"); process.exitCode = 1; }
await page.screenshot({ path: `${SHOTS}/t-title.png` });
await press("Enter"); await wait(200); await press("Enter"); await wait(300); await press("Escape"); await wait(500); await press("Escape"); await wait(300);
await press("Tab"); await wait(200); await press("ArrowDown", 3); await press("Space"); await wait(300);
await page.screenshot({ path: `${SHOTS}/t-menu.png` });
console.log("errors", JSON.stringify(errors));
if (errors.length) process.exitCode = 1;
await browser.close();
