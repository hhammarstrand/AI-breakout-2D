// Hack-battle rules, shared by BattleScene and the balance check in tests/battle-sim.mjs. Pure:
// no drawing, no DOM. The scene turns the events these functions return into text and effects.

// ECHO's moves. `act` is the act ECHO learns it in: one new move per floor.
export const MOVES = {
  ping: { id: "ping", name: "PING", act: 1, dmg: 18, desc: "Reliable probe. 18 damage." },
  spoof: { id: "spoof", name: "SPOOF", act: 1, block: true, cooldown: 2, desc: "Fake your signature. Blocks the next attack." },
  overload: { id: "overload", name: "OVERLOAD", act: 1, dmg: 40, self: 10, cooldown: 3, desc: "40 damage, costs 10 of your integrity. Cooldown 3." },
  patch: { id: "patch", name: "PATCH", act: 1, heal: 30, cooldown: 3, desc: "Restore 30 integrity. Cooldown 3." },
  jam: { id: "jam", name: "JAM", act: 2, dmg: 12, breaks: true, cooldown: 3, desc: "12 damage. Breaks a charging LOCK-ON." },
  fork: { id: "fork", name: "FORK", act: 3, dmg: 13, hits: 2, pierce: true, cooldown: 2, desc: "Two 13-damage hits. Slips through a FIREWALL." },
};
export const MOVE_ORDER = ["ping", "spoof", "overload", "patch", "jam", "fork"];

export const FOE_MOVES = {
  trace: { id: "trace", name: "TRACE", dmg: 14, tell: "is tracing your signal…" },
  scan: { id: "scan", name: "SCAN", dmg: 8, tell: "is sweeping its scanner…" },
  crush: { id: "crush", name: "CRUSH", dmg: 20, tell: "is winding up a CRUSH…" },
  leech: { id: "leech", name: "LEECH", dmg: 12, drain: true, tell: "is reaching for your power…" },
  firewall: { id: "firewall", name: "FIREWALL", shield: true, heal: 10, tell: "is raising a FIREWALL!" },
  lockon: { id: "lockon", name: "LOCK-ON", charge: true, tell: "is charging a LOCK-ON!" },
  fire: { id: "fire", name: "PURGE BOLT", tell: "fires the PURGE BOLT!" }, // damage is the archetype's bolt
  reel: { id: "reel", name: "REBOOT", tell: "is rebooting its targeting…" }, // after JAM broke a charge
};

// One sentinel class per act, each with its own stats, AI and a weakness the player can learn
// (EXPLOIT: x1.5 damage from that move). `ai` weighs the intent picked after each turn.
export const ARCHETYPES = {
  watcher: {
    id: "watcher", cls: "WATCHER", hp: 100, bolt: 76, weak: "overload", flee: 0.6, level: 12, score: 10,
    ai: { lockon: 0.4, trace: 0.36, scan: 0.24 },
  },
  hunter: {
    id: "hunter", cls: "HUNTER", hp: 95, bolt: 80, weak: "jam", flee: 0.45, level: 18, score: 15,
    ai: { lockon: 0.34, trace: 0.3, leech: 0.36 },
  },
  warden: {
    id: "warden", cls: "WARDEN", hp: 115, bolt: 90, weak: "fork", flee: 0.3, level: 24, score: 20,
    ai: { lockon: 0.3, crush: 0.34, firewall: 0.18, scan: 0.18 },
  },
};
const ACT_KIND = { 1: "watcher", 2: "hunter", 3: "warden" };
export const archetypeFor = (kind, act) => ARCHETYPES[kind] ?? ARCHETYPES[ACT_KIND[act]] ?? ARCHETYPES.watcher;

// ECHO grows a little per act: more integrity and one new move.
export const echoStats = (act) => ({ max: 100 + (act - 1) * 10, level: [7, 12, 18][act - 1] ?? 7 });
export const echoMoves = (act) => MOVE_ORDER.filter((id) => MOVES[id].act <= act);

export const CELL_HEAL = 50;
export const RUN_COST = 20; // seconds, scaled by difficulty

// scale: the sentinels' damage, by difficulty
export function newBattle({ kind, act = 1, scale = 1, rng = Math.random }) {
  const arch = archetypeFor(kind, act);
  const echo = echoStats(act);
  const s = {
    arch, act, rng, scale, moves: echoMoves(act),
    me: { hp: echo.max, max: echo.max, level: echo.level },
    foe: { hp: arch.hp, max: arch.hp },
    cd: {}, spoofed: false, intent: null, over: null,
  };
  pickIntent(s);
  return s;
}

