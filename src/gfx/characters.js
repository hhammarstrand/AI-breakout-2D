// Procedural pixel-art characters. A "look" (skin, hair, outfit…) is painted as a paper doll onto a
// 16x20 grid for each facing and walk frame, then an automatic 1px outline pass gives it the
// crisp hand-drawn sprite look. Frames are rendered once into small canvases and cached.

export const FRAME_W = 18;
export const FRAME_H = 22;
const OUTLINE = [10, 8, 18, 255];
const EYE = "#140c1c";
const DIRS = ["down", "up", "left", "right"];
const STEPS = 4;

export function buildCharacter(look) {
  const frames = {};
  for (const dir of DIRS) {
    for (let step = 0; step < STEPS; step++) {
      for (const blink of [false, true]) {
        frames[`${dir}:${step}:${blink ? 1 : 0}`] = dir === "right"
          ? mirror(paint(look, "left", step, blink))
          : paint(look, dir, step, blink);
      }
    }
  }
  return {
    frame(dir, step = 0, blink = false) {
      return frames[`${dir}:${step % STEPS}:${blink ? 1 : 0}`];
    },
  };
}

function paint(look, dir, step, blink) {
  const c = document.createElement("canvas");
  c.width = FRAME_W;
  c.height = FRAME_H;
  const ctx = c.getContext("2d");
  const px = (x, y, w, h, color) => {
    if (!color) return;
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, w, h);
  };

  // walk cycle: steps 1 and 3 lift a leg and swing the opposite arm; the body rises a pixel
  const lift = step === 1 ? "L" : step === 3 ? "R" : null;
  const by = lift ? -1 : 0;

  drawLegs(px, look, dir, lift);
  drawTorso(px, look, dir, by, lift);
  drawHead(px, look, dir, by, blink);

  outline(ctx);
  return c;
}

function drawLegs(px, L, dir, lift) {
  if (dir === "left") {
    // side view: legs scissor forward/back
    const front = lift === "L" ? -2 : lift === "R" ? 1 : 0;
    const back = -front;
    px(6 + back, 15, 3, 3, L.pantsShade);
    px(6 + back, 18, 3, 2, L.shoes);
    px(7 + front, 15, 3, 3, L.pants);
    px(6 + front, 18, 4, 2, L.shoes);
    return;
  }
  const ly = lift === "L" ? -1 : 0;
  const ry = lift === "R" ? -1 : 0;
  px(5, 15 + ly, 3, 3, L.pants);
  px(8, 15 + ry, 3, 3, L.pantsShade);
  px(5, 18 + ly, 3, 2, L.shoes);
  px(8, 18 + ry, 3, 2, L.shoes);
}

function drawTorso(px, L, dir, by, lift) {
  const y = 9 + by;
  if (dir === "left") {
    px(5, y, 6, 6, L.top);
    px(10, y, 1, 6, L.topShade);
    styleSide(px, L, y);
    // one visible arm swinging front/back
    const swing = lift === "L" ? 1 : lift === "R" ? -1 : 0;
    px(7 + swing, y + 1, 2, 4, L.sleeve ?? L.topShade);
    px(7 + swing, y + 5, 2, 1, L.skin);
    return;
  }
  px(4, y, 8, 6, L.top);
  px(11, y, 1, 6, L.topShade);
  styleFront(px, L, dir, y);
  // arms swing opposite to the lifted leg
  const la = lift === "R" ? 1 : 0;
  const ra = lift === "L" ? 1 : 0;
  px(2, y + la, 2, 5, L.sleeve ?? L.top);
  px(12, y + ra, 2, 5, L.sleeve ?? L.topShade);
  px(2, y + 5 + la, 2, 1, L.skin);
  px(12, y + 5 + ra, 2, 1, L.skinShade);
}

function styleFront(px, L, dir, y) {
  const back = dir === "up";
  switch (L.style) {
    case "vest": // hi-vis vest over a shirt, reflective stripes
      px(4, y, 3, 6, L.accent);
      px(9, y, 3, 6, L.accent);
      if (back) px(4, y, 8, 6, L.accent);
      px(4, y + 2, 8, 1, L.stripe);
      px(4, y + 4, 8, 1, L.stripe);
      if (!back) px(7, y, 2, 6, L.top);
      break;
    case "coat": // lab coat, open at the front, hangs over the hips
      px(4, y, 8, 7, L.coat);
      px(11, y, 1, 7, L.coatShade);
      if (!back) { px(7, y, 2, 4, L.top); px(6, y + 1, 1, 1, L.accent); }
      break;
    case "uniform":
      px(4, y + 5, 8, 1, L.belt);
      if (!back) { px(9, y + 1, 1, 1, L.accent); px(5, y + 1, 2, 1, L.topShade); }
      break;
    case "hoodie":
      if (!back) { px(5, y + 3, 6, 2, L.topShade); px(6, y, 1, 2, L.accent); px(9, y, 1, 2, L.accent); }
      break;
    case "overalls":
      px(4, y, 8, 6, L.shirt);
      px(5, y + 2, 6, 4, L.top);
      px(5, y, 1, 2, L.top);
      px(10, y, 1, 2, L.top);
      if (!back) px(7, y + 3, 2, 1, L.accent);
      break;
  }
}

