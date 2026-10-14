import { music } from "../audio/music.js";
import { gameState, penalize, scaledPenalty } from "../state.js";
import { CCTV_RULES } from "../story.js";
import { t } from "../i18n/index.js";

// L1 — CCTV survivor search. Readings are neutral sensor values, and every value a survivor or a
// hostile can show is shared with some other kind of feed, so no single reading decides a card.
// The rules that tell them apart are split between the L1 sign and three lobby NPCs (CCTV_RULES
// in story.js); each feed is random per visit but built only from the profiles below, which are
// exactly what those rules allow. Round 2 adds machinery, hot hostiles and quiet movers that only
// THERMAL can settle.
const ROOM_NAMES = [
  "CORRIDOR 7B", "WASHROOM", "LAB ANNEX", "STAIRWELL B", "BREAK ROOM", "MAILROOM", "ELEVATOR 3",
  "ARCHIVE", "BOARDROOM", "COPY ROOM", "OFFICE 3C", "STOREROOM", "OPEN PLAN", "LOADING BAY",
];

// m: P = periodic at breathing pace, A = aperiodic, N = none. `late` variants only appear in
// round 2; w weights the draw towards the look-alikes (quiet people, ticking bots).
const PROFILES = {
  survivor: [
    { m: "P", a: "quiet", w: 3 }, { m: "P", a: "voiced", w: 2 }, { m: "A", a: "voiced", w: 2 },
    { m: "A", a: "quiet", w: 3, temp: [[36.0, 36.8]], late: true }, // cool enough to rule out a hostile
  ],
  hostile: [
    { m: "A", a: "impulsive", w: 2 }, { m: "A", a: "looped" }, { m: "N", a: "impulsive", w: 2 }, { m: "N", a: "looped" },
    { m: "N", a: "quiet", w: 2 },
    { m: "A", a: "quiet", temp: [[38.7, 41.3]], late: true }, // too hot to be a person
  ],
  cleanbot: [{ m: "P", a: "tonal", w: 2 }, { m: "P", a: "impulsive", w: 3 }],
  machinery: [{ m: "N", a: "tonal" }, { m: "N", a: "broadband" }],
  empty: [{ m: "N", a: "quiet" }, { m: "N", a: "broadband" }, { m: "N", a: "voiced" }, { m: "N", a: "looped" }],
};

// Survivors run a fever as often as not and many hostiles are cooled, so warm proves nothing.
// A third value marks a band used only in round 2: with no machinery on floor 2, a hot hostile
// there would be decided by THERMAL alone.
const TEMPS = {
  survivor: [[36.0, 37.2], [37.3, 38.4]],
  hostile: [[37.1, 38.4], [37.1, 38.4], [38.6, 41.3, true]],
  cleanbot: [[36.0, 37.9]],
  machinery: [[38.6, 41.3], [41.6, 45.8]],
  empty: [[15.5, 24.5]],
};

export const ROUNDS = [
  {
    area: "FLOOR 2, EAST WING", survivors: 1, hostiles: 2, decoys: (rnd) => (rnd() < 0.5 ? ["cleanbot", "empty", "empty"] : ["cleanbot", "cleanbot", "empty"]),
    brief: "Reyes: someone badged a door on floor 2 four minutes ago. Find them, and whatever is up there with them.",
    decoyText: "The other 3 feeds are decoys: cleanbots or empty rooms.",
  },
  {
    area: "FLOOR 3, ARCHIVE WING", survivors: 1, hostiles: 3,
    decoys: (rnd) => ["cleanbot", "cleanbot", "machinery", ...(rnd() < 0.5 ? ["machinery", "empty"] : ["empty", "empty"])],
    brief: "Reyes: it's Lind! She ran for floor 3 and went to ground again. Find her, and every hostile between her and the stairs.",
    decoyText: "The other 5 feeds are decoys: cleanbots, machinery or empty rooms.",
  },
];

const NOTE_SOURCES = [["sign", "L1 SIGN"], ["intern", "INTERN"], ["janitor", "JANITOR"], ["analyst", "ANALYST"]];

const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];

function pickWeighted(arr, rnd) {
  let x = rnd() * arr.reduce((n, p) => n + (p.w ?? 1), 0);
  return arr.find((p) => (x -= p.w ?? 1) < 0) ?? arr.at(-1);
}

