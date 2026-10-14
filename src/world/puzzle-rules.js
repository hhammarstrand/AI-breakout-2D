// Pure rules for the in-world floor puzzles (no DOM, no game state), shared by the game and by
// the solver that proves every layout solvable. A puzzle config is a small ASCII template:
// { kind, id, origin: { col, row }, rows: [...] } stamped onto the floor's grid at `origin`.
//
// Template legend
//   #  wall          D  doorway into the room (plain floor, outside the puzzle)
//   _  plain floor   +  the reward capsule's tile
//   lasers:  S start pad · . sensor floor · M/C magenta/cyan gate · * cracked sensor · G override pad
//   slide:   R recall pad · . ice · o vent · $ canister · T tank (solid) · V sealed door
//   lattice: S entry socket · . panel · E vault socket · P core pillar (solid) · V vault door

export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export const key = (c, r) => `${c},${r}`;

// template char at a world tile, or null outside the template
export function charAt(cfg, c, r) {
  const ch = cfg.rows[r - cfg.origin.row]?.[c - cfg.origin.col];
  return ch === undefined || ch === " " ? null : ch;
}

// every non-wall template tile: "c,r" -> char
export function cells(cfg) {
  const out = new Map();
  cfg.rows.forEach((line, y) => [...line].forEach((ch, x) => {
    if (ch !== "#" && ch !== " ") out.set(key(cfg.origin.col + x, cfg.origin.row + y), ch);
  }));
  return out;
}

export function find(cfg, ch) {
  const out = [];
  for (const [k, v] of cells(cfg)) if (v === ch) { const [c, r] = k.split(",").map(Number); out.push({ c, r }); }
  return out;
}

// Tiles that block walking before the puzzle is solved (closed doors, canisters where they start).
export function staticBlockers(cfg, solved) {
  const out = [];
  for (const [k, ch] of cells(cfg)) {
    if (ch === "V" && !solved) out.push(k);
    if (ch === "$" && !solved) out.push(k);
  }
  return out;
}

// --- laser grid -------------------------------------------------------------------------------
// k counts the beats since the player stepped onto the start pad, mod 2. Every step a floor
// sensor feels swaps the gates: magenta fires on even beats, cyan on odd. A cracked sensor ('*')
// feels nothing, so stepping onto it skips a beat. The beat changes as a step starts, so the
// gate you walk into must be lit while you stand in front of it; it goes dark as you move in.
export function gateLive(ch, k) { return (ch === "M" && k === 0) || (ch === "C" && k === 1); }
export function nextBeat(k, ch) { return ch === "S" ? 0 : ch === "*" ? k : k ^ 1; }

// --- slide bay --------------------------------------------------------------------------------
// A pushed canister slides until the next tile is not ice/vent (walls, tanks, the recall nook,
// the door) or holds another canister. Vents don't stop it.
export function slideEnd(cfg, occupied, c, r, dx, dy) {
  for (;;) {
    const nc = c + dx, nr = r + dy;
    const ch = charAt(cfg, nc, nr);
    if (!(ch === "." || ch === "o" || ch === "$") || occupied.has(key(nc, nr))) return { c, r };
    c = nc; r = nr;
  }
}

// --- lattice ----------------------------------------------------------------------------------
// One stroke: start on S, light every panel exactly once, finish on E. A lit panel takes no second
// step (the game blocks it), and stepping onto E with panels still dark overloads the lattice.
export const isPanel = (ch) => ch === "S" || ch === "." || ch === "E";
export function latticeStep(cfg, lit, c, r) {
  const ch = charAt(cfg, c, r);
  if (!isPanel(ch)) return "off";
  const k = key(c, r);
  if (lit.length === 0) return ch === "S" ? "lit" : "off";
  if (lit.includes(k)) return "overload";
  const total = [...cells(cfg).values()].filter(isPanel).length;
  if (ch === "E") return lit.length + 1 === total ? "solved" : "overload";
  return "lit";
}
