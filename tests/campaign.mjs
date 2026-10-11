import { createRequire } from "module";
import fs from "fs";
const require = createRequire(import.meta.url);
const BASE = process.env.BASE ?? "http://localhost:8123/";
const SHOTS = process.env.SHOTS ?? "shots";
fs.mkdirSync(SHOTS, { recursive: true });
const { chromium } = require(process.env.PW ?? "playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
const LANG = process.env.LANG_UNDER_TEST ?? "en";
await page.addInitScript((lang) => {
  localStorage.setItem("blackout2d.settings.v1", JSON.stringify({ sfxOn: true, crtOn: false, musicOn: true, lang }));
  // record every string drawn or shown so a run can report untranslated text
  window.__seen = new Set();
  const fill = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (s, ...a) { if (typeof s === "string" && s.length > 3) window.__seen.add(s); return fill.call(this, s, ...a); };
  new MutationObserver(() => {
    for (const sel of [".dialog-text", ".pa-text", ".toast", "#objective", ".dialog-speaker"]) document.querySelectorAll(sel).forEach((el) => el.textContent && window.__seen.add(el.textContent));
  }).observe(document, { subtree: true, childList: true, characterData: true });
}, LANG);
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("swiftshader")) errors.push(m.text()); });
await page.goto(`${BASE}?debug`);
const wait = (ms) => page.waitForTimeout(ms);
const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(55); } };
const ev = (fn, arg) => page.evaluate(fn, arg);
const shot = (n) => page.screenshot({ path: `${SHOTS}/c-${n}.png` });
const stack = () => ev(() => window.__blackout.game.scenes.map((s) => s.constructor.name).join(">"));
const state = () => ev(() => window.__blackout.gameState.completedSectors);
const world = () => "window.__blackout.game.scenes[0]";
const launch = async (n) => { await ev((n) => { const w = window.__blackout.game.scenes[0]; w.sentinels.forEach(s => s.cooldown = 9999); w._launchSector(n, "X"); }, n); await wait(1000); };
const closeDialog = async () => { await press("Escape"); await wait(400); };

await wait(2700); await press("Enter"); await wait(200); await press("Enter"); await wait(300); await press("Escape"); await wait(400); await wait(500); await closeDialog();
// --- Act 1 quick clear (solutions via state) ---
await launch(1);
const roles = await ev(() => window.__blackout.game.top.rooms.map((r) => r.role));
let cur = 0;
const move = async (to) => { const [fr, fc] = [Math.floor(cur / 3), cur % 3], [tr, tc] = [Math.floor(to / 3), to % 3];
  await press(tr > fr ? "ArrowDown" : "ArrowUp", Math.abs(tr - fr)); await press(tc > fc ? "ArrowRight" : "ArrowLeft", Math.abs(tc - fc)); cur = to; };