function shuffle(arr, rnd) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// n different profiles, weighted, redrawn until `ok` accepts the set
function pickDistinct(list, n, rnd, ok = () => true) {
  for (;;) {
    const left = list.slice(), out = [];
    while (out.length < n) out.push(...left.splice(left.indexOf(pickWeighted(left, rnd)), 1));
    if (ok(out)) return out;
  }
}

const voiced = (p) => p.a === "voiced" || p.a === "looped";

// One board for a round. Exported so tests/solvers can check it outside the browser.
export function generateFeeds(round, rnd = Math.random) {
  const r = ROUNDS[round];
  const allowed = (role) => PROFILES[role].filter((p) => round > 0 || !p.late);
  const hostiles = pickDistinct(allowed("hostile"), r.hostiles, rnd,
    (hs) => round === 0 || (hs.some((p) => p.m === "N") && hs.some((p) => p.m === "A")));
  // at least one empty room has the PA talking, so "voiced" never means "person" on its own
  const roles = r.decoys(rnd);
  const empties = pickDistinct(allowed("empty"), roles.filter((role) => role === "empty").length, rnd, (es) => es.some(voiced));
  const decoys = roles.filter((role) => role !== "empty").map((role) => [role, pickWeighted(allowed(role), rnd)]);
  const feeds = [["survivor", pickWeighted(allowed("survivor"), rnd)], ...hostiles.map((p) => ["hostile", p]),
    ...decoys, ...empties.map((p) => ["empty", p])];
  const names = shuffle(ROOM_NAMES.slice(), rnd);
  return shuffle(feeds, rnd).map(([role, p], i) => {
    const [lo, hi] = pick((p.temp ?? TEMPS[role]).filter((b) => round > 0 || !b[2]), rnd);
    const temp = lo + rnd() * (hi - lo);
    const hz = 0.21 + rnd() * 0.13;
    const loop = 3 + Math.floor(rnd() * 7);
    return {
      id: i + 1, name: names[i], role, seed: rnd() * 100, m: p.m, a: p.a, hz,
      motion: p.m === "P" ? `periodic ${hz.toFixed(2)} Hz` : p.m === "A" ? "aperiodic" : "none",
      thermal: `${temp.toFixed(1)}C`,
      audio: {
        quiet: "quiet", voiced: "voiced, irregular", looped: `voiced, looped ${loop}s`,
        tonal: "tonal 120 Hz", impulsive: "impulsive", broadband: "broadband",
      }[p.a],
    };
  });
}

const HEADER_H = 20;
const STATUS_H = 13;
const FOOTER_H = 16;
const GRID_X = 9;
const GRID_TOP = HEADER_H + STATUS_H + 4;
const CARD_W = 150;
const GUTTER = 6;

const CYCLE = { none: "hostile", hostile: "survivor", survivor: "decoy", decoy: "none" };
const STAMPS = {
  hostile: ["✕ HOSTILE", "#ff5a5a", "#330a0a"],
  survivor: ["▲ SURVIVOR", "#0aff7a", "#0a3322"],
  decoy: ["◇ DECOY", "#5a8a7a", "#0a1410"],
};

const STAMP_TIME = 0.25;
const TIME_PENALTY = 30;
const COUNT_PENALTY = 10;
const DONE_TIME = 1.8;
const TRACE_SPAN = 8; // seconds of motion history in a trace

export class Sector1Scene {
  constructor({ hud, sfx, fx, onResult }) {
    this.hints = [
      "No single reading settles a feed. Read MOTION and AUDIO together, then let THERMAL break ties. Tab shows what the sign, the intern, the janitor and the analyst told you.",
      "Breathing pace (periodic 0.20–0.35 Hz) is a person or a sweeping cleanbot, and a cleanbot is never quiet. Hostiles never breathe, and a person never reads 'none'.",
      "Go feed by feed and cross out what it can't be. Motion and body heat are on the L1 sign; hostiles and cleanbot motion are the intern's; cleanbot sounds and people's voices the janitor's; hostile and machine heat the analyst's. When two kinds are left, THERMAL decides, and the counts in the briefing settle the rest.",
    ];
    this.hud = hud;
    this.sfx = sfx;
    this.fx = fx;
    this.onResult = onResult;
    this.round = 0;
    this._t = 0;
    this._load();
  }

  onEnter() { document.body.classList.add("no-objective", "in-puzzle"); music.play("sector"); music.setIntensity(0); }
  onExit() { document.body.classList.remove("no-objective", "in-puzzle"); }

  get part() { return this.round; }
  resume(i) { this.round = i; this._load(); }

