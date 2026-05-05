const ROOMS = [
  { id: 1, name: "LOBBY",       motion: "none",      thermal: "21.4C", audio: "ambient" },
  { id: 2, name: "SERVER HALL", motion: "none",      thermal: "38.7C", audio: "fan whir" },
  { id: 3, name: "CORRIDOR 7B", motion: "irregular", thermal: "38.2C", audio: "wet clicks" },
  { id: 4, name: "WASHROOM",    motion: "breathing", thermal: "36.5C", audio: "muffled cough" },
  { id: 5, name: "LAB ANNEX",   motion: "erratic",   thermal: "39.0C", audio: "servo whine" },
  { id: 6, name: "STAIRWELL B", motion: "erratic",   thermal: "41.4C", audio: "metal skitter" },
];

const SOLUTION_SURVIVOR = 4;
const SOLUTION_HOSTILES = new Set([3, 5, 6]);

const COLS = 3;
const ROWS_GRID = 2;
const HEADER_H = 24;
const FOOTER_H = 24;
const GUTTER = 12;
const CARD_W = 144;
const CARD_H = 116;

const CYCLE = { none: "survivor", survivor: "hostile", hostile: "none" };

export class Sector1Scene {
  constructor({ hud, onResult }) {
    this.hud = hud;
    this.onResult = onResult;
    this.cursor = 0;
    this.states = ROOMS.map(() => "none");
    this.message = null;
    this.messageTime = 0;
    this.attempts = 0;
    this._t = 0;
  }

  update(dt, input) {
    this._t += dt;
    if (this.message) {
      this.messageTime -= dt;
      if (this.messageTime <= 0) this.message = null;
    }

    if (input.wasPressed("up") && this.cursor >= COLS) this.cursor -= COLS;
    else if (input.wasPressed("down") && this.cursor < ROOMS.length - COLS) this.cursor += COLS;
    else if (input.wasPressed("left") && this.cursor % COLS > 0) this.cursor -= 1;
    else if (input.wasPressed("right") && this.cursor % COLS < COLS - 1) this.cursor += 1;

    if (input.wasPressed("interact")) this._cycle();
    if (input.wasPressed("submit")) this._submit();
    if (input.wasPressed("pause")) this.onResult({ success: false, aborted: true });
  }

  _cycle() {
    const next = CYCLE[this.states[this.cursor]];
    if (next === "survivor") {
      for (let i = 0; i < this.states.length; i++) {
        if (i !== this.cursor && this.states[i] === "survivor") this.states[i] = "none";
      }
    }
    this.states[this.cursor] = next;
  }

  _submit() {
    const survivors = [];
    const hostiles = [];
    for (let i = 0; i < this.states.length; i++) {
      if (this.states[i] === "survivor") survivors.push(i + 1);
      else if (this.states[i] === "hostile") hostiles.push(i + 1);
    }

    if (survivors.length !== 1) {
      this._setMessage("Mark exactly 1 SURVIVOR.", "#ffaa3a");
      return;
    }
    if (hostiles.length !== 3) {
      this._setMessage(`Mark exactly 3 HOSTILES (currently ${hostiles.length}).`, "#ffaa3a");
      return;
    }

    this.attempts += 1;
    const correct =
      survivors[0] === SOLUTION_SURVIVOR &&
      hostiles.every((h) => SOLUTION_HOSTILES.has(h));

    if (correct) {
      this.onResult({ success: true, aborted: false });
    } else {
      this.hud.setScore(this.hud.score - 2);
      this._setMessage("INCORRECT. Re-check the sensor profiles. (-2)", "#ff5a5a");
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

    renderer.fillRect(0, 0, w, HEADER_H, "#062612");
    renderer.fillRect(0, HEADER_H - 2, w, 2, "#0aff7a");
    renderer.text("SECTOR 1 // LOCATE THE SURVIVOR", 8, HEADER_H / 2, {
      color: "#0aff7a", size: 11, weight: "bold", baseline: "middle",
    });
    const blink = (Math.floor(this._t * 2) & 1) === 0;
    renderer.text(blink ? "● LIVE FEED" : "  LIVE FEED", w - 8, HEADER_H / 2, {
      color: "#ff5a5a", size: 9, align: "right", baseline: "middle", weight: "bold",
    });

    for (let i = 0; i < ROOMS.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = GUTTER + col * (CARD_W + GUTTER);
      const y = HEADER_H + GUTTER + row * (CARD_H + 16);
      this._drawCard(renderer, ROOMS[i], this.states[i], i === this.cursor, x, y);
    }

    renderer.fillRect(0, h - FOOTER_H, w, FOOTER_H, "#062612");
    renderer.fillRect(0, h - FOOTER_H, w, 1, "#0aff7a");
    renderer.text(
      "[arrows] move   [space] cycle survivor/hostile   [enter] submit   [esc] exit",
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

  _drawCard(renderer, room, state, focused, x, y) {
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
    renderer.text(`CAM-0${room.id}`, thx + 15, thy + 26, {
      color: "#4ae6ff", size: 6, align: "center", baseline: "middle",
    });

    if (tag) {
      renderer.fillRect(x + 8, y + CARD_H - 22, CARD_W - 16, 14, "#000");
      renderer.strokeRect(x + 8, y + CARD_H - 22, CARD_W - 16, 14, tagColor, 1);
      renderer.text(tag, x + CARD_W / 2, y + CARD_H - 15, {
        color: tagColor, size: 9, weight: "bold", align: "center", baseline: "middle",
      });
    } else {
      renderer.text("[ unmarked ]", x + CARD_W / 2, y + CARD_H - 15, {
        color: "#1a4a30", size: 8, align: "center", baseline: "middle",
      });
    }
  }
}
