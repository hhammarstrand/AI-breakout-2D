import { TILE } from "../tilemap.js";

// Small helper for laying out maps with walls, alcoves and props.
export function makeGrid(cols, rows, floor) {
  const grid = Array.from({ length: rows }, () => Array(cols).fill(floor));
  const set = (r, c, t) => { if (r >= 0 && r < rows && c >= 0 && c < cols) grid[r][c] = t; };
  const fill = (r0, c0, r1, c1, t) => {
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) set(r, c, t);
  };
  const border = () => {
    fill(0, 0, 0, cols - 1, TILE.WALL);
    fill(rows - 1, 0, rows - 1, cols - 1, TILE.WALL);
    fill(0, 0, rows - 1, 0, TILE.WALL);
    fill(0, cols - 1, rows - 1, cols - 1, TILE.WALL);
  };
  // replace one floor kind with another inside a rectangle
  const paint = (r0, c0, r1, c1, from, to) => {
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (grid[r]?.[c] === from) grid[r][c] = to;
  };
  return { grid, set, fill, border, paint };
}

// Widen a finished grid with solid wall so a wing can be stamped beside it.
export function grow(grid, cols) {
  for (const row of grid) while (row.length < cols) row.push(TILE.WALL);
  return grid;
}

// Stamp a floor puzzle's template (see puzzle-rules.js) onto the grid: walls, solid props, and
// `floor` everywhere the puzzle draws its own tiles.
export function stamp(grid, cfg, floor) {
  cfg.rows.forEach((line, y) => [...line].forEach((ch, x) => {
    const r = cfg.origin.row + y, c = cfg.origin.col + x;
    if (ch === " " || !grid[r] || c >= grid[r].length) return;
    grid[r][c] = ch === "#" ? TILE.WALL : ch === "T" ? TILE.TANK : ch === "P" ? TILE.CORE : floor;
  }));
  return grid;
}
