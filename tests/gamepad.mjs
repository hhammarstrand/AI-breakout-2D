import { createRequire } from "module";
import fs from "fs";
const require = createRequire(import.meta.url);
const BASE = process.env.BASE ?? "http://localhost:8123/";
const { chromium } = require(process.env.PW ?? "playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
// a fake standard-mapping gamepad whose buttons the test flips through window.__pad
await page.addInitScript(() => {
  localStorage.setItem("blackout2d.settings.v1", JSON.stringify({ sfxOn: true, crtOn: false, musicOn: true }));
  window.__pad = { buttons: Array.from({ length: 17 }, () => ({ pressed: false })), axes: [0, 0, 0, 0] };
  navigator.getGamepads = () => [window.__pad];
});
const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${BASE}?debug`);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, a) => page.evaluate(fn, a);
const tapBtn = async (i, ms = 90) => { await ev((i) => { window.__pad.buttons[i].pressed = true; }, i); await wait(ms); await ev((i) => { window.__pad.buttons[i].pressed = false; }, i); await wait(120); };
await wait(2700);
await tapBtn(9); await tapBtn(9);                 // START: new game -> NORMAL
await tapBtn(8); await wait(400);                 // SELECT: skip intro
await tapBtn(1); await wait(300);                 // B: close dialog
console.log("in world", await ev(() => window.__blackout.game.top.constructor.name));
const before = await ev(() => window.__blackout.game.scenes[0].player.col);
await ev(() => { window.__pad.axes[0] = -1; }); await wait(700); await ev(() => { window.__pad.axes[0] = 0; }); await wait(300);
console.log("stick left moved", before, "->", await ev(() => window.__blackout.game.scenes[0].player.col));
await tapBtn(9); await wait(200);
console.log("START opens", await ev(() => window.__blackout.game.top.constructor.name));
await tapBtn(1); await wait(200);
// calm fx: flashes must not trigger
await ev(() => { window.__blackout.gameState.calmFx = true; });
await ev(() => window.__blackout.game.scenes[0].fx.flash("#ff0000"));
console.log("calm flash suppressed", await ev(() => !document.getElementById("flash").classList.contains("on")));
console.log("errors", JSON.stringify(errors));
await browser.close();
