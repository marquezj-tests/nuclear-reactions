/*
 * Two-body nuclear reaction kinematics  X(a,b)Y*
 *
 * Energy bookkeeping follows the level diagram of the "Pocketbook of Data for
 * Nuclear Engineers" (p. 18): every quantity is placed on one absolute
 * energy scale whose zero is the rest mass of the exit channel  Y + b.
 *
 * All energies are in keV internally.  Masses are ATOMIC masses taken from the
 * mass excesses distributed with ENSDF (AME2020); the electron masses cancel in
 * the Q value of an (a,b) reaction, and the binding of the electrons is
 * neglected, as usual.
 */

export const U_KEV = 931494.10242;       // atomic mass unit            [keV/c^2]
export const HBAR_KEV_S = 6.582119569e-19; // reduced Planck constant   [keV s]
export const LN2 = Math.LN2;

/** Light particles that get a dedicated button in the UI. */
export const PARTICLES = {
  g: { key: "g", label: "γ", name: "photon", z: 0, a: 0, massless: true },
  n: { key: "n", label: "n", name: "neutron", z: 0, a: 1 },
  p: { key: "p", label: "p", name: "proton", z: 1, a: 1 },
  d: { key: "d", label: "d", name: "deuteron", z: 1, a: 2 },
  t: { key: "t", label: "t", name: "triton", z: 1, a: 3 },
  h: { key: "h", label: "³He", name: "helion", z: 2, a: 3 },
  A: { key: "A", label: "α", name: "alpha", z: 2, a: 4 },
};

/* ------------------------------------------------------------------ masses */

/** Rest mass energy of a nuclide record (atomic mass), in keV. */
export function massOf(nuclide) {
  if (!nuclide) return NaN;
  if (nuclide.massless) return 0;
  return nuclide.a * U_KEV + nuclide.me;
}

/* --------------------------------------------------------------- kinematics */

/**
 * Classical (non-relativistic) kinematics, i.e. exactly the relations printed
 * on the diagram:
 *
 *   Q1 = (1 + mb/mY) Eb - (1 - ma/mY) Ea - 2 sqrt(ma mb Ea Eb) cos(theta) / mY
 */
function solveClassical({ ma, mX, mb, mY, Ea, Q1, theta }) {
  const M = ma + mX;
  const Ecm = (ma / M) * Ea;          // kinetic energy of the centre of mass
  const Edisp = (mX / M) * Ea;        // energy available in the C.M. frame

  // (mY + mb) x^2 - 2 sqrt(ma mb Ea) cos(th) x - [(mY - ma) Ea + mY Q1] = 0 ,  x = sqrt(Eb)
  const A = mY + mb;
  const B = 2 * Math.sqrt(ma * mb * Ea) * Math.cos(theta);
  const C = (mY - ma) * Ea + mY * Q1;
  const disc = B * B + 4 * A * C;

  const branches = [];
  if (disc >= 0 && A > 0) {
    const root = Math.sqrt(disc);
    for (const x of [(B + root) / (2 * A), (B - root) / (2 * A)]) {
      if (x > 0) branches.push(x * x);
    }
  }
  return { Ecm, Edisp, branches };
}

/**
 * Exact relativistic kinematics.  Used for photons (m = 0) and whenever the
 * user asks for it; the classical relations above are the ones drawn on the
 * original diagram but they lose accuracy for Ea of the order of the rest mass.
 */
function solveRelativistic({ ma, mX, mb, MY, Ea, theta }) {
  const Etot_a = Ea + ma;
  const pa = Math.sqrt(Math.max(Ea * Ea + 2 * Ea * ma, 0));
  const Etot = Etot_a + mX;                 // total lab energy
  const s = Etot * Etot - pa * pa;          // invariant mass squared
  const W = Math.sqrt(Math.max(s, 0));      // invariant mass
  const Edisp = W - ma - mX;                // kinetic energy available in C.M.
  const Ecm = Ea - Edisp;

  //   2 E_tot E_b - 2 (pa cos th) p_b = s + mb^2 - MY^2  =  K
  // squared and written as a quadratic in p_b:
  //   4(E_tot^2 - u^2) p^2 - 4 u K p + (4 E_tot^2 mb^2 - K^2) = 0
  const K = s + mb * mb - MY * MY;
  const u = pa * Math.cos(theta);
  const den = Etot * Etot - u * u;
  const branches = [];
  if (den > 0) {
    const disc = u * u * K * K - den * (4 * Etot * Etot * mb * mb - K * K);
    if (disc >= 0) {
      const root = Math.sqrt(disc);
      for (const pb of [(u * K + root) / (2 * den), (u * K - root) / (2 * den)]) {
        if (pb <= 0) continue;                       // p_b must be positive ...
        const Eb = (K + 2 * u * pb) / (2 * Etot);    // ... and so must E_b
        if (Eb < mb) continue;
        branches.push(Eb - mb);
      }
    }
  }
  return { Ecm, Edisp, branches, pa, W, s };
}

/* ------------------------------------------------------------------ public */

/**
 * Full solution of X(a,b)Y* at one lab energy and one lab angle.
 *
 * @param {object} o
 * @param {object} o.X   target nuclide record     {z, a, me}
 * @param {object} o.a   projectile record
 * @param {object} o.b   ejectile record
 * @param {object} o.Y   residual nuclide record
 * @param {object} o.C   compound nucleus record
 * @param {number} o.Ea      lab kinetic energy of the projectile  [keV]
 * @param {number} o.theta   lab emission angle of b               [deg]
 * @param {number} o.W1      excitation energy left in Y           [keV]
 * @param {boolean} o.relativistic
 */
