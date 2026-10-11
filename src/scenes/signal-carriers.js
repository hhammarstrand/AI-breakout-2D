// Rules for the three R2 carriers, kept free of rendering so tests and solver scripts can import
// them. A voice is { FREQ, AMP, PHASE }: FREQ = cycles across the scope, AMP = peak height in
// grid squares, PHASE in eighths of a turn (45° steps).
export const PARAMS = ["FREQ", "AMP", "PHASE"];
export const RANGES = { FREQ: [1, 6], AMP: [1, 5], PHASE: [0, 7] };
export const PHASE_STEPS = 8;
const HALF_TURN = PHASE_STEPS / 2;
// R3 handshake rules, each told somewhere on the research floor (see research-floor.js, LOGS):
// the ping chirps once per cycle of both voices (signal console), both voices share 6 units of
// power (HALCYON's self-diagnostic), HALCYON answers as ECHO's mirror image (Kofi).
export const HANDSHAKE_POWER = 6;
export const HANDSHAKES = 3; // transmissions per line before the sentinel net hangs up
export const MAX_CHIRPS = 8;

const int = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

export const degrees = (phase) => phase * (360 / PHASE_STEPS);
export const sameVoice = (a, b) => PARAMS.every((p) => a[p] === b[p]);
export function wave(v, x) { return v.AMP * Math.sin((x * v.FREQ + v.PHASE / PHASE_STEPS) * Math.PI * 2); }

// What the scope shows in round 2: HALCYON + ECHO on one carrier. Same-phase voices add,
// opposite-phase voices subtract, so the sum is a clean wave with a whole-number height.
export function received({ target, echo }) {
  const signed = echo.AMP + (target.PHASE === echo.PHASE ? target.AMP : -target.AMP);
  return { FREQ: echo.FREQ, AMP: Math.abs(signed), PHASE: signed > 0 ? echo.PHASE : (echo.PHASE + HALF_TURN) % PHASE_STEPS };
}

// The sentinel handshake HALCYON expects, given what the R3 scene shows (ECHO's voice, the ping).
export function handshake(echo, chirps) {
  return { FREQ: chirps - echo.FREQ, AMP: HANDSHAKE_POWER - echo.AMP, PHASE: (echo.PHASE + HALF_TURN) % PHASE_STEPS };
}

// Per-dial feedback after a refused handshake. Phase is a circle, so it only says right or wrong.
export function feedback(sent, target) {
  const dir = (a, b) => (a === b ? "✓" : a < b ? "▲" : "▼");
  return { FREQ: dir(sent.FREQ, target.FREQ), AMP: dir(sent.AMP, target.AMP), PHASE: sent.PHASE === target.PHASE ? "✓" : "✗" };
}

// Round 1: copy a wave drawn in plain sight (teaches what each dial does).
function copyRound(rnd) {
  return { kind: "copy", target: { FREQ: int(rnd, 1, 6), AMP: int(rnd, 2, 5), PHASE: int(rnd, 0, 7) } };
}

// Round 2: only the sum is on the scope. Two of the three cases cancel: HALCYON at 180° to ECHO
// either shrinks the sum below ECHO's height or wins and flips it upside down.
function sumRound(rnd) {
  const echo = { FREQ: int(rnd, 2, 6), AMP: int(rnd, 2, 4), PHASE: int(rnd, 0, 7) };
  const kind = ["with", "under", "over"][int(rnd, 0, 2)];
  const AMP = kind === "with" ? int(rnd, 1, 6 - echo.AMP) : kind === "under" ? int(rnd, 1, echo.AMP - 1) : int(rnd, echo.AMP + 1, 5);
  const PHASE = kind === "with" ? echo.PHASE : (echo.PHASE + HALF_TURN) % PHASE_STEPS;
  return { kind: "sum", echo, target: { FREQ: echo.FREQ, AMP, PHASE } };
}

// Round 3: no HALCYON wave at all. A new line (after a dropped one) changes every dial of the
// answer, so blind guesses can't be carried over from line to line.
function handshakeRound(rnd, prev) {
  for (;;) {
    const FREQ = int(rnd, 1, 6), echoFreq = int(rnd, 1, 5);
    if (echoFreq === FREQ || FREQ + echoFreq > MAX_CHIRPS) continue;
    const echo = { FREQ: echoFreq, AMP: [1, 2, 4, 5][int(rnd, 0, 3)], PHASE: int(rnd, 0, 7) };
    const chirps = FREQ + echoFreq;
    const target = handshake(echo, chirps);
    if (prev && PARAMS.some((p) => target[p] === prev.target[p])) continue;
    return { kind: "handshake", echo, chirps, target };
  }
}

export const ROUND_COUNT = 3;
export function makeRound(index, rnd = Math.random, prev = null) {
  return [copyRound, sumRound, handshakeRound][index](rnd, prev);
}
