// Regression checks for save/checkpoint, timer and scene-stack bugs found in review.
// Exits non-zero if any check fails.
import { open, check, summary, floorHelpers } from "./lib.mjs";

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

// --- in-world floor puzzles, solved with real key input (tests/lib.mjs floorHelpers) -------------
const at = (p) => p.ev(() => { const pl = window.__blackout.game.scenes[0].player; return `${pl.col},${pl.row}`; });
const takeEast = async (p) => { await p.ev(() => { window.__blackout.game.scenes[0].player.facing = "right"; }); await p.press("e"); await p.wait(400); await quiet(p); };

// 10. Lobby laser grid: a dark gate zaps you back to the pad for time; two cracked panels in the
// right order get you to the override pad; it stays solved after a reload.
{
  const p = await open({ save: fresh() });
  await p.title(); await quiet(p); await floorHelpers(p.page);
  await p.ev(() => window.__blackout.game.scenes[0].player.teleport(46, 23));
  await p.ev(() => window.__fp.steps("RR"));
  check(await at(p) === "48,23", "lasers: entered on the start pad", await at(p));
  const t0 = (await p.state()).secondsLeft;
  await p.ev(() => window.__fp.steps("RRRR")); // the east gate is dark whenever you stand in front of it
  check(await at(p) === "48,23" && t0 - (await p.state()).secondsLeft >= 4.5, "lasers: a dark gate zaps you back to the pad and costs time", await at(p));
  await p.ev(() => window.__fp.steps("DRDDDDLURRRRRURRUULURRRRR"));
  check((await p.state()).collected.includes("wp-lasers"), "lasers: the parity route reaches the override pad", await at(p));
  await takeEast(p);
  check((await p.state()).items.cell === 1, "lasers: the spare cell is behind the pad");
  await p.reload(); await quiet(p);
  check(await p.ev(() => window.__blackout.game.scenes[0].puzzles[0].solved), "lasers: the grid stays off after a reload");
  await p.browser.close();
}

// 11. Research cold store: canisters slide on ice; the recall pad and a held E both reset them;
// seven real pushes cap the vents and unseal the store.
{
  const p = await open({ save: fresh({ completedSectors: 4 }) });
  await p.title(); await quiet(p); await floorHelpers(p.page);
  const moved = () => p.ev(() => window.__blackout.game.scenes[0].puzzles[0].moved);
  await p.ev(() => window.__blackout.game.scenes[0].player.teleport(38, 17));
  await p.ev(() => window.__fp.walkTo(41, 18));
  await p.ev(() => window.__fp.push("right"));
  check(await p.ev(() => window.__blackout.game.scenes[0].puzzles[0].cans[0].c) === 43, "cold store: a pushed canister slides until the next one stops it");
  await p.ev(() => window.__fp.walkTo(40, 17));
  check(!(await moved()), "cold store: the recall pad sends every canister home");
  await p.ev(() => window.__fp.walkTo(41, 19));
  await p.ev(() => window.__fp.push("right"));
  await p.page.keyboard.down("e"); await p.wait(1400); await p.page.keyboard.up("e"); await quiet(p);
  check(!(await moved()), "cold store: holding E recalls the canisters from anywhere in the bay");
  const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  for (const [c, r, d] of [[42, 18, "right"], [43, 18, "down"], [44, 18, "right"], [45, 18, "down"], [42, 19, "right"], [45, 19, "down"], [43, 22, "left"]]) {
    await p.ev(([x, y]) => window.__fp.walkTo(x, y), [c - D[d][0], r - D[d][1]]);
    await p.ev((d) => window.__fp.push(d), d);
  }
  await p.wait(300);
  check((await p.state()).collected.includes("wp-coldstore"), "cold store: capping all three vents unseals the inner store");
  check(await p.ev(() => window.__fp.walkTo(47, 20)), "cold store: the sealed door is open");
  await takeEast(p);
  check((await p.state()).items.cell === 1, "cold store: the cell is inside");
  await p.browser.close();
}

// 12. Core lattice: lit panels take no second step, holding E clears the trace, the vault socket
// rejects an unfinished trace for time, and the one-stroke trace opens the vault.
{
  const p = await open({ save: fresh({ completedSectors: 8 }) });
  await p.title(); await quiet(p); await floorHelpers(p.page);
  const lit = () => p.ev(() => window.__blackout.game.scenes[0].puzzles[0].lit.length);
  await p.ev(() => window.__blackout.game.scenes[0].player.teleport(30, 18));
  await p.ev(() => window.__fp.steps("RRRL"));
  check(await at(p) === "32,18" && await lit() === 0, "lattice: stepping back off the entry socket clears it", await at(p));
  await p.ev(() => window.__fp.steps("RDD"));
  check(await lit() === 3, "lattice: each panel lights as you step on it");
  await p.ev(() => window.__fp.steps("U"));
  check(await at(p) === "33,20" && await lit() === 3, "lattice: a spent panel won't take a second step", await at(p));
  await p.page.keyboard.down("e"); await p.wait(1400); await p.page.keyboard.up("e"); await quiet(p);
  check(await at(p) === "32,18" && await lit() === 0, "lattice: holding E clears the trace and returns you to the entry", await at(p));
  const t0 = (await p.state()).secondsLeft;
  await p.ev(() => window.__fp.steps("RDDRURURDDR"));
  check(await at(p) === "32,18" && await lit() === 0 && t0 - (await p.state()).secondsLeft >= 4.5, "lattice: the vault socket rejects an unfinished trace and costs time", await at(p));
  await p.ev(() => window.__fp.steps("RDDRURULULURRRRDLDRDLDR"));
  check((await p.state()).collected.includes("wp-lattice"), "lattice: one stroke over every panel opens the vault");
  await p.ev(() => window.__fp.steps("R"));
  await takeEast(p);
  check((await p.state()).items.cell === 1, "lattice: the vault holds a cell");
  await p.browser.close();
}

// 13. Inside a floor puzzle room H gives that puzzle's hints and sentinels can't see in.
{
  const p = await open({ save: fresh() });
  await p.title(); await quiet(p);
  await p.ev(() => window.__blackout.game.scenes[0].player.teleport(49, 23));
  await p.wait(200);
  await p.press("h"); await p.wait(300);
  const list = await p.ev(() => window.__blackout.game.top.list?.[0]);
  check(/floor sensor/.test(list ?? ""), "H in the laser room shows the laser hints", list);
  await p.press("Escape"); await p.wait(200);
  // the same sentinel, one tile away and facing the player: seen in the lobby, blind in the room
  const meter = (col, row) => p.ev(async ([col, row]) => {
    const { Sentinel } = await import("/src/entities/sentinel.js");
    const w = window.__blackout.game.scenes[0];
    w.player.teleport(col, row);
    const s = new Sentinel({ name: "T", angle: Math.PI / 2, path: [{ c: col, r: row - 1, wait: 9 }, { c: col, r: row - 1, wait: 9 }] });
    w.sentinels = [s];
    await new Promise((r) => setTimeout(r, 350));
    w.sentinels = [];
    return s.meter;
  }, [col, row]);
  check(await meter(44, 26) > 0, "control: a sentinel next to the player in the lobby starts spotting");
  await p.wait(300); await quiet(p);
  const spotted = await meter(49, 23);
  check(spotted === 0, "a sentinel right next to a puzzle room can't see the player inside it");
  await p.browser.close();
}

summary("regress");
