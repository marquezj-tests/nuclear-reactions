#!/usr/bin/env python3
"""Fold index.html, the stylesheet and the ES modules into one page.

Claude Artifacts wrap the published file in their own document skeleton and the
content security policy allows no stylesheet or script from outside the CDN
allow-list, so the page that goes there carries its CSS and JS inline and keeps
only the Google Fonts link.  The data files travel next to it unchanged.

  python3 build_artifact.py --root .. --out ../dist/artifact.html
"""
import argparse
import os
import re

MODULES = ["js/nuclear.js", "js/data.js", "js/diagram.js", "js/app.js"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    read = lambda rel: open(os.path.join(args.root, rel), encoding="utf-8").read()

    html = read("index.html")
    title = re.search(r"<title>(.*?)</title>", html, re.S).group(1)
    fonts = re.search(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^>]*>', html).group(0)
    body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
    body = re.sub(r'<script type="module".*?</script>', "", body, flags=re.S).strip()

    # concatenate the modules: one module scope, so the imports between them go
    bundle = []
    for rel in MODULES:
        src = read(rel)
        src = re.sub(r'^import\s*\{[^}]*\}\s*from\s*"\./[^"]+";\s*$', "", src, flags=re.M)
        src = re.sub(r"^export\s+(?=(async\s+)?(function|const|let|class))", "", src, flags=re.M)
        bundle.append(f"/* ===== {rel} ===== */\n{src.strip()}")

    page = f"""<title>{title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
{fonts}
<style>
{read("css/style.css").strip()}
</style>

{body}

<script type="module">
{os.linesep.join(bundle)}
</script>
"""
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write(page)
    print(f"{args.out}: {len(page) / 1024:.1f} kB")


if __name__ == "__main__":
    main()
