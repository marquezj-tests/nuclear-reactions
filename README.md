# Nuclear Reaction Energetics

**Live site: <https://marquezj-tests.github.io/nuclear-reactions/>**

An interactive remake of the reaction-kinematics plate on p. 18 of the *Pocketbook of
Data for Nuclear Engineers*: the energy-level diagram of

```
X(a,b)Y*
```

drawn to scale for a target, a projectile, an ejectile and an incident energy that you
choose. Every number on the figure comes from the ENSDF/AME data shipped in `data/`,
and the whole plate — level positions, brackets, emission angles, the sharing of the
kinetic energy between ejectile and recoil — is recomputed on every change.

## Run it locally

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. Any static server will do; the page needs one
because it fetches its data files (opening `index.html` from the file system will not
work).

## The published site

The repository root *is* the site, so nothing has to be built or copied first:
`.github/workflows/pages.yml` runs the kinematics tests and then deploys the root of
the branch to GitHub Pages on every push to it, and on demand from the Actions tab.

Pages has to be switched on once by a repository admin, under
**Settings -> Pages -> Build and deployment -> Source: "GitHub Actions"**. A workflow
token is not allowed to create the Pages site, so until that is done the workflow stops
at `Create Pages site failed: Resource not accessible by integration`. Re-run it after
switching Pages on and the site goes up at
<https://marquezj-tests.github.io/nuclear-reactions/>.

Serving straight from the branch (**Source: "Deploy from a branch"**, branch
`claude/sweet-knuth-wjcwjj`, folder `/ (root)`) works just as well and needs no
workflow at all; `.nojekyll` is there so the files are published as they are.

## What it draws

The three panels of the original plate sit on one absolute energy scale whose zero is
the rest mass of the exit channel `Y + b`:

| Panel | Contents |
| --- | --- |
| **Before** | `X + a` at `Q₀`, the split of `E_a` into `E_CM` (motion of the centre of mass) and `E_disp` (energy available in the C.M. frame) |
| **During** | the compound nucleus `C` at `−S_b`, its excitation `E*(C) = S_a + E_disp`, the separation energies `S_a` and `S_b`, the width `Γ` of the state the beam selects, and the ENSDF level ladder of `C` |
| **After** | `Y + b` at zero, `Y* + b` at the chosen level `W₁`, the brackets `Q₀`, `Q₁ = Q₀ − W₁`, and the sharing of the available energy into `E_b` / `E_Y` in the laboratory and `E_b^CM` / `E_Y^CM` in the centre of mass |

The cartoons along the top show the real kinematics: the ejectile at the chosen
laboratory angle `θ`, the recoil at the angle `φ` that momentum conservation requires,
and both of them back to back in the C.M. frame at `θ_CM`.

## Physics

Mass excesses `Δ` are atomic, so the electron masses cancel in

```
Q₀ = Δ(X) + Δ(a) − Δ(Y) − Δ(b) = S_a − S_b
```

and the electron binding energy is neglected, as usual. With `W₁` the excitation left
in the residual nucleus, `Q₁ = Q₀ − W₁`, and the ejectile energy follows from the
relation printed on the plate,

```
Q₁ = (1 + m_b/m_Y) E_b − (1 − m_a/m_Y) E_a − (2√(m_a m_b)/m_Y) √(E_a E_b) cos θ
```

solved as a quadratic in `√E_b`. Both roots are reported when the ejectile is confined
to a forward cone (heavy ejectile, inverse kinematics), and the app also gives the
largest angle `θ_max` of that cone. Below threshold it reports the threshold instead,
`E_th = −Q₁ (m_a + m_X)/m_X`.

The **relativistic kinematics** switch replaces that relation with the exact
invariant-mass solution, which is also used automatically whenever a photon takes part
(radiative capture `(a,γ)` or a photonuclear reaction `(γ,b)`), where the classical
relation is undefined.

## Data

`data/` is built from the [IAEA Live Chart of Nuclides
API](https://www-nds.iaea.org/relnsd/vcharthtml/api_v0_guide.html), which serves the
ENSDF adopted levels together with the AME2020 mass evaluation distributed with them.

* `data/nuclides.json` — 3357 ground states: mass excess, Jπ, half-life, abundance,
  `S_n`, `S_p`, `Q_α`, and the ENSDF evaluation date.
* `data/levels/z<Z>.json` — adopted levels (energy, Jπ, half-life) of the nuclides of
  element `Z`, up to 400 levels or 30 MeV per nuclide. Loaded lazily, one element at a
  time.

To rebuild them, fetch the raw tables and run the builder:

```bash
curl "https://www-nds.iaea.org/relnsd/v1/data?fields=ground_states&nuclides=all" -o gs_all.csv
mkdir raw_levels
# one request per nuclide, e.g. for 56Fe:
curl "https://www-nds.iaea.org/relnsd/v1/data?fields=levels&nuclides=56fe" -o raw_levels/56fe.csv
python3 tools/build_data.py --raw-gs gs_all.csv --raw-levels raw_levels --out data
```

## Layout

```
index.html          the page
css/style.css       tokens, layout, and the styling of the SVG itself
js/nuclear.js       masses, Q values, classical and relativistic kinematics
js/data.js          loading and lookup of the ENSDF data
js/diagram.js       the SVG plate
js/app.js           controls and read-outs
tools/build_data.py builds data/ from the IAEA tables
tools/build_artifact.py  folds everything into one self-contained page
tests/kinematics.test.mjs
```

## Tests

```bash
node tests/kinematics.test.mjs
```

Checks the Q values, separation energies and thresholds of a set of standard reactions
against their published values, the internal energy bookkeeping (`E_CM + E_disp = E_a`,
`E_b + E_Y = E_a + Q₁`, `E*(C) = S_a + E_disp`), momentum conservation at the solved
angles, the agreement of the classical and relativistic engines at low energy, the
recoil shift of a capture γ ray, and the two-branch solution of inverse kinematics.
