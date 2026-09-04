#!/usr/bin/env python3
"""
Regenerate features/feature-queue.html from features/feature-queue.md (and the
lead from features/NEXT-FEATURE.md). This is the readable feature dashboard Jay
opens in a browser tab, the feature-side mirror of bugs/render-queue.py. Running
it at the end of every digest/triage reconcile keeps it in sync with the markdown.

Usage:  python3 features/render-features.py
Reads:  features/feature-queue.md, features/NEXT-FEATURE.md
Writes: features/feature-queue.html

No external dependencies (stdlib only). House rule: the output is scrubbed of em
and en dashes (the source markdown carries em dashes as separators in titles).
"""

import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
QUEUE = HERE / "feature-queue.md"
NEXT = HERE / "NEXT-FEATURE.md"
OUT = HERE / "feature-queue.html"


def scrub(s: str) -> str:
    # Em dash as a separator reads best as a spaced hyphen here; keep the house
    # rule (no em dashes in output). En dash to hyphen for ranges.
    s = s.replace(" — ", " - ").replace("—", " - ").replace("–", "-")
    return s.strip()


def clean_md(s: str) -> str:
    s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)   # [text](url) -> text
    s = re.sub(r"\*\*([^*]+)\*\*", r"\1", s)          # bold -> plain
    s = s.replace("`", "")
    return scrub(s)


def section(md: str, start_marker: str, end_markers):
    start = md.index(start_marker)
    end = len(md)
    for m in end_markers:
        i = md.find(m, start + len(start_marker))
        if i != -1:
            end = min(end, i)
    return md[start:end]


def parse_queue(md: str, lead_brief: str):
    sec = section(md, "## Queue", ["## Needs a Jay decision", "## Deferred", "## Shipped"])
    parts = re.split(r"\n(?=### )", sec)
    items = []
    for part in parts:
        m = re.match(r"### (.+)", part)
        if not m:
            continue
        heading = m.group(1).strip()
        is_lead = heading.upper().startswith("LEAD:")
        heading = re.sub(r"^LEAD:\s*", "", heading, flags=re.IGNORECASE)
        name = clean_md(heading)

        def field(label):
            fm = re.search(r"^- \*\*" + label + r":\*\*\s*(.+)$", part, re.MULTILINE)
            return clean_md(fm.group(1)) if fm else ""

        brief = ""
        bm = re.search(r"\*\*Brief:\*\*\s*`?([^`\n]+\.md)`?", part)
        if bm:
            brief = bm.group(1).strip()
        if lead_brief and brief and brief.endswith(lead_brief.split("/")[-1]):
            is_lead = True

        items.append({
            "name": name,
            "group": "ready",
            "lead": is_lead,
            "brief": brief,
            "size": field("Size"),
            "what": field("What"),
            "note": "",
        })
    return items


def parse_bullets(sec: str, group: str):
    out = []
    for line in sec.splitlines():
        bm = re.match(r"- \*\*(.+?)\*\*\s*(.*)$", line)
        if not bm:
            continue
        name = clean_md(bm.group(1))
        note = clean_md(bm.group(2)).lstrip(":-. ").strip()
        out.append({"name": name, "group": group, "lead": False, "brief": "", "size": "", "what": "", "note": note})
    return out


def parse_shipped(md: str, limit: int = 8):
    sec = section(md, "## Shipped", [])
    out = []
    for line in sec.splitlines():
        bm = re.match(r"- \*\*(.+?)\*\*\s*(.*)$", line)
        if not bm:
            continue
        name = clean_md(bm.group(1))
        tail = bm.group(2)
        prs = re.findall(r"#(\d+)", tail)
        pr = "#" + "/#".join(dict.fromkeys(prs)) if prs else ""
        note = clean_md(re.sub(r"^[-\s]*PR[^.]*\.\s*", "", tail))
        if len(note) > 240:
            note = note[:237].rstrip() + "..."
        out.append({"name": name, "pr": pr, "note": note})
        if len(out) >= limit:
            break
    return out


def parse_snapshot(md: str) -> str:
    m = re.search(r"Last updated:\s*([A-Za-z]+ \d{1,2}, \d{4})", md)
    return m.group(1) if m else "unknown"


def parse_lead_brief(next_md: str) -> str:
    idx = next_md.find("Build this")
    if idx != -1:
        m = re.search(r"`(features/[^`]+\.md)`", next_md[idx:idx + 400])
        if m:
            return m.group(1)
    return ""


TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Linestry Feature Queue</title>
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
  .name { font-weight: 800; font-size: 13.5px; color: #292524; }
  .what { font-size: 12.5px; color: #57534e; margin: 6px 0 0; line-height: 1.45; }
  .size { font-size: 12px; color: #115e59; margin: 6px 0 0; line-height: 1.4; }
  .note { font-size: 12.5px; color: #57534e; margin: 5px 0 0; line-height: 1.45; }
  .badges { display: flex; gap: 5px; flex-wrap: wrap; margin-left: auto; }
  .b { font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.03em; }
  .ready { background: #ccfbf1; color: #115e59; }
  .dec { background: #f3e8ff; color: #6b21a8; }
  .park { background: #f5f5f4; color: #57534e; }
  .lead-b { background: #f59e0b; color: #fff; }
  .brief { font-size: 11.5px; color: #2563eb; margin-top: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .empty { color: #a8a29e; font-size: 13px; padding: 20px 0; text-align: center; }
  details.shipped { margin-top: 26px; border-top: 1px solid #e7e5e4; padding-top: 12px; }
  details.shipped summary { font-size: 12.5px; font-weight: 700; color: #78716c; cursor: pointer; }
  .ship { font-size: 12.5px; color: #57534e; margin: 7px 0; line-height: 1.45; }
  .ship b { color: #292524; }
  footer { margin-top: 22px; font-size: 11.5px; color: #a8a29e; line-height: 1.5; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Linestry Feature Queue</h1>
    <p class="sub" id="sub">Snapshot. Source: features/feature-queue.md.</p>
  </header>
  <div class="counts" id="counts"></div>
  <div class="controls">
    <button class="chip active" data-f="all">All</button>
    <button class="chip" data-f="ready">Ready</button>
    <button class="chip" data-f="decision">Needs decision</button>
    <button class="chip" data-f="parked">Parked</button>
    <input id="q" placeholder="Search name, note...">
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
  const FEATURES = /*FEATURES*/;
  const SHIPPED = /*SHIPPED*/;

  const GROUPS = [["ready","Ready to build (value-ordered)"],["decision","Needs a decision / drafting pass"],["parked","Deferred / parked"]];
  let filter = "all", query = "";

  function badge(g){ return g==="ready"?'<span class="b ready">ready</span>':g==="decision"?'<span class="b dec">decision</span>':'<span class="b park">parked</span>'; }

  function render(){
    const counts = { ready:0, decision:0, parked:0 };
    FEATURES.forEach(f => counts[f.group]++);
    document.getElementById("counts").innerHTML =
      '<span class="count"><b>'+counts.ready+'</b> ready</span>' +
      '<span class="count">decisions <b>'+counts.decision+'</b></span>' +
      '<span class="count">parked <b>'+counts.parked+'</b></span>' +
      '<span class="count">shipped (recent) <b>'+SHIPPED.length+'</b></span>';
    document.getElementById("sub").textContent = "Snapshot as of "+SNAPSHOT+". Source: features/feature-queue.md. Lead: "+LEAD+". Regenerated by the morning digest.";

    const list = document.getElementById("list");
    list.innerHTML = "";
    let shown = 0;
    GROUPS.forEach(([g,label]) => {
      if (filter !== "all" && filter !== g) return;
      const items = FEATURES.filter(f => f.group===g && match(f));
      if (!items.length) return;
      const h = document.createElement("div"); h.className="group"; h.textContent=label; list.appendChild(h);
      items.forEach(f => { list.appendChild(card(f)); shown++; });
    });
    if (!shown) list.innerHTML = '<div class="empty">No features match.</div>';

    document.getElementById("shipped").innerHTML = SHIPPED.map(s =>
      '<div class="ship"><b>'+s.name+'</b>'+(s.pr?' ('+s.pr+')':'')+' '+s.note+'</div>').join("");
    document.getElementById("foot").innerHTML =
      "This is a snapshot dashboard generated from features/feature-queue.md by the morning digest (features/render-features.py). Features have no BUG id; they reconcile off bugs/SHIP-LOG.md type:feature + git.";
  }

  function match(f){
    if (!query) return true;
    const s = (f.name+" "+f.what+" "+f.note).toLowerCase();
    return s.includes(query);
  }

  function card(f){
    const d = document.createElement("div");
    d.className = "card" + (f.lead ? " lead" : "");
    let inner = '<div class="row1"><span class="name">'+f.name+'</span>'+
      '<div class="badges">'+(f.lead?'<span class="b lead-b">lead</span>':'')+badge(f.group)+'</div></div>';
    if (f.what) inner += '<div class="what">'+f.what+'</div>';
    if (f.note) inner += '<div class="note">'+f.note+'</div>';
    if (f.size) inner += '<div class="size">'+f.size+'</div>';
    if (f.brief) inner += '<div class="brief">'+f.brief+'</div>';
    d.innerHTML = inner;
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
    md = QUEUE.read_text(encoding="utf-8")
    next_md = NEXT.read_text(encoding="utf-8") if NEXT.exists() else ""

    lead_brief = parse_lead_brief(next_md)
    queue = parse_queue(md, lead_brief)
    decisions = parse_bullets(section(md, "## Needs a Jay decision", ["## Deferred", "## Shipped"]), "decision")
    parked = parse_bullets(section(md, "## Deferred", ["## Shipped"]), "parked")
    features = queue + decisions + parked
    shipped = parse_shipped(md)
    snapshot = parse_snapshot(md)
    lead = next((f["name"] for f in queue if f["lead"]), (queue[0]["name"] if queue else ""))

    html = TEMPLATE
    html = html.replace("/*SNAPSHOT*/", json.dumps(snapshot))
    html = html.replace("/*LEAD*/", json.dumps(lead))
    html = html.replace("/*FEATURES*/", json.dumps(features, ensure_ascii=False))
    html = html.replace("/*SHIPPED*/", json.dumps(shipped, ensure_ascii=False))

    OUT.write_text(html, encoding="utf-8")
    print(f"Wrote {OUT} : {len(queue)} ready, {len(decisions)} decisions, "
          f"{len(parked)} parked, {len(shipped)} shipped, snapshot {snapshot}, lead {lead}")


if __name__ == "__main__":
    main()
