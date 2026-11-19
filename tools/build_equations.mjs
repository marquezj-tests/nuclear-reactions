/*
 * Typeset tools/equations.mjs with MathJax and bake the result into the page.
 *
 *   npm install            # mathjax-full
 *   node tools/build_equations.mjs
 *
 * Each relation becomes a standalone file in assets/equations/, and the same
 * markup is injected into index.html between
 *   <!-- equations:start --> ... <!-- equations:end -->
 * so the page needs no maths library at run time.  MathJax paints the glyph
 * paths with currentColor, so the equations follow the page's theme.
 */
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";

import { EQUATIONS } from "./equations.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "assets", "equations");

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const doc = mathjax.document("", {
  InputJax: new TeX({ packages: AllPackages }),
  OutputJax: new SVG({ fontCache: "local" }),   // each file carries its own glyphs
});

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function typeset(eq) {
  const node = doc.convert(eq.tex, { display: true, em: 16, ex: 8, containerWidth: 1200 });
  let svg = adaptor.innerHTML(node);
  // the ids MathJax generates are only unique within one conversion
  svg = svg.replace(/\b(id|href|xlink:href)="#?(MJX-[^"]*)"/g,
    (m, attr, id) => `${attr}="${attr === "id" ? "" : "#"}${id.replace(/^MJX-/, `MJX-${eq.id}-`)}"`);
  // display maths comes back wrapped in a vertical-align style meant for text flow
  svg = svg.replace(/\sstyle="[^"]*"/, "");
  svg = svg.replace("<svg ", `<svg class="eq-svg" aria-label="${escape(eq.alt)}" `);
  return svg;
}

mkdirSync(OUT, { recursive: true });
const figures = [];
for (const eq of EQUATIONS) {
  const svg = typeset(eq);
  writeFileSync(join(OUT, `${eq.id}.svg`), `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`);
  const cls = ["eq", eq.display ? `eq-${eq.display}` : ""].filter(Boolean).join(" ");
  figures.push(
    `      <figure class="${cls}" id="eq-${eq.id}">\n` +
    `        <div class="eq-body">${svg}</div>\n` +
    `        <figcaption>${eq.caption}</figcaption>\n` +
    `      </figure>`
  );
}

const page = join(ROOT, "index.html");
const html = readFileSync(page, "utf8");
const start = "<!-- equations:start -->";
const end = "<!-- equations:end -->";
if (!html.includes(start) || !html.includes(end)) {
  throw new Error(`index.html has no ${start} / ${end} markers`);
}
const before = html.slice(0, html.indexOf(start) + start.length);
const after = html.slice(html.indexOf(end));
writeFileSync(page, `${before}\n${figures.join("\n")}\n      ${after}`);

const bytes = figures.join("").length;
console.log(`${EQUATIONS.length} equations -> assets/equations/, ${(bytes / 1024).toFixed(1)} kB inlined into index.html`);