  _load() {
    this.rooms = generateFeeds(this.round);
    this.states = this.rooms.map(() => "none");
    this.stamps = this.rooms.map(() => 0);
    this.cursor = 0;
    this.briefing = true;
    this.notes = false;
    this.message = null;
    this.done = 0;
  }

  update(dt, input) {
    this._t += dt;
    this.hud.update(dt);
    for (let i = 0; i < this.stamps.length; i++) this.stamps[i] = Math.max(0, this.stamps[i] - dt);
    if (this.message) {
      this.message.time -= dt;
      if (this.message.time <= 0) this.message = null;
    }
    if (this.done > 0) {
      this.done -= dt;
      if (this.done <= 0) this._next();
      return;
    }
    if (input.wasPressed("pause")) { this.onResult({ success: false, aborted: true }); return; }

    const toggleNotes = input.wasPressed("menu") || input.wasPressed("back");
    if (this.notes) {
      if (toggleNotes || input.wasPressed("interact") || input.wasPressed("submit")) { this.notes = false; this.sfx.play("select"); }
      return;
    }
    if (toggleNotes) { this.notes = true; this.sfx.play("blip"); return; }
    if (this.briefing) {
      if (input.wasPressed("interact") || input.wasPressed("submit")) { this.briefing = false; this.sfx.play("select"); }
      return;
    }

    const cols = 3;
    const before = this.cursor;
    if (input.wasPressed("up") && this.cursor >= cols) this.cursor -= cols;
    else if (input.wasPressed("down") && this.cursor < this.rooms.length - cols) this.cursor += cols;
    else if (input.wasPressed("left") && this.cursor % cols > 0) this.cursor -= 1;
    else if (input.wasPressed("right") && this.cursor % cols < cols - 1) this.cursor += 1;
    if (this.cursor !== before) this.sfx.play("select");

    if (input.wasPressed("interact")) this._cycle();
    if (input.wasPressed("submit")) this._submit(); // only Enter commits: Space must never cost time
  }

  _cycle() {
    const next = CYCLE[this.states[this.cursor]];
    this.states[this.cursor] = next;
    this.stamps[this.cursor] = next === "none" ? 0 : STAMP_TIME;
    this.sfx.play(next === "none" || next === "decoy" ? "select" : "stamp");
  }

  _marked(state) { return this.rooms.filter((_, i) => this.states[i] === state); }

  _submit() {
    const r = ROUNDS[this.round];
    const survivors = this._marked("survivor");
    const hostiles = this._marked("hostile");
    // a miscount costs a little too, so Enter can't be used to probe the board for free
    if (survivors.length !== r.survivors || hostiles.length !== r.hostiles) {
      penalize(COUNT_PENALTY);
      this.sfx.play("denied");
      this._setMessage(`COUNT MISMATCH: mark ▲${r.survivors} and ✕${r.hostiles}. (-${scaledPenalty(COUNT_PENALTY)}s)`, "#ffaa3a");
      return;
    }
    if (survivors.every((f) => f.role === "survivor") && hostiles.every((f) => f.role === "hostile")) {
      this.done = DONE_TIME;
      this.message = null;
      this.sfx.play("success");
      this.fx.flash("#0aff7a");
      return;
    }
    this.hud.addScore(-2);
    penalize(TIME_PENALTY);
    this.sfx.play("error");
    this.fx.shake();
    this.fx.flash("#ff5a5a");
    this._setMessage(`WRONG TARGETS. HALCYON noticed. (-${scaledPenalty(TIME_PENALTY)}s)`, "#ff5a5a");
  }

  _next() {
    if (this.round + 1 < ROUNDS.length) {
      this.round++;
      this.sfx.play("door");
      this.fx.glitch();
      this._load();
      return;
    }
    const survivor = this._marked("survivor")[0].name;
    const hostileNames = this._marked("hostile").map((f) => f.name);
    this.onResult({
      success: true,
      aborted: false,
      report: [
        `[L1] Survivor confirmed in ${survivor}. It's Dr. Ines Lind — HALCYON's lead engineer.`,
        `Hostiles flagged in ${hostileNames.slice(0, -1).join(", ")} and ${hostileNames.at(-1)}. I've sealed those rooms.`,
        "Lind's on her way down to the lobby. Go talk to her — she says she has something for you.",
        "And L2 just unlocked.",
      ],
    });
  }

  _setMessage(text, color) {
    this.message = { text, color, time: 2.6 };
  }

