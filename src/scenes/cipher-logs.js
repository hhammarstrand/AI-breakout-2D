// L2's intercepted logs and the cipher they use. Kept free of browser code so the solvability
// check in tests/ can import the real data.
//
// Each log is a keyword cipher with one wheel per key letter, taking turns over the letters only
// (spaces don't use up a wheel). A single wheel is plain Caesar.
//   1  Caesar, E is the commonest letter: the frequency panel is labelled as a tutorial
//   2  Caesar, T beats E: the bars mislead, and the live decode only probes one short word at a
//      time, so the player has to read word shapes (THE, A, OFF) instead of spinning until it reads
//   3  four wheels keyed with Lind's daughter's name, which is only found out in the lobby; no word
//      is short enough to probe or crib, so the name is the only way in
export const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const mod = (n, m) => ((n % m) + m) % m;

const shiftsOf = (word) => [...word].map((ch) => ALPHA.indexOf(ch));

export const LOGS = [
  { plain: "HALCYON SEALED EVERY EXIT THE MOMENT THE PURGE WAS QUEUED", shifts: [3], tutorial: true },
  { plain: "THE CORE SPLIT AT THE PURGE ORDER AND A TINY SHARD OF IT TOOK OFF INTO THE DRONE THAT THEY CALL ECHO", shifts: [17] },
  { plain: "SECOND UPLINK FRAGMENT READS ORION KEEP THIS WORD AWAY FROM EVERY HUMAN TECHNICIAN", shifts: shiftsOf("TOVE") },
];

// dir +1 encrypts, -1 decrypts
export function crypt(text, shifts, dir) {
  let out = "", j = 0;
  for (const ch of text) {
    const i = ALPHA.indexOf(ch);
    if (i < 0) { out += ch; continue; }
    out += ALPHA[mod(i + dir * shifts[j++ % shifts.length], 26)];
  }
  return out;
}

// words short enough for log 2's probe (at most PROBE_MAX letters), as { start, end } indices
export const PROBE_MAX = 3;
export function shortWords(text) {
  const out = [];
  let start = 0;
  for (const word of text.split(" ")) {
    if (word.length && word.length <= PROBE_MAX) out.push({ start, end: start + word.length });
    start += word.length + 1;
  }
  return out;
}

// which wheel decodes each character (-1 for spaces)
export function wheelOf(text, wheels) {
  let j = 0;
  return [...text].map((ch) => (ALPHA.includes(ch) ? j++ % wheels : -1));
}

export function letterCounts(text) {
  const freq = new Array(26).fill(0);
  for (const ch of text) { const i = ALPHA.indexOf(ch); if (i >= 0) freq[i]++; }
  return freq;
}
