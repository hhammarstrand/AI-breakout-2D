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
