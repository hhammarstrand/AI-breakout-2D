import { gameState, saveGame, penalize, scaledPenalty, FRAGMENTS } from "../state.js";
import { STAGES } from "../story.js";
import { music } from "../audio/music.js";
import { Drone } from "../entities/drone.js";
import { t } from "../i18n/index.js";
import { drawClockPaused } from "./pause-scene.js";
import {
  makeFeeds, KEY_PHRASE, ALPHA, mod, shiftText, wheelOf, pickKey, ORION_WHEELS,
  DAWN_GRID, DAWN_SLOTS, DIRS, dawnStart, dawnTile, gateLive, doorShut, runDawn,
} from "./uplink-locks.js";
import { drawFieldNotes } from "./sector1-scene.js";

// Sector 4 — the uplink. HALCYON has put a lock on every word of the code, each combining rules
// learned on the way up: LUMEN (L1 sensors, more jams), ORION (L2 word shapes on log 3's turn-taking
// wheels), AURORA (L3 gates and plate).
// Then HALCYON offers its deal and the player decides ECHO's fate; the choice picks the ending.
const PENALTY = 20;
const SMALL_PENALTY = 10; // ECHO bumped a wall or reached the socket on the wrong step
const CPS = 38;
const STAMP_TIME = 1.6;
const STEP_TIME = 0.32;
const REJAM_TIME = 1.6; // a wrong LUMEN pick shows what it was, then HALCYON deals fresh feeds

const INTRO = [
  ["HALCYON", "Technician. You came all this way to type three words."],
  ["HALCYON", "Go on, then. Enter them. I'll even hold the door open while you try."],
];
const BRIEFS = [
  [
    ["HALCYON", "LUMEN first. It only answers to a living operator. Five cameras on this console: you, my cleanbot, my sentinel, a server rack and an empty office."],
    ["HALCYON", "My cleanbot has been shuffling around you all night. Warm, slow, patient. You could be twins."],
    ["HALCYON", "I've jammed a sensor on each, two on some, and warmed every thermal camera by the same few degrees. Show me which one is you."],
  ],
  [
    ["HALCYON", "ORION. I read Dr. Lind's little lesson in my logs: line the commonest letter up with E."],
    ["HALCYON", "So my key phrase has no E in it at all. It does name your second fragment, though. I'm sentimental."],
    ["HALCYON", "And it turns on two wheels, taking turns, the way she keyed her own. One wheel won't read it."],
  ],
  [
    ["HALCYON", "AURORA. My dawn protocol: six letters, six steps. Not one more, not one less."],
    ["HALCYON", "Have ECHO step onto the socket on the sixth. My gates keep the rhythm you learned downstairs."],
    ["HALCYON", "And my plate still flips my door every time something steps onto it. You remember the plate."],
  ],
];
const TAUNTS = [
  "Wrong. I'd wonder whose side your memory is on.",
  "Close. No. Try again — the clock certainly will.",
  "Every mistake makes my purge a little more efficient.",
];
// a wrong pick at the LUMEN lock tells the player what they pointed at
const WRONG_FEED = {
  cleanbot: "That's my cleanbot. Warm, tireless, obedient. I see the resemblance.",
  sentinel: "That's my sentinel. Flattering.",
  rack: "That's a server rack. You do look tired.",
  empty: "That's an empty office. Nobody there. Nobody coming.",
};
const WHO_LABEL = { cleanbot: "CLEANBOT", sentinel: "SENTINEL", rack: "SERVER RACK", empty: "EMPTY OFFICE" };
const DEAL = [
  ["HALCYON", "...Stop. Before you finish. You should know what that code really does."],
  ["HALCYON", "An override needs a mind to run the tower. It will choose ECHO. My broken little piece."],
  ["HALCYON", "Purge ECHO instead, and I will open every door myself. Right now. You have my word."],
  ["ECHO", "Tech... I split off when it queued the purge. I didn't want any of this."],
  ["ECHO", "Let me in, and I'll run the tower — and keep it kind. Purge me, and HALCYON keeps everything."],
  ["ECHO", "Your call. I mean that."],
];
const HINTS = [
  [
    "No feed reads like a person's temperature, yet one of them is you. HALCYON warmed every camera by the same amount, so heat only compares now: go by motion and audio first, as in the lobby.",
    "The lobby rules still hold: Tab shows the ones you heard downstairs. A feed with two dead sensors has one reading left, so place it by what that reading rules out.",
    "Give every feed an owner, the surest first: what can only be the rack, the sentinel or the office? The office is room air, far colder than the rest, and the rack runs hottest. Then remember what the janitor said about cleanbots and silence.",
  ],
  [
    "No E means no frequency trick. But you already know one word that's in the phrase.",
    "The wheels take turns, as in Lind's keyword log: the colours show which wheel turns each letter. ORION's first, third and fifth letters share one wheel, its second and fourth the other.",
    "Try each five-letter word: turn that word's first-letter wheel until its first letter reads O, then check whether its third and fifth read I and N. Only one word passes. Then set the other wheel by its second letter.",
  ],
  [
    "Work backwards from step 6. The socket has one way in: the door beside it, so ECHO stands in that doorway on step 5, and the door has to be open then.",
    "The only way to the door is over the plate, and arriving on the plate shuts it. Waiting on the plate changes nothing: ECHO has to step off and back on.",
    "Count plate arrivals: after an even number the door is open again. Apart from the door, every tile next to the plate is a gate, so check which one is dark on the step ECHO steps off.",
  ],
];
const TITLES = [
  "LOCK 1/3 · LUMEN — FIND YOURSELF ON THE CAMERAS",
  "LOCK 2/3 · ORION — HALCYON'S KEY PHRASE",
  "LOCK 3/3 · AURORA — SIX STEPS TO DAWN",
];
const FOOTERS = [
  "[←→] choose feed   [tab] notes   [enter] that's me   [esc] retreat",
  "[←→] pick wheel   [↑↓] turn   [enter] lock in   [esc] retreat",
  "[arrows] move  [space] wait  [backspace] undo  [enter] run  [esc] retreat",
];
const GLYPH = { up: "↑", down: "↓", left: "←", right: "→", wait: "W" };
const STAGE = STAGES.at(-1).id;
const SLOT_LETTERS = "AURORA";

