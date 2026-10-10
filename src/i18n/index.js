import { SV, SV_PATTERNS } from "./sv.js";

// Render-time translation: every place that puts text on screen passes it through t().
// English is the source language; Swedish looks the exact string up, then tries patterns for
// strings built at runtime (names, counters, penalties). Unknown strings fall back to English.
let lang = "en";

export function setLang(l) { lang = l === "sv" ? "sv" : "en"; }
export function getLang() { return lang; }

export function t(s) {
  if (lang === "en" || typeof s !== "string" || s === "") return s;
  return translate(s);
}

function translate(s) {
  const hit = SV[s];
  if (hit !== undefined) return hit;
  for (const [re, fn] of SV_PATTERNS) {
    const m = s.match(re);
    if (m) return fn(m, translate);
  }
  return s;
}

// Static HTML labels carry data-i18n with their English text.
export function applyDom(root = document) {
  for (const el of root.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  document.documentElement.lang = lang;
}
