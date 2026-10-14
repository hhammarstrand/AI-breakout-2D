import { t } from "../i18n/index.js";

const W = 480, H = 320; // the game's logical resolution; the backing store may be 2x for sharp text

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.width = W;
    this.height = H;
    this.scale = 1;
    // Readability floors (OPTIONS → LARGE TEXT / HIGH CONTRAST): the smallest font size, and the
    // contrast ratio text must reach against the panel it sits on.
    this.textFloor = 8;
    this.largeText = false;
    this.contrastFloor = 4.5;
    this._panels = [];
    this._fixed = new Map();
    this._ox = 0; this._oy = 0; // withTranslate offset, so tracked panels are in screen space
    installFontFloor(this);
  }

  // Draw at s× the logical size (s = 1 or 2); scenes keep using 480×320 coordinates.
  setScale(s) {
    if (s === this.scale) return;
    this.scale = s;
    this.canvas.width = W * s;
    this.canvas.height = H * s;
    this.ctx.setTransform(s, 0, 0, s, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  clear(color = "#000") {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this._panels.length = 0;
    this._track(0, 0, this.width, this.height, color);
  }

  fillRect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
    if (w * h >= 40) this._track(x, y, w, h, color);
  }

  strokeRect(x, y, w, h, color, lineWidth = 1) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.strokeRect((x | 0) + 0.5, (y | 0) + 0.5, (w | 0) - 1, (h | 0) - 1);
  }

  text(message, x, y, options = {}) {
    const {
      color = "#0aff7a",
      size = 10,
      align = "left",
      baseline = "top",
      weight = "normal",
    } = options;
    this.ctx.fillStyle = this._readable(color, x, y, baseline);
    this.ctx.textAlign = align;
    this.ctx.textBaseline = baseline;
    this.ctx.font = `${weight} ${size}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
    const msg = t(message);
    // the size floors and longer glyphs must never push a line off the screen: squeeze it instead
    const sx = x + this._ox;
    const avail = align === "left" ? W - sx - 3 : align === "right" ? sx - 3 : 2 * Math.min(sx, W - sx) - 6;
    const width = this.ctx.measureText(msg).width;
    if (width > avail && avail > 40) {
      const px = Math.max(6, Math.floor(parseFloat(/(\d+(?:\.\d+)?)px/.exec(this.ctx.font)[1]) * avail / width * 10) / 10);
      this._rawFont = true;
      this.ctx.font = `${weight} ${px}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
      this._rawFont = false;
    }
    this.ctx.fillText(msg, x | 0, y | 0);
  }

  withTranslate(dx, dy, fn) {
    this.ctx.save();
    this.ctx.translate(-dx | 0, -dy | 0);
    const ox = this._ox, oy = this._oy;
    this._ox -= dx | 0; this._oy -= dy | 0;
    try { fn(this.ctx); } finally { this.ctx.restore(); this._ox = ox; this._oy = oy; }
  }

  // Remember the solid rectangles drawn this frame (panels, boxes, key caps), so text knows what
  // it is drawn on. Translucent fills are blended over whatever was under their centre.
  _track(x, y, w, h, color) {
    const c = parseColor(color);
    if (!c || c[3] < 0.3) return;
    const ox = this._ox, oy = this._oy;
    let rgb = c;
    if (c[3] < 0.98) {
      const under = this._bgAt(x + ox + w / 2, y + oy + h / 2);
      rgb = [0, 1, 2].map((i) => c[i] * c[3] + under[i] * (1 - c[3]));
    }
    if (this._panels.length > 600) this._panels.splice(1, 300);
    this._panels.push({ x: x + ox, y: y + oy, w, h, rgb });
  }

  _bgAt(x, y) {
    const list = this._panels;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) return p.rgb;
    }
    return [0, 0, 0];
  }

  // Lift (or darken) a text colour until it reaches the contrast floor against its panel.
  _readable(color, x, y, baseline) {
    const c = parseColor(color);
    if (!c || c[3] < 0.98) return color;
    const dy = baseline === "top" ? 3 : baseline === "middle" ? 0 : -3;
    const bg = this._bgAt(x + this._ox, y + this._oy + dy);
    const key = `${color}|${bg.join(",")}|${this.contrastFloor}`;
    let out = this._fixed.get(key);
    if (out) return out;
    const lb = luminance(bg);
    out = color;
    if (ratio(luminance(c), lb) < this.contrastFloor) {
      const toward = lb < 0.25 ? 255 : 0;
      let lo = 0, hi = 1;
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        const m = c.slice(0, 3).map((v) => v + (toward - v) * mid);
        if (ratio(luminance(m), lb) >= this.contrastFloor) hi = mid; else lo = mid;
      }
      const m = c.slice(0, 3).map((v) => Math.round(v + (toward - v) * hi));
      out = `rgb(${m[0]},${m[1]},${m[2]})`;
    }
    if (this._fixed.size > 2000) this._fixed.clear();
    this._fixed.set(key, out);
    return out;
  }
}

// Every font set on the main canvas, by any scene, goes through the size floor, so text that is
// measured for layout and the text that is drawn always agree.
function installFontFloor(r) {
  const proto = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, "font");
  if (!proto?.set) return;
  const cache = new Map();
  Object.defineProperty(r.ctx, "font", {
    configurable: true,
    get() { return proto.get.call(this); },
    set(v) {
      if (r._rawFont) { proto.set.call(this, v); return; }
      const key = `${r.textFloor}|${r.largeText}|${v}`;
      let f = cache.get(key);
      if (f === undefined) {
        f = String(v).replace(/(\d+(?:\.\d+)?)px/, (m, n) => {
          let px = Number(n);
          if (r.largeText && px <= 10) px += 1;
          return `${Math.max(px, r.textFloor)}px`;
        });
        cache.set(key, f);
      }
      proto.set.call(this, f);
    },
  });
}

const COLORS = new Map();
function parseColor(s) {
  if (typeof s !== "string") return null;
  let c = COLORS.get(s);
  if (c !== undefined) return c;
  c = null;
  let m;
  if ((m = s.match(/^#([0-9a-f]{3})$/i))) c = [...m[1]].map((h) => parseInt(h + h, 16)).concat(1);
  else if ((m = s.match(/^#([0-9a-f]{6})$/i))) c = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(1);
  else if ((m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i))) c = [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  if (COLORS.size > 4000) COLORS.clear();
  COLORS.set(s, c);
  return c;
}

function luminance([r, g, b]) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(a, b) { return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }

export const _test = { parseColor, luminance, ratio };
