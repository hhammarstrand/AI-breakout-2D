import { TILE_SIZE, TILE } from "../world/tilemap.js";

// Tiles that block light (and therefore cast shadows from the flashlight).
const OPAQUE = new Set([
  TILE.WALL, TILE.RACK, TILE.LOCKER,
  TILE.DOOR_L1, TILE.DOOR_L2, TILE.DOOR_L3, TILE.DOOR_L4,
]);

const RAY_COUNT = 56;
const RAY_STEP = 2;

// Darkness layer: a full-screen dark fill with lights "cut out" of it, composited over the scene,
// followed by an additive colour pass so light sources bloom.
export class Lighting {
  constructor(width, height) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext("2d");
    this.width = width;
    this.height = height;
  }

  render(target, camera, { darkness, tint, lights, cones = [], tilemap }) {
    const ctx = this.ctx;
    const w = this.width, h = this.height;

    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = tint;
    ctx.globalAlpha = darkness;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;

    ctx.globalCompositeOperation = "destination-out";
    const visible = [];
    for (const l of lights) {
      if (l.intensity <= 0.01) continue;
      const sx = l.x - camera.x, sy = l.y - camera.y;
      if (sx < -l.radius || sy < -l.radius || sx > w + l.radius || sy > h + l.radius) continue;
      visible.push({ l, sx, sy });
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, l.radius);
      g.addColorStop(0, `rgba(0,0,0,${l.intensity})`);
      g.addColorStop(0.5, `rgba(0,0,0,${l.intensity * 0.55})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(sx - l.radius, sy - l.radius, l.radius * 2, l.radius * 2);
    }

    const polys = [];
    for (const c of cones) {
      const cx = c.x - camera.x, cy = c.y - camera.y;
      if (cx < -c.range || cy < -c.range || cx > w + c.range || cy > h + c.range) continue;
      const poly = visibilityCone(tilemap, c);
      polys.push({ c, poly, cx, cy });
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, c.range);
      g.addColorStop(0, `rgba(0,0,0,${c.intensity})`);
      g.addColorStop(0.7, `rgba(0,0,0,${c.intensity * 0.75})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      tracePolygon(ctx, poly, camera);
      ctx.fill();
    }

    ctx.globalCompositeOperation = "source-over";
    target.drawImage(this.canvas, 0, 0);

    // additive bloom
    target.save();
    target.globalCompositeOperation = "lighter";
    for (const { l, sx, sy } of visible) {
      if (!l.color) continue;
      const r = l.radius * 0.8;
      const g = target.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, `rgba(${l.color},${0.22 * l.intensity})`);
      g.addColorStop(1, `rgba(${l.color},0)`);
      target.fillStyle = g;
      target.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    for (const { c, poly, cx, cy } of polys) {
      const g = target.createRadialGradient(cx, cy, 0, cx, cy, c.range);
      g.addColorStop(0, `rgba(${c.color},${c.glow ?? 0.2})`);
      g.addColorStop(1, `rgba(${c.color},0)`);
      target.fillStyle = g;
      tracePolygon(target, poly, camera);
      target.fill();
    }
    target.restore();
  }
}

function tracePolygon(ctx, pts, camera) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x - camera.x, pts[0].y - camera.y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x - camera.x, pts[i].y - camera.y);
  ctx.closePath();
}

// Casts a fan of rays and returns the lit polygon (origin + ray hit points).
function visibilityCone(tilemap, { x, y, angle, spread, range }) {
  const pts = [{ x, y }];
  for (let i = 0; i <= RAY_COUNT; i++) {
    const a = angle - spread + (spread * 2 * i) / RAY_COUNT;
    const dx = Math.cos(a), dy = Math.sin(a);
    let d = 0;
    while (d < range) {
      d += RAY_STEP;
      const col = Math.floor((x + dx * d) / TILE_SIZE);
      const row = Math.floor((y + dy * d) / TILE_SIZE);
      if (OPAQUE.has(tilemap.tileAt(col, row))) { d += 3; break; } // let light lick the wall face
    }
    pts.push({ x: x + dx * Math.min(d, range), y: y + dy * Math.min(d, range) });
  }
  return pts;
}

// True when nothing opaque sits on the straight line between two points.
export function lineOfSight(tilemap, x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.ceil(dist / 4);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const col = Math.floor((x0 + (x1 - x0) * t) / TILE_SIZE);
    const row = Math.floor((y0 + (y1 - y0) * t) / TILE_SIZE);
    if (OPAQUE.has(tilemap.tileAt(col, row))) return false;
  }
  return true;
}

// Builds static light sources from the map. `time` drives flicker; door colours follow sector state.
export function collectLights(tilemap, doorColor) {
  const lights = [];
  for (let r = 0; r < tilemap.rows; r++) {
    for (let c = 0; c < tilemap.cols; c++) {
      const tile = tilemap.grid[r][c];
      const x = c * TILE_SIZE + TILE_SIZE / 2;
      const y = r * TILE_SIZE + TILE_SIZE / 2;
      const seed = (c * 73 + r * 151) % 997;
      const breach = c >= 37 && r <= 7;
      switch (tile) {
        case TILE.LIGHT:
          lights.push({ x, y, radius: 58, base: 0.9, color: breach ? "255,90,60" : "170,255,215", seed,
                        flicker: breach ? "heavy" : seed % 7 === 0 ? "faulty" : "hum" });
          break;
        case TILE.TERMINAL:
          lights.push({ x, y: y - 3, radius: 26, base: 0.55, color: "40,255,140", seed, flicker: "hum" });
          break;
        case TILE.RACK:
          lights.push({ x, y, radius: 16, base: 0.35, color: "74,230,255", seed, flicker: "hum" });
          break;
        case TILE.SIGN:
          lights.push({ x, y: y - 3, radius: 18, base: 0.45, color: "74,230,255", seed, flicker: "hum" });
          break;
        case TILE.DEBRIS:
          if (breach) lights.push({ x, y, radius: 22, base: 0.4, color: "255,120,40", seed, flicker: "heavy" });
          break;
        case TILE.DOOR_L1: case TILE.DOOR_L2: case TILE.DOOR_L3: case TILE.DOOR_L4: {
          const n = tile - TILE.DOOR_L1 + 1;
          lights.push({ x, y: y + 6, radius: 44, base: 0.8, seed, flicker: "pulse", door: n });
          break;
        }
      }
    }
  }
  for (const l of lights) l.intensity = l.door ? 0 : l.base;
  return {
    lights,
    update(time) {
      for (const l of lights) {
        let k = 1;
        if (l.flicker === "hum") k = 0.92 + 0.08 * Math.sin(time * 3 + l.seed);
        else if (l.flicker === "pulse") k = 0.75 + 0.25 * Math.sin(time * 2.5);
        else if (l.flicker === "faulty") k = Math.sin(time * 11 + l.seed) * Math.sin(time * 4.3 + l.seed * 2) > 0.45 ? 0.1 : 1;
        else if (l.flicker === "heavy") k = Math.random() < 0.12 ? 0.15 : 0.7 + Math.random() * 0.3;
        if (l.door) l.color = doorColor(l.door);
        l.intensity = l.base * k * (l.door && !l.color ? 0 : 1);
      }
    },
  };
}
