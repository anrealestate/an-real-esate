#!/usr/bin/env python3
"""Upload HOW split floor-plan PDFs to Cloudinary (raw) and patch listings.

Uses the same unsigned preset as admin (folder an-realestate/how-floorplans).

Usage:
  python3 scripts/upload_how_floorplans_cloudinary.py           # upload + patch + write manifest
  python3 scripts/upload_how_floorplans_cloudinary.py --patch-only  # use existing manifest JSON

Writes:
  data/how-floorplan-cloudinary-urls.json — page number → secure_url
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS_FP = ROOT / "docs" / "house-of-wellness-floor-plans"
LISTINGS_PATH = ROOT / "data" / "listings.json"
MANIFEST_PATH = ROOT / "data" / "how-floorplan-cloudinary-urls.json"

CLOUD = "dbume3eak"
PRESET = "f3eiclx5"
UPLOAD_URL = f"https://api.cloudinary.com/v1_1/{CLOUD}/raw/upload"
TOTAL = 64


def pdf_paths() -> list[Path]:
    files = sorted(DOCS_FP.glob("how-floorplan-page-*-of-64.pdf"))
    if len(files) != TOTAL:
        sys.exit(f"Expected {TOTAL} PDFs under {DOCS_FP}, found {len(files)}")
    return files


def page_from_name(p: Path) -> int:
    m = re.search(r"page-(\d+)-of-64", p.name)
    return int(m.group(1)) if m else -1


def curl_upload(pdf: Path, page: int) -> str:
    public_id = f"how-floorplan-page-{page:02d}-of-{TOTAL}"
    cmd = [
        "curl",
        "-sS",
        "-X",
        "POST",
        UPLOAD_URL,
        "-F",
        f"upload_preset={PRESET}",
        "-F",
        "folder=an-realestate/how-floorplans",
        "-F",
        f"public_id={public_id}",
        "-F",
        f"file=@{pdf}",
    ]
    out = subprocess.check_output(cmd, text=True)
    data = json.loads(out)
    if "secure_url" not in data:
        sys.exit(f"Upload failed page {page}: {out[:500]}")
    return data["secure_url"]


def load_manifest() -> dict[str, str]:
    if not MANIFEST_PATH.is_file():
        return {}
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def save_manifest(url_by_page: dict[int, str]) -> None:
    serializable = {str(k): v for k, v in sorted(url_by_page.items())}
    MANIFEST_PATH.write_text(json.dumps(serializable, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {MANIFEST_PATH}")


def patch_listings(url_by_page: dict[int, str]) -> int:
    data = json.loads(LISTINGS_PATH.read_text(encoding="utf-8"))
    n = 0
    for u in data["listings"]:
        if u.get("parent_slug") != "house-of-wellness":
            continue
        fps = u.get("floorPlans")
        if not fps:
            continue
        for fp in fps:
            src = fp.get("src") or ""
            m = re.search(r"how-floorplan-page-(\d+)-of-64\.pdf", src)
            if not m:
                continue
            pg = int(m.group(1))
            url = url_by_page.get(pg)
            if not url:
                sys.exit(f"Missing Cloudinary URL for page {pg} ({u.get('ref')})")
            fp["src"] = url
            n += 1
    LISTINGS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Patched floorPlans on {n} entries → {LISTINGS_PATH}")
    return n


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--patch-only", action="store_true", help="Skip upload; use manifest on disk")
    args = ap.parse_args()

    url_by_page: dict[int, str] = {}

    if args.patch_only:
        raw = load_manifest()
        url_by_page = {int(k): v for k, v in raw.items()}
        if len(url_by_page) < TOTAL:
            sys.exit(f"Manifest incomplete ({len(url_by_page)}/{TOTAL}). Run without --patch-only first.")
    else:
        url_by_page = {int(k): v for k, v in load_manifest().items()}
        for pdf in pdf_paths():
            pg = page_from_name(pdf)
            if pg < 1:
                sys.exit(f"Bad filename: {pdf.name}")
            if pg in url_by_page:
                print(f"skip page {pg:02d} (manifest)")
                continue
            print(f"upload page {pg:02d} …")
            url_by_page[pg] = curl_upload(pdf, pg)
            save_manifest(url_by_page)

    patch_listings(url_by_page)
    print("Next: python3 scripts/sync_listings_bundles.py")


if __name__ == "__main__":
    main()