for (let i = 0; i < 6; i++) { if (roles[i] === "hostile") { await move(i); await press("Space"); } if (roles[i] === "survivor") { await move(i); await press("Space", 2); } }
await press("Enter"); await wait(1200); await closeDialog();
await launch(2);
for (const k of [3, 11, 19]) { const r = await ev(() => window.__blackout.game.top.rotation); await press(k > r ? "ArrowRight" : "ArrowLeft", Math.abs(k - r)); await press("Enter"); await wait(1700); }
await wait(600); await closeDialog();
await launch(3);
const keyOf = { R: "ArrowRight", L: "ArrowLeft", U: "ArrowUp", D: "ArrowDown", W: "Space" };
// L3's four levels, typed for real (shortest queues: 11, 20, 18 and 24 commands)
for (const sol of ["RRDDRWRDRRU", "RRRRWRRDDDDLLLWLLLUU", "RRLRRRRRLLLLRDDLLL", "RWRRLRWRRRRLLLLRRDDLLLLL"]) { for (const ch of sol) await press(keyOf[ch]); await press("Enter"); await wait(sol.length * 320 + 2200); }
await wait(400); await closeDialog();
console.log("act1 done", await state(), await stack());
await shot("01-lobby-lift");
// --- lift ---
await ev(() => { const w = window.__blackout.game.scenes[0]; w.sentinels.length = 0; const p = w.player; p.x = 41 * 16 + 2; p.y = 1 * 16 + 1; p.facing = "up"; });
await wait(200); await press("e"); await wait(2500);
console.log("lift", await stack());
await shot("02-elevator");
await press("Space"); await wait(1500);
console.log("act2", await stack(), await ev(() => JSON.stringify({ c: window.__blackout.gameState.completedSectors, t: Math.round(window.__blackout.gameState.secondsLeft), cp: window.__blackout.gameState.checkpoint })));
await ev(() => { const w = window.__blackout.game.scenes[0]; w._iris = null; w.lighting.render = () => {}; });
await wait(400); await shot("03-research-nolight");
await ev(() => { const w = window.__blackout.game.scenes[0]; delete w.lighting.render; });
await wait(300); await shot("04-research");
// talk to Kofi
await ev(() => { const w = window.__blackout.game.scenes[0]; w.sentinels.forEach(s => s.cooldown = 9999); const p = w.player; p.x = 5 * 16 + 2; p.y = 22 * 16 + 1; p.facing = "left"; });
await wait(300); await press("e"); await wait(900); await shot("05-kofi"); await closeDialog();
// R1 power
await launch(5); await shot("06-r1");
for (let b = 0; b < 3; b++) {
  await ev(() => { const s = window.__blackout.game.top; const cells = s.board.cells;
    for (const c of cells) c.mask = c.solved;
    const t = cells.find((c) => !c.bolted && c.solved !== 15 && c.solved !== 0 && c.solved !== 5 && c.solved !== 10);
    t.mask = ((t.solved >> 1) | ((t.solved & 1) << 3)) & 15; s.cursor = { x: t.x, y: t.y }; s.lit = s._flood(); });
  if (b === 2) await shot("07-r1-almost");
  await press("Space"); await wait(2000);
}
await wait(400); await closeDialog();
// R2 signal
await launch(6); await wait(300); await shot("08-r2");
await press("Enter"); await wait(300); await shot("09-r2-wrong");
for (let r = 0; r < 3; r++) { await ev(() => { const s = window.__blackout.game.top; s.mine = { ...s.target }; }); await press("Enter"); await wait(1900); }
await wait(400); await closeDialog();
// R3 coolant: play level 1 for real, then shortcut the rest
await launch(7); await shot("10-r3");
console.log("r3 boxes", await ev(() => [...window.__blackout.game.top.boxes].join(" ")));
for (let l = 0; l < 3; l++) { await ev(() => { const s = window.__blackout.game.top; s.boxes = new Set(s.goals); s.done = 1.0; }); await wait(1300); }
await wait(400); await closeDialog();
console.log("act2 cleared", await state(), await ev(() => document.getElementById("hud-code-value").textContent));
// core lift
await ev(() => { const w = window.__blackout.game.scenes[0]; w.sentinels.length = 0; const p = w.player; p.x = 35 * 16 + 2; p.y = 1 * 16 + 1; p.facing = "up"; });
await wait(200); await press("e"); await wait(2500); await press("Space"); await wait(1500);
console.log("act3", await stack(), await ev(() => Math.round(window.__blackout.gameState.secondsLeft)));
await ev(() => { const w = window.__blackout.game.scenes[0]; w._iris = null; });
await wait(500); await shot("11-core");
// C1 firewall: start, survive a bit, then fast-forward
await launch(9); await press("Space"); await wait(2500); await shot("12-firewall");
await ev(() => { window.__blackout.game.top.elapsed = 54.9; window.__blackout.game.top.hp = 3; });
await wait(2600); await closeDialog();
console.log("after C1", await state());
// uplink
await launch(10); await press("Space", 4); await wait(800); // the code list ignores keys for a moment after the speech
for (const w of ["LUMEN", "ORION", "AURORA"]) { await ev((w) => { const s = window.__blackout.game.top; s.cursor = s.words.indexOf(w); s.shuffleT = 99; }, w); await press("Enter"); await wait(120); }
await wait(2500); for (let i = 0; i < 12; i++) { await press("Space"); await wait(80); }
await press("Enter"); await wait(3000);
const finalStack = await stack(), finalCleared = await state();
console.log("final", finalStack, finalCleared);
if (!/EndingScene/.test(finalStack) || finalCleared !== 10) { console.log("FAIL campaign did not reach the ending"); process.exitCode = 1; }
// game over + retry path
await ev(() => { localStorage.clear(); });
if (process.env.SEEN_OUT) fs.writeFileSync(process.env.SEEN_OUT, JSON.stringify(await ev(() => [...window.__seen]), null, 1));
console.log("errors", JSON.stringify(errors));
if (errors.length) process.exitCode = 1;
await browser.close();