function styleSide(px, L, y) {
  switch (L.style) {
    case "vest":
      px(5, y, 6, 6, L.accent);
      px(5, y + 2, 6, 1, L.stripe);
      px(5, y + 4, 6, 1, L.stripe);
      break;
    case "coat":
      px(5, y, 6, 7, L.coat);
      px(4, y, 1, 3, L.top);
      break;
    case "uniform":
      px(5, y + 5, 6, 1, L.belt);
      break;
    case "overalls":
      px(5, y, 6, 6, L.shirt);
      px(5, y + 2, 6, 4, L.top);
      break;
  }
}

function drawHead(px, L, dir, by, blink) {
  const y = 1 + by;
  if (dir === "up") {
    px(3, y, 10, 8, L.hair);
    px(3, y + 6, 10, 2, L.hairShade);
    hat(px, L, dir, y);
    if (L.hairStyle === "bun") px(6, y - 1, 4, 3, L.hairShade);
    if (L.hairStyle === "long") px(3, y + 7, 10, 3, L.hair);
    return;
  }
  if (dir === "left") {
    px(3, y + 1, 9, 7, L.skin);
    px(3, y + 7, 9, 1, L.skinShade);
    px(3, y, 10, 2, L.hair);           // top + fringe
    px(8, y, 5, 7, L.hair);            // back of the head
    px(12, y + 2, 1, 5, L.hairShade);
    px(8, y + 6, 4, 1, L.hairShade);
    px(7, y + 3, 1, 2, L.skinShade);   // ear, between face and hair
    px(2, y + 4, 1, 2, L.skin);        // nose
    if (!blink) px(4, y + 3, 1, 2, EYE); else px(4, y + 4, 1, 1, EYE);
    if (L.glasses) px(3, y + 3, 3, 1, L.glasses);
    px(4, y + 6, 1, 1, L.blush);
    if (L.hairStyle === "bun") px(11, y - 1, 3, 3, L.hairShade);
    if (L.hairStyle === "long") px(9, y + 6, 4, 4, L.hair);
    hat(px, L, dir, y);
    return;
  }
  // facing down
  px(3, y, 10, 8, L.skin);
  px(12, y, 1, 8, L.skinShade);
  px(3, y + 7, 10, 1, L.skinShade);
  px(3, y, 10, 2, L.hair);
  px(3, y, 1, 5, L.hair);
  px(12, y, 1, 5, L.hairShade);
  if (L.hairStyle === "short" || L.hairStyle === "long") px(4, y + 2, 3, 1, L.hair);
  if (L.hairStyle === "bun") px(6, y - 1, 4, 2, L.hairShade);
  if (L.hairStyle === "long") { px(2, y + 2, 1, 7, L.hair); px(13, y + 2, 1, 7, L.hairShade); }
  if (!blink) {
    px(5, y + 4, 1, 2, EYE);
    px(10, y + 4, 1, 2, EYE);
  } else {
    px(5, y + 5, 1, 1, EYE);
    px(10, y + 5, 1, 1, EYE);
  }
  if (L.glasses) { px(4, y + 4, 3, 1, L.glasses); px(9, y + 4, 3, 1, L.glasses); px(7, y + 4, 2, 1, L.glasses); }
  px(4, y + 6, 1, 1, L.blush);
  px(11, y + 6, 1, 1, L.blush);
  px(7, y + 6, 2, 1, L.skinShade);
  hat(px, L, dir, y);
}

function hat(px, L, dir, y) {
  if (!L.hat) return;
  if (L.hat === "cap") {
    px(3, y - 1, 10, 3, L.hatColor);
    px(3, y + 1, 10, 1, L.hatShade);
    if (dir === "down") px(2, y + 2, 12, 1, L.hatShade);
    if (dir === "left") px(0, y + 1, 4, 1, L.hatShade);
    if (L.hatBadge && dir !== "up") px(dir === "left" ? 5 : 7, y, 2, 1, L.hatBadge);
  } else if (L.hat === "beanie") {
    px(3, y - 1, 10, 3, L.hatColor);
    px(3, y + 1, 10, 1, L.hatShade);
    px(7, y - 2, 2, 1, L.hatShade);
  } else if (L.hat === "hood") {
    px(2, y - 1, 12, 3, L.top);
    if (dir !== "up") { px(2, y + 1, 1, 7, L.top); px(13, y + 1, 1, 7, L.topShade); }
    if (dir === "left") px(9, y, 5, 9, L.top);
    if (dir === "up") px(2, y, 12, 9, L.top);
  }
}