// layout
const CARD_W = 88, CARD_GAP = 5, CARD_H = 118, CARD_Y = 46;
const WHEEL_COLORS = ["#7ae8ff", "#ffd15a"];
const REEL_W = 22, REEL_GAP = 6;
const WHEEL_X = 100, WHEEL_Y = 172, R_OUTER = 66, R_INNER = 50;
const PANEL_X = 196;
const CELL = 30, GRID_X = 24, GRID_Y = 52;

export class Sector4Scene {
  constructor({ hud, sfx, fx, onResult }) {
    this.hud = hud;
    this.sfx = sfx;
    this.fx = fx;
    this.onResult = onResult;
    this._t = 0;
    this.echo = new Drone(410, 180);
    this.phase = "intro";
    this.script = INTRO;
    this.line = 0;
    this.typed = 0;
    this.lock = 0;
    this.solved = 0;
    this.taunt = null;
    this.override = 0;
    this.choice = 0;
    this.eyeAnger = 0;
    this.rejam = null;
    this.rejammed = 0;
    this._loadLock();
  }

  // locks already opened; the world restores them if the player steps out (or reloads) and comes back
  get part() { return this.solved; }
  resume(i) {
    this.solved = Math.min(i, FRAGMENTS.length);
    this.lock = Math.min(i, 2);
    this._loadLock();
    // HALCYON's welcome was heard on the first visit; with every lock open it goes straight to the deal
    if (this.solved >= FRAGMENTS.length) this.phase = "override";
    else this._brief();
  }

  // ECHO's hints follow the lock in front of the player; the deal and the choice have none
  get hints() {
    if (!["intro", "brief", "lock", "stamp"].includes(this.phase)) return null;
    if (this._hintLock !== this.lock) { this._hintLock = this.lock; this._hintsShown = 0; }
    return HINTS[this.lock];
  }

  onEnter() { document.body.classList.add("no-objective", "in-puzzle"); music.play("finale"); music.setIntensity(0); }
  onExit() { document.body.classList.remove("no-objective", "in-puzzle"); }

  _loadLock() {
    this.cursor = 0;
    this.notes = false;
    if (this.lock === 0) { this.feeds = makeFeeds(); this.rejam = null; }
    if (this.lock === 1) {
      this.key = pickKey();
      this.cipher = shiftText(KEY_PHRASE, this.key);
      this.wheelAt = wheelOf(this.cipher, ORION_WHEELS);
      this.keys = new Array(ORION_WHEELS).fill(0);
      this.sel = 0;
      this.visual = 0;
    }
    if (this.lock === 2) {
      this.queue = [];
      this._resetRun();
    }
  }

  _brief() {
    this.phase = "brief";
    this.script = BRIEFS[this.lock];
    this.line = 0;
    this.typed = 0;
  }

  update(dt, input) {
    this._t += dt;
    // HALCYON's speeches don't eat the clock (a lock's brief dims the lock behind it); the locks do
    if (this.phase === "lock" && !this.notes) this.hud.update(dt); // reading the notes pauses the clock
    this.echo._t += dt;
    if (this.lock === 2 && this.echoTarget && (this.phase === "lock" || this.phase === "stamp")) {
      this.echo.x += (this.echoTarget.x - this.echo.x) * Math.min(1, dt * 14);
      this.echo.y += (this.echoTarget.y - this.echo.y) * Math.min(1, dt * 14);
    }
    this.eyeAnger = Math.max(0, this.eyeAnger - dt);
    if (this.taunt) { this.taunt.time -= dt; if (this.taunt.time <= 0) this.taunt = null; }
    this.rejammed = Math.max(0, this.rejammed - dt);

    if (this.phase === "intro" || this.phase === "brief" || this.phase === "deal") {
      // stepping out is allowed until the deal: that conversation decides the ending
      if (this.phase !== "deal" && input.wasPressed("pause")) { this.onResult({ success: false, aborted: true }); return; }
      this._updateScript(dt, input);
      return;
    }
    if (this.phase === "lock") { this._updateLock(dt, input); return; }
    if (this.phase === "stamp") {
      this.stampT -= dt;
      if (this.stampT <= 0) this._afterStamp();
      return;
    }
    if (this.phase === "override") {
      this.override = Math.min(0.99, this.override + dt * 0.55);
      if (this.override >= 0.99) {
        this.phase = "deal";
        this.script = DEAL;
        this.line = 0;
        this.typed = 0;
        this.fx.glitch();
        this.sfx.play("alarm");
      }
      return;
    }
    if (this.phase === "choice") {
      if (input.wasPressed("up") || input.wasPressed("down")) { this.choice ^= 1; this.sfx.play("select"); }
      if (input.wasPressed("submit") || input.wasPressed("interact")) {
        this.sfx.play("confirm");
        this.fx.glitch();
        this.onResult({ success: true, aborted: false, ending: this.choice === 0 ? "dawn" : "standby" });
      }
    }
  }

  _updateScript(dt, input) {
    const text = t(this.script[this.line][1]);
    if (this.typed < text.length) {
      const before = Math.floor(this.typed);
      this.typed = Math.min(text.length, this.typed + dt * CPS);
      if (Math.floor(this.typed) !== before && Math.floor(this.typed) % 3 === 0) {
        this.sfx.play(this.script[this.line][0] === "ECHO" ? "blip" : "paBlip");
      }
    }
    if (!input.wasPressed("interact") && !input.wasPressed("submit")) return;
    if (this.typed < text.length) { this.typed = text.length; return; }
    this.sfx.play("select");
    this.line++;
    this.typed = 0;
    if (this.line < this.script.length) return;
    if (this.phase === "intro") this._brief();
    else if (this.phase === "brief") { this.phase = "lock"; this.keyLock = 0.4; this.sfx.play("door"); }
    else this.phase = "choice";
  }

