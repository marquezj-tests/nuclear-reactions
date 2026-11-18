/* UI wiring: pick a reaction, set the beam energy, redraw the diagram. */

import { solve, widthFromHalfLife, PARTICLES } from "./nuclear.js";
import { loadDatabase, nuclide, allNuclides, particle, levelsOf, nameOf, htmlName, tagOf } from "./data.js";
import { render, reactionText, fmtE } from "./diagram.js";

const S = {                         // application state
  target: { z: 26, a: 56 },
  projectile: "n",                  // a PARTICLES key or {z, a}
  ejectile: "g",
  Ea: 0.0253 / 1000,                // keV
  theta: 0,
  W1: 0,
  relativistic: false,
};

const $ = (id) => document.getElementById(id);
const UNIT = { eV: 1e-3, keV: 1, MeV: 1e3 };

/* ------------------------------------------------------------ persistence */
function saveState() {
  try { localStorage.setItem("reaction-state", JSON.stringify(S)); } catch { /* private mode */ }
}
function restoreState() {
  try {
    const raw = localStorage.getItem("reaction-state");
    if (raw) Object.assign(S, JSON.parse(raw));
  } catch { /* ignore */ }
}

/* ----------------------------------------------------------- the particles */
function specOf(choice) {
  if (typeof choice === "string") return particle(choice);
  const rec = nuclide(choice.z, choice.a);
  return rec ? { ...rec } : null;
}

function speciesButtons(container, current, onPick) {
  container.innerHTML = "";
  for (const key of ["g", "n", "p", "d", "t", "h", "A"]) {
    const p = PARTICLES[key];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (current === key ? " on" : "");
    btn.textContent = p.label;
    btn.title = p.name;
    btn.addEventListener("click", () => onPick(key));
    container.appendChild(btn);
  }
  const other = document.createElement("button");
  other.type = "button";
  other.className = "chip wide" + (typeof current === "object" ? " on" : "");
  other.innerHTML = typeof current === "object" ? htmlName(nuclide(current.z, current.a)) : "nuclide…";
  other.addEventListener("click", () => onPick("__pick__"));
  container.appendChild(other);
}

/* ------------------------------------------------------- the nuclide picker */
function setupCombo(inputId, listId, onChoose) {
  const input = $(inputId), list = $(listId);
  let items = [], active = -1;

  const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; };
  const open = () => { list.hidden = false; input.setAttribute("aria-expanded", "true"); };

  function search(q) {
    const query = q.trim().toLowerCase().replace(/[\s-]/g, "");
    const all = allNuclides();
    if (!query) return all.slice(0, 60);
    const out = [];
    for (const n of all) {
      const sym = n.sym.toLowerCase();
      const hay = [`${sym}${n.a}`, `${n.a}${sym}`, sym, String(n.a)];
      if (hay.some((h) => h.startsWith(query)) || `${sym}${n.a}`.includes(query)) out.push(n);
      if (out.length > 80) break;
    }
    return out;
  }

  function paint(q) {
    items = search(q);
    list.innerHTML = items.map((n, i) => `
      <li role="option" id="${listId}-o${i}" data-i="${i}" class="${i === active ? "on" : ""}">
        <span class="opt-name"><sup>${n.a}</sup>${n.sym}</span>
        <span class="opt-meta">${n.jp ? `J<sup>π</sup> ${n.jp}` : ""}${n.abu ? ` · ${n.abu}%` : ""}${n.hl && n.hl !== "STABLE" ? ` · ${n.hl}` : n.hl === "STABLE" ? " · stable" : ""}</span>
      </li>`).join("");
    open();
  }

  input.addEventListener("focus", () => paint(input.value));
  input.addEventListener("input", () => paint(input.value));
  input.addEventListener("keydown", (e) => {
    if (list.hidden && (e.key === "ArrowDown" || e.key === "Enter")) { paint(input.value); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      active = Math.max(0, Math.min(items.length - 1, active + (e.key === "ArrowDown" ? 1 : -1)));
      [...list.children].forEach((li, i) => li.classList.toggle("on", i === active));
      list.children[active]?.scrollIntoView({ block: "nearest" });
      input.setAttribute("aria-activedescendant", `${listId}-o${active}`);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const n = items[Math.max(active, 0)];
      if (n) { onChoose(n); close(); input.blur(); }
    } else if (e.key === "Escape") { close(); }
  });
  list.addEventListener("mousedown", (e) => {
    const li = e.target.closest("li[data-i]");
    if (!li) return;
    e.preventDefault();
    onChoose(items[Number(li.dataset.i)]);
    close();
    input.blur();
  });
  input.addEventListener("blur", () => setTimeout(close, 120));
  return { close };
}

