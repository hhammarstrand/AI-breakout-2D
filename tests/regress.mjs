// Regression checks for save/checkpoint, timer and scene-stack bugs found in review.
// Exits non-zero if any check fails.
import { open, check, summary } from "./lib.mjs";

const fresh = (over = {}) => ({ completedSectors: 0, score: 0, secondsLeft: 900, timesCaught: 0, difficulty: "normal",
  checkpoint: { completedSectors: 0, score: 0, timesCaught: 0, collected: [], items: {} }, collected: [], items: {}, ...over });
const quiet = (p) => p.ev(() => { const w = window.__blackout.game.scenes[0]; w.sentinels.length = 0; w.dialog.close(); });

// 1. Reloading mid-lift lands in the new act with its full clock and checkpoint.
{
  const p = await open({ save: fresh({ completedSectors: 3, score: 75, secondsLeft: 300 }) });
  await p.title(); await quiet(p);
  await p.ev(() => { const pl = window.__blackout.game.scenes[0].player; pl.x = 41 * 16 + 2; pl.y = 1 * 16 + 1; pl.facing = "up"; });
  await p.wait(200); await p.press("e"); await p.wait(1500);
  check(/ElevatorScene/.test(await p.stack()), "lift ride started");
  await p.reload();
  const s = await p.state();
  const map = await p.ev(() => window.__blackout.game.scenes[0].map.id);
  check(map === "research" && s.completedSectors === 4, "reload mid-lift continues on the research floor", `${map} c=${s.completedSectors}`);
  check(s.secondsLeft > 1190, "reload mid-lift gets the act II clock", `t=${Math.round(s.secondsLeft)}`);
  check(s.checkpoint?.completedSectors === 4, "reload mid-lift has the act II checkpoint");
  await p.browser.close();
}

// 2. GAME OVER is final even if the player reloads instead of choosing RETRY.
{
  const p = await open({ save: fresh({ completedSectors: 6, score: 125, secondsLeft: 600,
    checkpoint: { completedSectors: 4, score: 75, timesCaught: 0, collected: [], items: {} } }) });
  await p.title(); await quiet(p);
  await p.ev(() => { window.__blackout.gameState.secondsLeft = 0.2; });
  await p.wait(1500);
  check(/GameOverScene/.test(await p.stack()), "running out of time shows GAME OVER", await p.stack());
  check((await p.disk()).completedSectors === 4, "the save on disk is already back at the checkpoint");
  await p.reload();
  const s = await p.state();
  check(s.completedSectors === 4 && s.score === 75, "reload after GAME OVER restarts the act", `c=${s.completedSectors} score=${s.score}`);
  await p.browser.close();
}

// 3. A used BACKUP CELL and a puzzle penalty both survive a reload.
{
  const p = await open({ save: fresh({ completedSectors: 1, score: 30, secondsLeft: 600, items: { cell: 1 } }) });
  await p.title(); await quiet(p);
  await p.press("Tab"); await p.wait(300); await p.press("Space"); await p.wait(200); await p.press("Space"); await p.wait(300);
  const d = await p.disk();
  check(d.items.cell === 0 && d.secondsLeft > 680, "cell use is saved together with its +90 s", `t=${Math.round(d.secondsLeft)}`);
  await p.reload();
  check((await p.state()).secondsLeft > 680, "cell bonus survives a reload");
  await quiet(p);
  await p.ev(() => window.__blackout.game.scenes[0]._launchSector(2, "L2")); await p.wait(1200);
  const before = (await p.state()).secondsLeft;
  await p.press("Enter"); await p.wait(300); // wrong decode with the key at 0
  const after = (await p.disk()).secondsLeft;
  check(before - after > 25, "a puzzle penalty is on disk at once", `${Math.round(before)} -> ${Math.round(after)}`);
  await p.browser.close();
}