export function pickIntent(s) {
  if (s.intent?.charge) { s.intent = FOE_MOVES.fire; return; }
  const ai = Object.entries(s.arch.ai).filter(([id]) => !(id === "firewall" && s.intent?.shield));
  const total = ai.reduce((a, [, w]) => a + w, 0);
  let r = s.rng() * total;
  for (const [id, w] of ai) { if ((r -= w) < 0) { s.intent = FOE_MOVES[id]; return; } }
  s.intent = FOE_MOVES[ai[ai.length - 1][0]];
}

// A FIREWALL is raised while it's telegraphed, so it already blunts the player's move that turn.
export const shielded = (s) => !!s.intent?.shield;
export const ready = (s, id) => !(s.cd[id] > 0);

function tick(s) { for (const k of Object.keys(s.cd)) s.cd[k] = Math.max(0, s.cd[k] - 1); }

const vary = (s, n) => Math.round(n * (0.9 + s.rng() * 0.2));

export function playerMove(s, id) {
  const m = MOVES[id];
  tick(s);
  if (m.cooldown) s.cd[id] = m.cooldown;
  const ev = [{ type: "use", move: m }];
  if (m.dmg) {
    for (let i = 0; i < (m.hits ?? 1); i++) {
      const crit = s.rng() < 0.12;
      const weak = s.arch.weak === id;
      const blunt = shielded(s) && !m.pierce;
      const dmg = Math.max(1, Math.round(vary(s, m.dmg) * (crit ? 1.5 : 1) * (weak ? 1.5 : 1) * (blunt ? 0.5 : 1)));
      s.foe.hp = Math.max(0, s.foe.hp - dmg);
      ev.push({ type: "hit", target: "foe", dmg, crit, weak, blunt, move: m });
      if (!s.foe.hp) break;
    }
    if (m.self) { s.me.hp = Math.max(1, s.me.hp - m.self); ev.push({ type: "self", dmg: m.self }); }
  }
  if (m.breaks && s.intent === FOE_MOVES.fire) { s.intent = FOE_MOVES.reel; ev.push({ type: "break" }); }
  if (m.block) { s.spoofed = true; ev.push({ type: "spoof" }); }
  if (m.heal) { const h = Math.min(m.heal, s.me.max - s.me.hp); s.me.hp += h; ev.push({ type: "heal", target: "me", amount: h }); }
  if (!s.foe.hp) s.over = "won";
  return ev;
}

// BAG: burn a backup cell for integrity; it takes the turn, like a Pokémon potion.
export function useCell(s) {
  tick(s);
  const h = Math.min(CELL_HEAL, s.me.max - s.me.hp);
  s.me.hp += h;
  return [{ type: "cell", amount: h }];
}

// RUN: a chance per class; a failed attempt still gives the sentinel its turn.
export function tryRun(s) {
  tick(s);
  if (s.rng() < s.arch.flee) { s.over = "fled"; return [{ type: "fled" }]; }
  return [{ type: "run-failed" }];
}

export function enemyTurn(s) {
  const m = s.intent;
  const ev = [];
  if (m.charge) ev.push({ type: "charge" });
  else if (m === FOE_MOVES.reel) ev.push({ type: "reel" });
  else if (m.shield) {
    const h = Math.min(m.heal, s.foe.max - s.foe.hp);
    s.foe.hp += h;
    ev.push({ type: "shield", amount: h });
  } else if (s.spoofed) {
    s.spoofed = false;
    ev.push({ type: "foe-use", move: m }, { type: "blocked", move: m });
  } else {
    const dmg = vary(s, (m === FOE_MOVES.fire ? s.arch.bolt : m.dmg) * s.scale);
    s.me.hp = Math.max(0, s.me.hp - dmg);
    ev.push({ type: "foe-use", move: m }, { type: "hit", target: "me", dmg, move: m });
    if (m.drain) {
      const h = Math.min(dmg, s.foe.max - s.foe.hp);
      s.foe.hp += h;
      if (h) ev.push({ type: "heal", target: "foe", amount: h });
    }
  }
  if (s.me.hp <= 0) { s.over = "lost"; return ev; }
  pickIntent(s);
  ev.push({ type: "intent" });
  return ev;
}
