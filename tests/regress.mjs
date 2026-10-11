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
    s.briefing = false;
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

// 10. L1: briefing first, a miscount costs time, notes only show what was heard, rounds resume.
{
  const p = await open({ save: fresh() });
  await p.title(); await quiet(p);
  await p.ev(() => { const w = window.__blackout.game.scenes[0]; w.player.teleport(14, 16); w.player.facing = "up"; });
  await p.press("e"); await p.wait(300); await quiet(p);
  check(JSON.stringify((await p.state()).heard) === '["analyst"]', "talking to the analyst records it as heard", JSON.stringify((await p.state()).heard));
  await p.ev(() => window.__blackout.game.scenes[0]._launchSector(1, "L1")); await p.wait(1200);
  const top = () => p.ev(() => { const s = window.__blackout.game.top; return { brief: s.briefing, notes: s.notes, round: s.round, marks: s.states.filter((x) => x !== "none").length, msg: s.message?.text ?? "" }; });
  await p.press("Space"); await p.wait(100);
  let t = await top();
  check(t.brief === false && t.marks === 0, "space closes the briefing without marking a feed", JSON.stringify(t));
  const t0 = (await p.state()).secondsLeft;
  await p.press("Enter"); await p.wait(200);
  t = await top();
  const cost = t0 - (await p.state()).secondsLeft;
  check(cost > 9 && cost < 12 && /COUNT MISMATCH/.test(t.msg) && t.round === 0, "submitting the wrong number of marks costs 10 s", `${cost.toFixed(1)} s, "${t.msg}"`);
  const names = await p.ev(() => window.__blackout.game.top.rooms.map((r) => r.name));
  check(!names.some((n) => t.msg.includes(n)), "the miscount message names no feed");
  await p.press("Tab"); await p.wait(100);
  const t1 = (await p.state()).secondsLeft;
  await p.press("Enter"); await p.wait(200);
  t = await top();
  check(t.notes === false && t1 - (await p.state()).secondsLeft < 1, "Enter closes the notes instead of submitting");
  const notes = await p.ev(() => { const s = window.__blackout.game.top, r = window.__blackout.game.renderer, drawn = [];
    const f = r.ctx.fillText; r.ctx.fillText = function (x, ...a) { drawn.push(x); return f.call(this, x, ...a); };
    s.notes = true; s.render(r); s.notes = false; r.ctx.fillText = f; return drawn.join("|"); });
  check(/37\.0–41\.5C/.test(notes) && !/0\.20–0\.35 Hz/.test(notes), "field notes show the analyst's rules and hide the unheard ones");
  await p.ev(() => { const s = window.__blackout.game.top; s.states = s.rooms.map((r) => (r.role === "survivor" || r.role === "hostile" ? r.role : "none")); });
  await p.press("Enter"); await p.wait(2400);
  t = await top();
  check(t.round === 1 && t.brief === true && (await p.ev(() => window.__blackout.game.top.rooms.length)) === 9, "round 2 opens with a briefing and nine feeds");
  await p.press("Escape"); await p.wait(700); await quiet(p);
  await p.ev(() => window.__blackout.game.scenes[0]._launchSector(1, "L1")); await p.wait(1200);
  check(await p.ev(() => window.__blackout.game.top.round) === 1, "L1 reopens on round 2 after stepping out");
  // every generated card fits exactly one kind under the rules as the lobby states them (CCTV_RULES)
  const bad = await p.ev(async () => {
    const { generateFeeds } = await import(new URL("src/scenes/sector1-scene.js", location.href).href);
    const fits = (c, t) => ({
      survivor: c.m !== "N" && t >= 35 && t <= 38.5 && ["voiced", "quiet"].includes(c.a),
      hostile: c.m !== "P" && t >= 37 && t <= 41.5 && ["impulsive", "looped", "quiet"].includes(c.a),
      cleanbot: c.m === "P" && t >= 35 && t <= 38 && ["tonal", "impulsive"].includes(c.a),
      machinery: c.m === "N" && t > 38.5 && ["tonal", "broadband"].includes(c.a),
      empty: c.m === "N" && t < 25,
    });
    let n = 0;
    for (let round = 0; round < 2; round++) for (let i = 0; i < 500; i++) for (const c of generateFeeds(round)) {
      const kinds = Object.entries(fits(c, parseFloat(c.thermal))).filter(([k, ok]) => ok && (round || k !== "machinery")).map(([k]) => k);
      if (kinds.length !== 1 || kinds[0] !== c.role) n++;
    }
    return n;
  });
  check(bad === 0, "every generated L1 feed fits exactly one kind under the lobby's rules (1000 boards)", `${bad} bad`);
// 11. L2 escalates: only log 1 labels the peak as E, log 2's peak isn't E, log 3's key is the name
//     on Lind's desk, hints follow the log, and a stepped-out player resumes on the keyword log.
{
  const p = await open({ save: fresh({ completedSectors: 1 }) });
  await p.title(); await quiet(p);
  await p.ev(() => window.__blackout.game.scenes[0]._launchSector(2, "L2")); await p.wait(1200);
  const l1 = await p.ev(() => { const s = window.__blackout.game.top; return { tut: !!s.log.tutorial, partial: !!s.revealed, hint: s.hints[0] }; });
  check(l1.tut && l1.partial, "log 1 is the frequency tutorial with a partial decode");
  await p.ev(() => { const s = window.__blackout.game.top; s._hintsShown = 2; s.resume(1); }); // as if two log-1 hints were read
  const l2 = await p.ev(async () => {
    const { letterCounts, ALPHA } = await import("/src/scenes/cipher-logs.js");
    const s = window.__blackout.game.top, f = letterCounts(s.log.plain);
    const peak = f.indexOf(Math.max(...f));
    // the shift a player gets by assuming the tallest ciphertext bar is E
    const guess = ((s.freq.indexOf(s.freqMax) - 4) % 26 + 26) % 26;
    return { peak: ALPHA[peak], eTop: f[4] >= f[peak], tut: !!s.log.tutorial, partial: !!s.revealed, hint: s.hints[0], shown: s._hintsShown ?? 0, guess, key: s.log.shifts[0] };
  });
  check(!l2.eTop && !l2.tut && !l2.partial, "log 2: no E label, full live decode, and E is not the commonest letter", `peak ${l2.peak}`);
  check(l2.hint !== l1.hint && l2.shown === 0, "hints switch to log 2's set and start from the first tier");
  check(l2.guess !== l2.key, "log 2: 'tallest bar = E' gives the wrong key");
  const t0 = (await p.state()).secondsLeft;
  await p.press("ArrowRight", l2.guess); await p.press("Enter"); await p.wait(300);
  check(t0 - (await p.disk()).secondsLeft > 25, "locking in the E guess on log 2 costs time");
  await p.ev(() => window.__blackout.game.top.resume(2));
  const name = await p.ev(async () => {
    const { smartBuildingMap } = await import("/src/world/maps/smart-building.js");
    return smartBuildingMap.tileMessages["20,10"].lines.join(" ").match(/BY ([A-Z]+),/)?.[1];
  });
  const key = await p.ev(() => window.__blackout.game.top.log.shifts.map((k) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[k]).join(""));
  check(!!name && name === key, "log 3's keyword is the name signed on Lind's desk drawing", `${name} / ${key}`);
  // one reel wrong still fails
  for (const [i, ch] of [...key].entries()) {
    await p.press("ArrowUp", ch.charCodeAt(0) - 65 + (i === 3 ? 1 : 0));
    if (i < 3) await p.press("ArrowRight");
  }
  const t1 = (await p.disk()).secondsLeft;
  await p.press("Enter"); await p.wait(300);
  check(t1 - (await p.disk()).secondsLeft > 25 && await p.ev(() => window.__blackout.game.top.index) === 2, "three right reels of four is still a wrong lock-in");
  await p.press("Escape"); await p.wait(700); await quiet(p);
  await p.ev(() => window.__blackout.game.scenes[0]._launchSector(2, "L2")); await p.wait(1200);
  check(await p.ev(() => window.__blackout.game.top.index) === 2, "L2 reopens on the keyword log after stepping out");
  for (const [i, ch] of [...key].entries()) { await p.press("ArrowUp", ch.charCodeAt(0) - 65); if (i < 3) await p.press("ArrowRight"); }
  await p.press("Enter"); await p.wait(1900);
  check((await p.state()).completedSectors === 2, "dialling the name clears L2");
  await p.browser.close();
}

summary("regress");