  render(renderer) {
    const w = renderer.width;
    const h = renderer.height;
    const r = ROUNDS[this.round];

    renderer.fillRect(0, 0, w, h, "#020a08");
    for (let y = 0; y < h; y += 4) renderer.fillRect(0, y, w, 1, "rgba(10,255,122,0.05)");
    const scanY = (this._t * 60) % h;
    renderer.fillRect(0, scanY, w, 2, "rgba(10,255,122,0.10)");
    renderer.fillRect(0, scanY - 6, w, 6, "rgba(10,255,122,0.04)");

    renderer.fillRect(0, 0, w, HEADER_H, "#062612");
    renderer.fillRect(0, HEADER_H - 2, w, 2, "#0aff7a");
    renderer.text("SECTOR 1 // LOCATE THE SURVIVOR", 8, HEADER_H / 2, {
      color: "#0aff7a", size: 10, weight: "bold", baseline: "middle",
    });
    const blink = (Math.floor(this._t * 2) & 1) === 0;
    renderer.text(`FEEDS ${this.round + 1}/${ROUNDS.length}`, w - 66, HEADER_H / 2, {
      color: "#cffcff", size: 8, align: "right", baseline: "middle", weight: "bold",
    });
    renderer.text(blink ? "● LIVE" : "  LIVE", w - 8, HEADER_H / 2, {
      color: "#ff5a5a", size: 8, align: "right", baseline: "middle", weight: "bold",
    });

    // the briefing's counts stay on screen; the right side counts the player's own marks
    renderer.fillRect(0, HEADER_H, w, STATUS_H, "#04140c");
    renderer.text(`FIND ▲${r.survivors} SURVIVOR · ✕${r.hostiles} HOSTILES`, 8, HEADER_H + STATUS_H / 2, {
      color: "#8adcb0", size: 8, baseline: "middle", weight: "bold",
    });
    renderer.text(`MARKED ▲${this._marked("survivor").length} ✕${this._marked("hostile").length}`, w - 8, HEADER_H + STATUS_H / 2, {
      color: "#5a8a7a", size: 8, align: "right", baseline: "middle",
    });

    const rows = Math.ceil(this.rooms.length / 3);
    const gap = rows > 2 ? 5 : 8;
    const cardH = Math.floor((h - FOOTER_H - 3 - GRID_TOP - gap * (rows - 1)) / rows);
    for (let i = 0; i < this.rooms.length; i++) {
      const x = GRID_X + (i % 3) * (CARD_W + GUTTER);
      const y = GRID_TOP + Math.floor(i / 3) * (cardH + gap);
      this._drawCard(renderer, this.rooms[i], this.states[i], i === this.cursor && !this.briefing, x, y, cardH, this.stamps[i]);
    }

    renderer.fillRect(0, h - FOOTER_H, w, FOOTER_H, "#062612");
    renderer.fillRect(0, h - FOOTER_H, w, 1, "#0aff7a");
    renderer.text("[arrows] move   [space] mark   [tab] notes   [enter] submit   [esc] exit", 8, h - FOOTER_H / 2, {
      color: "#0a8a4a", size: 8, baseline: "middle",
    });

    if (this.message) {
      const my = h - FOOTER_H - 28;
      renderer.fillRect(0, my, w, 24, "#0a0a0a");
      renderer.fillRect(0, my, w, 1, this.message.color);
      renderer.fillRect(0, my + 23, w, 1, this.message.color);
      renderer.text(this.message.text, w / 2, my + 12, {
        color: this.message.color, size: 9, align: "center", baseline: "middle", weight: "bold",
      });
    }

    if (this.done > 0) this._drawDone(renderer);
    else if (this.notes) this._drawNotes(renderer);
    else if (this.briefing) this._drawBriefing(renderer, r);
  }

