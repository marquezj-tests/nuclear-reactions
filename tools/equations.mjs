/*
 * The relations printed under the diagram, as LaTeX.
 *
 * tools/build_equations.mjs typesets them with MathJax and writes the result to
 * assets/equations/<id>.svg, then injects the same markup into index.html
 * between the equation markers.  `alt` is what a screen reader gets.
 */
export const EQUATIONS = [
  {
    id: "ecm",
    tex: String.raw`E_{\mathrm{CM}} \;=\; \frac{m_a}{m_a + m_X}\, E_a`,
    alt: "E sub CM equals m sub a over the sum of m sub a and m sub X, times E sub a",
    caption: "kinetic energy carried by the motion of the centre of mass",
  },
  {
    id: "edisp",
    tex: String.raw`E_{\mathrm{disp}} \;=\; \frac{m_X}{m_a + m_X}\, E_a \;=\; E_a - E_{\mathrm{CM}}`,
    alt: "E sub disp equals m sub X over the sum of m sub a and m sub X, times E sub a, which is E sub a minus E sub CM",
    caption: "energy available in the centre-of-mass frame",
  },
  {
    id: "excitation",
    tex: String.raw`E^{*}(C) \;=\; S_a + E_{\mathrm{disp}}`,
    alt: "E star of C equals S sub a plus E sub disp",
    caption: "excitation of the compound nucleus",
  },
  {
    id: "qvalue",
    tex: String.raw`Q_0 \;=\; \Delta(m_X) + \Delta(m_a) - \Delta(m_Y) - \Delta(m_b) \;=\; Q_1 + W_1`,
    alt: "Q sub zero equals delta of m sub X plus delta of m sub a minus delta of m sub Y minus delta of m sub b, equals Q sub one plus W sub one",
    caption: "from the atomic mass excesses; the electrons cancel",
  },
  {
    id: "master",
    display: "master",
    tex: String.raw`Q_1 \;=\; \left(1 + \frac{m_b}{m_Y}\right) E_b
      \;-\; \left(1 - \frac{m_a}{m_Y}\right) E_a
      \;-\; \frac{2\sqrt{m_a m_b}}{m_Y}\, \sqrt{E_a}\,\sqrt{E_b}\, \cos\theta`,
    alt: "Q sub one equals one plus m sub b over m sub Y, times E sub b, minus one minus m sub a over m sub Y, times E sub a, minus two times the square root of m sub a m sub b over m sub Y, times the square root of E sub a, times the square root of E sub b, times cosine theta",
    caption: "the relation on the plate, solved here as a quadratic in &radic;<em>E</em><sub>b</sub>",
  },
  {
    id: "root",
    display: "wide",
    tex: String.raw`\sqrt{E_b} \;=\; \frac{\sqrt{m_a m_b E_a}\,\cos\theta \;\pm\;
      \sqrt{m_a m_b E_a \cos^{2}\theta + (m_Y + m_b)\left[(m_Y - m_a)E_a + m_Y Q_1\right]}}{m_Y + m_b}`,
    alt: "square root of E sub b equals, over m sub Y plus m sub b, the square root of m sub a m sub b E sub a times cosine theta, plus or minus the square root of m sub a m sub b E sub a cosine squared theta plus m sub Y plus m sub b times the quantity m sub Y minus m sub a times E sub a plus m sub Y Q sub one",
    caption: "that solution; both roots are real inside the forward cone of a heavy ejectile",
  },
  {
    id: "threshold",
    tex: String.raw`E_{\mathrm{th}} \;=\; -\,Q_1\, \frac{m_a + m_X}{m_X} \qquad (Q_1 < 0)`,
    alt: "E sub th equals minus Q sub one times the sum of m sub a and m sub X over m sub X, for negative Q sub one",
    caption: "laboratory threshold of an endoergic channel",
  },
];
