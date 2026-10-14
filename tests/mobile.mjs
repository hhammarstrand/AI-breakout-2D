import { createRequire } from "module";
import fs from "fs";
const require = createRequire(import.meta.url);
const BASE = process.env.BASE ?? "http://localhost:8123/";
const SHOTS = process.env.SHOTS ?? "shots";
fs.mkdirSync(SHOTS, { recursive: true });
const { chromium, devices } = require(process.env.PW ?? "playwright");
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["Pixel 7 landscape"] });
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem("blackout2d.settings.v1", JSON.stringify({ sfxOn: true, crtOn: false, musicOn: true })));
const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${BASE}?debug`);
const wait = (ms) => page.waitForTimeout(ms);
const tap = async (sel, ms = 80) => { const b = await page.$(sel); const box = await b.boundingBox(); await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); await wait(ms); };
await wait(2800);
await tap(".t-a"); await wait(300); await tap(".t-a"); await wait(400); await tap(".t-select"); await wait(500);
await tap(".t-b"); await wait(400);   // close intro dialog
const before = await page.evaluate(() => { const p = window.__blackout.game.scenes[0].player; return `${p.col},${p.row},${p.facing}`; });
// hold the left button
const b = await (await page.$(".t-left")).boundingBox();
await page.dispatchEvent(".t-left", "pointerdown"); await wait(600); await page.dispatchEvent(".t-left", "pointerup");
await wait(300);
const after = await page.evaluate(() => { const p = window.__blackout.game.scenes[0].player; return `${p.col},${p.row},${p.facing}`; });
console.log("move via touch", before, "->", after);
await page.screenshot({ path: `${SHOTS}/m-mobile.png` });
await tap(".t-start"); await wait(300);
console.log("start opens", await page.evaluate(() => window.__blackout.game.top.constructor.name));
await page.screenshot({ path: `${SHOTS}/m-mobile-menu.png` });
// LIGHT toggles the flashlight, SPRINT latches run on and off
const lightBefore = await page.evaluate(() => window.__blackout.game.scenes[0].flashOn);
await tap(".t-b"); await tap(".t-light"); await wait(200);
const lightAfter = await page.evaluate(() => window.__blackout.game.scenes[0].flashOn);
console.log("light button toggles", lightBefore !== lightAfter);
await tap(".t-run");
const runOn = await page.evaluate(() => window.__blackout.game.input.isDown("run"));
await tap(".t-run");
const runOff = await page.evaluate(() => !window.__blackout.game.input.isDown("run"));
console.log("sprint latches", runOn && runOff);
let fail = lightBefore === lightAfter || !runOn || !runOff;

// upright phone: the dialog sits between the playfield and the buttons, never under them
for (const dev of ["iPhone 13", "iPhone 13 landscape"]) {
  const c2 = await browser.newContext({ ...devices[dev] });
  const p2 = await c2.newPage();
  await p2.addInitScript(() => localStorage.setItem("blackout2d.settings.v1", JSON.stringify({ sfxOn: false, crtOn: false, musicOn: false, lang: "en" })));
  await p2.goto(`${BASE}?debug`);
  await p2.waitForTimeout(2800);
  const t2 = async (sel) => { const bb = await (await p2.$(sel)).boundingBox(); await p2.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await p2.waitForTimeout(300); };
  await t2(".t-a"); await t2(".t-a"); await p2.waitForTimeout(300);
  await p2.evaluate(() => window.__blackout.game.top._finish?.()); await p2.waitForTimeout(1500);
  const rects = await p2.evaluate(() => Object.fromEntries(["#dialog", ".dpad", ".abtns", ".t-run", "#game"].map((s) => { const b = document.querySelector(s).getBoundingClientRect(); return [s, [b.left, b.top, b.right, b.bottom]]; })));
  const hit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  const clear = ![".dpad", ".abtns"].some((s) => hit(rects["#dialog"], rects[s]));
  const prompt = await p2.evaluate(() => document.querySelector(".dialog-text").textContent);
  await p2.screenshot({ path: `${SHOTS}/m-${dev.replace(/ /g, "-")}-dialog.png` });
  console.log(dev, "dialog clear of the buttons", clear, JSON.stringify(rects));
  if (!clear) fail = true;
  await t2("#dialog"); await t2("#dialog");
  const page2 = await p2.evaluate(() => document.querySelector(".dialog-page").textContent);
  console.log(dev, "tap on the dialog reads on", page2);
  if (page2 === "1/5") fail = true;
  await c2.close();
  void prompt;
}
console.log("errors", JSON.stringify(errors));
console.log(fail || errors.length ? "mobile: FAILED" : "mobile: all checks passed");
if (fail || errors.length) process.exitCode = 1;
await browser.close();
