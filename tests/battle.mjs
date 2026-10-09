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
await wait(2700); await press("Enter"); await wait(200); await press("Enter"); await wait(300); await press("Escape"); await wait(400); await wait(400); await press("Escape"); await wait(300);
// put a sentinel right next to the player facing it
await ev(() => { const w = window.__blackout.game.scenes[0]; const s = w.sentinels[1]; const p = w.player;
  s.x = p.centerX + 30; s.y = p.centerY; s.angle = Math.PI; s.waitT = 99; s.baseAngle = Math.PI; });
await wait(400); await page.screenshot({ path: `${SHOTS}/b-0-spot.png` });
let top = "";
for (let i = 0; i < 40 && top !== "BattleScene"; i++) { await wait(100); top = await ev(() => window.__blackout.game.top.constructor.name); }
await wait(1500); await page.screenshot({ path: `${SHOTS}/b-1-intro.png` });
// play: smart-ish policy — spoof when bolt is coming, patch when low, else ping/overload
let turns = 0;
for (let i = 0; i < 200; i++) {
  const st = await ev(() => { const b = window.__blackout.game.top; if (b.constructor.name !== "BattleScene") return null;
    return { phase: b.phase, text: !!b.text, intent: b.intent.name, hp: b.me.hp, cd: b.cooldowns, cursor: b.cursor }; });
  if (!st) break;
  if (st.text || st.phase !== "choose") { await press("Space"); continue; }
  let want = 0;
  if (st.intent === "PURGE BOLT" && !(st.cd.spoof > 0)) want = 1;
  else if (st.hp < 40 && !(st.cd.patch > 0)) want = 3;
  else if (!(st.cd.overload > 0) && st.hp > 30) want = 2;
  if (turns === 1) await page.screenshot({ path: `${SHOTS}/b-2-moves.png` });
  await ev((c) => { window.__blackout.game.top.cursor = c; }, want);
  await press("Space"); turns++;
}
await wait(500);
console.log("turns", turns, "after battle top:", await ev(() => window.__blackout.game.top.constructor.name),
  "sentinel cooldown", await ev(() => Math.round(window.__blackout.game.scenes[0].sentinels[1].cooldown)),
  "caught", await ev(() => window.__blackout.gameState.timesCaught));
console.log("errors", JSON.stringify(errors));
await browser.close();
