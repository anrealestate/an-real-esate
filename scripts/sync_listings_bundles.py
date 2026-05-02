#!/usr/bin/env python3
"""Sync canonical data/listings.json into site bundles (matches publish flow).

Updates:
  - data-listings.js (runtime fallback when fetch fails)
  - index.html — <script id="listings-data">
  - admin/index.html — same inline payload for local admin preview

Usage:
  python3 scripts/sync_listings_bundles.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LISTINGS = ROOT / "data" / "listings.json"
DATA_LISTINGS_JS = ROOT / "data-listings.js"
INDEX_HTML = ROOT / "index.html"
ADMIN_INDEX = ROOT / "admin" / "index.html"

SCRIPT_BLOCK = re.compile(
    r'(<script[^>]+id="listings-data"[^>]*>)([\s\S]*?)(</script>)',
    re.IGNORECASE,
)


def main() -> None:
    if not LISTINGS.is_file():
        sys.exit(f"Missing {LISTINGS}")

    listings = json.loads(LISTINGS.read_text(encoding="utf-8"))["listings"]
    payload = json.dumps({"listings": listings}, ensure_ascii=False, separators=(",", ":"))

    dl_content = (
        "/* Shared listings data — auto-generated */\n"
        ";(function () {\n"
        "  const el = document.getElementById('listings-data')\n"
        "  if (el) return\n"
        "  const s = document.createElement('script')\n"
        "  s.id   = 'listings-data'\n"
        "  s.type = 'application/json'\n"
        f"  s.textContent = JSON.stringify({payload})\n"
        "  document.head.appendChild(s)\n"
        "})()\n"
    )
    DATA_LISTINGS_JS.write_text(dl_content, encoding="utf-8")
    print(f"Wrote {DATA_LISTINGS_JS.name} ({len(listings)} listings)")

    for path, label in ((INDEX_HTML, "index.html"), (ADMIN_INDEX, "admin/index.html")):
        text = path.read_text(encoding="utf-8")
        m = SCRIPT_BLOCK.search(text)
        if not m:
            sys.exit(f'No <script id="listings-data"> in {label}')
        new_text = text[: m.start()] + m.group(1) + payload + m.group(3) + text[m.end() :]
        path.write_text(new_text, encoding="utf-8")
        print(f"Updated {label} inline listings-data")


if __name__ == "__main__":
    main()