// 4. Hints: H opens, H again shows the next hint in place, never stacks; H is ignored over a dialog.
{
  const p = await open({ save: fresh({ completedSectors: 1 }) });
  await p.title(); await quiet(p);
  await p.press("h"); await p.wait(300);
  await p.press("h"); await p.wait(300);
  check(await p.stack() === "WorldScene>HintScene", "a second H never stacks another overlay", await p.stack());
  check(await p.ev(() => window.__blackout.game.top.count) === 1, "the stronger hint waits for its cooldown");
  await p.ev(() => { window.__blackout.game.top.owner._hintAt -= 31000; });
  await p.press("h"); await p.wait(300);
  check(await p.ev(() => window.__blackout.game.top.count) === 2, "after the cooldown H shows the second hint in place");
  const t0 = (await p.state()).secondsLeft; await p.wait(1500);
  check(t0 - (await p.state()).secondsLeft > 1, "the clock keeps running under the hint overlay");
  await p.press("Escape"); await p.wait(300);
  await p.ev(() => { const w = window.__blackout.game.scenes[0]; w.player.teleport(27, 25); w.player.facing = "up"; });
  await p.press("e"); await p.wait(300); await p.press("h"); await p.wait(300);
  check(await p.stack() === "WorldScene", "H does nothing while a conversation is open", await p.stack());
  const t1 = (await p.state()).secondsLeft; await p.wait(1500);
  check(Math.abs(t1 - (await p.state()).secondsLeft) < 0.05, "the clock is paused while reading a conversation");
  await p.browser.close();
}

// 5. Submit and abort in the same frame can't empty the scene stack.
{
  const p = await open({ save: fresh() });
  await p.title(); await quiet(p);
  await p.ev(() => window.__blackout.game.scenes[0]._launchSector(1, "L1")); await p.wait(1200);
  await p.ev(() => {
    const s = window.__blackout.game.top;
    s.states = s.rooms.map((r) => (r.role === "survivor" ? "survivor" : r.role === "hostile" ? "hostile" : "none"));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  });
  await p.wait(800);
  check((await p.stack()).startsWith("WorldScene"), "the world survives Enter+Esc in one frame", await p.stack());
  await p.browser.close();
}

// 6. Retrying an act brings back the pickups taken during the failed attempt, with their points.
{
  const p = await open({ save: fresh({ completedSectors: 1, score: 30 }) });
  await p.title(); await quiet(p);
  await p.ev(() => { const w = window.__blackout.game.scenes[0]; w.player.teleport(3, 23); w.player.facing = "left"; });
  await p.press("e"); await p.wait(300); await quiet(p);
  check((await p.state()).collected.includes("log-intern"), "picked up the intern's log");
  await p.ev(() => { window.__blackout.gameState.secondsLeft = 0.2; }); await p.wait(1500);
  await p.press("Enter"); await p.wait(1200); // RETRY
  const s = await p.state();
  const back = await p.ev(() => window.__blackout.game.scenes[0].pickups.some((x) => x.id === "log-intern"));
  check(!s.collected.includes("log-intern") && back, "retry restores the capsule taken in the failed attempt");
  await p.browser.close();
}

// 7. CONTINUE returns the player to where they saved.
{
  const p = await open({ save: fresh({ completedSectors: 1 }) });
  await p.title(); await quiet(p);
  await p.ev(() => { const w = window.__blackout.game.scenes[0]; w.player.teleport(20, 20); });
  await p.wait(500);
  await p.press("Tab"); await p.wait(200);
  for (let i = 0; i < 5; i++) await p.press("ArrowDown"); // SAVE
  await p.press("Space"); await p.wait(300);
  await p.reload();
  const pos = await p.ev(() => { const pl = window.__blackout.game.scenes[0].player; return [pl.col, pl.row]; });
  check(pos[0] === 20 && pos[1] === 20, "CONTINUE resumes at the saved spot", pos.join(","));
  await p.browser.close();
}

// 8. Mashing through the epilogue doesn't skip the stats and rating.
{
  const p = await open({ save: fresh({ completedSectors: 9 }) });
  await p.title(); await quiet(p);
  await p.ev(() => window.__blackout.game.scenes[0].onEnding("dawn")); await p.wait(300);
  for (let i = 0; i < 12; i++) { await p.press("Space"); await p.wait(120); }
  check(/EndingScene/.test(await p.stack()), "still on the ending after mashing space", await p.stack());
  await p.browser.close();
}

// 9. Stepping out of a puzzle keeps the parts already solved.
{
  const p = await open({ save: fresh({ completedSectors: 6 }) });
  await p.title(); await quiet(p);
  await p.ev(() => window.__blackout.game.scenes[0]._launchSector(7, "R3")); await p.wait(1200);
  await p.ev(() => window.__blackout.game.top.resume(1));
  await p.press("Escape"); await p.wait(700); await quiet(p);
  await p.ev(() => window.__blackout.game.scenes[0]._launchSector(7, "R3")); await p.wait(1200);
  check(await p.ev(() => window.__blackout.game.top.level) === 1, "R3 reopens on the bay the player reached");
  await p.reload(); await quiet(p);
  await p.ev(() => window.__blackout.game.scenes[0]._launchSector(7, "R3")); await p.wait(1200);
  check(await p.ev(() => window.__blackout.game.top.level) === 1, "solved bays survive a reload");
  await p.browser.close();
}