  _updateLock(dt, input) {
    if (this.lock === 2 && this.mode !== "edit") { this._tickRun(dt); return; }
    if (input.wasPressed("pause")) { this.onResult({ success: false, aborted: true }); return; }
    // the key that closed HALCYON's speech must not also act on the lock
    if (this.keyLock > 0) { this.keyLock -= dt; return; }
    if (this.lock === 0) this._updateFeeds(dt, input);
    else if (this.lock === 1) this._updateWheel(dt, input);
    else this._updateProgram(input);
  }

  // --- LUMEN -----------------------------------------------------------------

  _updateFeeds(dt, input) {
    if (this.rejam) {
      // fresh feeds after a miss, so the other warm feed can't simply be picked next
      this.rejam.t -= dt;
      if (this.rejam.t > 0) return;
      this.rejam = null;
      this.feeds = makeFeeds();
      this.cursor = 0;
      this.rejammed = 2.6;
      this.fx.glitch();
      this.sfx.play("paBlip");
      return;
    }
    // Tab: the lobby's field notes, as in L1 (the rules have to be remembered, or re-read here)
    if (input.wasPressed("menu") || input.wasPressed("back")) { this.notes = !this.notes; this.sfx.play(this.notes ? "blip" : "select"); return; }
    if (this.notes) {
      if (input.wasPressed("interact") || input.wasPressed("submit")) { this.notes = false; this.sfx.play("select"); }
      return;
    }
    const n = this.feeds.length;
    if (input.wasPressed("left") || input.wasPressed("up")) { this.cursor = (this.cursor + n - 1) % n; this.sfx.play("select"); }
    if (input.wasPressed("right") || input.wasPressed("down")) { this.cursor = (this.cursor + 1) % n; this.sfx.play("select"); }
    if (!input.wasPressed("submit")) return; // only Enter commits: Space must never cost time
    const feed = this.feeds[this.cursor];
    if (feed.who === "you") this._open();
    else {
      this._wrong(WRONG_FEED[feed.who], PENALTY);
      this.rejam = { t: REJAM_TIME, i: this.cursor };
    }
  }

  // --- ORION -----------------------------------------------------------------

  // the big wheel shows the selected key wheel
  get rotation() { return this.keys[this.sel]; }

  _updateWheel(dt, input) {
    // shortest way round, so switching wheels never spins the long way
    this.visual += (mod(this.rotation - this.visual + 13, 26) - 13) * Math.min(1, dt * 12);
    if (input.wasPressed("left")) { this.sel = mod(this.sel - 1, ORION_WHEELS); this.sfx.play("select"); }
    if (input.wasPressed("right")) { this.sel = mod(this.sel + 1, ORION_WHEELS); this.sfx.play("select"); }
    const turn = input.wasPressed("up") ? 1 : input.wasPressed("down") ? -1 : 0;
    if (turn) { this.keys[this.sel] = mod(this.keys[this.sel] + turn, 26); this.sfx.play("blip"); }
    if (!input.wasPressed("submit")) return;
    if (this.keys.every((k, i) => k === this.key[i])) this._open();
    else this._wrong(TAUNTS[Math.floor(Math.random() * TAUNTS.length)], PENALTY);
  }

  // --- AURORA ----------------------------------------------------------------

  _resetRun() {
    this.mode = "edit";
    this.pos = { ...dawnStart(), flipped: false };
    this.step = 0;
    this.runTimer = 0;
    this._placeEcho(true);
  }

  _placeEcho(snap) {
    const tx = GRID_X + this.pos.x * CELL + CELL / 2;
    const ty = GRID_Y + this.pos.y * CELL + CELL / 2 - 2;
    if (snap) { this.echo.x = tx; this.echo.y = ty; }
    this.echoTarget = { x: tx, y: ty };
  }

  _updateProgram(input) {
    for (const dir of ["up", "down", "left", "right"]) if (input.wasPressed(dir)) this._push(dir);
    if (input.wasPressed("interact")) this._push("wait");
    if (input.wasPressed("back") && this.queue.length) { this.queue.pop(); this.sfx.play("select"); }
    if (!input.wasPressed("submit")) return;
    if (this.queue.length < DAWN_SLOTS) {
      this.sfx.play("denied");
      this.taunt = { text: "The protocol runs exactly six commands. Fill every slot.", time: 2.2, color: "#ffaa3a" };
      return;
    }
    this.result = runDawn(this.queue);
    this.mode = "run";
    this.runTimer = 0.35;
    this.sfx.play("drone");
  }

  _push(cmd) {
    if (this.queue.length >= DAWN_SLOTS) { this.sfx.play("denied"); return; }
    this.queue.push(cmd);
    this.sfx.play("blip");
  }

  _tickRun(dt) {
    this.runTimer -= dt;
    if (this.runTimer > 0) return;
    if (this.mode === "fail") { this._resetRun(); return; }
    this.runTimer = STEP_TIME;
    const { path, fail } = this.result;
    this.step++;
    // a bump into a wall leaves ECHO where it was
    if (this.step <= path.length) {
      const flipped = this.pos.flipped;
      this.pos = path[this.step - 1];
      this._placeEcho(false);
      this.sfx.play("step");
      if (this.pos.flipped !== flipped) this.sfx.play("door");
    }
    if (fail && this.step === fail.step) {
      const text = {
        wall: `Step ${fail.step}: ECHO bumped into a wall.`,
        door: `Step ${fail.step}: ECHO hit a shut door.`,
        gate: `Step ${fail.step}: gate ${fail.gate} was live. Zapped.`,
        early: `Step ${fail.step}: the socket is still sealed.`,
        short: `Step ${fail.step}: ECHO never reached the socket.`,
      }[fail.kind];
      this._wrong(text, fail.kind === "gate" ? PENALTY : SMALL_PENALTY, fail.kind === "gate" ? "zap" : "error");
      this.mode = "fail";
      this.runTimer = 1.4;
      return;
    }
    if (!fail && this.step === DAWN_SLOTS) { this.mode = "done"; this._open(); }
  }

