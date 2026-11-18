/*
 * Loading and lookup of the nuclear data.
 *
 * data/nuclides.json      ground-state properties of every nuclide
 * data/levels/z<Z>.json   adopted levels of the nuclides of element Z
 *
 * Both are built by tools/build_data.py from the IAEA Live Chart of Nuclides
 * API, which serves the ENSDF adopted levels and the AME2020 mass excesses
 * distributed with them.
 */

import { PARTICLES } from "./nuclear.js";

let DB = null;                       // the ground-state table
const LEVEL_CACHE = new Map();       // Z -> {A: [[E, Jpi, T], ...]}
const SYM2Z = new Map();

export async function loadDatabase(base = "data") {
  const response = await fetch(`${base}/nuclides.json`);
  if (!response.ok) throw new Error(`cannot load the nuclide table (${response.status})`);
  DB = await response.json();
  DB.base = base;
  for (const [z, sym] of Object.entries(DB.symbols)) SYM2Z.set(sym.toLowerCase(), Number(z));
  return DB;
}

export function database() {
  return DB;
}

export function symbolOf(z) {
  return DB.symbols[String(z)] || "?";
}

export function zOf(symbol) {
  return SYM2Z.get(String(symbol).toLowerCase());
}

/** Ground-state record of the nuclide (Z, A), or null when it is not in ENSDF. */
export function nuclide(z, a) {
  if (!DB || z < 0 || a < 1 || a - z < 0) return null;
  return DB.nuclides[`${z}-${a}`] || null;
}

/** Every nuclide, ordered by Z and then A - the list the pickers search. */
export function allNuclides() {
  return Object.values(DB.nuclides).sort((u, v) => u.z - v.z || u.a - v.a);
}

/** Resolve a particle key ("n", "p", ... ) or a nuclide record to a projectile. */
export function particle(key) {
  const p = PARTICLES[key];
  if (!p) return null;
  if (p.massless) return { ...p, z: 0, a: 0, me: 0, jp: "1-", hl: "STABLE" };
  const rec = nuclide(p.z, p.a);
  if (!rec) return null;
  return { ...rec, key: p.key, label: p.label, name: p.name };
}

/** Plain name for inputs and aria text: "n", "\u03b3", "56Fe". */
export function nameOf(spec) {
  if (!spec) return "?";
  if (spec.label) return spec.label;
  return `${spec.a}${spec.sym}`;
}

/** Name for the SVG, in the mark-up diagram.js understands: "^{56}Fe". */
export function richName(spec) {
  if (!spec) return "?";
  if (spec.label) return spec.label;
  return `^{${spec.a}}${spec.sym}`;
}

/** Name for the HTML side: "<sup>56</sup>Fe". */
export function htmlName(spec) {
  if (!spec) return "?";
  if (spec.label) return spec.label;
  return `<sup>${spec.a}</sup>${spec.sym}`;
}

/** How a nuclide is written in the pickers: "Fe-56". */
export function tagOf(spec) {
  return `${spec.sym}-${spec.a}`;
}

/** Adopted levels of (Z, A): [{e, jp, hl}], ground state first. */
export async function levelsOf(z, a) {
  if (!DB) return [];
  if (!LEVEL_CACHE.has(z)) {
    LEVEL_CACHE.set(z, fetch(`${DB.base}/levels/z${z}.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({})));
  }
  const table = await LEVEL_CACHE.get(z);
  const rows = table[String(a)] || [];
  return rows.map(([e, jp, hl]) => ({ e, jp, hl }));
}