// 10. R2: Space never transmits; carrier 2 names the slip; carrier 3 gives per-dial marks, drops the
// line after three refusals with a fully new answer, and keeps carriers 1-2 when the player steps out.
{
  const p = await open({ save: fresh({ completedSectors: 5, secondsLeft: 1100 }) });
  await p.title(); await quiet(p);
  const top = (fn, a) => p.ev(fn, a);
  await p.ev(() => window.__blackout.game.scenes[0]._launchSector(6, "R2")); await p.wait(1200);
  let t0 = (await p.state()).secondsLeft;
  await p.press("Space"); await p.wait(200);
  check(t0 - (await p.state()).secondsLeft < 2 && !(await top(() => window.__blackout.game.top.message)), "Space does not transmit in R2");
  await top(() => window.__blackout.game.top.resume(1));
  await top(async () => {
    const s = window.__blackout.game.top;
    const { received } = await import(new URL("src/scenes/signal-carriers.js", location.href).href);
    s.mine = received(s.carrier); // copy the red trace: the habit carrier 1 taught
  });
  t0 = (await p.state()).secondsLeft;
  await p.press("Enter"); await p.wait(200);
  const msg = await top(() => window.__blackout.game.top.message?.text ?? "");
  check(/both voices/.test(msg) && t0 - (await p.state()).secondsLeft > 15, "sending the sum on carrier 2 is refused with a reason", msg);
  await top(() => window.__blackout.game.top.resume(2));
  const first = await top(() => { const s = window.__blackout.game.top; return { target: { ...s.target }, chirps: s.carrier.chirps, echo: s.carrier.echo }; });
  check(first.target.FREQ === first.chirps - first.echo.FREQ && first.target.AMP === 6 - first.echo.AMP
    && first.target.PHASE === (first.echo.PHASE + 4) % 8, "carrier 3's answer follows the three floor rules");
  const sends = [{ FREQ: 1, AMP: 1, PHASE: 0 }, { FREQ: 6, AMP: 5, PHASE: 1 }, { FREQ: 3, AMP: 3, PHASE: 2 }]
    .map((v) => (v.PHASE === first.target.PHASE ? { ...v, PHASE: (v.PHASE + 3) % 8 } : v));
  for (let i = 0; i < 2; i++) { await top((v) => { window.__blackout.game.top.mine = { ...v }; }, sends[i]); await p.press("Enter"); await p.wait(150); }
  const log = await top(() => window.__blackout.game.top.log.map((l) => l.fb));
  const mark = (a, b) => (a === b ? "✓" : a < b ? "▲" : "▼");
  check(log.length === 2 && log.every((fb, i) => fb.FREQ === mark(sends[i].FREQ, first.target.FREQ) && fb.AMP === mark(sends[i].AMP, first.target.AMP) && fb.PHASE === "✗"),
    "refused handshakes log ▲/▼/✓ per dial", JSON.stringify(log));
  await top((v) => { window.__blackout.game.top.mine = { ...v }; }, sends[2]); await p.press("Enter"); await p.wait(3000);
  const second = await top(() => { const s = window.__blackout.game.top; return { target: { ...s.target }, log: s.log.length, redial: s.redial }; });
  check(second.log === 0 && second.redial <= 0 && ["FREQ", "AMP", "PHASE"].every((k) => second.target[k] !== first.target[k]),
    "the third refusal drops the line and re-keys every dial", JSON.stringify([first.target, second.target]));
  await p.press("Escape"); await p.wait(700); await quiet(p);
  await p.ev(() => window.__blackout.game.scenes[0]._launchSector(6, "R2")); await p.wait(1200);
  check(await top(() => window.__blackout.game.top.round) === 2, "R2 reopens on carrier 3 after stepping out");
  await top(() => { const s = window.__blackout.game.top, c = s.carrier; s.mine = { FREQ: c.chirps - c.echo.FREQ, AMP: 6 - c.echo.AMP, PHASE: (c.echo.PHASE + 4) % 8 }; });
  await p.press("Enter"); await p.wait(2200);
  check((await p.state()).completedSectors === 6, "the rule-built handshake clears R2");
  check(!p.errors.length, "no page errors in R2", p.errors.join(" | "));
  await p.browser.close();
}

summary("regress");
