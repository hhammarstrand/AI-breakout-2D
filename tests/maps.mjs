const root = new URL("../src/world/maps/", import.meta.url).href;
const { Tilemap } = await import(new URL("../src/world/tilemap.js", import.meta.url).href);
for (const [file, name] of [["smart-building.js", "smartBuildingMap"], ["research-floor.js", "researchFloorMap"], ["core.js", "coreMap"]]) {
  const m = (await import(root + file))[name];
  const tm = new Tilemap(m.grid, { doors: m.doors, theme: m.theme, safe: m.safe });
  const npc = new Set((m.npcs ?? []).map((n) => `${n.col},${n.row}`));
  const pick = new Set((m.pickups ?? []).map((p) => `${p.col},${p.row}`));
  const blocked = (c, r) => tm.isSolidAt(c, r) || npc.has(`${c},${r}`) || pick.has(`${c},${r}`);
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
  const adj = (c, r) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => seen.has(`${c + dc},${r + dr}`));
  const targets = [...(m.pickups ?? []).map((p) => [p.id, p.col, p.row]), ["safe", m.safe.col, m.safe.row],
    ...(m.npcs ?? []).map((n) => [n.id, n.col, n.row]),
    ...Object.entries(m.doors).map(([slot, d]) => { for (let r = 0; r < tm.rows; r++) for (let c = 0; c < tm.cols; c++) if (tm.doorSlot(tm.grid[r][c]) === Number(slot)) return [d.label, c, r]; })];
  const bad = targets.filter(([, c, r]) => !adj(c, r));
  console.log(name, "reachable tiles", seen.size, bad.length ? "UNREACHABLE: " + JSON.stringify(bad) : "all targets reachable");
}
