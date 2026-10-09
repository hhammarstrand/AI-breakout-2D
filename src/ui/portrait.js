// Draws the speaker's face into the dialog portrait canvas.
const SCALE = 4;

export function drawPortrait(canvas, profile, t = 0) {
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = "#020c06";
  ctx.fillRect(0, 0, w, h);

  if (profile.glyph) {
    ctx.fillStyle = profile.tint;
    ctx.globalAlpha = 0.12;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.font = `bold ${profile.glyph.length > 1 ? 18 : 26}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(profile.glyph, w / 2, h / 2 + 1);
  } else {
    // Head-and-shoulders crop of the 12x14 world sprite, scaled up.
    const blink = (t % 3.2) < 0.12;
    const px = (x, y, pw, ph, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(x * SCALE, y * SCALE, pw * SCALE, ph * SCALE);
    };
    px(1, 9, 10, 4, profile.bodyDark);
    px(1, 8, 10, 1, profile.color);
    px(2, 2, 8, 6, "#fbd2a0");
    px(1, 1, 10, 2, profile.accent);
    px(1, 1, 10, 1, "#fff");
    if (!blink) { px(4, 4, 1, 2, "#000"); px(7, 4, 1, 2, "#000"); }
    else { px(4, 5, 1, 1, "#000"); px(7, 5, 1, 1, "#000"); }
    px(5, 7, 2, 1, "#a0583a");
  }

  // scanlines
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
}

export function profileFor(speaker) {
  const s = (speaker || "").toLowerCase();
  if (s.includes("sign") || s.includes("reception")) return { glyph: "▤", tint: "#ffd15a" };
  if (s.includes("terminal") || s.includes("cctv")) return { glyph: ">_", tint: "#4ae6ff" };
  if (s.includes("clear")) return { glyph: "✓", tint: "#0aff7a" };
  if (s.includes("seal") || s.includes("lock") || s.includes("abort")) return { glyph: "✕", tint: "#ff5a5a" };
  return { glyph: "◉", tint: "#0aff7a" };
}