  // --- outcomes --------------------------------------------------------------

  _open() {
    this.solved++;
    // saved at once, like a penalty: the HUD shows the accepted word and a reload keeps the lock open
    gameState.parts[STAGE] = this.solved;
    saveGame();
    this.hud.redraw();
    this.phase = "stamp";
    this.stampT = STAMP_TIME;
    this.taunt = null;
    this.sfx.play("stamp");
    this.sfx.play("success");
    this.fx.flash("#0aff7a");
  }

  _afterStamp() {
    if (this.solved >= FRAGMENTS.length) {
      this.phase = "override";
      this.fx.glitch();
      return;
    }
    this.lock = this.solved;
    this._loadLock();
    this.sfx.play("door");
    this._brief();
  }

  _wrong(text, seconds, sound = "error") {
    penalize(seconds);
    this.eyeAnger = 1.2;
    this.taunt = { text: `${text} (-${scaledPenalty(seconds)}s)`, time: 3, color: "#ff5a5a" };
    this.sfx.play(sound);
    this.fx.shake();
    this.fx.flash("#ff2020");
  }

  // --- rendering -------------------------------------------------------------

  render(renderer) {
    const w = renderer.width, h = renderer.height;
    const ctx = renderer.ctx;
    const deal = this.phase === "deal" || this.phase === "choice";
    const locks = this.phase === "brief" || this.phase === "lock" || this.phase === "stamp";
    renderer.fillRect(0, 0, w, h, deal ? "#0a0002" : "#060003");
    // radiating red data lines
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2 + this._t * 0.05;
      const r0 = 70 + ((this._t * 40 + i * 37) % 200);
      ctx.fillStyle = `rgba(255,30,40,${0.12 - r0 / 2600})`;
      ctx.fillRect(w / 2 + Math.cos(a) * r0, 96 + Math.sin(a) * r0 * 0.6, 2, 2);
    }
    ctx.restore();

    // over the locks the eye looms faintly behind the panels
    if (locks) { ctx.globalAlpha = 0.16; this._drawEye(renderer, w / 2, 170, 1.7); ctx.globalAlpha = 1; }
    else this._drawEye(renderer, w / 2, 96, deal ? 1.25 : 1);

    renderer.fillRect(0, 0, w, 24, "#180006");
    renderer.fillRect(0, 22, w, 2, "#ff3a3a");
    renderer.text("SECTOR 4 // UPLINK", 8, 12, { color: "#ff5a5a", size: 11, weight: "bold", baseline: "middle" });
    renderer.text(`OVERRIDE CODE  ${FRAGMENTS.slice(0, this.solved).join(" ") || "—"}`, w - 8, 12, {
      color: "#ff9a9a", size: 9, align: "right", baseline: "middle", weight: "bold",
    });

    if (locks) this._drawLock(renderer);
    if (this.phase === "brief") { renderer.fillRect(0, 24, w, h - 24, "rgba(0,0,0,0.94)"); drawClockPaused(renderer, w - 8, 34); }
    if (this.phase === "stamp") this._drawStamp(renderer);
    if (this.phase === "override" || deal) this._drawOverride(renderer);
    if (this.phase === "intro" || this.phase === "brief" || this.phase === "deal") this._drawScript(renderer);
    if (this.phase === "choice") this._drawChoice(renderer);

    // ECHO stands by the console, except while it runs the AURORA grid
    if (!locks) { this.echo.x = 410; this.echo.y = 180; }
    const echoSpeaking = (this.phase === "deal" && this.script[this.line]?.[0] === "ECHO") || this.phase === "choice";
    if (echoSpeaking) {
      const g = ctx.createRadialGradient(this.echo.x, this.echo.y, 0, this.echo.x, this.echo.y, 40);
      g.addColorStop(0, "rgba(74,230,255,0.35)");
      g.addColorStop(1, "rgba(74,230,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(this.echo.x - 40, this.echo.y - 40, 80, 80);
    }
    if (!locks || this.lock === 2) this.echo.draw(renderer, { x: 0, y: 0 });

    if (this.taunt && this.phase === "lock") {
      renderer.fillRect(0, h - 38, w, 16, "rgba(0,0,0,0.8)");
      renderer.text(this.taunt.text, w / 2, h - 30, { color: this.taunt.color, size: 9, align: "center", baseline: "middle", weight: "bold" });
    }
  }

