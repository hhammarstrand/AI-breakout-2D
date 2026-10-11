import { createRequire } from "module";
import fs from "fs";
const require = createRequire(import.meta.url);
const BASE = process.env.BASE ?? "http://localhost:8123/";
const SHOTS = process.env.SHOTS ?? "shots";
fs.mkdirSync(SHOTS, { recursive: true });
const { chromium } = require(process.env.PW ?? "playwright");
const KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Enter", "Escape", "Backspace", "Tab", "h", "f", "Shift", "q", "e", "m"];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
await page.addInitScript(() => localStorage.setItem("blackout2d.settings.v1", JSON.stringify({ sfxOn: true, crtOn: false, musicOn: true })));
const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("swiftshader")) errors.push(m.text()); });
await page.goto(`${BASE}?debug`);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, a) => page.evaluate(fn, a);
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const seen = new Map();
await wait(2700);
// stages to visit: jump straight into each scene type and mash keys there
const STAGES = [1, 2, 3, 5, 6, 7, 9, 10];
await page.keyboard.press("Enter"); await wait(100); await page.keyboard.press("Enter"); await wait(300); await page.keyboard.press("Escape"); await wait(500);
const SAFE_KEYS = KEYS.filter((k) => !["Escape", "Tab", "q"].includes(k));
const mash = async (n, keys = KEYS) => {
  for (let i = 0; i < n; i++) {
    const k = keys[Math.floor(rnd() * keys.length)];
    if (rnd() < 0.3) { await page.keyboard.down(k); await wait(30 + rnd() * 400); await page.keyboard.up(k); }
    else { await page.keyboard.press(k); await wait(20 + rnd() * 60); }
    const top = await ev(() => window.__blackout.game.top?.constructor.name);
    seen.set(top, (seen.get(top) ?? 0) + 1);
  }
};
await mash(150);   // world, menus, dialogs
const enterWorld = async () => {
  if (await ev(() => window.__blackout.game.scenes[0].constructor.name) === "WorldScene") return;
  await ev(() => { const g = window.__blackout.game; while (g.scenes.length > 1) g.pop(); });
  for (let i = 0; i < 6 && (await ev(() => window.__blackout.game.scenes[0].constructor.name)) !== "WorldScene"; i++) {
    await page.keyboard.press("Escape"); await wait(200); await page.keyboard.press("Enter"); await wait(200); await page.keyboard.press("Enter"); await wait(300); await page.keyboard.press("Escape"); await wait(400);
  }
};
for (const st of STAGES) {
  await enterWorld();
  await ev((st) => { const g = window.__blackout.game; while (g.scenes.length > 1) g.pop(); const w = g.scenes[0];
    window.__blackout.gameState.completedSectors = st - 1; w._iris = null; w._launchSector(st, "F"); }, st);
  await wait(900);
  await mash(100, SAFE_KEYS);
}
// the lobby safe's combination dial
await enterWorld();
await ev(() => { const g = window.__blackout.game; while (g.scenes.length > 1) g.pop(); const w = g.scenes[0]; w._iris = null; w.dialog.close(); w._useSafe(); });
await wait(300);
await mash(100, SAFE_KEYS.filter((k) => k !== "Backspace")); // Backspace would just leave the dial
// battles: trigger repeatedly and mash
for (let b = 0; b < 3; b++) {
  await enterWorld();
  await ev(() => { const g = window.__blackout.game; while (g.scenes.length > 1) g.pop(); const w = g.scenes[0]; w._iris = null; w.dialog.close();
    const s = w.sentinels[0]; if (s) w._startBattle(s); });
  await wait(300);
  await mash(90, SAFE_KEYS);
}
console.log("scenes exercised:", JSON.stringify(Object.fromEntries(seen)));
console.log("errors:", errors.length, JSON.stringify(errors.slice(0, 5)));
await browser.close();
