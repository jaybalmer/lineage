#!/usr/bin/env python3
"""
Regenerate bugs/bug-queue.html from bugs/bug-triage.md (and the lead from
bugs/NEXT-SESSION.md). This is the readable dashboard Jay opens; running this at
the end of every daily triage keeps it from drifting out of sync with the
markdown source of truth.

Usage:  python3 bugs/render-queue.py
Reads:  bugs/bug-triage.md, bugs/NEXT-SESSION.md
Writes: bugs/bug-queue.html

No external dependencies (stdlib only). House rule: the output is scrubbed of em
and en dashes (the source markdown occasionally carries one).
"""

import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
TRIAGE = HERE / "bug-triage.md"
NEXT = HERE / "NEXT-SESSION.md"
OUT = HERE / "bug-queue.html"


def scrub_dashes(s: str) -> str:
    # Honour the no-em-dash house rule even when the source slips one in.
    s = s.replace(" — ", "; ").replace("—", "; ")
    s = s.replace("–", "-")  # en dash -> hyphen (ranges like 1990-1999)
    return s


def clean_md(s: str) -> str:
    # Strip the markdown link wrappers and inline code ticks for readable text.
    s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)  # [text](url) -> text
    s = s.replace("`", "")
    s = scrub_dashes(s).strip()
    return s


def first_bracket_tags(heading_tail: str):
    # heading_tail is everything after "BUG-NNN: "; returns the [..] tokens.
    return re.findall(r"\[([^\]]+)\]", heading_tail)


def group_for(tags, heading, body):
    blob = (heading + " " + body).lower()
    tagset = [t.lower() for t in tags]
    priority = next((t.upper() for t in tagset if t in ("p0", "p1", "p2")), "P2")
    is_feature = ("feature" in tagset) or ("feature gap" in blob)
    is_decision = (
        "needs-decision" in tagset
        or "needs-info" in tagset
        or "needs product decision" in blob
        or "needs design decision" in blob
        or "premise changed" in blob
        or "(decision;" in blob
        or "(decision)" in blob
    )
    if is_feature:
        return "feature"
    if is_decision:
        return "decision"
    return priority


def derive_tags(second_brackets, heading, body):
    blob = (heading + " " + body).lower()
    tags = []
    # repro / needs-info from the 2nd+ bracket tokens
    for t in second_brackets:
        tl = t.lower()
        if tl in ("reproducible", "needs-info"):
            if tl not in tags:
                tags.append(tl)
    for needle, label in [
        ("diagnosis-first", "diagnosis-first"),
        ("human-run", "human-run"),
        ("auto-merge", "auto-merge"),
        ("consistency", "consistency"),
        ("launch-facing", "launch-facing"),
        ("feature gap", "feature-gap"),
    ]:
        if needle in blob and label not in tags:
            tags.append(label)
    return tags


def parse_queue(md: str):
    # Slice the Queue section (between "## Queue" and "## Shipped").
    start = md.index("## Queue")
    end = md.index("## Shipped", start)
    section = md[start:end]

    # Split on the "### BUG-NNN:" headings, keeping the heading with its body.
    parts = re.split(r"\n(?=### BUG-\d+:)", section)
    bugs = []
    for part in parts:
        m = re.match(r"### (BUG-\d+):\s*(.*)", part)
        if not m:
            continue
        bug_id = m.group(1)
        heading_tail = m.group(2).strip()
        body = part[part.index("\n") + 1:] if "\n" in part else ""

        # Title = heading text before the first "  [" (two spaces + bracket).
        title = re.split(r"\s\s\[", heading_tail)[0].strip()
        title = clean_md(title)

        tags = first_bracket_tags(heading_tail)
        group = group_for(tags, heading_tail, body)

        # Note = the Symptom line (most readable); fall back to Surface line.
        note = ""
        sym = re.search(r"^- Symptom:\s*(.+)$", body, re.MULTILINE)
        if sym:
            note = sym.group(1)
        else:
            surf = re.search(r"^- Surface / suspected area:\s*(.+)$", body, re.MULTILINE)
            if surf:
                note = surf.group(1)
        note = clean_md(note)

        # Brief = first "Brief at `bugs/..md`" or "Added to `bugs/..md`".
        brief = ""
        bm = re.search(r"(?:Brief at|Added to)\s+`?(bugs/[^`\s]+\.md)`?", body)
        if bm:
            brief = bm.group(1)

        bugs.append({
            "id": bug_id,
            "group": group,
            "title": title,
            "tags": derive_tags(tags[1:], heading_tail, body),
            "note": note,
            "brief": brief,
        })
    return bugs


