/* Sanity checks for the kinematics module.  Run with:  node tests/kinematics.test.mjs */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { solve, massOf, PARTICLES, U_KEV } from "../js/nuclear.js";

const here = dirname(fileURLToPath(import.meta.url));
const DB = JSON.parse(readFileSync(join(here, "..", "data", "nuclides.json"), "utf8"));

const SYM2Z = {};
for (const [z, sym] of Object.entries(DB.symbols)) SYM2Z[sym.toLowerCase()] = Number(z);

function nuc(tag) {
  const m = /^(\d+)([A-Za-z]+)$/.exec(tag);
  const a = Number(m[1]);
  const z = SYM2Z[m[2].toLowerCase()];
  const rec = DB.nuclides[`${z}-${a}`];
  if (!rec) throw new Error(`unknown nuclide ${tag}`);
  return rec;
}
function part(key) {
  if (/^\d/.test(key)) return nuc(key);            // a nuclide tag such as "7Be"
  const p = PARTICLES[key];
  if (p.massless) return { ...p, me: 0, a: 0, z: 0 };
  const rec = DB.nuclides[`${p.z}-${p.a}`];
  return { ...rec, label: p.label, key: p.key };
}
function byZA(z, a) {
  return DB.nuclides[`${z}-${a}`];
}

