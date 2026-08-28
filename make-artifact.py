#!/usr/bin/env python3
"""Strip index.html down to the body-only fragment the Artifact host expects.

site/index.html is the source of truth. Run this after editing it to refresh
the Artifact copy; the published page and the live site then match.
"""
import re, sys, pathlib
src = pathlib.Path(__file__).parent / "index.html"
d = src.read_text(encoding="utf-8")
head = d[d.index("<title>"):d.index("</head>")]
head = re.sub(r'<meta[^>]*>|<link rel="canonical"[^>]*>|<link rel="icon"[^>]*>', "", head)
head = re.sub(r'<style>\*\{box-sizing.*?</style>', "", head, flags=re.S).strip()
body = d[d.index("<body>") + len("<body>"): d.index("</body>")].strip()
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "artifact-body.html")
out.write_text(head + "\n\n" + body + "\n", encoding="utf-8")
print(f"wrote {out} ({out.stat().st_size:,} bytes)")