function outline(ctx) {
  const img = ctx.getImageData(0, 0, FRAME_W, FRAME_H);
  const d = img.data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < FRAME_W && y < FRAME_H && d[(y * FRAME_W + x) * 4 + 3] > 0 && !isOutline(d, (y * FRAME_W + x) * 4);
  const mark = [];
  for (let y = 0; y < FRAME_H; y++) {
    for (let x = 0; x < FRAME_W; x++) {
      if (d[(y * FRAME_W + x) * 4 + 3] > 0) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) mark.push((y * FRAME_W + x) * 4);
    }
  }
  for (const i of mark) { d[i] = OUTLINE[0]; d[i + 1] = OUTLINE[1]; d[i + 2] = OUTLINE[2]; d[i + 3] = OUTLINE[3]; }
  ctx.putImageData(img, 0, 0);
}

function isOutline(d, i) {
  return d[i] === OUTLINE[0] && d[i + 1] === OUTLINE[1] && d[i + 2] === OUTLINE[2];
}

function mirror(src) {
  const c = document.createElement("canvas");
  c.width = FRAME_W;
  c.height = FRAME_H;
  const ctx = c.getContext("2d");
  ctx.translate(FRAME_W, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

// --- the cast ------------------------------------------------------------------

const SKIN = {
  light: ["#f4c8a0", "#d8a07a"],
  tan: ["#d89a6a", "#b0764a"],
  brown: ["#9a6440", "#7a4a2c"],
  deep: ["#6a4028", "#4e2c1a"],
};

const base = (skin) => ({ skin: SKIN[skin][0], skinShade: SKIN[skin][1], blush: "#e88a7a", shoes: "#2a1e1a" });

export const LOOKS = {
  player: {
    ...base("tan"),
    hair: "#3a2414", hairShade: "#24160c", hairStyle: "short",
    hat: "cap", hatColor: "#2ac8e8", hatShade: "#147a9a",
    style: "vest", top: "#24404a", topShade: "#16282e", accent: "#ff8a1a", stripe: "#f0f0e0", sleeve: "#24404a",
    pants: "#2a3448", pantsShade: "#1c2434",
  },
  operator: {
    ...base("brown"),
    hair: "#1a1410", hairShade: "#0e0a08", hairStyle: "short",
    hat: "cap", hatColor: "#2a4e8e", hatShade: "#1a3466", hatBadge: "#ffd15a",
    style: "uniform", top: "#2a5a9a", topShade: "#1a3a6a", accent: "#ffd15a", belt: "#141414",
    pants: "#1a2a4a", pantsShade: "#101c34",
  },
  analyst: {
    ...base("light"),
    hair: "#c8c8d0", hairShade: "#8a8a96", hairStyle: "short", glasses: "#2a2a3a",
    style: "coat", top: "#c83a3a", topShade: "#8a2020", coat: "#e8eef0", coatShade: "#b0bcc4", accent: "#4ae6ff", sleeve: "#e8eef0",
    pants: "#34343e", pantsShade: "#24242c",
  },
  janitor: {
    ...base("tan"),
    hair: "#6a6a6a", hairShade: "#4a4a4a", hairStyle: "short",
    hat: "beanie", hatColor: "#7a4a1a", hatShade: "#5a3410",
    style: "overalls", top: "#5a4a2a", topShade: "#3a301a", shirt: "#8a8a7a", accent: "#ffd15a", sleeve: "#8a8a7a",
    pants: "#5a4a2a", pantsShade: "#3a301a",
  },
  intern: {
    ...base("light"),
    hair: "#e86aa8", hairShade: "#a8407a", hairStyle: "long",
    style: "hoodie", top: "#f0d040", topShade: "#b89a20", accent: "#f8f8f8",
    pants: "#3a4a6a", pantsShade: "#2a3450",
  },
  kofi: {
    ...base("brown"),
    hair: "#1a120c", hairShade: "#0e0a06", hairStyle: "short", glasses: "#3a3a46",
    hat: "beanie", hatColor: "#2a8a6a", hatShade: "#1a5a44",
    style: "hoodie", top: "#3a9a7a", topShade: "#24644e", accent: "#e8e8e8",
    pants: "#2a3040", pantsShade: "#1c2030",
  },
  lind: {
    ...base("deep"),
    hair: "#d0d0d8", hairShade: "#9a9aa4", hairStyle: "bun", glasses: "#c8a040",
    style: "coat", top: "#3a7a5a", topShade: "#24503a", coat: "#f0f4f4", coatShade: "#b8c4c4", accent: "#0aff7a", sleeve: "#f0f4f4",
    pants: "#2a2a34", pantsShade: "#1c1c24",
  },
};

const cache = {};
export function character(id) {
  if (!cache[id]) cache[id] = buildCharacter(LOOKS[id] ?? LOOKS.player);
  return cache[id];
}