/* -------------------------------------------------------------- the update */
async function update() {
  const X = nuclide(S.target.z, S.target.a);
  const a = specOf(S.projectile);
  const b = specOf(S.ejectile);
  const msg = $("message");

  if (!X || !a || !b) { msg.textContent = "Choose a target, a projectile and an ejectile."; return; }

  const zY = X.z + a.z - b.z, aY = X.a + a.a - b.a;
  const Y = nuclide(zY, aY);
  const C = nuclide(X.z + a.z, X.a + a.a);

  $("reaction").innerHTML = Y
    ? `${htmlName(X)}<span class="paren">(</span>${htmlName(a)},${htmlName(b)}<span class="paren">)</span>${htmlName(Y)}`
    : `${htmlName(X)}(${htmlName(a)},${htmlName(b)})?`;

  if (!Y) {
    msg.innerHTML = `The residual nucleus of this channel (Z = ${zY}, A = ${aY}) is not in the ENSDF tables — the channel does not exist.`;
    $("figure-host").innerHTML = "";
    $("readout").innerHTML = "";
    return;
  }
  msg.textContent = "";

  const levelsY = await levelsOf(zY, aY);
  const levelsC = C ? await levelsOf(C.z, C.a) : [];

  const r = solve({ X, a, b, Y, C, Ea: S.Ea, theta: S.theta, W1: S.W1, relativistic: S.relativistic });

  // the compound state that the beam energy picks out, and its width
  let gamma = null, resonance = null;
  if (levelsC.length) {
    let best = null;
    for (const lv of levelsC) {
      const d = Math.abs(lv.e - r.Eexc);
      if (!best || d < best.d) best = { lv, d };
    }
    const window = Math.max(50, Math.abs(r.Eexc) * 0.004);
    if (best && best.d < window) {
      resonance = best.lv;
      gamma = widthFromHalfLife(best.lv.hl);
    }
  }

  fillLevelSelect(levelsY, r);
  $("figure-host").innerHTML = render({ r, X, a, b, Y, C, Ea: S.Ea, theta: S.theta, W1: S.W1, levelsY, levelsC, gamma });
  $("figure-caption").innerHTML = captionFor({ r, X, a, b, Y, C });
  renderReadout({ r, X, a, b, Y, C, levelsY, resonance, gamma });
  saveState();
}

function captionFor({ r, X, a, b, Y, C }) {
  const sign = r.Q0 >= 0 ? "exoergic" : "endoergic";
  const sol = r.branches[0];
  return `Energy balance of ${htmlName(X)}(${htmlName(a)},${htmlName(b)})${htmlName(Y)}, ${sign} with
    Q<sub>0</sub> = ${fmtE(r.Q0)}. Every level sits on one absolute scale whose zero is the rest mass of
    ${htmlName(Y)} + ${htmlName(b)}; the compound nucleus is ${C ? htmlName(C) : "unknown"}.
    ${sol ? `The laboratory bracket on the right splits E<sub>a</sub> + Q<sub>1</sub> between the ejectile and the
      recoil at \u03b8 = ${S.theta.toFixed(0)}\u00b0, which follows from conservation of linear momentum;
      the C.M. bracket splits E<sub>disp</sub> + Q<sub>1</sub> the same way, independently of the angle.`
    : "No ejectile can be emitted at this angle, so the laboratory sharing is left blank."}`;
}

