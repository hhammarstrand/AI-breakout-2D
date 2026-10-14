// Input prompts for the device the player last used. Scenes keep writing keyboard prompts
// ("[esc] exit", "press Enter"); t() passes every string through localizePrompts(), which swaps
// the key names for touch-button or gamepad labels. Keyboard is a no-op.
let device = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches ? "touch" : "keyboard";
const listeners = new Set();

export function getDevice() { return device; }
export function setDevice(d) {
  if (d === device) return;
  device = d;
  for (const fn of listeners) fn(d);
}
export function onDeviceChange(fn) { listeners.add(fn); }

const GLYPHS = {
  keyboard: { interact: "E", submit: "Enter", pause: "Esc", back: "Backspace", notes: "Tab", menu: "Tab", flashlight: "F", run: "Shift", hint: "H", move: "WASD", lr: "←→", ud: "↑↓", any: "any key" },
  touch: { interact: "A", submit: "START", pause: "SELECT", back: "B", notes: "B", menu: "START", flashlight: "LIGHT", run: "SPRINT", hint: "?", move: "D-pad", lr: "◀▶", ud: "▲▼", any: "tap" },
  gamepad: { interact: "A", submit: "START", pause: "SELECT", back: "B", notes: "B", menu: "START", flashlight: "X", run: "LB", hint: "Y", move: "D-pad", lr: "◀▶", ud: "▲▼", any: "any button" },
};
const SV_WORDS = { "any key": "valfri tangent", tap: "tryck", "any button": "valfri knapp", "D-pad": "styrkors", LIGHT: "LJUS", SPRINT: "SPRING" };

// The label for an action on the current device, e.g. glyph("interact") → "E" / "A".
export function glyph(action, lang = "en") {
  const g = GLYPHS[device][action] ?? action;
  return lang === "sv" ? SV_WORDS[g] ?? g : g;
}

// Bracketed key names in footers, English and Swedish, to the action they stand for.
const BRACKET = {
  esc: "pause", enter: "submit", space: "interact", mellanslag: "interact", tab: "notes", h: "hint",
  backspace: "back", backsteg: "back", arrows: "move", pilar: "move", "←→": "lr", "↑↓": "ud", "any key": "any", "valfri tangent": "any",
};
const HOLD = { "hold space": "hold", "håll mellanslag": "håll" };
const BRACKET_RE = /\[([^\]\n]{1,16})\]/g;
// Free-form "press X" in dialogue and notes. TAB opens the world menu; "Tab" is L1's field notes.
const PRESS_RE = /\b(Press|press|Tryck|tryck)( sedan)? (E|F|Enter|TAB|Tab)\b/g;
const PRESS_KEY = { E: "interact", F: "flashlight", Enter: "submit", TAB: "menu", Tab: "notes" };

export function localizePrompts(s, lang = "en") {
  if (device === "keyboard" || typeof s !== "string") return s;
  const sv = lang;
  let out = s;
  if (out.includes("[")) {
    out = out.replace(BRACKET_RE, (m, inner) => {
      const key = inner.toLowerCase();
      if (HOLD[key]) return `[${HOLD[key]} ${glyph("interact")}]`;
      const multi = key.split("/");
      if (multi.length > 1 && multi.every((k) => BRACKET[k])) return `[${multi.map((k) => glyph(BRACKET[k], sv)).join("/")}]`;
      return BRACKET[key] ? `[${glyph(BRACKET[key], sv)}]` : m;
    });
  }
  if (/ress|ryck/.test(out)) out = out.replace(PRESS_RE, (m, verb, then = "", key) => `${verb}${then} ${glyph(PRESS_KEY[key], sv)}`);
  if (out.includes("(TAB)")) out = out.replace("(TAB)", `(${glyph("menu")})`);
  return out;
}

// The one-line controls briefing the operator gives at the start, per device.
export function controlsLine() {
  if (device === "touch") return "Move with the D-pad, tap SPRINT to run. A to talk and interact, B to go back, START for the menu. LIGHT for your flashlight. Now go.";
  if (device === "gamepad") return "Move with the D-pad or stick, shoulders to run. A to talk and interact, B to go back, START for the menu. X for your flashlight. Now go.";
  return "Move with WASD or the arrows, Shift to run. E or space to talk and interact. Tab for the menu, F for your flashlight. Now go.";
}

// Every control on the current device, for OPTIONS → CONTROLS. Built per language, since the
// lines are assembled from glyphs.
export function controlsSheet(lang = "en") {
  const sv = lang === "sv";
  const g = (a) => glyph(a, lang);
  const kb = device === "keyboard";
  const L = sv
    ? { move: "GÅ", run: "SPRING", act: "INTERAGERA / NÄSTA", back: "TILLBAKA / ÅNGRA", menu: "MENY", light: "FICKLAMPA", submit: "SKICKA I ETT PUSSEL", leave: "LÄMNA ETT PUSSEL", hint: "LEDTRÅD FRÅN ECHO", sound: "LJUD", arrows: "WASD / piltangenter", space: "E / mellanslag", toggle: "SPRING (av/på)" }
    : { move: "MOVE", run: "RUN", act: "INTERACT / NEXT", back: "BACK / UNDO", menu: "MENU", light: "FLASHLIGHT", submit: "SUBMIT IN A PUZZLE", leave: "LEAVE A PUZZLE", hint: "HINT FROM ECHO", sound: "SOUND", arrows: "WASD / arrow keys", space: "E / space", toggle: "SPRINT (on/off)" };
  const foot = device === "touch"
    ? (sv ? "Tryck på en menyrad för att välja den, och på en dialogruta för att läsa vidare." : "Tap a menu row to pick it; tap a dialog to read on.")
    : kb ? (sv ? "Musen fungerar också i menyerna: klicka på en rad för att välja den." : "The mouse works in menus too: click a row to pick it.")
      : (sv ? "Alla vanliga handkontroller fungerar." : "Any standard controller works.");
  return [
    `${L.move}: ${kb ? L.arrows : g("move")}`,
    `${L.run}: ${device === "touch" ? L.toggle : g("run")}`,
    `${L.act}: ${kb ? L.space : g("interact")}    ${L.back}: ${g("back")}`,
    `${L.menu}: ${kb ? "Tab / Q / Enter / Esc" : g("menu")}    ${L.light}: ${g("flashlight")}`,
    `${L.submit}: ${g("submit")}    ${L.leave}: ${g("pause")}`,
    `${L.hint}: ${g("hint")}${kb ? `    ${L.sound}: M` : ""}`,
    foot,
  ];
}
