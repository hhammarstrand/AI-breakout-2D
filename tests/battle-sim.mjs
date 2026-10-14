// Balance check for the hack battles (no browser): N fights per sentinel class, two policies.
// PING spam must lose often, reading the telegraph must almost always win.
// node tests/battle-sim.mjs [N]  — exits non-zero if a class misses the targets.
const R = await import(new URL("../src/scenes/battle-rules.js", import.meta.url).href);
const { newBattle, playerMove, enemyTurn, ready, shielded, FOE_MOVES, ARCHETYPES } = R;
const N = Number(process.argv[2]) || 10000;

// seeded so the numbers in the README are reproducible
let seed = 12345;
const rng = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);

const spam = () => "ping";
// Reads NEXT and uses what the hints teach: SPOOF (or JAM) the bolt, PATCH when low, hit the
// class's weakness, don't swing into a FIREWALL.
function good(s) {
  const can = (id) => s.moves.includes(id) && ready(s, id);
  const hp = s.me.hp;
  if (s.intent === FOE_MOVES.fire && !s.spoofed) {
    if (can("jam") && s.arch.weak === "jam") return "jam";
    if (can("spoof")) return "spoof";
    if (can("jam")) return "jam";
    if (can("patch")) return "patch";
  }
  if (shielded(s)) {
    if (can("fork")) return "fork";
    if (can("patch") && hp < s.me.max - 25) return "patch";
    if (can("spoof") && !s.spoofed) return "spoof";
  }
  if (hp < 45 && can("patch")) return "patch";
  const w = s.arch.weak;
  if (can(w) && w !== "jam" && (w !== "overload" || hp > 30)) return w; // JAM is saved for a charge
  if (can("overload") && hp > 30) return "overload";
  if (can("fork")) return "fork";
  return "ping";
}

// the old review's policy: SPOOF the bolt, PATCH when low, OVERLOAD when ready. No weakness, no JAM/FORK.
function basic(s) {
  if (s.intent === FOE_MOVES.fire && !s.spoofed && ready(s, "spoof")) return "spoof";
  if (s.me.hp < 40 && ready(s, "patch")) return "patch";
  if (ready(s, "overload") && s.me.hp > 30) return "overload";
  return "ping";
}

function fight(kind, act, policy) {
  const s = newBattle({ kind, act, rng });
  let turns = 0;
  while (!s.over && turns < 60) {
    playerMove(s, policy(s));
    turns++;
    if (!s.over) enemyTurn(s);
  }
  return { won: s.over === "won", turns, hp: s.me.hp };
}

let failed = false;
for (const [kind, act] of [["watcher", 1], ["hunter", 2], ["warden", 3]]) {
  const row = {};
  for (const [name, policy] of [["spam", spam], ["basic", basic], ["good", good]]) {
    let wins = 0, turns = 0, minHp = Infinity;
    for (let i = 0; i < N; i++) {
      const r = fight(kind, act, policy);
      if (r.won) { wins++; minHp = Math.min(minHp, r.hp); }
      turns += r.turns;
    }
    row[name] = { win: +(100 * wins / N).toFixed(1), turns: +(turns / N).toFixed(1) };
  }
  const ok = row.spam.win <= 40 && row.good.win >= 95;
  if (!ok) failed = true;
  console.log(`${ARCHETYPES[kind].cls.padEnd(8)} act ${act}  PING spam ${row.spam.win}% (${row.spam.turns} turns)  no-weakness ${row.basic.win}%  telegraph ${row.good.win}% (${row.good.turns} turns)  ${ok ? "ok" : "FAIL"}`);
}
if (failed) process.exitCode = 1;