function fillLevelSelect(levelsY, r) {
  const sel = $("level");
  const available = r.Q0 + r.Edisp;         // highest excitation the beam can leave in Y
  const previous = S.W1;
  sel.innerHTML = "";
  const seen = new Set();
  for (const lv of levelsY.slice(0, 120)) {
    if (seen.has(lv.e)) continue;
    seen.add(lv.e);
    const opt = document.createElement("option");
    opt.value = String(lv.e);
    const jp = lv.jp ? `  ${lv.jp}` : "";
    opt.textContent = `${(lv.e / 1000).toFixed(3)} MeV${jp}${lv.e === 0 ? "  (ground state)" : ""}`;
    if (lv.e > available) { opt.textContent += "  — above the available energy"; opt.classList.add("unreachable"); }
    sel.appendChild(opt);
  }
  if (!seen.has(previous)) {
    const opt = document.createElement("option");
    opt.value = String(previous);
    opt.textContent = `${(previous / 1000).toFixed(3)} MeV  (set by hand)`;
    sel.appendChild(opt);
  }
  sel.value = String(previous);
}

/* ---------------------------------------------------------------- readouts */
function row(label, value, note) {
  return `<div class="row"><dt>${label}</dt><dd>${value}${note ? `<span class="note">${note}</span>` : ""}</dd></div>`;
}

function renderReadout({ r, X, a, b, Y, C, resonance, gamma }) {
  const sol = r.branches[0];
  const alt = r.branches[1];
  const mass = (n) => (n ? `${n.me.toFixed(1)} keV` : "—");

  const before = [
    row("E<sub>a</sub> (lab)", fmtE(S.Ea)),
    row("E<sub>CM</sub>", fmtE(r.Ecm), "kinetic energy of the centre of mass"),
    row("E<sub>disp</sub>", fmtE(r.Edisp), "energy available in the C.M. frame"),
    row("v<sub>CM</sub>/c", (Math.sqrt(2 * r.Ecm / (r.masses.ma + r.masses.mX)) || 0).toExponential(3)),
  ].join("");

  const during = [
    row("compound nucleus", C ? `${htmlName(C)}` : "—"),
    row("S<sub>a</sub>", fmtE(r.Sa), `separation energy of ${htmlName(a)} from ${C ? htmlName(C) : "C"}`),
    row("S<sub>b</sub>", fmtE(r.Sb), `separation energy of ${htmlName(b)} from ${C ? htmlName(C) : "C"}`),
    row("E*(C)", fmtE(r.Eexc), "excitation of the compound nucleus"),
    row("nearest ENSDF level", resonance ? `${(resonance.e / 1000).toFixed(3)} MeV${resonance.jp ? `  ${resonance.jp}` : ""}` : "none within the window",
      gamma ? `Γ = ${fmtE(gamma)}` : resonance ? "width not known" : ""),
  ].join("");

  const after = [
    row("Q<sub>0</sub>", fmtE(r.Q0), "ground state to ground state"),
    row("W<sub>1</sub>", fmtE(S.W1), `excitation left in ${htmlName(Y)}`),
    row("Q<sub>1</sub>", fmtE(r.Q1), "Q<sub>0</sub> − W<sub>1</sub>"),
    r.Eth > 0 ? row("threshold", fmtE(r.Eth), "lab energy needed to open this channel") : "",
    row(`E<sub>b</sub> at θ = ${S.theta.toFixed(0)}°`, sol ? fmtE(sol.Eb) : "no solution",
      alt ? `second branch ${fmtE(alt.Eb)}` : ""),
    row("E<sub>Y</sub> (recoil)", sol ? fmtE(sol.EY) : "—", sol ? `φ = ${sol.phi.toFixed(2)}°` : ""),
    row("E<sup>CM</sup><sub>b</sub> / E<sup>CM</sup><sub>Y</sub>", `${fmtE(r.EbCM)} / ${fmtE(r.EYCM)}`,
      sol ? `θ<sub>CM</sub> = ${sol.thetaCM.toFixed(2)}°` : ""),
    r.thetaMax !== null ? row("emission cone", `θ ≤ ${r.thetaMax.toFixed(2)}°`, "two energies at every angle inside it") : "",
  ].join("");

  const data = [
    row(`Δ(${htmlName(X)})`, mass(X), X.jp ? `J<sup>π</sup> ${X.jp}` : ""),
    row(`Δ(${htmlName(a)})`, a.massless ? "0" : mass(a), ""),
    row(`Δ(${htmlName(b)})`, b.massless ? "0" : mass(b), ""),
    row(`Δ(${htmlName(Y)})`, mass(Y), Y.jp ? `J<sup>π</sup> ${Y.jp}` : ""),
    row(`Δ(${C ? htmlName(C) : "C"})`, mass(C), C && C.jp ? `J<sup>π</sup> ${C.jp}` : ""),
  ].join("");

  $("readout").innerHTML = `
    <section class="card entrance"><h3>Before</h3><dl>${before}</dl></section>
    <section class="card compound"><h3>During</h3><dl>${during}</dl></section>
    <section class="card exit"><h3>After</h3><dl>${after}</dl></section>
    <section class="card plain"><h3>Mass excesses</h3><dl>${data}</dl>
      <p class="fineprint">Atomic mass excesses Δ from the AME2020 evaluation distributed with ENSDF;
      Q<sub>0</sub> = Δ(X) + Δ(a) − Δ(Y) − Δ(b).</p></section>`;
}