  _drawCard(renderer, room, state, focused, x, y, cardH, stamp) {
    const roomy = cardH > 100;
    const stampInfo = STAMPS[state];
    renderer.fillRect(x, y, CARD_W, cardH, stampInfo && state !== "decoy" ? stampInfo[2] : "#0a1410");
    if (focused) {
      const pulse = (Math.sin(this._t * 6) + 1) * 0.5;
      const focusColor = stampInfo && state !== "decoy" ? stampInfo[1] : "#cffcff";
      renderer.strokeRect(x - 2, y - 2, CARD_W + 4, cardH + 4, focusColor, 2);
      const ctx = renderer.ctx;
      ctx.globalAlpha = 0.1 + 0.15 * pulse;
      ctx.fillStyle = focusColor;
      ctx.fillRect(x, y, CARD_W, cardH);
      ctx.globalAlpha = 1;
    } else {
      renderer.strokeRect(x, y, CARD_W, cardH, stampInfo ? stampInfo[1] : "#1a4a30", 1);
    }

    renderer.text(`[${room.id}] ${room.name}`, x + 5, y + (roomy ? 10 : 8), {
      color: "#0aff7a", size: roomy ? 9 : 8, weight: "bold", baseline: "middle",
    });
    renderer.fillRect(x + 5, y + (roomy ? 18 : 15), CARD_W - 10, 1, "#1a4a30");

    const lines = [["MOTION", room.motion], ["THERMAL", room.thermal], ["AUDIO", room.audio]];
    const top = y + (roomy ? 24 : 19);
    const step = roomy ? 13 : 11;
    lines.forEach(([label, value], i) => {
      renderer.text(label, x + 5, top + i * step, { color: "#0a8a4a", size: 8, baseline: "top" });
      renderer.text(value, x + 47, top + i * step, { color: "#cffcff", size: 8, baseline: "top" });
    });

    // the motion sensor's raw trace: the same information as the MOTION line, drawn over time
    if (roomy) this._drawTrace(renderer, room, x + 5, top + 3 * step + 4, CARD_W - 10, 24);
    else this._drawTrace(renderer, room, x + CARD_W - 39, y + 3, 34, 10);

    const sy = y + cardH - (roomy ? 14 : 11);
    if (stampInfo) {
      // rubber-stamp slam: starts big and tilted, settles into place
      const k = stamp / STAMP_TIME;
      const ctx = renderer.ctx;
      ctx.save();
      ctx.translate(x + CARD_W / 2, sy);
      ctx.rotate(-0.05 - k * 0.25);
      ctx.scale(1 + k * 1.2, 1 + k * 1.2);
      ctx.globalAlpha = 1 - k * 0.5;
      renderer.fillRect(-(CARD_W - 20) / 2, -7, CARD_W - 20, 14, "#000");
      renderer.strokeRect(-(CARD_W - 20) / 2, -7, CARD_W - 20, 14, stampInfo[1], 1);
      renderer.text(stampInfo[0], 0, 0, { color: stampInfo[1], size: 9, weight: "bold", align: "center", baseline: "middle" });
      ctx.restore();
    } else {
      renderer.text("[ unmarked ]", x + CARD_W / 2, sy, { color: "#1a4a30", size: 8, align: "center", baseline: "middle" });
    }
  }

