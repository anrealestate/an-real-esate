#!/usr/bin/env python3
"""Assign House of Wellness unit floorPlans from the branded booklet PDF.

Rule (validated against 58 inventory units): the inventory \"Line\" column is the
same index as booklet \"LINE XX\" on each sheet. Match + bedroom type + floor ∈ LEVELS.

Ambiguities / booklet gaps are resolved with explicit overrides (see OVERRIDES).

Usage:
  python3 scripts/how_assign_floorplans.py              # dry-run summary
  python3 scripts/how_assign_floorplans.py --write    # patch data/listings.json

Requires: pip install pypdf
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError:
    sys.exit("Install pypdf: pip install pypdf")

ROOT = Path(__file__).resolve().parents[1]
LISTINGS_PATH = ROOT / "data" / "listings.json"
TOTAL_PAGES = 64
DOC_PREFIX = "/docs/house-of-wellness-floor-plans"

DEFAULT_BOOKLET_PDF = (
    Path.home()
    / "Downloads"
    / "House of wellness Miami"
    / "Floor plans"
    / "Hou seOfWellness_FloorPlans_Branded.pdf"
)

# Booklet LEVELS list for LINE 19 studio omits 18 and 32; use main sheet as fallback.
_FALLBACK_LINE19_STUDIO_PAGE = 41

# LINE 09 B1: floor 10 appears on two sheets (pages 21 & 23); exterior SF differs by floor
# in inventory — page chosen for lower terrace (46 sq ft on unit 1009).
_TIE_LINE09_FLOOR10_PAGE = 21

OVERRIDES_PAGE_BY_REF: dict[str, int] = {
    "AN202605-1819": _FALLBACK_LINE19_STUDIO_PAGE,
    "AN202605-3219": _FALLBACK_LINE19_STUDIO_PAGE,
    "AN202605-1009": _TIE_LINE09_FLOOR10_PAGE,
}


def parse_levels(text: str) -> list[int]:
    t = re.sub(r"L\s*E\s*V\s*E\s*L\s*S?", "LEVELS", text, flags=re.I)
    m = re.search(r"LEVELS\s*([\d\s,\-]+)", t, re.I)
    if not m:
        m2 = re.search(r"LEVEL\s*(\d+)", t, re.I)
        return [int(m2.group(1))] if m2 else []
    chunk = re.split(r"[^\d,\s\-]", m.group(1))[0]
    levels: set[int] = set()
    for part in re.split(r"[,|]", chunk):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            try:
                da, db = int(a.strip()), int(b.strip())
                levels.update(range(min(da, db), max(da, db) + 1))
            except ValueError:
                pass
        else:
            try:
                levels.add(int(part))
            except ValueError:
                pass
    return sorted(levels)


def line_plan(raw: str) -> tuple[str, int | str, str] | None:
    """Return ('line', line_num, plan) or ('unit', unit_num, plan)."""
    m = re.search(r"LINE\s+(\d+)\s+([A-Z]\d?)", raw, re.I)
    if m:
        return ("line", int(m.group(1)), m.group(2).upper())
    m2 = re.search(r"UNIT\s+(\d+)\s+([A-Z]\d?)", raw, re.I)
    if m2:
        return ("unit", int(m2.group(1)), m2.group(2).upper())
    return None


def beds_hint(raw: str) -> int | None:
    if re.search(r"STUDIO", raw, re.I):
        return 0
    m = re.search(r"(\d+)\s*BEDROOM", raw, re.I)
    return int(m.group(1)) if m else None


def index_booklet(pdf_path: Path) -> list[dict]:
    r = PdfReader(str(pdf_path))
    rows: list[dict] = []
    for i, page in enumerate(r.pages):
        raw = page.extract_text() or ""
        lp = line_plan(raw)
        lv = parse_levels(raw)
        bd = beds_hint(raw)
        row: dict = {"page": i + 1, "levels": lv, "beds": bd}
        if lp:
            row["kind"], row["line_or_unit"], row["plan"] = lp
        else:
            row["kind"] = "unknown"
        rows.append(row)
    return rows


def parse_stack(desc0: str) -> tuple[int, str] | None:
    m = re.search(r"sq ft\s*·\s*(\d+)\s*([NSEW]{1,2})\s*\.", desc0 or "")
    if not m:
        return None
    return int(m.group(1)), m.group(2).upper()


def candidates_for_unit(
    index: list[dict], *, stack: int, floor: int, beds: int
) -> list[dict]:
    out: list[dict] = []
    for p in index:
        if p.get("kind") != "line":
            continue
        if p["line_or_unit"] != stack:
            continue
        pb = p.get("beds")
        if pb is not None and pb != beds:
            continue
        lv = p.get("levels") or []
        if not lv:
            continue
        if floor not in lv:
            continue
        out.append(p)
    return out


def pdf_src(page: int) -> str:
    return f"{DOC_PREFIX}/how-floorplan-page-{page:02d}-of-{TOTAL_PAGES}.pdf"


def assign_pages(index: list[dict], how: list[dict]) -> tuple[dict[str, int], list[tuple]]:
    """Returns ref -> page, and list of (ref, note) warnings."""
    ref_page: dict[str, int] = {}
    warnings: list[tuple] = []

    for u in how:
        ref = u["ref"]
        if ref in OVERRIDES_PAGE_BY_REF:
            ref_page[ref] = OVERRIDES_PAGE_BY_REF[ref]
            continue

        floor = u["floor"]
        beds = u["beds"]
        desc0 = (u.get("description") or [""])[0]
        st = parse_stack(desc0)
        if not st:
            warnings.append((ref, "no stack in description"))
            continue
        stack, _ori = st

        cand = candidates_for_unit(index, stack=stack, floor=floor, beds=beds)
        if len(cand) == 1:
            ref_page[ref] = cand[0]["page"]
        elif len(cand) == 0:
            # Fallback: same LINE + beds, any page with non-empty levels (booklet gap)
            loose = [
                p
                for p in index
                if p.get("kind") == "line"
                and p["line_or_unit"] == stack
                and (p.get("beds") is None or p["beds"] == beds)
                and (p.get("levels") or [])
            ]
            if loose:
                ref_page[ref] = min(loose, key=lambda x: x["page"])["page"]
                warnings.append((ref, f"floor {floor} not in LEVELS; used LINE fallback page {ref_page[ref]}"))
            else:
                warnings.append((ref, "no candidates"))
        else:
            chosen = min(cand, key=lambda x: x["page"])
            ref_page[ref] = chosen["page"]
            warnings.append(
                (
                    ref,
                    f"tie {len(cand)} pages {[c['page'] for c in cand]} → picked {chosen['page']}",
                )
            )

    return ref_page, warnings


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="Write data/listings.json")
    ap.add_argument(
        "--pdf",
        type=Path,
        default=DEFAULT_BOOKLET_PDF,
        help="Path to Hou seOfWellness_FloorPlans_Branded.pdf",
    )
    args = ap.parse_args()

    if not args.pdf.is_file():
        sys.exit(f"Booklet PDF not found: {args.pdf}")

    index = index_booklet(args.pdf)
    data = json.loads(LISTINGS_PATH.read_text(encoding="utf-8"))
    how = [x for x in data["listings"] if x.get("parent_slug") == "house-of-wellness"]

    ref_page, warnings = assign_pages(index, how)

    missing = [u["ref"] for u in how if u["ref"] not in ref_page]
    print(f"Units: {len(how)}  assigned: {len(ref_page)}  missing: {len(missing)}")
    if missing:
        print("Missing refs:", missing)
    for w in warnings:
        print("WARN:", w[0], "-", w[1])

    if not args.write:
        print("\nDry-run only. Pass --write to patch listings.")

    # Apply floorPlans on HOW children
    updated = 0
    for u in data["listings"]:
        if u.get("parent_slug") != "house-of-wellness":
            continue
        ref = u["ref"]
        pg = ref_page.get(ref)
        if not pg:
            continue
        # Find line + plan label from index
        meta = next((x for x in index if x.get("page") == pg), {})
        plan = meta.get("plan", "")
        line_id = meta.get("line_or_unit", "")
        label = f"Floor plan · LINE {int(line_id):02d} {plan}" if isinstance(line_id, int) and plan else f"Floor plan (sheet {pg})"
        u["floorPlans"] = [{"src": pdf_src(pg), "label": label}]
        updated += 1

    print(f"\nfloorPlans entries set: {updated}")

    if args.write:
        LISTINGS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Wrote {LISTINGS_PATH}")
        print("Next: python3 scripts/upload_how_floorplans_cloudinary.py  # Cloudinary URLs")
        print("      python3 scripts/sync_listings_bundles.py")


if __name__ == "__main__":
    main()
