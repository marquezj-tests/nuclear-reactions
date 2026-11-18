/*
 * The energy-level diagram of X(a,b)Y*.
 *
 * It redraws the plate on page 18 of the "Pocketbook of Data for Nuclear
 * Engineers": three panels (Before / During / After) over one absolute energy
 * scale whose zero is the rest mass of the exit channel Y + b.  Every line,
 * bracket and arrow is placed from the solved kinematics, so the figure moves
 * with the projectile energy, the angle and the residual level.
 */

import { richName, nameOf } from "./data.js";

/* ---------------------------------------------------------------- geometry */
const W = 1420, H = 880;
const AXIS_X = 72;                      // the energy axis
const COL = {
  before: { x0: 136, x1: 392, cx: 264 },
  during: { x0: 424, x1: 648, cx: 536 },
  after:  { x0: 684, x1: 1030, cx: 857 },
};
const LANE_EA = AXIS_X + 26;            // the E_a arrow, left of the Before panel
const LANE_Q0 = 800, LANE_Q1 = 940;     // Q_0 and Q_1 / W_1 inside the After panel
const LANE_CM = 1086, LANE_LAB = 1230;  // C.M. and laboratory sharing, right gutter
const TOP = 196, BOTTOM = 688;          // the plotting band
const BREAK_Y = 706, MASS_Y = 742;      // axis break and the mc^2 labels

/* ------------------------------------------------------------------ helpers */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** "E_{CM}" and "E^{CM}_{b}" -> tspans. */
function rich(s) {
  const re = /([_^])\{([^}]*)\}/g;
  let out = "", last = 0, m, pending = 0;
  const emit = (t) => {
    if (!t) return;
    out += pending ? `<tspan dy="${(-pending).toFixed(3)}em">${esc(t)}</tspan>` : esc(t);
    pending = 0;
  };
  while ((m = re.exec(s))) {
    emit(s.slice(last, m.index));
    const dy = m[1] === "_" ? 0.33 : -0.44;
    out += `<tspan dy="${(dy - pending).toFixed(3)}em" font-size="0.72em">${esc(m[2])}</tspan>`;
    pending = dy;
    last = re.lastIndex;
  }
  emit(s.slice(last));
  if (pending) out += `<tspan dy="${(-pending).toFixed(3)}em"> </tspan>`;
  return out;
}

function text(x, y, s, o = {}) {
  const a = [`x="${x.toFixed(1)}"`, `y="${y.toFixed(1)}"`];
  if (o.anchor) a.push(`text-anchor="${o.anchor}"`);
  if (o.size) a.push(`font-size="${o.size}"`);
  if (o.cls) a.push(`class="${o.cls}"`);
  if (o.fill) a.push(`fill="${o.fill}"`);
  if (o.weight) a.push(`font-weight="${o.weight}"`);
  if (o.rotate) a.push(`transform="rotate(${o.rotate} ${x.toFixed(1)} ${y.toFixed(1)})"`);
  if (o.opacity) a.push(`opacity="${o.opacity}"`);
  return `<text ${a.join(" ")}>${o.raw ? s : rich(s)}</text>`;
}

const line = (x1, y1, x2, y2, cls, extra = "") =>
  `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="${cls}" ${extra}/>`;

/** Four significant digits, in whichever of MeV / keV / eV / meV reads best. */
export function fmtE(keV, sig = 4) {
  if (keV === null || keV === undefined || !isFinite(keV)) return "\u2014";
  if (keV === 0) return "0";
  const abs = Math.abs(keV);
  const [v, unit] =
    abs >= 1000 ? [keV / 1000, "MeV"] :
    abs >= 0.5 ? [keV, "keV"] :
    abs >= 1e-5 ? [keV * 1000, "eV"] : [keV * 1e6, "meV"];
  const a = Math.abs(v);
  const txt = a >= 1e-4 && a < 1e7 ? String(Number(v.toPrecision(sig))) : v.toExponential(sig - 1);
  return `${txt} ${unit}`;
}

/* Keeps labels in one lane from overlapping; returns the y to draw at. */
function lanePlacer(...reserved) {
  const used = [...reserved];
  const place = (y, half = 8) => {
    let yy = y;
    for (let i = 0; i < 80; i++) {
      const clash = used.find((u) => Math.abs(u - yy) < half * 2);
      if (!clash) break;
      yy = clash + (yy >= clash ? half * 2 + 0.5 : -(half * 2 + 0.5));
    }
    used.push(yy);
    return yy;
  };
  return place;
}

