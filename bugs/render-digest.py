#!/usr/bin/env python3
"""
Regenerate bugs/morning-digest.html from bugs/MORNING-DIGEST.md. This is the
browser-viewable version of the morning digest, the feature/digest-side companion
to bugs/render-queue.py (which renders the bug-queue dashboard). Running it at the
end of every morning-digest run keeps the HTML in sync with the markdown.

Usage:  python3 bugs/render-digest.py
Reads:  bugs/MORNING-DIGEST.md
Writes: bugs/morning-digest.html

No external dependencies (stdlib only). House rule: the output is scrubbed of em
and en dashes (the source markdown occasionally carries one). Renders the small
markdown subset the digest uses: one h1 title, ** intro headline, ## section
headings, ordered and unordered lists, paragraphs, **bold**, and `inline code`.
"""

import html as _html
import re
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "MORNING-DIGEST.md"
OUT = HERE / "morning-digest.html"


def scrub_dashes(s: str) -> str:
    s = s.replace(" — ", "; ").replace("—", "; ")
    s = s.replace("–", "-")
    return s


def inline(s: str) -> str:
    # Escape first, then re-introduce the small set of inline spans we allow.
    s = _html.escape(s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    return s


def render_body(md: str):
    """Return (title, intro_html, sections) where sections is a list of
    (heading, body_html)."""
    lines = scrub_dashes(md).split("\n")
    title = "Morning digest"
    intro_blocks = []          # blocks before the first ## section
    sections = []              # list of [heading, [blocks]]
    current = None             # current section body block list
    target = intro_blocks

    para = []                  # running paragraph buffer

    def flush_para():
        nonlocal para
        if para:
            target.append(("p", " ".join(para).strip()))
            para = []

    list_buf = None            # ("ol"|"ul", [items])

    def flush_list():
        nonlocal list_buf
        if list_buf:
            target.append((list_buf[0], list_buf[1]))
            list_buf = None

    for raw in lines:
        line = raw.rstrip()
        if line.startswith("# "):
            flush_para(); flush_list()
            title = line[2:].strip()
            continue
        if line.startswith("## "):
            flush_para(); flush_list()
            heading = line[3:].strip()
            current = []
            sections.append([heading, current])
            target = current
            continue
        m_ol = re.match(r"^\d+\.\s+(.*)$", line)
        m_ul = re.match(r"^[-*]\s+(.*)$", line)
        if m_ol:
            flush_para()
            if not list_buf or list_buf[0] != "ol":
                flush_list(); list_buf = ("ol", [])
            list_buf[1].append(m_ol.group(1))
            continue
        if m_ul:
            flush_para()
            if not list_buf or list_buf[0] != "ul":
                flush_list(); list_buf = ("ul", [])
            list_buf[1].append(m_ul.group(1))
            continue
        if not line.strip():
            flush_para(); flush_list()
            continue
        # plain text line: part of a paragraph
        flush_list()
        para.append(line.strip())
    flush_para(); flush_list()

    def blocks_to_html(blocks):
        out = []
        for kind, payload in blocks:
            if kind == "p":
                out.append("<p>" + inline(payload) + "</p>")
            elif kind == "ol":
                out.append("<ol>" + "".join("<li>" + inline(it) + "</li>" for it in payload) + "</ol>")
            elif kind == "ul":
                out.append("<ul>" + "".join("<li>" + inline(it) + "</li>" for it in payload) + "</ul>")
        return "\n".join(out)

    intro_html = blocks_to_html(intro_blocks)
    sections_html = [(h, blocks_to_html(b)) for h, b in sections]
    return title, intro_html, sections_html


def section_kind(heading: str) -> str:
    h = heading.lower()
    if "suggested today" in h:
        return "suggest"
    if "balance" in h:
        return "balance"
    if "needs you" in h:
        return "needs"
    if "auto-fix" in h:
        return "auto"
    if "triage" in h:
        return "triage"
    if "feature" in h:
        return "feature"
    if "lead" in h:
        return "leads"
    return "plain"


TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>__TITLE__</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #ffffff; color: #1c1a17; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .wrap { max-width: 760px; margin: 0 auto; padding: 20px 18px 48px; }
  header h1 { font-size: 19px; margin: 0 0 2px; letter-spacing: -0.01em; }
  .sub { font-size: 12.5px; color: #78716c; margin: 0 0 14px; }
  .headline { font-size: 14px; line-height: 1.5; background: #fffbeb; border: 1px solid #fde68a; border-left: 3px solid #f59e0b; border-radius: 10px; padding: 12px 14px; margin: 0 0 18px; color: #44403c; }
  .headline strong { color: #1c1a17; }
  .card { border: 1px solid #e7e5e4; border-radius: 11px; padding: 12px 16px 14px; margin: 10px 0; background: #fff; }
  .card.suggest { border-color: #f59e0b; box-shadow: 0 0 0 1px #f59e0b inset; background: #fffdf7; }
  .card.needs { border-color: #fca5a5; background: #fffafa; }
  .card.balance { background: #f6fdfb; border-color: #99f6e4; }
  .card h2 { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: #78716c; margin: 0 0 8px; }
  .card.suggest h2 { color: #92400e; }
  .card.needs h2 { color: #991b1b; }
  .card.balance h2 { color: #115e59; }
  .card p { font-size: 13px; line-height: 1.5; color: #44403c; margin: 8px 0; }
  .card p:first-of-type { margin-top: 0; }
  .card ul, .card ol { font-size: 13px; line-height: 1.5; color: #44403c; margin: 8px 0; padding-left: 22px; }
  .card li { margin: 5px 0; }
  .card.suggest ol { padding-left: 20px; }
  .card.suggest li { margin: 8px 0; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; background: #f5f5f4; color: #2563eb; padding: 1px 5px; border-radius: 5px; }
  strong { font-weight: 700; }
  footer { margin-top: 22px; font-size: 11.5px; color: #a8a29e; line-height: 1.5; }
  a { color: #2563eb; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Linestry Morning Digest</h1>
    <p class="sub">__SUB__</p>
  </header>
  __HEADLINE__
  __SECTIONS__
  <footer>__FOOT__</footer>
</div>
</body>
</html>
"""


def main():
    if not SRC.exists():
        raise SystemExit(f"missing {SRC}")
    md = SRC.read_text(encoding="utf-8")
    title, intro_html, sections = render_body(md)

    # Date for the sub line: the first line of the digest after "digest, ".
    m = re.search(r"digest,\s*(.+)$", title)
    date_str = m.group(1).strip() if m else title
    sub = f"{date_str}. Source: bugs/MORNING-DIGEST.md."

    headline = f'<div class="headline">{intro_html}</div>' if intro_html else ""

    cards = []
    for heading, body_html in sections:
        kind = section_kind(heading)
        cards.append(
            f'<section class="card {kind}"><h2>{_html.escape(heading)}</h2>{body_html}</section>'
        )
    sections_html = "\n  ".join(cards)

    gen = datetime.now().strftime("%Y-%m-%d %H:%M")
    foot = (
        "Browser view generated from bugs/MORNING-DIGEST.md by bugs/render-digest.py "
        f"(the morning-digest run). Last generated {gen}."
    )

    out = (
        TEMPLATE
        .replace("__TITLE__", _html.escape(title))
        .replace("__SUB__", _html.escape(sub))
        .replace("__HEADLINE__", headline)
        .replace("__SECTIONS__", sections_html)
        .replace("__FOOT__", _html.escape(foot))
    )
    OUT.write_text(out, encoding="utf-8")
    print(f"Wrote {OUT} : {len(sections)} sections, date {date_str}")


if __name__ == "__main__":
    main()