export function solve({ X, a, b, Y, C, Ea, theta, W1, relativistic }) {
  const mX = massOf(X), ma = massOf(a), mb = massOf(b), mY = massOf(Y);
  const mC = C ? massOf(C) : NaN;
  const th = (theta * Math.PI) / 180;
  const rel = relativistic || ma === 0 || mb === 0;

  // Q values from the mass excesses (the rest-mass terms cancel for a balanced
  // reaction, so this is identical to  m_X + m_a - m_Y - m_b ).
  const Q0 = (X.me || 0) + (a.me || 0) - (Y.me || 0) - (b.me || 0);
  const Q1 = Q0 - W1;

  // separation energies of a and b from the compound nucleus
  const Sa = C ? (X.me || 0) + (a.me || 0) - (C.me || 0) : NaN;
  const Sb = C ? (Y.me || 0) + (b.me || 0) - (C.me || 0) : NaN;

  const core = rel
    ? solveRelativistic({ ma, mX, mb, MY: mY + W1, Ea, theta: th })
    : solveClassical({ ma, mX, mb, mY, Ea, Q1, theta: th });

  const { Ecm, Edisp } = core;
  const Eexc = rel ? core.W - mC : Sa + Edisp;   // excitation of the compound nucleus

  // C.M. kinetic energies in the exit channel
  let EbCM, EYCM;
  if (rel) {
    const W = core.W, MY = mY + W1;
    const num = (W * W - (mb + MY) * (mb + MY)) * (W * W - (mb - MY) * (mb - MY));
    if (num >= 0 && W > 0) {
      const pstar = Math.sqrt(num) / (2 * W);
      EbCM = Math.sqrt(pstar * pstar + mb * mb) - mb;
      EYCM = Math.sqrt(pstar * pstar + MY * MY) - MY;
    } else {
      EbCM = EYCM = NaN;
    }
  } else {
    const avail = Edisp + Q1;
    EbCM = (mY / (mb + mY)) * avail;
    EYCM = (mb / (mb + mY)) * avail;
  }

  // lab branches (two solutions are possible when the ejectile is heavier than
  // the recoil and the reaction is endoergic)
  const branches = core.branches
    .map((Eb) => {
      const EY = Ea + Q1 - Eb;
      const pa = rel ? core.pa : Math.sqrt(2 * ma * Ea);
      const pb = rel
        ? Math.sqrt(Math.max((Eb + mb) * (Eb + mb) - mb * mb, 0))
        : Math.sqrt(2 * mb * Eb);
      const py_z = pa - pb * Math.cos(th);
      const py_x = pb * Math.sin(th);
      const phi = (Math.atan2(py_x, py_z) * 180) / Math.PI;   // lab recoil angle of Y

      // emission angle of b in the centre-of-mass frame
      let pz;
      if (rel) {
        const Etot = Ea + ma + mX;
        const beta = pa / Etot;
        const gamma = Etot / core.W;
        pz = gamma * (pb * Math.cos(th) - beta * (Eb + mb));
      } else {
        const vcm = pa / (ma + mX);
        pz = pb * Math.cos(th) - mb * vcm;
      }
      const thetaCM = (Math.atan2(py_x, pz) * 180) / Math.PI;
      return { Eb, EY, phi, pb, thetaCM };
    })
    .filter((s) => s.EY >= -1e-6)
    .sort((u, v) => v.Eb - u.Eb);

  // reaction threshold in the lab frame for this exit channel
  let Eth = 0;
  if (Q1 < 0) {
    if (rel) {
      const MY = mY + W1;
      Eth = (((mb + MY) * (mb + MY) - (ma + mX) * (ma + mX)) / (2 * mX)) - 0;
      Eth = Math.max(Eth, 0);
    } else {
      Eth = (-Q1 * (ma + mX)) / mX;
    }
  }

  // largest lab angle at which b can be emitted (when a maximum exists)
  let thetaMax = null;
  const probe = (deg) => {
    const r = rel
      ? solveRelativistic({ ma, mX, mb, MY: mY + W1, Ea, theta: (deg * Math.PI) / 180 })
      : solveClassical({ ma, mX, mb, mY, Ea, Q1, theta: (deg * Math.PI) / 180 });
    return r.branches.length > 0;
  };
  if (probe(0) && !probe(180)) {
    let lo = 0, hi = 180;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (probe(mid)) lo = mid; else hi = mid;
    }
    thetaMax = lo;
  }

  return {
    masses: { mX, ma, mb, mY, mC },
    Q0, Q1, W1, Sa, Sb, Ecm, Edisp, Eexc, EbCM, EYCM,
    branches, Eth, thetaMax, relativistic: rel,
    /* absolute level positions, zero at the (Y + b) rest mass */
    levels: {
      Yb: 0,                 // Y + b  ground state
      Ystar: W1,             // Y* + b
      Xa: Q0,                // X + a  rest masses
      C: -Sb,                // compound nucleus ground state
      entranceTop: Q0 + Ea,  // X + a + Ea   (total energy of the system)
      cmLine: Q0 + Edisp,    // energy available in the C.M. frame
    },
  };
}

/** Level width from a half-life:  Gamma = hbar ln2 / T_1/2   [keV]. */
export function widthFromHalfLife(halfLifeSeconds) {
  if (!halfLifeSeconds || !isFinite(halfLifeSeconds) || halfLifeSeconds <= 0) return null;
  return (HBAR_KEV_S * LN2) / halfLifeSeconds;
}