let failures = 0;
function check(name, got, want, tol) {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}: got ${got.toFixed(4)}, expected ${want} ± ${tol}`);
}

function run(targetTag, aKey, bKey, Ea, theta = 0, W1 = 0, relativistic = false) {
  const X = nuc(targetTag), a = part(aKey), b = part(bKey);
  const C = byZA(X.z + a.z, X.a + a.a);
  const Y = byZA(X.z + a.z - b.z, X.a + a.a - b.a);
  return solve({ X, a, b, Y, C, Ea, theta, W1, relativistic });
}

console.log("--- Q values (keV) ---");
// AME2020 / ENSDF reference values
check("7Li(p,n)7Be  Q0", run("7Li", "p", "n", 2000).Q0, -1644.24, 0.5);
check("3H(d,n)4He   Q0", run("3H", "d", "n", 100).Q0, 17589.3, 1);
check("2H(d,n)3He   Q0", run("2H", "d", "n", 100).Q0, 3268.9, 1);
check("14N(a,p)17O  Q0", run("14N", "A", "p", 5000).Q0, -1191.8, 1);
check("56Fe(n,g)57Fe Q0 = Sn(57Fe)", run("56Fe", "n", "g", 1).Q0, 7646.1, 1);
check("235U(n,g)236U Q0 = Sn(236U)", run("235U", "n", "g", 1).Q0, 6545.4, 1);
check("9Be(a,n)12C  Q0", run("9Be", "A", "n", 5000).Q0, 5701.4, 1);

console.log("\n--- separation energies (keV), compare with the ENSDF/AME S values ---");
{
  const r = run("56Fe", "n", "n", 1000);           // compound 57Fe
  check("Sa = Sn(57Fe)", r.Sa, 7646.1, 1);
  check("Sb = Sn(57Fe)", r.Sb, 7646.1, 1);
  check("Q0 of elastic channel", r.Q0, 0, 1e-9);
  check("Sn(57Fe) from the ENSDF table", DB.nuclides["26-57"].sn, 7646.1, 1);
}
{
  const r = run("12C", "p", "p", 5000);            // compound 13N
  check("Sp(13N)", r.Sa, DB.nuclides["7-13"].sp, 0.01);
}

console.log("\n--- thresholds (keV) ---");
check("7Li(p,n)7Be  Eth", run("7Li", "p", "n", 1000).Eth, 1880.4, 2);
check("14N(a,p)17O  Eth", run("14N", "A", "p", 1000).Eth, 1532, 5);

console.log("\n--- energy bookkeeping ---");
{
  const r = run("56Fe", "n", "n", 14100, 30, 846.7778);
  check("Ecm + Edisp = Ea", r.Ecm + r.Edisp, 14100, 1e-6);
  check("Edisp = mX/(mX+ma) Ea", r.Edisp, (massOf(nuc("56Fe")) / (massOf(nuc("56Fe")) + massOf(part("n")))) * 14100, 1e-6);
  const s = r.branches[0];
  check("Eb + EY = Ea + Q1", s.Eb + s.EY, 14100 + r.Q1, 1e-6);
  check("E*(C) = Sa + Edisp", r.Eexc, r.Sa + r.Edisp, 1e-6);
  check("EbCM + EYCM = Edisp + Q1", r.EbCM + r.EYCM, r.Edisp + r.Q1, 1e-6);
  // the relation printed on the diagram must hold for the solved Eb
  const { ma, mb, mY } = r.masses;
  const th = (30 * Math.PI) / 180;
  const lhs = (1 + mb / mY) * s.Eb - (1 - ma / mY) * 14100
    - (2 * Math.sqrt(ma * mb) / mY) * Math.sqrt(14100 * s.Eb) * Math.cos(th);
  check("diagram relation for Q1", lhs, r.Q1, 1e-5);
}

console.log("\n--- momentum conservation (classical) ---");
{
  const r = run("27Al", "p", "A", 10000, 45);
  const s = r.branches[0];
  const { ma, mb, mY } = r.masses;
  const pa = Math.sqrt(2 * ma * 10000);
  const pb = Math.sqrt(2 * mb * s.Eb);
  const pY = Math.sqrt(2 * mY * s.EY);
  const th = Math.PI / 4, ph = (s.phi * Math.PI) / 180;
  check("p_z", pb * Math.cos(th) + pY * Math.cos(ph), pa, 1e-6 * pa);
  check("p_x", pb * Math.sin(th) - pY * Math.sin(ph), 0, 1e-6 * pa);
}

console.log("\n--- relativistic engine ---");
{
  // at low energy the two engines must agree
  const cl = run("56Fe", "n", "n", 5000, 60, 0, false);
  const re = run("56Fe", "n", "n", 5000, 60, 0, true);
  check("Eb classical vs relativistic (5 MeV)", re.branches[0].Eb, cl.branches[0].Eb, 1.0);
  check("Edisp classical vs relativistic", re.Edisp, cl.Edisp, 1.0);
}
{
  // radiative capture 1H(n,g)2H with a thermal neutron: at 90 deg the first
  // order Doppler shift vanishes and only the 2H recoil, Eg^2/(2 M c^2), is left
  const r = run("1H", "n", "g", 0.0253, 90, 0, true);
  check("1H(n,g)2H  Q0", r.Q0, 2224.566, 0.1);
  check("E_gamma at 90 deg (recoil-shifted)", r.branches[0].Eb, 2224.566 + 0.0253 / 2 - 2224.566 ** 2 / (2 * (2 * U_KEV + nuc("2H").me)), 0.02);
  const fwd = run("1H", "n", "g", 0.0253, 0, 0, true).branches[0].Eb;
  const bwd = run("1H", "n", "g", 0.0253, 180, 0, true).branches[0].Eb;
  check("Doppler split 0 vs 180 deg", fwd - bwd, 2 * Math.sqrt(2 * massOf(part("n")) * 0.0253) / (2 * U_KEV + nuc("2H").me) * 2223.5, 0.02);
}
{
  // photodisintegration of the deuteron, 2H(g,n)1H
  const r = run("2H", "g", "n", 4000, 0, 0, true);
  check("2H(g,n)p  Q0", r.Q0, -2224.566, 0.1);
  check("E_disp available", r.Edisp, 4000 - r.Ecm, 1e-6);
}

console.log("\n--- two-valued solutions (heavy ejectile, endoergic) ---");
{
  // inverse kinematics: the heavy ejectile is confined to a forward cone and
  // two energies are possible at every angle inside it
  const r = run("1H", "7Li", "7Be", 20000, 2);   // 1H(7Li,7Be)n
  console.log(`    1H(7Li,7Be)n  Q0 = ${r.Q0.toFixed(1)} keV`);
  console.log(`    branches at 2 deg: ${r.branches.map((s) => s.Eb.toFixed(1)).join(", ")} keV`);
  console.log(`    theta_max = ${r.thetaMax === null ? "none (all angles)" : r.thetaMax.toFixed(2) + " deg"}`);
  if (r.branches.length !== 2) { failures++; console.log("FAIL  expected two branches"); }
  else console.log("ok    two kinematic branches inside the forward cone");
  if (r.thetaMax === null || r.thetaMax > 20) { failures++; console.log("FAIL  expected a narrow forward cone"); }
  else console.log("ok    emission cone is limited to theta_max");
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