/* -------------------------------------------------------------- the inputs */
function syncEnergyInputs() {
  const unit = $("energy-unit").value;
  $("energy").value = String(Number((S.Ea / UNIT[unit]).toPrecision(6)));
  $("energy-slider").value = String(Math.log10(Math.max(S.Ea, 1e-9)));
}

function bind() {
  setupCombo("target", "target-list", (n) => {
    S.target = { z: n.z, a: n.a };
    S.W1 = 0;
    $("target").value = tagOf(n);
    update();
  });
  setupCombo("proj-nuc", "proj-nuc-list", (n) => {
    S.projectile = { z: n.z, a: n.a };
    S.W1 = 0;
    $("proj-nuc").value = tagOf(n);
    paintSpecies();
    update();
  });
  setupCombo("ejec-nuc", "ejec-nuc-list", (n) => {
    S.ejectile = { z: n.z, a: n.a };
    S.W1 = 0;
    $("ejec-nuc").value = tagOf(n);
    paintSpecies();
    update();
  });

  $("energy").addEventListener("input", () => {
    const v = parseFloat($("energy").value);
    if (!isFinite(v) || v <= 0) return;
    S.Ea = v * UNIT[$("energy-unit").value];
    $("energy-slider").value = String(Math.log10(S.Ea));
    update();
  });
  $("energy-unit").addEventListener("change", () => syncEnergyInputs());
  $("energy-slider").addEventListener("input", () => {
    S.Ea = Math.pow(10, parseFloat($("energy-slider").value));
    syncEnergyInputs();
    update();
  });
  for (const btn of document.querySelectorAll("[data-energy]")) {
    btn.addEventListener("click", () => {
      S.Ea = parseFloat(btn.dataset.energy);
      syncEnergyInputs();
      update();
    });
  }

  $("angle").addEventListener("input", () => {
    S.theta = parseFloat($("angle").value);
    $("angle-value").textContent = `${S.theta.toFixed(0)}\u00b0`;
    update();
  });
  $("level").addEventListener("change", () => { S.W1 = parseFloat($("level").value) || 0; update(); });
  $("relativistic").addEventListener("change", () => { S.relativistic = $("relativistic").checked; update(); });
}

function paintSpecies() {
  const wire = (chipsId, which, comboId) => {
    speciesButtons($(chipsId), S[which], (key) => {
      if (key === "__pick__") {
        $(comboId).parentElement.hidden = false;
        $(comboId).focus();
        $(comboId).select();
        return;
      }
      S[which] = key;
      S.W1 = 0;
      $(comboId).parentElement.hidden = true;
      paintSpecies();
      update();
    });
    const custom = typeof S[which] === "object";
    $(comboId).parentElement.hidden = !custom;
    if (custom) {
      const rec = nuclide(S[which].z, S[which].a);
      if (rec) $(comboId).value = tagOf(rec);
    }
  };
  wire("projectile-chips", "projectile", "proj-nuc");
  wire("ejectile-chips", "ejectile", "ejec-nuc");
}

async function main() {
  restoreState();
  try {
    await loadDatabase();
  } catch (err) {
    $("message").textContent = `Could not load the nuclear data: ${err.message}`;
    return;
  }
  const X = nuclide(S.target.z, S.target.a) || nuclide(26, 56);
  $("target").value = tagOf(X);
  $("angle").value = String(S.theta);
  $("angle-value").textContent = `${S.theta.toFixed(0)}°`;
  $("relativistic").checked = S.relativistic;
  syncEnergyInputs();
  bind();
  paintSpecies();
  await update();
}

main();