/* ------------------------------------------------------------------- render */

export function render(model) {
  const { r, X, a, b, Y, C, Ea, theta, W1, levelsY, levelsC, gamma } = model;
  const L = r.levels;

  /* ---- vertical scale --------------------------------------------------- */
  const values = [L.Yb, L.Ystar, L.Xa, L.C, L.entranceTop, L.cmLine].filter(Number.isFinite);
  let lo = Math.min(...values), hi = Math.max(...values);
  if (hi - lo < 1e-6) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.1;
  lo -= pad; hi += pad;
  const y = (e) => BOTTOM - ((e - lo) / (hi - lo)) * (BOTTOM - TOP);

  const out = [];
  const push = (...s) => out.push(...s);

  /* ---- panel headings --------------------------------------------------- */
  push(text(COL.before.cx, 30, "Before", { anchor: "middle", cls: "panel-title" }));
  push(text(COL.during.cx, 30, "During", { anchor: "middle", cls: "panel-title" }));
  push(text(COL.after.cx, 30, "After", { anchor: "middle", cls: "panel-title" }));
  push(line(COL.during.x0 - 18, 14, COL.during.x0 - 18, BOTTOM + 60, "rule-v"));
  push(line(COL.after.x0 - 18, 14, COL.after.x0 - 18, BOTTOM + 60, "rule-v"));

  /* ---- cartoons --------------------------------------------------------- */
  push(cartoons(model));

  /* ---- energy axis ------------------------------------------------------ */
  push(axis(lo, hi, y));

  /* ---- the ENSDF levels that sit inside the window ---------------------- */
  push(ladder(levelsC, L.C, COL.during.x0 + 4, COL.during.x0 + 38, y, lo, hi, "lvl-c", r.Eexc,
    `levels of ${C ? richName(C) : "C"}`, COL.during.x1));
  push(ladder(levelsY, L.Yb, COL.after.x0 + 4, COL.after.x0 + 38, y, lo, hi, "lvl-y", W1,
    `levels of ${richName(Y)}`, COL.after.x1));

  /* ---- "independent of the projectile energy" frame --------------------- */
  const frameTop = Math.min(y(L.Xa), y(L.Yb), y(L.Ystar)) - 14;
  push(`<rect class="indep" x="${COL.before.x0 - 6}" y="${frameTop.toFixed(1)}" width="${COL.after.x1 - COL.before.x0 + 12}" height="${(MASS_Y + 26 - frameTop).toFixed(1)}" rx="4"/>`);
  push(text(COL.after.x1 + 2, MASS_Y + 44, "everything inside this outline is independent", { anchor: "end", cls: "note" }));
  push(text(COL.after.x1 + 2, MASS_Y + 58, "of the energy of the projectile", { anchor: "end", cls: "note" }));

  /* ---- horizontal reference lines --------------------------------------- */
  push(line(LANE_EA, y(L.entranceTop), LANE_LAB + 6, y(L.entranceTop), "ref-dotted"));
  push(line(LANE_EA, y(L.cmLine), LANE_CM + 6, y(L.cmLine), "ref-dashed"));
  push(line(COL.after.x0, y(L.Ystar), LANE_CM - 10, y(L.Ystar), "ref-dashed exit"));
  push(line(COL.before.x1, y(L.Xa), LANE_Q1 + 6, y(L.Xa), "ref-dotted faint"));
  push(line(COL.during.x0, y(L.Yb), COL.after.x0, y(L.Yb), "ref-dotted faint"));

  /* ---- Before: the entrance channel ------------------------------------- */
  push(levelLine(COL.before.x0, COL.before.x1, y(L.Xa), "entrance"));
  push(text(COL.before.x0 + 6, y(L.Xa) - 10, `${richName(X)} + ${richName(a)}`, { cls: "level-label entrance-t" }));

  push(arrowY(LANE_EA, y(L.Xa), y(L.entranceTop), "entrance"));
  push(text(LANE_EA - 7, (y(L.Xa) + y(L.entranceTop)) / 2, `E_{a} = ${fmtE(Ea)}`,
    { anchor: "middle", cls: "small entrance-t", rotate: -90 }));
  const placeB2 = lanePlacer(y(L.Xa) - 13);
  push(bracket(COL.before.x0 + 16, y(L.cmLine), y(L.entranceTop), `E_{CM} = ${fmtE(r.Ecm)}`, "entrance", { place: placeB2 }));
  push(bracket(COL.before.x0 + 16, y(L.Xa), y(L.cmLine), `E_{disp} = ${fmtE(r.Edisp)}`, "entrance", { place: placeB2 }));

  /* ---- During: the compound nucleus ------------------------------------- */
  push(levelLine(COL.during.x0, COL.during.x1, y(L.C), "compound"));
  const cName = C ? richName(C) : "?";
  push(text(COL.during.cx, y(L.C) + 18, cName, { anchor: "middle", cls: "level-label compound-t" }));

  // the band of the compound state, its visible thickness carries Gamma
  const gammaH = gamma ? Math.max(2.5, Math.min(26, (gamma / (hi - lo)) * (BOTTOM - TOP))) : 3;
  push(`<rect class="gamma-band" x="${COL.during.x0}" y="${(y(L.cmLine) - gammaH / 2).toFixed(1)}" width="${COL.during.x1 - COL.during.x0}" height="${gammaH.toFixed(1)}"/>`);
  push(text(COL.during.x1 + 4, y(L.cmLine) + 3, gamma ? `Γ = ${fmtE(gamma)}` : "Γ", { cls: "small compound-t" }));

  push(arrowY(COL.during.cx, y(L.C), y(L.cmLine), "compound"));
  push(text(COL.during.cx - 8, (y(L.C) + y(L.cmLine)) / 2, `excitation of the compound nucleus  ${fmtE(r.Eexc)}`,
    { anchor: "middle", cls: "small compound-t", rotate: -90 }));

  // separation energies
  push(arrowY(COL.during.cx - 46, y(L.C), y(L.Xa), "sep"));
  push(text(COL.during.cx - 54, (y(L.C) + y(L.Xa)) / 2, `S_{a} = ${fmtE(r.Sa)}`,
    { anchor: "middle", cls: "small compound-t", rotate: -90 }));
  push(arrowY(COL.during.x1 - 20, y(L.C), y(L.Yb), "sep"));
  push(text(COL.during.x1 - 28, (y(L.C) + y(L.Yb)) / 2, `S_{b} = ${fmtE(r.Sb)}`,
    { anchor: "middle", cls: "small compound-t", rotate: -90 }));

  /* ---- After: the exit channel ------------------------------------------ */
  push(levelLine(COL.after.x0, COL.after.x1, y(L.Yb), "exit"));
  push(text(COL.after.x0 + 46, y(L.Yb) + 18, `${richName(Y)} + ${richName(b)}`, { cls: "level-label exit-t" }));
  if (Math.abs(W1) > 1e-9) {
    push(levelLine(COL.after.x0, COL.after.x1, y(L.Ystar), "exit star"));
    push(text(COL.after.x0 + 46, y(L.Ystar) - 9, `${richName(Y)}* + ${richName(b)}`, { cls: "level-label exit-t" }));
  }

  push(bracket(LANE_Q0, y(L.Yb), y(L.Xa), `Q_{0} = ${fmtE(r.Q0)}`, "q0", { place: lanePlacer() }));
  const placeQ = lanePlacer();
  push(bracket(LANE_Q1, y(L.Ystar), y(L.Xa), `Q_{1} = ${fmtE(r.Q1)}`, "q1", { place: placeQ }));
  push(bracket(LANE_Q1, y(L.Yb), y(L.Ystar), `W_{1} = ${fmtE(W1)}`, "w1", { place: placeQ }));

  /* ---- the sharing of the kinetic energy -------------------------------- */
  const sol = r.branches[0];
  const placeCM = lanePlacer();
  if (isFinite(r.EbCM) && isFinite(r.EYCM) && r.EbCM >= 0) {
    const split = L.Ystar + r.EYCM;
    push(bracket(LANE_CM, y(split), y(L.cmLine), `E^{CM}_{b} = ${fmtE(r.EbCM)}`, "exit", { place: placeCM }));
    push(bracket(LANE_CM, y(L.Ystar), y(split), `E^{CM}_{Y} = ${fmtE(r.EYCM)}`, "exit", { place: placeCM }));
  }
  const placeLab = lanePlacer();
  if (sol) {
    const split = L.Ystar + sol.EY;
    push(bracket(LANE_LAB, y(split), y(L.entranceTop), `E_{b} = ${fmtE(sol.Eb)}`, "exit", { place: placeLab }));
    push(bracket(LANE_LAB, y(L.Ystar), y(split), `E_{Y} = ${fmtE(sol.EY)}`, "exit", { place: placeLab }));
  } else {
    push(text(LANE_CM, y(L.cmLine), "no solution at this angle", { cls: "note warn" }));
    if (r.Eth > 0) push(text(LANE_CM, y(L.cmLine) + 14, `threshold E_{th} = ${fmtE(r.Eth)}`, { cls: "note warn" }));
    if (r.thetaMax !== null) push(text(LANE_CM, y(L.cmLine) + 28, `θ ≤ ${r.thetaMax.toFixed(1)}°`, { cls: "note warn" }));
  }
  push(text(LANE_CM, TOP - 26, "C.M. sharing", { anchor: "middle", cls: "frame-tag" }));
  push(text(LANE_LAB, TOP - 26, "laboratory sharing", { anchor: "middle", cls: "frame-tag" }));

  /* ---- the broken axis and the rest masses ------------------------------ */
  push(breakAndMasses(model, y));

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Energy level diagram of the reaction ${esc(plainText(model))}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,1 L9,5 L0,9 z" fill="currentColor"/>
      </marker>
    </defs>
    ${out.join("\n")}
  </svg>`;
}

export function reactionText({ X, a, b, Y }) {
  return `${nameOf(X)}(${nameOf(a)},${nameOf(b)})${nameOf(Y)}`;
}

function plainText(m) { return reactionText(m); }

/* ------------------------------------------------------------ sub-drawings */

function levelLine(x0, x1, yy, cls) {
  return `<line x1="${x0}" y1="${yy.toFixed(1)}" x2="${x1}" y2="${yy.toFixed(1)}" class="level ${cls}"/>`;
}

/** Double-headed arrow with end caps, plus a label placed beside it. */
function bracket(x, yTop, yBot, label, cls, o = {}) {
  const [y1, y2] = yTop <= yBot ? [yTop, yBot] : [yBot, yTop];
  const mid = (y1 + y2) / 2;
  const span = y2 - y1;
  const parts = [];
  parts.push(`<line x1="${x}" y1="${(y1 + 0.5).toFixed(1)}" x2="${x}" y2="${(y2 - 0.5).toFixed(1)}" class="bracket ${cls}" marker-start="url(#ah)" marker-end="url(#ah)"/>`);
  parts.push(line(x - 4, y1, x + 4, y1, `bracket-cap ${cls}`));
  parts.push(line(x - 4, y2, x + 4, y2, `bracket-cap ${cls}`));
  const place = o.place || ((v) => v);
  const ly = place(span < 18 ? y1 - 10 : mid);
  const anchor = o.side === "left" ? "end" : "start";
  const lx = o.side === "left" ? x - 8 : x + 8;
  if (Math.abs(ly - mid) > 2 || span < 14) {
    parts.push(line(x + (o.side === "left" ? -3 : 3), mid, lx + (o.side === "left" ? 3 : -3), ly, `leader ${cls}`));
  }
  parts.push(text(lx, ly + 3.5, label, { anchor, cls: `small ${cls}-t` }));
  return parts.join("");
}

/** Single vertical double arrow used for S_a, S_b and the excitation. */
function arrowY(x, y1, y2, cls) {
  return `<line x1="${x}" y1="${(Math.min(y1, y2) + 1).toFixed(1)}" x2="${x}" y2="${(Math.max(y1, y2) - 1).toFixed(1)}" class="bracket ${cls}" marker-start="url(#ah)" marker-end="url(#ah)"/>`;
}

function axis(lo, hi, y) {
  const parts = [line(AXIS_X, TOP - 16, AXIS_X, BOTTOM + 10, "axis")];
  const raw = (hi - lo) / 1000 / 6;                 // target ~6 ticks, in MeV
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9))));
  const step = ([1, 2, 5, 10].find((m) => m * mag >= raw) || 10) * mag;
  const start = Math.ceil(lo / 1000 / step) * step;
  for (let v = start; v * 1000 <= hi; v += step) {
    const yy = y(v * 1000);
    if (yy < TOP - 16 || yy > BOTTOM + 10) continue;
    parts.push(line(AXIS_X - 5, yy, AXIS_X, yy, "tick"));
    const dec = step < 0.01 ? 3 : step < 0.1 ? 2 : step < 1 ? 1 : 0;
    parts.push(text(AXIS_X - 9, yy + 3.5, v.toFixed(dec), { anchor: "end", cls: "tick-label" }));
  }
  parts.push(text(18, (TOP + BOTTOM) / 2, "energy above (m_{Y}+m_{b})c²    [MeV]",
    { anchor: "middle", cls: "axis-title", rotate: -90 }));
  return parts.join("");
}

/**
 * The adopted levels of one nucleus, drawn as a narrow ladder so that the
 * level density stays readable; the selected (or nearest) level is drawn
 * across the whole panel.
 */
function ladder(levels, base, xa, xb, y, lo, hi, cls, highlight, caption, xFull) {
  if (!levels || !levels.length) return "";
  const parts = [];
  let shown = 0, top = BOTTOM, hit = false;
  for (const lv of levels) {
    const e = base + lv.e;
    if (e < lo || e > hi) continue;
    const yy = y(e);
    const on = highlight !== undefined && Math.abs(lv.e - highlight) < 1e-6;
    if (on) { hit = true; continue; }
    parts.push(line(xa, yy, xb, yy, cls));
    top = Math.min(top, yy);
    if (++shown > 600) break;
  }
  if (hit) parts.push(line(xa, y(base + highlight), xFull || xb, y(base + highlight), `${cls} on`));
  if (shown > 1) parts.push(text(xa, Math.min(top - 7, TOP - 10), caption, { cls: `tiny ${cls}-cap` }));
  return parts.join("");
}

/** The three rest-mass labels below the broken axis. */
function breakAndMasses(model, y) {
  const { r, X, a, b, Y, C } = model;
  const L = r.levels;
  const parts = [];
  const zig = (x0, x1) => {
    let d = `M${x0},${BREAK_Y}`;
    for (let x = x0; x < x1; x += 16) d += ` l8,-5 l8,5`;
    return `<path class="axis-break" d="${d}"/>`;
  };
  parts.push(zig(AXIS_X - 10, COL.after.x1 + 10));
  const drops = [
    { x: COL.before.cx, e: L.Xa, label: `(m_{X}+m_{a})c²`, cls: "entrance-t" },
    { x: COL.during.cx, e: L.C, label: `m_{C}c²`, cls: "compound-t" },
    { x: COL.after.cx, e: L.Yb, label: `(m_{Y}+m_{b})c²`, cls: "exit-t" },
  ];
  for (const d of drops) {
    parts.push(line(d.x, y(d.e), d.x, BREAK_Y - 4, "drop"));
    parts.push(line(d.x, BREAK_Y + 6, d.x, MASS_Y - 12, "drop"));
    parts.push(text(d.x, MASS_Y, d.label, { anchor: "middle", cls: `small ${d.cls}` }));
  }
  const u = 931494.10242;
  const mass = (n) => (n ? ((n.a * u + n.me) / 1000).toFixed(3) : "—");
  parts.push(text(COL.before.cx, MASS_Y + 16, `${((r.masses.mX + r.masses.ma) / 1000).toFixed(3)} MeV`, { anchor: "middle", cls: "tiny" }));
  parts.push(text(COL.during.cx, MASS_Y + 16, `${mass(C)} MeV`, { anchor: "middle", cls: "tiny" }));
  parts.push(text(COL.after.cx, MASS_Y + 16, `${((r.masses.mY + r.masses.mb) / 1000).toFixed(3)} MeV`, { anchor: "middle", cls: "tiny" }));
  return parts.join("");
}

/* --------------------------------------------------------------- cartoons */

function nucleus(cx, cy, rr, cls) {
  return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rr}" class="blob ${cls}"/>`;
}
function vec(x1, y1, x2, y2, cls) {
  return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="vec ${cls}" marker-end="url(#ah)"/>`;
}

function cartoons(model) {
  const { r, X, a, b, Y, C, theta } = model;
  const sol = r.branches[0];
  const p = [];
  const yc = 112;

  const frames = [
    { x: COL.before.x0 + 46, tag: "LAB" },
    { x: COL.before.x1 - 56, tag: "C.M." },
    { x: COL.during.x0 + 48, tag: "LAB" },
    { x: COL.during.x1 - 48, tag: "C.M." },
    { x: COL.after.x0 + 56, tag: "LAB" },
    { x: COL.after.x1 - 70, tag: "C.M." },
  ];
  for (const f of frames) p.push(text(f.x, 56, f.tag, { anchor: "middle", cls: "frame-tag" }));

  // Before, lab: a moves towards a target at rest
  let x = frames[0].x;
  p.push(vec(x - 42, yc, x - 16, yc, "entrance"));
  p.push(text(x - 44, yc - 8, richName(a), { anchor: "middle", cls: "tiny entrance-t" }));
  p.push(nucleus(x + 6, yc, 11, "target"));
  p.push(text(x + 6, yc - 16, richName(X), { anchor: "middle", cls: "tiny" }));
  p.push(text(x + 6, yc + 26, "at rest", { anchor: "middle", cls: "tiny muted" }));

  // Before, C.M.: the two approach each other
  x = frames[1].x;
  p.push(vec(x - 44, yc, x - 20, yc, "entrance"));
  p.push(text(x - 46, yc - 8, richName(a), { anchor: "middle", cls: "tiny entrance-t" }));
  p.push(nucleus(x + 18, yc, 11, "target"));
  p.push(vec(x + 2, yc, x - 6, yc, "entrance"));
  p.push(text(x + 18, yc - 16, richName(X), { anchor: "middle", cls: "tiny" }));

  // During: the compound nucleus, moving in the lab, at rest in the C.M.
  x = frames[2].x;
  p.push(nucleus(x, yc, 14, "compound"));
  p.push(vec(x + 16, yc, x + 40, yc, "compound"));
  p.push(text(x, yc - 20, C ? richName(C) : "C", { anchor: "middle", cls: "tiny compound-t" }));
  p.push(text(x + 30, yc + 16, `E_{CM}`, { anchor: "middle", cls: "tiny compound-t" }));
  x = frames[3].x;
  p.push(nucleus(x, yc, 14, "compound"));
  p.push(text(x, yc - 20, C ? richName(C) : "C", { anchor: "middle", cls: "tiny compound-t" }));
  p.push(text(x, yc + 24, "at rest", { anchor: "middle", cls: "tiny muted" }));

  // After, lab: b at theta, Y at the recoil angle
  x = frames[4].x;
  const R = 34;
  p.push(line(x - 46, yc, x - 6, yc, "beam-axis"));
  p.push(nucleus(x - 2, yc, 7, "target faint"));
  if (sol) {
    const th = (theta * Math.PI) / 180, ph = (sol.phi * Math.PI) / 180;
    p.push(vec(x, yc, x + R * Math.cos(th), yc - R * Math.sin(th), "exit"));
    p.push(text(x + (R + 12) * Math.cos(th), yc - (R + 12) * Math.sin(th) + 3, richName(b), { anchor: "middle", cls: "tiny exit-t" }));
    p.push(vec(x, yc, x + R * 0.8 * Math.cos(ph), yc + R * 0.8 * Math.sin(ph), "recoil"));
    p.push(text(x + (R * 0.8 + 12) * Math.cos(ph), yc + (R * 0.8 + 12) * Math.sin(ph) + 3, richName(Y), { anchor: "middle", cls: "tiny recoil-t" }));
    p.push(`<path class="angle-arc" d="M${(x + 18).toFixed(1)},${yc} A18,18 0 0,0 ${(x + 18 * Math.cos(th)).toFixed(1)},${(yc - 18 * Math.sin(th)).toFixed(1)}"/>`);
    p.push(text(x + 24, yc - 8, "θ", { cls: "tiny" }));
    p.push(text(x + 40, yc + 46, `θ = ${theta.toFixed(0)}°, φ = ${sol.phi.toFixed(1)}°`, { anchor: "middle", cls: "tiny muted" }));
  } else {
    p.push(text(x + 22, yc + 34, "no emission", { anchor: "middle", cls: "tiny warn" }));
  }

  // After, C.M.: back to back
  x = frames[5].x;
  if (sol) {
    const tc = (sol.thetaCM * Math.PI) / 180;
    p.push(vec(x, yc, x + R * Math.cos(tc), yc - R * Math.sin(tc), "exit"));
    p.push(vec(x, yc, x - R * 0.8 * Math.cos(tc), yc + R * 0.8 * Math.sin(tc), "recoil"));
    p.push(text(x + (R + 12) * Math.cos(tc), yc - (R + 12) * Math.sin(tc) + 3, richName(b), { anchor: "middle", cls: "tiny exit-t" }));
    p.push(text(x - (R * 0.8 + 12) * Math.cos(tc), yc + (R * 0.8 + 12) * Math.sin(tc) + 3, richName(Y), { anchor: "middle", cls: "tiny recoil-t" }));
    p.push(text(x + 4, yc + 46, `θ_{CM} = ${sol.thetaCM.toFixed(1)}°`, { anchor: "middle", cls: "tiny muted" }));
  }
  return p.join("");
}