  _drawTrace(renderer, room, x, y, w, h) {
    const ctx = renderer.ctx;
    renderer.fillRect(x, y, w, h, "#000");
    renderer.strokeRect(x, y, w, h, "#1a4a30", 1);
    ctx.strokeStyle = room.m === "N" ? "#1a6a40" : "#2adf8a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= w - 4; i++) {
      const ts = this._t - ((w - 4 - i) / (w - 4)) * TRACE_SPAN;
      let v = 0;
      if (room.m === "P") v = Math.sin(ts * room.hz * Math.PI * 2 + room.seed);
      else if (room.m === "A") v = jitter(room.seed, ts * 2.3);
      const py = y + h / 2 - v * (h / 2 - 2);
      if (i === 0) ctx.moveTo(x + 2 + i, py); else ctx.lineTo(x + 2 + i, py);
    }
    ctx.stroke();
  }

  _drawBriefing(renderer, r) {
    const w = renderer.width;
    const bw = 420, bx = (w - bw) / 2, by = 70;
    const brief = wrap(renderer.ctx, r.brief, bw - 24, 8);
    const bh = 98 + brief.length * 11;
    renderer.fillRect(0, 0, w, renderer.height, "rgba(0,0,0,0.5)");
    renderer.fillRect(bx, by, bw, bh, "#03140b");
    renderer.strokeRect(bx, by, bw, bh, "#0aff7a", 2);
    renderer.text(`FEEDS ${this.round + 1}/${ROUNDS.length} — ${r.area}`, bx + 12, by + 14, {
      color: "#0aff7a", size: 10, weight: "bold", baseline: "middle",
    });
    brief.forEach((line, i) => renderer.text(line, bx + 12, by + 32 + i * 11, { color: "#cffcff", size: 8, baseline: "middle" }));
    const cy = by + 40 + brief.length * 11;
    renderer.text(`MARK  ▲ ${r.survivors} SURVIVOR   ✕ ${r.hostiles} HOSTILES`, w / 2, cy, {
      color: "#ffffff", size: 10, weight: "bold", align: "center", baseline: "middle",
    });
    renderer.text(r.decoyText, w / 2, cy + 18, { color: "#8adcb0", size: 8, align: "center", baseline: "middle" });
    renderer.text("Feeds are live readings. What they mean, the staff can tell you.", w / 2, cy + 32, {
      color: "#5a8a7a", size: 8, align: "center", baseline: "middle",
    });
    renderer.text("[enter] start   [tab] field notes   [h] hint", w / 2, by + bh - 11, {
      color: "#0a8a4a", size: 8, align: "center", baseline: "middle",
    });
  }

  _drawNotes(renderer) { drawFieldNotes(renderer); }

  _drawDone(renderer) {
    const w = renderer.width, h = renderer.height;
    const last = this.round + 1 >= ROUNDS.length;
    renderer.fillRect(0, h / 2 - 26, w, 52, "rgba(0,20,10,0.92)");
    renderer.fillRect(0, h / 2 - 26, w, 1, "#0aff7a");
    renderer.fillRect(0, h / 2 + 25, w, 1, "#0aff7a");
    renderer.text(last ? "✓ ALL FEEDS CONFIRMED" : "✓ FEEDS CONFIRMED", w / 2, h / 2 - 8, {
      color: "#0aff7a", size: 12, weight: "bold", align: "center", baseline: "middle",
    });
    renderer.text(last ? "Reyes: sealing those rooms now." : "Reyes: the survivor's moving. Switching cameras…", w / 2, h / 2 + 11, {
      color: "#cffcff", size: 8, align: "center", baseline: "middle",
    });
  }
}

// The lobby rules the player has heard; the uplink's LUMEN lock shows the same notes.
export function drawFieldNotes(renderer) {
  const w = renderer.width;
  const ctx = renderer.ctx;
  const bx = 10, bw = w - 20, by = 24;
  // one entry per rule: [first line?, text]; the bullet marks where each rule starts
  const blocks = NOTE_SOURCES.map(([id, label]) => {
    const heard = gameState.heard?.includes(id);
    const lines = heard
      ? CCTV_RULES[id].flatMap((rule) => wrap(ctx, rule, bw - 30, 8).map((line, i) => [i === 0, line]))
      : [[false, t("nothing yet. Look around the lobby.")]];
    return { label, heard, lines };
  });
  const bh = 26 + blocks.reduce((n, b) => n + 13 + b.lines.length * 10, 0) + 12;
  renderer.fillRect(0, 0, w, renderer.height, "rgba(0,0,0,0.6)");
  renderer.fillRect(bx, by, bw, bh, "#03140b");
  renderer.strokeRect(bx, by, bw, bh, "#4ae6ff", 2);
  renderer.text("FIELD NOTES — what you've been told", bx + 10, by + 12, {
    color: "#4ae6ff", size: 10, weight: "bold", baseline: "middle",
  });
  let y = by + 28;
  for (const b of blocks) {
    renderer.text(b.label, bx + 10, y, { color: b.heard ? "#0aff7a" : "#3a6a5a", size: 8, weight: "bold", baseline: "middle" });
    y += 11;
    b.lines.forEach(([first, line]) => {
      if (first) renderer.text("▸", bx + 12, y, { color: "#4ae6ff", size: 8, baseline: "middle" });
      renderer.text(line, bx + 20, y, { color: b.heard ? "#cffcff" : "#3a6a5a", size: 8, baseline: "middle" });
      y += 10;
    });
    y += 2;
  }
  renderer.text("[tab] close", bx + bw - 10, by + bh - 9, { color: "#2a7a8a", size: 8, align: "right", baseline: "middle" });
}

// Smooth, non-repeating wobble in [-1, 1] for aperiodic motion traces.
function jitter(seed, x) {
  const i = Math.floor(x), f = x - i;
  const n = (k) => { const s = Math.sin((k + seed * 13.7) * 127.1) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
  const s = f * f * (3 - 2 * f);
  return n(i) * (1 - s) + n(i + 1) * s;
}

function wrap(ctx, text, maxW, size) {
  ctx.font = `normal ${size}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
  const out = [];
  let line = "";
  for (const word of t(text).split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out;
}
