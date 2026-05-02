#!/usr/bin/env python3
"""Split House of Wellness branded floor plans PDF into one file per page.

Usage:
  python3 scripts/split_how_floorplans.py "/path/to/Hou seOfWellness_FloorPlans_Branded.pdf"

Output: docs/house-of-wellness-floor-plans/how-floorplan-page-NN-of-MM.pdf
Requires: pip install pypdf
"""
from __future__ import annotations

import sys
from pathlib import Path

try:
    from pypdf import PdfReader, PdfWriter
except ImportError:
    sys.exit("Install pypdf: pip install pypdf")

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs" / "house-of-wellness-floor-plans"


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__ or "missing pdf path")
    src = Path(sys.argv[1]).expanduser().resolve()
    if not src.is_file():
        sys.exit(f"Not a file: {src}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    reader = PdfReader(str(src))
    n = len(reader.pages)
    for i in range(n):
        w = PdfWriter()
        w.add_page(reader.pages[i])
        out = OUT_DIR / f"how-floorplan-page-{i + 1:02d}-of-{n:02d}.pdf"
        with open(out, "wb") as f:
            w.write(f)

    note = OUT_DIR / "SOURCE.txt"
    note.write_text(
        f"Split from: {src}\n"
        f"Pages: {n}\n"
        f"Naming: how-floorplan-page-XX-of-{n:02d}.pdf\n"
        "Each page is a layout/line variant (not one PDF per unit number).\n"
        "Regenerate: python3 scripts/split_how_floorplans.py \"<path-to-source.pdf>\"\n",
        encoding="utf-8",
    )
    print(f"Wrote {n} files under {OUT_DIR}")


if __name__ == "__main__":
    main()
