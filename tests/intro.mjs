import { createRequire } from "module";
import fs from "fs";
const require = createRequire(import.meta.url);
const BASE = process.env.BASE ?? "http://localhost:8123/";
const SHOTS = process.env.SHOTS ?? "shots";
fs.mkdirSync(SHOTS, { recursive: true });
const { chromium } = require(process.env.PW ?? "playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
await page.addInitScript(() => localStorage.setItem("blackout2d.settings.v1", JSON.stringify({ sfxOn: true, crtOn: false, musicOn: true })));
const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${BASE}?debug`);
const wait = (ms) => page.waitForTimeout(ms);
const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(70); } };
const ev = (fn, a) => page.evaluate(fn, a);
await wait(2700); await press("Enter"); await wait(200);
await page.screenshot({ path: `${SHOTS}/i-0-difficulty.png` });
await press("ArrowUp"); await press("Enter"); await wait(300);   // STORY
console.log("scene", await ev(() => window.__blackout.game.top.constructor.name), "difficulty", await ev(() => window.__blackout.gameState.difficulty));
for (const [i, ms] of [[1, 3500], [2, 5200], [3, 5000], [4, 4200]]) { await wait(ms); await page.screenshot({ path: `${SHOTS}/i-${i}.png` }); }
await wait(6000);
console.log("after intro", await ev(() => window.__blackout.game.top.constructor.name), "act seconds", await ev(() => Math.round(window.__blackout.gameState.secondsLeft)));
await press("Escape"); await wait(300);
await ev(() => window.__blackout.game.scenes[0]._launchSector(2, "L2")); await wait(1100);
await press("h"); await wait(300); await press("Space"); await wait(200); await press("h"); await wait(300);
await page.screenshot({ path: `${SHOTS}/i-5-hint.png` });
console.log("hint scene", await ev(() => window.__blackout.game.top.constructor.name));
await press("Space"); await wait(200);
await press("Enter"); await wait(300); // wrong key -> penalty scaled
console.log("penalty msg", await ev(() => window.__blackout.game.top.message?.text));
console.log("errors", JSON.stringify(errors));
await browser.close();
