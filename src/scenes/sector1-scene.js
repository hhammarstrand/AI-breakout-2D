import { gameState } from "../state.js";

// Each visit generates a fresh set of feeds. The rules are spread across the lobby:
//  - L1 sign / Analyst: humans read 36-37C, hostiles run over 38C
//  - Intern: hostiles never hold still; humans are calm; empty rooms show no motion
//  - Janitor: cleanbots are ~37C too, but they whir instead of making human sounds
//  - Analyst (later): machinery runs hot but doesn't move
const ROOM_NAMES = [
  "LOBBY", "SERVER HALL", "CORRIDOR 7B", "WASHROOM", "LAB ANNEX", "STAIRWELL B",
  "BREAK ROOM", "MAILROOM", "ELEVATOR 3", "ARCHIVE", "COLD STORAGE", "BOARDROOM",
];
const SURVIVOR_PROFILES = [
  { motion: "breathing", audio: "coughing" },
  { motion: "shallow", audio: "sobbing" },
  { motion: "slow shift", audio: "whispers" },
];
const HOSTILE_PROFILES = [
  { motion: "irregular", audio: "wet clicks" },
  { motion: "erratic", audio: "servo whine" },
  { motion: "erratic", audio: "skittering" },
  { motion: "twitching", audio: "static hiss" },
  { motion: "irregular", audio: "dragging" },
];
const CLEANBOT_PROFILES = [
  { motion: "slow sweep", audio: "brush whir" },
  { motion: "slow shift", audio: "motor hum" },
  { motion: "breathing?", audio: "servo tick" },
];
const EMPTY_PROFILES = [
  { motion: "none", audio: "ambient", temp: [19.5, 23.5] },
  { motion: "none", audio: "fan whir", temp: [38.2, 40.5] },
  { motion: "none", audio: "dripping", temp: [16.0, 21.0] },
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const temp = (lo, hi) => `${(lo + Math.random() * (hi - lo)).toFixed(1)}C`;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateRooms() {
  const roles = shuffle(["survivor", "hostile", "hostile", "hostile", "cleanbot", "empty"]);
  const names = shuffle(ROOM_NAMES.slice());
  return roles.map((role, i) => {
    let p, thermal;
    if (role === "survivor") { p = pick(SURVIVOR_PROFILES); thermal = temp(36.1, 37.2); }
    else if (role === "hostile") { p = pick(HOSTILE_PROFILES); thermal = temp(38.1, 42.0); }
    else if (role === "cleanbot") { p = pick(CLEANBOT_PROFILES); thermal = temp(36.3, 37.1); }
    else { p = pick(EMPTY_PROFILES); thermal = temp(...p.temp); }
    return { id: i + 1, name: names[i], role, motion: p.motion, thermal, audio: p.audio };
  });
}

const COLS = 3;
const ROWS_GRID = 2;
const HEADER_H = 24;
const FOOTER_H = 24;
const GUTTER = 12;
const CARD_W = 144;
const CARD_H = 116;

const CYCLE = { none: "hostile", hostile: "survivor", survivor: "none" };

const STAMP_TIME = 0.25;
const TIME_PENALTY = 30;

export class Sector1Scene {
  constructor({ hud, sfx, fx, onResult }) {
    this.hud = hud;
    this.sfx = sfx;
    this.fx = fx;
    this.onResult = onResult;
    this.rooms = generateRooms();
    this.cursor = 0;
    this.states = this.rooms.map(() => "none");
    this.stamps = this.rooms.map(() => 0);
    this.message = null;
    this.messageTime = 0;
    this.attempts = 0;
    this._t = 0;
  }

  onEnter() { document.body.classList.add("no-objective"); }
  onExit() { document.body.classList.remove("no-objective"); }

  update(dt, input) {
    this._t += dt;
    this.hud.update(dt);
    for (let i = 0; i < this.stamps.length; i++) this.stamps[i] = Math.max(0, this.stamps[i] - dt);
    if (this.message) {
      this.messageTime -= dt;
      if (this.messageTime <= 0) this.message = null;
    }

    const before = this.cursor;
    if (input.wasPressed("up") && this.cursor >= COLS) this.cursor -= COLS;
    else if (input.wasPressed("down") && this.cursor < this.rooms.length - COLS) this.cursor += COLS;
    else if (input.wasPressed("left") && this.cursor % COLS > 0) this.cursor -= 1;
    else if (input.wasPressed("right") && this.cursor % COLS < COLS - 1) this.cursor += 1;
    if (this.cursor !== before) this.sfx.play("select");

    if (input.wasPressed("interact")) this._cycle();
    if (input.wasPressed("submit")) this._submit();
    if (input.wasPressed("pause")) this.onResult({ success: false, aborted: true });
  }

  _cycle() {
    const next = CYCLE[this.states[this.cursor]];
    this.states[this.cursor] = next;
    this.stamps[this.cursor] = next === "none" ? 0 : STAMP_TIME;
    this.sfx.play(next === "none" ? "select" : "stamp");
  }

  _submit() {
    const survivors = [];
    const hostiles = [];
    for (let i = 0; i < this.states.length; i++) {
      if (this.states[i] === "survivor") survivors.push(i + 1);
      else if (this.states[i] === "hostile") hostiles.push(i + 1);
    }

    if (survivors.length !== 1) {
      this.sfx.play("denied");
      this._setMessage("Mark exactly 1 SURVIVOR.", "#ffaa3a");
      return;
    }
    if (hostiles.length !== 3) {
      this.sfx.play("denied");
      this._setMessage(`Mark exactly 3 HOSTILES (currently ${hostiles.length}).`, "#ffaa3a");
      return;
    }

    this.attempts += 1;
    const role = (id) => this.rooms[id - 1].role;
    const correct =
      role(survivors[0]) === "survivor" &&
      hostiles.every((h) => role(h) === "hostile");

    if (correct) {
      const survivor = this.rooms[survivors[0] - 1].name;
      const hostileNames = hostiles.map((h) => this.rooms[h - 1].name);
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
    } else {
      this.hud.addScore(-2);
      gameState.secondsLeft = Math.max(1, gameState.secondsLeft - TIME_PENALTY);
      this.sfx.play("error");
      this.fx.shake();
      this.fx.flash("#ff5a5a");
      this._setMessage(`WRONG TARGETS. HALCYON noticed. (-${TIME_PENALTY}s)`, "#ff5a5a");
    }
  }

  _setMessage(text, color) {
    this.message = { text, color };
    this.messageTime = 2.6;
  }

  render(renderer) {
    const w = renderer.width;
    const h = renderer.height;

    renderer.fillRect(0, 0, w, h, "#020a08");
    for (let y = 0; y < h; y += 4) {
      renderer.fillRect(0, y, w, 1, "rgba(10,255,122,0.05)");
    }

    const scanY = (this._t * 60) % h;
    renderer.fillRect(0, scanY, w, 2, "rgba(10,255,122,0.10)");
    renderer.fillRect(0, scanY - 6, w, 6, "rgba(10,255,122,0.04)");

    renderer.fillRect(0, 0, w, HEADER_H, "#062612");
    renderer.fillRect(0, HEADER_H - 2, w, 2, "#0aff7a");
    renderer.text("SECTOR 1 // LOCATE THE SURVIVOR", 8, HEADER_H / 2, {
      color: "#0aff7a", size: 11, weight: "bold", baseline: "middle",
    });
    const blink = (Math.floor(this._t * 2) & 1) === 0;
    renderer.text(blink ? "● LIVE FEED" : "  LIVE FEED", w - 8, HEADER_H / 2, {
      color: "#ff5a5a", size: 9, align: "right", baseline: "middle", weight: "bold",
    });

    for (let i = 0; i < this.rooms.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = GUTTER + col * (CARD_W + GUTTER);
      const y = HEADER_H + GUTTER + row * (CARD_H + 16);
      this._drawCard(renderer, this.rooms[i], this.states[i], i === this.cursor, x, y, this.stamps[i]);
    }

    renderer.fillRect(0, h - FOOTER_H, w, FOOTER_H, "#062612");
    renderer.fillRect(0, h - FOOTER_H, w, 1, "#0aff7a");
    renderer.text(
      "[arrows] move   [space] cycle hostile/survivor   [enter] submit   [esc] exit",
      8, h - FOOTER_H / 2,
      { color: "#0a8a4a", size: 8, baseline: "middle" },
    );

    if (this.message) {
      const my = h - FOOTER_H - 30;
      renderer.fillRect(0, my, w, 26, "#0a0a0a");
      renderer.fillRect(0, my, w, 1, this.message.color);
      renderer.fillRect(0, my + 25, w, 1, this.message.color);
      renderer.text(this.message.text, w / 2, my + 13, {
        color: this.message.color, size: 10, align: "center", baseline: "middle", weight: "bold",
      });
    }
  }

  _drawCard(renderer, room, state, focused, x, y, stamp) {
    let bg = "#0a1410";
    let border = "#1a4a30";
    let tag = null;
    let tagColor = null;
    if (state === "survivor") {
      bg = "#0a3322"; border = "#0aff7a"; tag = "▲ SURVIVOR"; tagColor = "#0aff7a";
    } else if (state === "hostile") {
      bg = "#330a0a"; border = "#ff5a5a"; tag = "✕ HOSTILE"; tagColor = "#ff5a5a";
    }

    renderer.fillRect(x, y, CARD_W, CARD_H, bg);

    if (focused) {
      const pulse = (Math.sin(this._t * 6) + 1) * 0.5;
      const focusColor = state === "survivor" ? "#0aff7a"
                       : state === "hostile" ? "#ff5a5a"
                       : "#cffcff";
      renderer.strokeRect(x - 2, y - 2, CARD_W + 4, CARD_H + 4, focusColor, 2);
      renderer.strokeRect(x, y, CARD_W, CARD_H, focusColor, 1);
      const ctx = renderer.ctx;
      ctx.globalAlpha = 0.15 + 0.2 * pulse;
      ctx.fillStyle = focusColor;
      ctx.fillRect(x, y, CARD_W, CARD_H);
      ctx.globalAlpha = 1;
    } else {
      renderer.strokeRect(x, y, CARD_W, CARD_H, border, 1);
    }

    renderer.text(`[${room.id}] ${room.name}`, x + 8, y + 10, {
      color: "#0aff7a", size: 10, weight: "bold", baseline: "middle",
    });
    renderer.fillRect(x + 8, y + 18, CARD_W - 16, 1, "#1a4a30");

    const lines = [
      ["MOTION",  room.motion],
      ["THERMAL", room.thermal],
      ["AUDIO",   room.audio],
    ];
    for (let i = 0; i < lines.length; i++) {
      const ly = y + 28 + i * 12;
      renderer.text(lines[i][0], x + 8, ly, { color: "#0a8a4a", size: 8, baseline: "top" });
      renderer.text(lines[i][1], x + 50, ly, { color: "#cffcff", size: 8, baseline: "top" });
    }

    const thx = x + CARD_W - 38;
    const thy = y + 26;
    renderer.fillRect(thx, thy, 30, 30, "#000");
    renderer.strokeRect(thx, thy, 30, 30, "#1a4a30", 1);
    const noiseFrame = Math.floor(this._t * 4) & 3;
    for (let i = 0; i < 22; i++) {
      const dx = (room.id * 13 + i * 7 + noiseFrame * 5) % 28;
      const dy = (room.id * 19 + i * 11 + noiseFrame * 3) % 28;
      renderer.fillRect(thx + dx + 1, thy + dy + 1, 1, 1, "#1a3520");
    }
    if (room.motion !== "none" && Math.sin(this._t * 3 + room.id) > -0.3) {
      const bx = thx + 10 + Math.round(Math.sin(this._t * 1.7 + room.id * 2) * 6);
      renderer.fillRect(bx, thy + 9, 6, 4, "#2a6a40");
      renderer.fillRect(bx + 1, thy + 13, 4, 7, "#2a6a40");
    }
    renderer.text(`CAM-0${room.id}`, thx + 15, thy + 26, {
      color: "#4ae6ff", size: 6, align: "center", baseline: "middle",
    });

    if (tag) {
      // rubber-stamp slam: starts big and tilted, settles into place
      const k = stamp / STAMP_TIME;
      const ctx = renderer.ctx;
      ctx.save();
      ctx.translate(x + CARD_W / 2, y + CARD_H - 15);
      ctx.rotate(-0.05 - k * 0.25);
      ctx.scale(1 + k * 1.2, 1 + k * 1.2);
      ctx.globalAlpha = 1 - k * 0.5;
      renderer.fillRect(-(CARD_W - 16) / 2, -7, CARD_W - 16, 14, "#000");
      renderer.strokeRect(-(CARD_W - 16) / 2, -7, CARD_W - 16, 14, tagColor, 1);
      renderer.text(tag, 0, 0, {
        color: tagColor, size: 9, weight: "bold", align: "center", baseline: "middle",
      });
      ctx.restore();
    } else {
      renderer.text("[ unmarked ]", x + CARD_W / 2, y + CARD_H - 15, {
        color: "#1a4a30", size: 8, align: "center", baseline: "middle",
      });
    }
  }
}