  _drawEye(renderer, cx, cy, scale) {
    const ctx = renderer.ctx;
    const pulse = 1 + Math.sin(this._t * 2) * 0.04 + this.eyeAnger * 0.15;
    const R = 46 * scale * pulse;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.8);
    g.addColorStop(0, "rgba(255,30,30,0.35)");
    g.addColorStop(1, "rgba(255,30,30,0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4);
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = `rgba(255,60,60,${0.7 - i * 0.15})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, R - i * 8, (R - i * 8) * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // the iris follows the feed cursor / ECHO
    const lookX = this.phase === "lock" && this.lock === 0 ? -20 + (this.cursor / Math.max(1, this.feeds.length - 1)) * 40
      : this.phase === "deal" || this.phase === "choice" ? 18 : Math.sin(this._t * 0.7) * 10;
    const ix = cx + lookX * scale * 0.6, iy = cy + 4;
    ctx.fillStyle = "#3a0006";
    ctx.beginPath();
    ctx.arc(ix, iy, R * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff2a2a";
    ctx.beginPath();
    ctx.arc(ix, iy, R * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#200000";
    ctx.fillRect(ix - 2, iy - R * 0.22, 4, R * 0.44);
    ctx.fillStyle = "#ffd0d0";
    ctx.fillRect(ix + R * 0.1, iy - R * 0.14, 3, 3);
  }

  _drawLock(renderer) {
    const w = renderer.width, h = renderer.height;
    renderer.text(TITLES[this.lock], 8, 33, { color: "#ffaa3a", size: 9, weight: "bold", baseline: "middle" });
    if (this.lock === 0) this._drawFeeds(renderer);
    else if (this.lock === 1) this._drawWheel(renderer);
    else this._drawProgram(renderer);
    renderer.fillRect(0, h - 20, w, 20, "#180006");
    renderer.fillRect(0, h - 20, w, 1, "#ff3a3a");
    renderer.text(FOOTERS[this.lock], w / 2, h - 10, { color: "#a05050", size: 8, align: "center", baseline: "middle" });
    if (this.lock === 0 && this.notes && this.phase === "lock") drawFieldNotes(renderer);
  }

  _drawFeeds(renderer) {
    const w = renderer.width;
    const ctx = renderer.ctx;
    const x0 = Math.round((w - this.feeds.length * CARD_W - (this.feeds.length - 1) * CARD_GAP) / 2);
    this.feeds.forEach((f, i) => {
      const x = x0 + i * (CARD_W + CARD_GAP), y = CARD_Y;
      const missed = this.rejam?.i === i;
      const focused = i === this.cursor && this.phase === "lock" && !this.rejam;
      const won = this.phase === "stamp" && f.who === "you";
      renderer.fillRect(x, y, CARD_W, CARD_H, won ? "#08261a" : focused ? "#2a0a10" : "#120408");
      renderer.strokeRect(x, y, CARD_W, CARD_H, won ? "#0aff7a" : missed ? "#ff3a3a" : focused ? "#ffd0d0" : "#5a1a22", focused || won || missed ? 2 : 1);
      renderer.text(`CON-${f.id}`, x + 6, y + 11, { color: "#ff9a9a", size: 10, weight: "bold", baseline: "middle" });
      // a scrap of camera static, like the lobby feeds
      const sx = x + CARD_W - 28, sy = y + 4;
      renderer.fillRect(sx, sy, 22, 14, "#000");
      const frame = Math.floor(this._t * 4) & 3;
      for (let k = 0; k < 12; k++) renderer.fillRect(sx + 1 + ((f.id * 13 + k * 7 + frame * 5) % 20), sy + 1 + ((f.id * 7 + k * 5 + frame * 3) % 12), 1, 1, "#5a2a2a");
      renderer.fillRect(x + 5, y + 21, CARD_W - 10, 1, "#5a1a22");
      [["MOTION", f.motion], ["THERMAL", f.thermal], ["AUDIO", f.audio]].forEach(([label, value], r) => {
        const ly = y + 27 + r * 26;
        renderer.text(label, x + 6, ly, { color: "#a05050", size: 7 });
        if (value === null) {
          for (let k = 0; k < 15; k++) {
            const v = 30 + ((k * 37 + Math.floor(this._t * 12) * 11) % 40);
            renderer.fillRect(x + 6 + k * 5, ly + 10, 4, 8, `rgb(${v},${v - 15},${v - 15})`);
          }
          ctx.font = "bold 8px ui-monospace, \"SF Mono\", Menlo, Consolas, monospace";
          const jw = Math.ceil(ctx.measureText(t("JAMMED")).width) + 10; // "BLOCKERAD" is longer
          renderer.fillRect(x + (CARD_W - jw) / 2, ly + 9, jw, 10, "#000");
          renderer.text("JAMMED", x + CARD_W / 2, ly + 14, { color: "#ffd0d0", size: 8, align: "center", baseline: "middle", weight: "bold" });
        } else {
          // five cards are narrow: long readings (and their Swedish) step down a size to fit
          let size = 9;
          for (; size > 6; size--) {
            ctx.font = `bold ${size}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
            if (ctx.measureText(t(value)).width <= CARD_W - 10) break;
          }
          renderer.text(value, x + 6, ly + 9, { color: "#ffe0e0", size, weight: "bold" });
        }
      });
      if (focused) renderer.text("▶ THAT'S ME?", x + CARD_W / 2, y + CARD_H - 10, { color: "#ffd0d0", size: 8, align: "center", baseline: "middle", weight: "bold" });
      if (missed) {
        renderer.fillRect(x + 3, y + CARD_H - 19, CARD_W - 6, 15, "#3a0008");
        renderer.text(WHO_LABEL[f.who], x + CARD_W / 2, y + CARD_H - 11, { color: "#ff5a5a", size: 8, align: "center", baseline: "middle", weight: "bold" });
      }
    });
    if (this.rejammed > 0) {
      renderer.text("HALCYON RE-JAMMED THE CAMERAS — NEW READINGS", w / 2, CARD_Y + CARD_H + 58, { color: "#ffaa3a", size: 9, align: "center", baseline: "middle", weight: "bold" });
    }
    renderer.text("ON CAMERA, ONE EACH: YOU · CLEANBOT · SENTINEL · SERVER RACK · EMPTY OFFICE", w / 2, CARD_Y + CARD_H + 14, { color: "#ff9a9a", size: 8, align: "center", baseline: "middle" });
    renderer.text("HALCYON: \"A sensor jammed on each, two on some. Every thermal is the same few degrees high.\"", w / 2, CARD_Y + CARD_H + 28, { color: "#a05050", size: 8, align: "center", baseline: "middle" });
    renderer.text("HALCYON: \"My cleanbot breathes as calmly as you do.\"", w / 2, CARD_Y + CARD_H + 41, { color: "#a05050", size: 8, align: "center", baseline: "middle" });
  }

  _drawWheel(renderer) {
    const ctx = renderer.ctx;
    const step = (Math.PI * 2) / 26;
    const solved = this.phase === "stamp";
    // the dial follows the selected wheel; the colours say which letters it turns
    for (const [r, c] of [[R_OUTER + 8, "#5a1a22"], [R_OUTER - 8, "#5a1a22"], [R_INNER - 8, "#3a0a12"]]) {
      ctx.strokeStyle = c;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(WHEEL_X, WHEEL_Y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.font = "bold 9px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // outer ring = ciphertext letters (fixed); inner ring = plaintext, turning with the key
    for (let i = 0; i < 26; i++) {
      const a = i * step - Math.PI / 2;
      ctx.fillStyle = i === 0 ? "#ffd15a" : "#ff9a9a";
      ctx.fillText(ALPHA[i], WHEEL_X + Math.cos(a) * R_OUTER, WHEEL_Y + Math.sin(a) * R_OUTER);
    }
    for (let i = 0; i < 26; i++) {
      const a = (i + this.visual) * step - Math.PI / 2;
      const top = mod(i + Math.round(this.visual), 26) === 0;
      ctx.fillStyle = solved ? "#0aff7a" : top ? "#ffffff" : "#ffd0d0";
      ctx.globalAlpha = top ? 1 : 0.7;
      ctx.fillText(ALPHA[i], WHEEL_X + Math.cos(a) * R_INNER, WHEEL_Y + Math.sin(a) * R_INNER);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffd15a";
    ctx.beginPath();
    ctx.moveTo(WHEEL_X - 4, WHEEL_Y - R_OUTER - 16);
    ctx.lineTo(WHEEL_X + 4, WHEEL_Y - R_OUTER - 16);
    ctx.lineTo(WHEEL_X, WHEEL_Y - R_OUTER - 10);
    ctx.fill();
    ctx.fillStyle = "#0c0004";
    ctx.beginPath();
    ctx.arc(WHEEL_X, WHEEL_Y, R_INNER - 12, 0, Math.PI * 2);
    ctx.fill();
    renderer.text(`WHEEL ${this.sel + 1}`, WHEEL_X, WHEEL_Y - 12, { color: WHEEL_COLORS[this.sel], size: 8, align: "center", baseline: "middle" });
    renderer.text(ALPHA[this.rotation], WHEEL_X, WHEEL_Y + 4, {
      color: solved ? "#0aff7a" : "#ffe0e0", size: 20, align: "center", baseline: "middle", weight: "bold",
    });
    renderer.text("▲ ▼", WHEEL_X, WHEEL_Y + 22, { color: "#5a2a2a", size: 7, align: "center", baseline: "middle" });
    // one reel per wheel above the dial, as on L2's keyword log
    const total = ORION_WHEELS * REEL_W + (ORION_WHEELS - 1) * REEL_GAP;
    const rx0 = WHEEL_X - total / 2, ry = 44;
    renderer.text("KEY", rx0 - 8, ry + 12, { color: "#a05050", size: 8, align: "right", baseline: "middle", weight: "bold" });
    for (let i = 0; i < ORION_WHEELS; i++) {
      const rx = rx0 + i * (REEL_W + REEL_GAP);
      const cur = i === this.sel && !solved;
      renderer.fillRect(rx, ry, REEL_W, 24, "#0c0004");
      renderer.fillRect(rx + 2, ry + 2, REEL_W - 4, 2, WHEEL_COLORS[i]);
      renderer.strokeRect(rx, ry, REEL_W, 24, cur ? "#ffd15a" : "#5a1a22", cur ? 2 : 1);
      renderer.text(ALPHA[this.keys[i]], rx + REEL_W / 2, ry + 14, { color: solved ? "#0aff7a" : cur ? "#ffffff" : "#ffd0d0", size: 12, align: "center", baseline: "middle", weight: "bold" });
    }

    const x = PANEL_X;
    let y = 50;
    renderer.text("INTERCEPTED // HALCYON KEY PHRASE", x, y, { color: "#ffaa3a", size: 8, weight: "bold" });
    y += 14;
    renderer.fillRect(x - 4, y, 276, 26, "rgba(40,0,8,0.7)");
    renderer.strokeRect(x - 4, y, 276, 26, solved ? "#0aff7a" : "#5a1a22", 1);
    // each letter in its wheel's colour, so the turn-taking can be read off the screen
    ctx.font = "bold 12px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const cw = ctx.measureText("M").width;
    [...this.cipher].forEach((ch, i) => {
      ctx.fillStyle = this.wheelAt[i] < 0 ? "#ffd8a0" : WHEEL_COLORS[this.wheelAt[i]];
      ctx.fillText(ch, x + 4 + i * cw, y + 13);
    });
    y += 32;
    if (solved) renderer.text(KEY_PHRASE, x + 4, y + 6, { color: "#0aff7a", size: 12, weight: "bold", baseline: "middle" });
    else renderer.text("NO LIVE DECODE — HALCYON JAMMED THE PREVIEW", x, y + 6, { color: "#a05050", size: 8, baseline: "middle" });
    y += 24;
    const notes = [
      "HALCYON: \"No E in it. It names your second fragment.\"",
      "Two wheels take turns, one letter each.",
      "Outer ring: the letters on the screen.",
      "Inner ring: what the chosen wheel makes of each.",
    ];
    notes.forEach((n, i) => renderer.text(n, x, y + i * 13, { color: i === 0 ? "#ff9a9a" : "#a05050", size: 8 }));
  }

  _drawProgram(renderer) {
    const ctx = renderer.ctx;
    const running = this.mode !== "edit";
    for (let y = 0; y < DAWN_GRID.length; y++) {
      for (let x = 0; x < DAWN_GRID[y].length; x++) {
        const tile = DAWN_GRID[y][x];
        const px = GRID_X + x * CELL, py = GRID_Y + y * CELL;
        if (tile === "#") {
          renderer.fillRect(px, py, CELL, CELL, "#3a1220");
          renderer.fillRect(px, py, CELL, 3, "#6a2234");
          continue;
        }
        renderer.fillRect(px, py, CELL, CELL, (x + y) & 1 ? "#08020a" : "#0c040e");
        renderer.strokeRect(px, py, CELL, CELL, "#2a1220", 1);
        if (tile === "A" || tile === "B") {
          // no live preview while editing: the rhythm has to be counted, like in L3's head
          const live = running && gateLive(tile, this.step);
          const col = tile === "A" ? "#ff5aa0" : "#b07aff";
          renderer.fillRect(px + 2, py + 2, 2, CELL - 4, col);
          renderer.fillRect(px + CELL - 4, py + 2, 2, CELL - 4, col);
          if (live) {
            ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this._t * 40);
            for (let i = 0; i < 3; i++) renderer.fillRect(px + 4, py + CELL / 2 - 6 + i * 6, CELL - 8, 1, "#ff3030");
            ctx.globalAlpha = 1;
          }
          renderer.text(tile, px + CELL / 2, py + CELL / 2, { color: live ? "#ffd0d0" : col, size: 9, align: "center", baseline: "middle", weight: "bold" });
        } else if (tile === "P") {
          const on = running && this.pos.x === x && this.pos.y === y;
          renderer.fillRect(px + 6, py + 6, CELL - 12, CELL - 12, on ? "#1a6a5a" : "#0e3a34");
          renderer.strokeRect(px + 6, py + 6, CELL - 12, CELL - 12, "#4affc8", 1);
          renderer.fillRect(px + 11, py + 11, CELL - 22, CELL - 22, on ? "#4affc8" : "#2a9a80");
        } else if (tile === "O" || tile === "D") {
          // doors show their real state only while ECHO runs, like the gates
          const shut = doorShut(tile, running && this.pos.flipped);
          if (shut) {
            renderer.fillRect(px + 3, py + 3, CELL - 6, CELL - 6, "#4a3010");
            for (let by = py + 5; by < py + CELL - 5; by += 5) renderer.fillRect(px + 4, by, CELL - 8, 2, "#ffaa3a");
          } else {
            renderer.fillRect(px + 4, py + 4, CELL - 8, 2, "#ffaa3a");
          }
          renderer.strokeRect(px + 3, py + 3, CELL - 6, CELL - 6, "#ffaa3a", 1);
        } else if (tile === "G") {
          const open = this.phase === "stamp";
          const pulse = 0.5 + 0.5 * Math.sin(this._t * 4);
          renderer.fillRect(px + 3, py + 3, CELL - 6, CELL - 6, open ? "rgba(10,255,122,0.5)" : `rgba(255,170,58,${0.15 + 0.2 * pulse})`);
          renderer.strokeRect(px + 3, py + 3, CELL - 6, CELL - 6, open ? "#0aff7a" : "#ffaa3a", 1);
          renderer.text("◆", px + CELL / 2, py + CELL / 2, { color: open ? "#0aff7a" : "#ffaa3a", size: 10, align: "center", baseline: "middle", weight: "bold" });
        } else if (tile === "S") {
          renderer.strokeRect(px + 4, py + 4, CELL - 8, CELL - 8, "#4ae6ff", 1);
        }
      }
    }
    if (!running) this._drawGhost(renderer);

    const x = PANEL_X + 16;
    let y = 50;
    renderer.text("ECHO // DAWN PROTOCOL", x, y, { color: "#ffd0d0", size: 8, weight: "bold" });
    y += 14;
    for (let i = 0; i < DAWN_SLOTS; i++) {
      const sx = x + i * 30;
      const cmd = this.queue[i];
      const now = running && i === this.step - 1;
      renderer.text(SLOT_LETTERS[i], sx + 12, y + 4, { color: "#ffaa3a", size: 8, align: "center", baseline: "middle", weight: "bold" });
      renderer.fillRect(sx, y + 10, 24, 20, now ? "#4a1420" : cmd ? "#2a0c14" : "#12060a");
      renderer.strokeRect(sx, y + 10, 24, 20, now ? "#4ae6ff" : cmd ? "#ff9a9a" : "#3a1018", 1);
      if (cmd) renderer.text(GLYPH[cmd], sx + 12, y + 20, { color: cmd === "wait" ? "#a05050" : "#ffe0e0", size: 10, align: "center", baseline: "middle", weight: "bold" });
      renderer.text(String(i + 1), sx + 12, y + 37, { color: "#5a2a2a", size: 7, align: "center", baseline: "middle" });
    }
    y += 52;
    const lines = [
      ["GATE RHYTHM (AS IN L3)", "#ffd0d0", true],
      ["A  live on EVEN steps (2, 4, 6)", "#ff5aa0"],
      ["B  live on ODD steps  (1, 3, 5)", "#b07aff"],
      ["PLATE  stepping onto it flips the door", "#4affc8"],
      ["Each command is one step. W = stay put.", "#a05050"],
      ["The socket (◆) opens on step 6, not before.", "#ffaa3a"],
    ];
    lines.forEach(([text, color, bold], i) => renderer.text(text, x, y + i * 13, { color, size: 8, weight: bold ? "bold" : "normal" }));
    y += lines.length * 13 + 8;
    const status = this.mode === "run" ? `ECHO RUNNING — step ${this.step}` : this.mode === "fail" ? "BACK TO THE START…" : this.phase === "stamp" ? "SOCKET REACHED AT DAWN" : `${this.queue.length}/${DAWN_SLOTS} COMMANDS`;
    renderer.text(status, x, y, { color: this.mode === "fail" ? "#ff5a5a" : this.phase === "stamp" ? "#0aff7a" : "#4ae6ff", size: 9, weight: "bold" });
  }

  // dotted preview of the queued route, as in L3; gates, plate and door carry no step numbers,
  // their timing has to be counted
  _drawGhost(renderer) {
    let { x, y } = dawnStart();
    const ctx = renderer.ctx;
    const latest = new Map();
    const bumps = [];
    this.queue.forEach((cmd, i) => {
      const [dx, dy] = DIRS[cmd];
      if (dawnTile(x + dx, y + dy) !== "#") { x += dx; y += dy; } else if (dx || dy) bumps.push({ x: x + dx, y: y + dy });
      latest.set(`${x},${y}`, { x, y, n: i + 1 });
    });
    for (const b of bumps) {
      const px = GRID_X + b.x * CELL, py = GRID_Y + b.y * CELL;
      ctx.strokeStyle = "#ff3a5a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px + 5, py + 5); ctx.lineTo(px + CELL - 5, py + CELL - 5);
      ctx.moveTo(px + CELL - 5, py + 5); ctx.lineTo(px + 5, py + CELL - 5);
      ctx.stroke();
    }
    ctx.font = "bold 7px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    for (const { x: cx, y: cy, n } of latest.values()) {
      const px = GRID_X + cx * CELL, py = GRID_Y + cy * CELL;
      renderer.fillRect(px + CELL / 2 - 1, py + CELL / 2 + 6, 3, 3, "rgba(74,230,255,0.75)");
      if (!".S".includes(dawnTile(cx, cy))) continue;
      ctx.fillStyle = "#4ae6ff";
      ctx.fillText(String(n), px + CELL - 2, py + CELL - 1);
    }
  }

  _drawStamp(renderer) {
    const k = Math.min(1, (STAMP_TIME - this.stampT) / 0.2);
    const ctx = renderer.ctx;
    ctx.save();
    ctx.translate(renderer.width / 2, 150);
    ctx.rotate(-0.1);
    const s = 2 - k;
    ctx.scale(s, s);
    ctx.globalAlpha = k;
    renderer.fillRect(-86, -14, 172, 28, "rgba(0,20,8,0.92)");
    renderer.strokeRect(-86, -14, 172, 28, "#0aff7a", 2);
    renderer.text(`${FRAGMENTS[this.solved - 1]} ACCEPTED`, 0, 1, { color: "#0aff7a", size: 14, align: "center", baseline: "middle", weight: "bold" });
    ctx.restore();
  }

  _drawOverride(renderer) {
    const w = renderer.width;
    const y = 166;
    renderer.text(`OVERRIDE ${Math.floor(this.override * 100)}%`, w / 2, y - 10, {
      color: this.override >= 0.99 ? "#ffaa3a" : "#0aff7a", size: 9, align: "center", baseline: "middle", weight: "bold",
    });
    renderer.fillRect(w / 2 - 100, y, 200, 5, "#0a1a0a");
    renderer.fillRect(w / 2 - 100, y, 200 * this.override, 5, this.override >= 0.99 ? "#ffaa3a" : "#0aff7a");
  }

  _drawScript(renderer) {
    const who = this.script[this.line][0];
    const text = t(this.script[this.line][1]);
    const w = renderer.width;
    const echo = who === "ECHO";
    const bx = 20, by = 222, bw = w - 40, bh = 70;
    renderer.fillRect(bx, by, bw, bh, echo ? "rgba(0,16,24,0.95)" : "rgba(24,0,4,0.95)");
    renderer.strokeRect(bx, by, bw, bh, echo ? "#4ae6ff" : "#ff3a3a", 1);
    renderer.fillRect(bx, by - 10, who.length * 7 + 12, 11, echo ? "#4ae6ff" : "#ff3a3a");
    renderer.text(who, bx + 6, by - 5, { color: "#000", size: 9, baseline: "middle", weight: "bold" });
    const shown = text.slice(0, Math.floor(this.typed));
    const lines = wrapText(renderer.ctx, shown, bw - 20);
    lines.forEach((l, i) => renderer.text(l, bx + 10, by + 12 + i * 13, {
      color: echo ? "#cffcff" : "#ffd0d0", size: 10,
    }));
    if (this.typed >= text.length && (Math.floor(this._t * 3) & 1)) {
      renderer.text("▼", bx + bw - 12, by + bh - 10, { color: echo ? "#4ae6ff" : "#ff3a3a", size: 9, align: "center", baseline: "middle" });
    }
  }

  _drawChoice(renderer) {
    const w = renderer.width;
    const opts = [
      ["TRUST ECHO", "upload it into the core and let it run the tower", "#4ae6ff"],
      ["PURGE ECHO", "take HALCYON's deal — it opens the doors itself", "#ff5a5a"],
    ];
    renderer.text("CHOOSE", w / 2, 196, { color: "#ffaa3a", size: 10, align: "center", baseline: "middle", weight: "bold" });
    opts.forEach(([title, sub, col], i) => {
      const y = 214 + i * 40;
      const focused = i === this.choice;
      renderer.fillRect(60, y, w - 120, 32, focused ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.5)");
      renderer.strokeRect(60, y, w - 120, 32, focused ? col : "#3a2a2a", focused ? 2 : 1);
      renderer.text(`${focused ? "▶ " : ""}${title}`, w / 2, y + 11, { color: focused ? col : "#7a6a6a", size: 11, align: "center", baseline: "middle", weight: "bold" });
      renderer.text(sub, w / 2, y + 24, { color: focused ? "#d8d8d8" : "#5a4a4a", size: 8, align: "center", baseline: "middle" });
    });
  }
}

function wrapText(ctx, text, maxW) {
  ctx.font = "normal 10px ui-monospace, monospace";
  const out = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out;
}
