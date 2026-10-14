const root = new URL("../src/world/maps/", import.meta.url).href;
const { Tilemap } = await import(new URL("../src/world/tilemap.js", import.meta.url).href);
const { cells, staticBlockers } = await import(new URL("../src/world/puzzle-rules.js", import.meta.url).href);
const { lineOfSight } = await import(new URL("../src/engine/lighting.js", import.meta.url).href);
let failed = false;
for (const [file, name] of [["smart-building.js", "smartBuildingMap"], ["research-floor.js", "researchFloorMap"], ["core.js", "coreMap"]]) {
  const m = (await import(root + file))[name];
  const tm = new Tilemap(m.grid, { doors: m.doors, theme: m.theme, safe: m.safe });
  const npc = new Set((m.npcs ?? []).map((n) => `${n.col},${n.row}`));
  const pick = new Set((m.pickups ?? []).map((p) => `${p.col},${p.row}`));
  const puzzles = m.puzzles ?? [];
  // the floor puzzles are optional: required targets must be reachable with every puzzle unsolved,
  // and a puzzle's reward must be reachable once it is solved
  const flood = (solved) => {
    const shut = new Set(puzzles.flatMap((cfg) => staticBlockers(cfg, solved)));
    const blocked = (c, r) => tm.isSolidAt(c, r) || npc.has(`${c},${r}`) || pick.has(`${c},${r}`) || shut.has(`${c},${r}`);
    const seen = new Set([`${m.spawn.col},${m.spawn.row}`]);
    const q = [[m.spawn.col, m.spawn.row]];
    while (q.length) {
      const [c, r] = q.shift();
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${c + dc},${r + dr}`;
        if (seen.has(k) || blocked(c + dc, r + dr)) continue;
        seen.add(k); q.push([c + dc, r + dr]);
      }
    }
    return seen;
  };
  const open = flood(false), done = flood(true);
  const adj = (seen, c, r) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => seen.has(`${c + dc},${r + dr}`));
  const guarded = new Set(puzzles.flatMap((cfg) => [...cells(cfg)].filter(([, ch]) => ch === "+").map(([k]) => k)));
  const pickups = (m.pickups ?? []).map((p) => [p.id, p.col, p.row]);
  const targets = [...pickups.filter(([, c, r]) => !guarded.has(`${c},${r}`)), ["safe", m.safe.col, m.safe.row],
    ...(m.npcs ?? []).map((n) => [n.id, n.col, n.row]),
    // signs and terminals with something to read (L2's keyword is on one of them)
    ...Object.entries(m.tileMessages ?? {}).map(([k, msg]) => { const [r, c] = k.split(",").map(Number); return [msg.speaker, c, r]; }),
    ...Object.entries(m.doors).map(([slot, d]) => { for (let r = 0; r < tm.rows; r++) for (let c = 0; c < tm.cols; c++) if (tm.doorSlot(tm.grid[r][c]) === Number(slot)) return [d.label, c, r]; })];
  const bad = targets.filter(([, c, r]) => !adj(open, c, r));
  const rewards = pickups.filter(([, c, r]) => guarded.has(`${c},${r}`));
  const lost = rewards.filter(([, c, r]) => !adj(done, c, r));
  // no patrol can look into a puzzle room (the rooms are also shielded in game)
  const peeks = [];
  for (const s of m.sentinels ?? []) {
    const pts = s.path.map((p) => [p.c * 16 + 8, p.r * 16 + 8]);
    // a fixed turret only sweeps its base angle by ±1 rad (plus the cone's half-width); patrols look anywhere
    const fixed = s.path.every((p) => p.c === s.path[0].c && p.r === s.path[0].r);
    const facing = (dx, dy) => !fixed || Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - (s.angle ?? 0)), Math.cos(Math.atan2(dy, dx) - (s.angle ?? 0)))) < 1.45;
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8));
      for (let j = 0; j <= n; j++) {
        const sx = x0 + ((x1 - x0) * j) / n, sy = y0 + ((y1 - y0) * j) / n;
        for (const cfg of puzzles) for (const [k, ch] of cells(cfg)) {
          if (ch === "D") continue;
          const [c, r] = k.split(",").map(Number);
          const px = c * 16 + 8, py = r * 16 + 8;
          if (Math.hypot(px - sx, py - sy) < 112 && facing(px - sx, py - sy) && lineOfSight(tm, sx, sy, px, py)) peeks.push(`${s.name}->${k}`);
        }
      }
    }
  }
  if (bad.length || lost.length) failed = true;
  console.log(name, "reachable tiles", open.size,
    bad.length ? "UNREACHABLE: " + JSON.stringify(bad) : "all required targets reachable",
    rewards.length ? (lost.length ? "UNREACHABLE REWARD: " + JSON.stringify(lost) : `· ${rewards.length} puzzle reward(s) reachable once solved`) : "",
    puzzles.length ? `· sentinel sightlines into puzzle rooms: ${new Set(peeks).size} ${[...new Set(peeks)].join(" ")}` : "");
}
if (failed) process.exitCode = 1;
