#!/usr/bin/env python3
"""Build the web app's data files from the IAEA Live Chart API (ENSDF + AME2020).

Source:  https://www-nds.iaea.org/relnsd/v1/data
  fields=ground_states&nuclides=all   -> ground-state properties (mass excess ...)
  fields=levels&nuclides=<A><sym>     -> ENSDF adopted levels of one nuclide

Usage:
  python3 build_data.py --raw-gs gs_all.csv --raw-levels raw_levels/ --out ../data
"""
import argparse
import csv
import json
import os

MAX_LEVELS = 400          # levels kept per nuclide
MAX_LEVEL_ENERGY = 30000  # keV


def num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def clean(value):
    value = (value or "").strip()
    return value or None


def build_nuclides(path):
    """Ground-state table -> {"<Z>-<A>": {...}} plus element symbol map."""
    out = {}
    symbols = {}
    with open(path, newline="", encoding="utf-8", errors="replace") as fh:
        for row in csv.DictReader(fh):
            z, n = num(row.get("z")), num(row.get("n"))
            me = num(row.get("massexcess"))
            sym = clean(row.get("symbol"))
            if z is None or n is None or me is None or not sym:
                continue
            z, n = int(z), int(n)
            a = z + n
            symbols[z] = sym
            half_life = clean(row.get("half_life"))
            unit = clean(row.get("unit_hl"))
            entry = {
                "z": z,
                "a": a,
                "sym": sym,
                "me": round(me, 4),                       # mass excess, keV
                "dme": num(row.get("unc_me")),            # its uncertainty, keV
                "sys": clean(row.get("me_systematics")) == "Y",
                "jp": clean(row.get("jp")),
                "hl": half_life if not unit else f"{half_life} {unit}",
                "hls": num(row.get("half_life_sec")),
                "abu": num(row.get("abundance")),
                "sn": num(row.get("sn")),
                "sp": num(row.get("sp")),
                "qa": num(row.get("qa")),
                "ba": num(row.get("binding")),            # binding energy per nucleon, keV
                "ref": clean(row.get("ENSDFpublicationcut-off")),
            }
            out[f"{z}-{a}"] = {k: v for k, v in entry.items() if v is not None}
    return out, symbols


def build_levels(directory):
    """ENSDF adopted levels -> {Z: {A: [[E_keV, Jpi, T_half_s], ...]}}."""
    by_z = {}
    for name in sorted(os.listdir(directory)):
        if not name.endswith(".csv"):
            continue
        path = os.path.join(directory, name)
        if os.path.getsize(path) < 50:
            continue
        with open(path, newline="", encoding="utf-8", errors="replace") as fh:
            rows = list(csv.DictReader(fh))
        levels, z, a = [], None, None
        for row in rows:
            zz, nn = num(row.get("z")), num(row.get("n"))
            energy = num(row.get("energy"))
            if zz is None or nn is None or energy is None:
                continue
            if clean(row.get("energy_shift")):   # e.g. "X+123" -> unknown offset
                continue
            if energy > MAX_LEVEL_ENERGY:
                continue
            z, a = int(zz), int(zz) + int(nn)
            levels.append([
                round(energy, 3),
                clean(row.get("jp")),
                num(row.get("half_life_sec")),
            ])
            if len(levels) >= MAX_LEVELS:
                break
        if z is None or not levels:
            continue
        by_z.setdefault(z, {})[a] = levels
    return by_z


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw-gs", required=True)
    ap.add_argument("--raw-levels", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    nuclides, symbols = build_nuclides(args.raw_gs)
    levels = build_levels(args.raw_levels)

    os.makedirs(os.path.join(args.out, "levels"), exist_ok=True)
    with open(os.path.join(args.out, "nuclides.json"), "w", encoding="utf-8") as fh:
        json.dump({
            "source": "IAEA Live Chart of Nuclides API (ENSDF + AME2020)",
            "url": "https://www-nds.iaea.org/relnsd/v1/data?fields=ground_states&nuclides=all",
            "symbols": symbols,
            "nuclides": nuclides,
        }, fh, separators=(",", ":"))

    index = {}
    for z, table in sorted(levels.items()):
        with open(os.path.join(args.out, "levels", f"z{z}.json"), "w", encoding="utf-8") as fh:
            json.dump(table, fh, separators=(",", ":"))
        index[z] = sorted(table.keys())
    with open(os.path.join(args.out, "levels", "index.json"), "w", encoding="utf-8") as fh:
        json.dump(index, fh, separators=(",", ":"))

    print(f"nuclides: {len(nuclides)}")
    print(f"elements with levels: {len(levels)}")
    print(f"levels: {sum(len(v) for t in levels.values() for v in t.values())}")


if __name__ == "__main__":
    main()
