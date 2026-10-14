// Shared Playwright harness for the regression tests: seeded storage, key helpers and real checks
// that set a non-zero exit code on failure.
import { createRequire } from "module";
import fs from "fs";

const require = createRequire(import.meta.url);
export const BASE = process.env.BASE ?? "http://localhost:8123/";
export const SHOTS = process.env.SHOTS ?? "shots";
fs.mkdirSync(SHOTS, { recursive: true });
const { chromium } = require(process.env.PW ?? "playwright");

let failures = 0;
export function check(ok, what, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}${detail ? `  (${detail})` : ""}`);
  if (!ok) { failures++; process.exitCode = 1; }
}
export function summary(name) {
  console.log(failures ? `${name}: ${failures} FAILED` : `${name}: all checks passed`);
}

// opts.save seeds blackout2d.save.v1 on the first load only, so reloads keep what the game wrote.
export async function open(opts = {}) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 }, acceptDownloads: true });
  const settings = opts.settings ?? { sfxOn: false, crtOn: false, musicOn: false, lang: "en" };
  await page.addInitScript(({ save, settings }) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.clear();
    localStorage.setItem("blackout2d.settings.v1", JSON.stringify(settings));
    if (save) localStorage.setItem("blackout2d.save.v1", JSON.stringify(save));
  }, { save: opts.save ?? null, settings });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}?debug`);
  const wait = (ms) => page.waitForTimeout(ms);
  const press = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(60); } };
  const ev = (fn, a) => page.evaluate(fn, a);
  const stack = () => ev(() => window.__blackout.game.scenes.map((s) => s.constructor.name).join(">"));
  const state = () => ev(() => JSON.parse(JSON.stringify(window.__blackout.gameState)));
  const disk = () => ev(() => JSON.parse(localStorage.getItem("blackout2d.save.v1")));
  // past the boot screen, then the first title entry (CONTINUE when a save exists)
  const title = async () => { await wait(2700); await press("Enter"); await wait(900); };
  const reload = async () => { await page.reload(); await title(); };
  return { browser, page, errors, wait, press, ev, stack, state, disk, title, reload };
}

// Plays the uplink through: HALCYON's speeches, the three locks (the LUMEN feed and ORION key are
// read from the scene, the AURORA program is typed in), the deal, then ending 0 (trust) or 1 (purge).
export async function solveUplink({ ev, press, wait }, choice = 0) {
  const phase = () => ev(() => window.__blackout.game.top.phase);
  const talkUntil = async (want) => { for (let i = 0; i < 40 && (await phase()) !== want; i++) { await press("Space"); await wait(60); } await wait(500); };
  await talkUntil("lock");
  await ev(() => { const s = window.__blackout.game.top; s.cursor = s.feeds.findIndex((f) => f.who === "you"); });
  await press("Enter"); await wait(1900);
  await talkUntil("lock");
  await ev(() => { const s = window.__blackout.game.top; s.keys = [...s.key]; });
  await press("Enter"); await wait(1900);
  await talkUntil("lock");
  // AURORA: onto the plate (door shuts), off over the A gate on an odd step, back on (door opens)
  for (const k of ["ArrowRight", "ArrowDown", "ArrowUp", "ArrowDown", "ArrowRight", "ArrowRight"]) await press(k);
  await press("Enter");
  for (let i = 0; i < 100 && (await phase()) !== "deal"; i++) await wait(100);
  await talkUntil("choice");
  if (choice) await press("ArrowDown");
  await press("Enter"); await wait(3000);
}

// Real-input walking for the in-world floor puzzles: window.__fp.step(dir) takes exactly one grid
// step (or bumps), push(dir) leans on a canister until it slides, walkTo(c, r) paths around
// walls, people and canisters. Every step goes through the player's own input handling.
export async function floorHelpers(page) {
  await page.evaluate(() => {
    const g = window.__blackout.game;
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const until = async (fn, ms = 2000) => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > ms) return false; await frame(); } return true; };
    const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    window.__fp = {
      until,
      async step(d) {
        const w = g.scenes[0], p = w.player;
        await until(() => !p.target);
        p._face(d); p._turnHold = 0;
        g.input.press(d);
        await until(() => p.target || p.bumped, 600);
        g.input.release(d);
        await until(() => !p.target);
        await frame(); await frame();
        return [p.col, p.row];
      },
      async steps(str) {
        const map = { U: "up", D: "down", L: "left", R: "right" };
        for (const ch of str) await this.step(map[ch]);
      },
      async push(d) {
        const w = g.scenes[0], p = w.player, bay = w.puzzles.find((fp) => fp.cans);
        const snap = () => bay.cans.map((k) => `${k.c},${k.r}`).join(" ");
        const before = snap();
        await until(() => !p.target);
        p._face(d); p._turnHold = 0;
        g.input.press(d);
        const moved = await until(() => snap() !== before, 1500);
        g.input.release(d);
        await until(() => !p.target);
        await until(() => !bay._pending, 2000);
        return moved;
      },
      path(c, r) {
        const w = g.scenes[0], p = w.player;
        const start = `${p.col},${p.row}`, goal = `${c},${r}`;
        const prev = new Map([[start, null]]); const q = [[p.col, p.row]];
        while (q.length) {
          const [x, y] = q.shift();
          if (`${x},${y}` === goal) break;
          for (const [d, [dx, dy]] of Object.entries(D)) {
            const k = `${x + dx},${y + dy}`;
            if (prev.has(k) || w._blocked(x + dx, y + dy)) continue;
            prev.set(k, [`${x},${y}`, d]); q.push([x + dx, y + dy]);
          }
        }
        const out = []; let cur = goal;
        while (prev.get(cur)) { const [pk, d] = prev.get(cur); out.unshift(d); cur = pk; }
        return out;
      },
      async walkTo(c, r) { for (const d of this.path(c, r)) await this.step(d); const p = g.scenes[0].player; return p.col === c && p.row === r; },
    };
  });
}