def parse_shipped(md: str, limit: int = 6):
    start = md.index("## Shipped")
    section = md[start:]
    # Each block starts with "Shipped <date> via PR ...:" then "- BUG-...:" bullets.
    blocks = re.split(r"\n(?=Shipped .*? via PR)", section)
    out = []
    for block in blocks:
        head = block.splitlines()[0] if block.splitlines() else ""
        if not head.startswith("Shipped"):
            continue
        prs = re.findall(r"#(\d+)", head)
        pr = "#" + "/#".join(dict.fromkeys(prs)) if prs else ""
        # ids: prefer the commit "BUG-... :" list in the header, else the bullets.
        ids = re.findall(r"BUG-\d+(?:\s*/\s*\d+)*", head)
        if not ids:
            bullets = re.findall(r"^- (BUG-\d+):", block, re.MULTILINE)
            ids = bullets
        id_label = " / ".join(dict.fromkeys(ids)) if ids else "(no BUG ids)"
        # Note: first bullet if present, else the header tail after the colon.
        first_bullet = re.search(r"^- (.+)$", block, re.MULTILINE)
        if first_bullet:
            note = first_bullet.group(1)
        else:
            note = head.split("):", 1)[-1] if "):" in head else head
        note = clean_md(note)
        if len(note) > 260:
            note = note[:257].rstrip() + "..."
        out.append({"id": id_label, "pr": pr, "note": note})
        if len(out) >= limit:
            break
    return out


def parse_snapshot(md: str) -> str:
    m = re.search(r"Last updated:\s*([A-Za-z]+ \d{1,2}, \d{4})", md)
    return m.group(1) if m else "unknown"


def parse_lead(next_md: str, bugs) -> str:
    # First BUG id named in the "Build this" callout in NEXT-SESSION.md.
    # The heading form is authoritative and must be tried first: the doc header
    # also says the words "Build this" in prose, and the PIPELINE-SAFE callout
    # ("### Build this if unattended") is a different, lower-priority lead. So
    # match the attended heading exactly, then fall back through the looser
    # forms for older files that used the "Build this (" shape.
    m = re.search(r"^#+\s*Build this:", next_md, re.M)
    idx = m.start() if m else -1
    if idx == -1:
        idx = next_md.find("Build this (")
    if idx == -1:
        idx = next_md.find("Build this")
    if idx != -1:
        m = re.search(r"BUG-(\d+)", next_md[idx:idx + 400])
        if m:
            return "BUG-" + m.group(1)
    # Fallback: first P2 bug.
    for b in bugs:
        if b["group"] == "P2":
            return b["id"]
    return bugs[0]["id"] if bugs else ""


def next_free_id(bugs, shipped, md: str = "") -> str:
    nums = [int(n) for b in bugs for n in re.findall(r"BUG-(\d+)", b["id"])]
    nums += [int(n) for s in shipped for n in re.findall(r"BUG-(\d+)", s["id"])]
    # Deferred and not-auto-drafted items are logged as bold bullets, not as
    # "### BUG-NNN" queue entries, so parse_queue never sees them. They are real
    # allocated ids and must count, or the next run hands out a colliding one.
    # Matched narrowly on the "**BUG-NNN:" declaration form so that the many
    # prose cross-references to existing ids cannot inflate the number.
    nums += [int(n) for n in re.findall(r"\*\*BUG-(\d+):", md)]
    nxt = (max(nums) + 1) if nums else 1
    return f"BUG-{nxt:03d}"


TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #ffffff; color: #1c1a17; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .wrap { max-width: 760px; margin: 0 auto; padding: 20px 18px 48px; }
  header h1 { font-size: 19px; margin: 0 0 2px; letter-spacing: -0.01em; }
  .sub { font-size: 12.5px; color: #78716c; margin: 0 0 14px; }
  .counts { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 14px; }
  .count { font-size: 12px; font-weight: 600; padding: 5px 10px; border-radius: 999px; background: #f5f5f4; color: #44403c; border: 1px solid #e7e5e4; }
  .count b { font-weight: 800; }
  .controls { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 0 0 16px; }
  .chip { font-size: 12.5px; font-weight: 600; padding: 6px 12px; border-radius: 999px; border: 1px solid #d6d3d1; background: #fff; color: #44403c; cursor: pointer; }
  .chip.active { background: #1c1a17; color: #fff; border-color: #1c1a17; }
  #q { flex: 1; min-width: 160px; font-size: 13px; padding: 8px 11px; border: 1px solid #d6d3d1; border-radius: 9px; }
  .group { margin: 18px 0 6px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: #78716c; }
  .card { border: 1px solid #e7e5e4; border-radius: 11px; padding: 12px 14px; margin: 8px 0; background: #fff; }
  .card.lead { border-color: #f59e0b; box-shadow: 0 0 0 1px #f59e0b inset; }
  .row1 { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .id { font-weight: 800; font-size: 13.5px; }
  .title { font-size: 13.5px; color: #292524; }
  .note { font-size: 12.5px; color: #57534e; margin: 6px 0 0; line-height: 1.45; }
  .badges { display: flex; gap: 5px; flex-wrap: wrap; margin-left: auto; }
  .b { font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.03em; }
  .p1 { background: #fef3c7; color: #92400e; }
  .p2 { background: #e0f2fe; color: #075985; }
  .dec { background: #f3e8ff; color: #6b21a8; }
  .feat { background: #ccfbf1; color: #115e59; }
  .lead-b { background: #f59e0b; color: #fff; }
  .needsinfo { background: #fee2e2; color: #991b1b; }
  .tag { background: #f5f5f4; color: #57534e; }
  .brief { font-size: 11.5px; color: #2563eb; margin-top: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .empty { color: #a8a29e; font-size: 13px; padding: 20px 0; text-align: center; }
  details.shipped { margin-top: 26px; border-top: 1px solid #e7e5e4; padding-top: 12px; }
  details.shipped summary { font-size: 12.5px; font-weight: 700; color: #78716c; cursor: pointer; }
  .ship { font-size: 12.5px; color: #57534e; margin: 7px 0; }
  .ship b { color: #292524; }
  footer { margin-top: 22px; font-size: 11.5px; color: #a8a29e; line-height: 1.5; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Linestry Bug Queue</h1>
    <p class="sub" id="sub">Snapshot. Source: bugs/bug-triage.md.</p>
  </header>
  <div class="counts" id="counts"></div>
  <div class="controls">
    <button class="chip active" data-f="all">All</button>
    <button class="chip" data-f="P1">P1</button>
    <button class="chip" data-f="P2">P2</button>
    <button class="chip" data-f="decision">Needs decision</button>
    <button class="chip" data-f="feature">Features</button>
    <input id="q" placeholder="Search id, title, note...">
  </div>
  <div id="list"></div>

  <details class="shipped">
    <summary>Recently shipped (context)</summary>
    <div id="shipped"></div>
  </details>

  <footer id="foot"></footer>
</div>

<script>
  const SNAPSHOT = /*SNAPSHOT*/;
  const LEAD = /*LEAD*/;
  const NEXTID = /*NEXTID*/;
  const BUGS = /*BUGS*/;
  const SHIPPED = /*SHIPPED*/;

  const GROUPS = [["P1","P1 - Broken"],["P2","P2 - Polish and edge"],["decision","Needs a decision"],["feature","Features"]];
  let filter = "all", query = "";

  function badge(g){ return g==="P1"?'<span class="b p1">P1</span>':g==="P2"?'<span class="b p2">P2</span>':g==="decision"?'<span class="b dec">decision</span>':'<span class="b feat">feature</span>'; }
  function tagBadges(b){
    return b.tags.map(t => {
      const cls = t==="needs-info"?"needsinfo":"tag";
      return '<span class="b '+cls+'">'+t+'</span>';
    }).join("");
  }

  function render(){
    const counts = { P1:0,P2:0,decision:0,feature:0 };
    BUGS.forEach(b => counts[b.group]++);
    document.getElementById("counts").innerHTML =
      '<span class="count"><b>'+BUGS.length+'</b> open</span>' +
      '<span class="count">P0 <b>0</b></span>' +
      '<span class="count">P1 <b>'+counts.P1+'</b></span>' +
      '<span class="count">P2 <b>'+counts.P2+'</b></span>' +
      '<span class="count">decisions <b>'+counts.decision+'</b></span>' +
      '<span class="count">features <b>'+counts.feature+'</b></span>';
    document.getElementById("sub").textContent = "Snapshot as of "+SNAPSHOT+". Source: bugs/bug-triage.md. Lead: "+LEAD+". Regenerated by the daily triage.";

    const list = document.getElementById("list");
    list.innerHTML = "";
    let shown = 0;
    GROUPS.forEach(([g,label]) => {
      if (filter !== "all" && filter !== g) return;
      const items = BUGS.filter(b => b.group===g && match(b));
      if (!items.length) return;
      const h = document.createElement("div"); h.className="group"; h.textContent=label; list.appendChild(h);
      items.forEach(b => { list.appendChild(card(b)); shown++; });
    });
    if (!shown) list.innerHTML = '<div class="empty">No bugs match.</div>';

    document.getElementById("shipped").innerHTML = SHIPPED.map(s =>
      '<div class="ship"><b>'+s.id+'</b> ('+s.pr+') '+s.note+'</div>').join("");
    document.getElementById("foot").innerHTML =
      "This is a snapshot dashboard generated from bugs/bug-triage.md by the daily triage (bugs/render-queue.py). Next free id: "+NEXTID+".";
  }

  function match(b){
    if (!query) return true;
    const s = (b.id+" "+b.title+" "+b.note).toLowerCase();
    return s.includes(query);
  }

  function card(b){
    const d = document.createElement("div");
    d.className = "card" + (b.id===LEAD ? " lead" : "");
    d.innerHTML =
      '<div class="row1"><span class="id">'+b.id+'</span>'+
        '<div class="badges">'+(b.id===LEAD?'<span class="b lead-b">lead</span>':'')+badge(b.group)+tagBadges(b)+'</div></div>'+
      '<div class="title">'+b.title+'</div>'+
      '<div class="note">'+b.note+'</div>'+
      (b.brief ? '<div class="brief">'+b.brief+'</div>' : '');
    return d;
  }

  document.querySelectorAll(".chip").forEach(c => c.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach(x => x.classList.remove("active"));
    c.classList.add("active"); filter = c.dataset.f; render();
  }));
  document.getElementById("q").addEventListener("input", e => { query = e.target.value.trim().toLowerCase(); render(); });

  render();
</script>
</body>
</html>
"""


def main():
    md = TRIAGE.read_text(encoding="utf-8")
    next_md = NEXT.read_text(encoding="utf-8") if NEXT.exists() else ""

    bugs = parse_queue(md)
    shipped = parse_shipped(md)
    snapshot = parse_snapshot(md)
    lead = parse_lead(next_md, bugs)
    nxt = next_free_id(bugs, shipped, md)

    html = TEMPLATE
    html = html.replace("/*SNAPSHOT*/", json.dumps(snapshot))
    html = html.replace("/*LEAD*/", json.dumps(lead))
    html = html.replace("/*NEXTID*/", json.dumps(nxt))
    html = html.replace("/*BUGS*/", json.dumps(bugs, ensure_ascii=False))
    html = html.replace("/*SHIPPED*/", json.dumps(shipped, ensure_ascii=False))

    OUT.write_text(html, encoding="utf-8")
    print(f"Wrote {OUT} : {len(bugs)} open bugs, {len(shipped)} shipped blocks, "
          f"snapshot {snapshot}, lead {lead}, next {nxt}")


if __name__ == "__main__":
    main()
