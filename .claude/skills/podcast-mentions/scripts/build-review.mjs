#!/usr/bin/env node
// Build the review page for a mention seed.
//
// A seed file is JSON, which is not a review surface. This renders it as a page
// a person can actually work through: every story in episode order with its
// cast, a timecode that opens the video at that second so a story can be
// checked against the audio, and a checkbox per story that produces a trim list
// to hand back.
//
// Usage (from repo root):
//   node .claude/skills/podcast-mentions/scripts/build-review.mjs podcast-seeds/fnrad-ep21.json
//
// Writes <seed>-review.html beside the seed and prints the path. Read-only with
// respect to the seed and the database.
//
// Colors mirror Linestry's entity tiers (CLAUDE.md: riders violet, places teal,
// events amber, boards emerald, brands cyan) so the review reads in the same
// language as the app.

import { readFileSync, writeFileSync } from "node:fs"

const seedArg = process.argv[2]
if (!seedArg) {
  console.error("Usage: node .claude/skills/podcast-mentions/scripts/build-review.mjs <seed.json>")
  process.exit(1)
}
const OUT = seedArg.replace(/\.json$/, "") + "-review.html"

let seed
try {
  seed = JSON.parse(readFileSync(seedArg, "utf8"))
} catch (err) {
  console.error(`Could not read ${seedArg}: ${err.message}`)
  process.exit(1)
}

const ep = seed.episode ?? {}
const VID = (() => {
  const m = /(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/.exec(ep.media_url ?? "")
  return m ? m[1] : null
})()

const secs = (v) => {
  const s = String(v ?? "").trim()
  if (!s) return null
  if (/^\d+$/.test(s)) return +s
  const p = s.split(":").map(Number)
  if (p.some(Number.isNaN)) return null
  return p.length === 3 ? p[0]*3600 + p[1]*60 + p[2] : p[0]*60 + p[1]
}
const esc = (t) => String(t ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const LABEL = { person:"Rider", place:"Place", org:"Brand", event:"Event", board:"Board" }

// A flat (pre-story) seed renders as one-subject stories, so old seeds still
// get a review page.
const rawStories = seed.stories ?? (seed.mentions ?? []).map((m) => ({
  timestamp: m.timestamp, title: m.subject_name, excerpt: m.excerpt,
  resolution: m.resolution, activity: m.activity, skip_reason: m.skip_reason,
  subjects: [m],
}))

const stories = rawStories
  .map((s, i) => ({ ...s, i, secs: secs(s.timestamp) }))
  .sort((a, b) => (a.secs ?? 1e9) - (b.secs ?? 1e9))

const live = stories.filter((s) => s.resolution !== "skip")
const parked = stories.filter((s) => s.resolution === "skip")
const liveSubs = live.flatMap((s) => s.subjects ?? [])
const key = (x) => x.subject_type + "|" + x.subject_name
const newSet = new Set(liveSubs.filter((x) => x.resolution === "new_ghost").map(key))
const reviewSet = new Set(liveSubs.filter((x) => x.resolution === "review" || x.resolution === "ambiguous").map(key))
const matchSet = new Set(liveSubs.filter((x) => x.resolution === "matched_existing").map(key))

const chipState = (x) =>
  x.resolution === "matched_existing" ? { cls: "", note: "" }
  : x.resolution === "review" || x.resolution === "ambiguous" ? { cls: " is-review", note: " &middot; needs a decision" }
  : { cls: " is-new", note: " &middot; new" }

const chip = (x) => {
  const st = chipState(x)
  return `<span class="sub sub-${x.subject_type}${st.cls}"><i></i>${esc(x.subject_name)}<em>${LABEL[x.subject_type] ?? x.subject_type}${st.note}</em></span>`
}

const card = (s, trimmable) => {
  const tc = s.secs !== null && VID
    ? `<a class="tc" href="https://www.youtube.com/watch?v=${VID}&amp;t=${s.secs}s" target="_blank" rel="noopener noreferrer">${esc(s.timestamp)}</a>`
    : `<span class="tc">${esc(s.timestamp ?? "--")}</span>`
  const types = [...new Set((s.subjects ?? []).map((x) => x.subject_type))].join(" ")
  const hasNew = (s.subjects ?? []).some((x) => x.resolution !== "matched_existing")
  return `<li class="story${trimmable ? "" : " is-parked"}" data-i="${s.i}" data-types="${types}" data-new="${hasNew}">
${trimmable ? `<label class="check"><input type="checkbox" data-i="${s.i}"><span class="box" aria-hidden="true"></span><span class="sr">Trim this story</span></label>` : ""}
<div class="head">${tc}<h3>${esc(s.title)}</h3></div>
<p class="quote">${esc(s.excerpt)}</p>
${s.skip_reason ? `<p class="why">Parked under ${esc(s.activity ?? "unfiled")}: ${esc(s.skip_reason)}</p>` : ""}
<p class="cast">${(s.subjects ?? []).map(chip).join("")}</p>
</li>`
}

const epTitle = ep.episode_name ?? `Episode ${ep.episode_number ?? ""}`
const epLine = [ep.show_name, ep.episode_number != null ? `Episode ${ep.episode_number}` : null]
  .filter(Boolean).join(" &middot; ")

const html = `<title>${esc(epTitle)} story review</title>
<style>
:root{--bg:#fff;--surface:#f7f6f4;--raised:#fff;--line:#e6e2dc;--soft:#efece7;--ink:#1c1917;--ink2:#57534e;--ink3:#8a827b;--accent:#2563eb;
--person:#6d28d9;--place:#0d9488;--org:#0891b2;--event:#b45309;--board:#047857;
--personbg:#f6f2fe;--placebg:#effbf9;--orgbg:#edfafe;--eventbg:#fdf5e9;--boardbg:#effaf5}
@media(prefers-color-scheme:dark){:root{--bg:#161413;--surface:#1d1a19;--raised:#211e1c;--line:#332e2b;--soft:#2a2624;--ink:#f5f3f1;--ink2:#b5aca6;--ink3:#8a807a;--accent:#60a5fa;
--person:#a78bfa;--place:#2dd4bf;--org:#22d3ee;--event:#fbbf24;--board:#34d399;
--personbg:#221c33;--placebg:#102b2a;--orgbg:#0f2a33;--eventbg:#2e2314;--boardbg:#122a22}}
:root[data-theme="dark"]{--bg:#161413;--surface:#1d1a19;--raised:#211e1c;--line:#332e2b;--soft:#2a2624;--ink:#f5f3f1;--ink2:#b5aca6;--ink3:#8a807a;--accent:#60a5fa;
--person:#a78bfa;--place:#2dd4bf;--org:#22d3ee;--event:#fbbf24;--board:#34d399;
--personbg:#221c33;--placebg:#102b2a;--orgbg:#0f2a33;--eventbg:#2e2314;--boardbg:#122a22}
:root[data-theme="light"]{--bg:#fff;--surface:#f7f6f4;--raised:#fff;--line:#e6e2dc;--soft:#efece7;--ink:#1c1917;--ink2:#57534e;--ink3:#8a827b;--accent:#2563eb;
--person:#6d28d9;--place:#0d9488;--org:#0891b2;--event:#b45309;--board:#047857;
--personbg:#f6f2fe;--placebg:#effbf9;--orgbg:#edfafe;--eventbg:#fdf5e9;--boardbg:#effaf5}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:15px;line-height:1.55;-webkit-font-smoothing:antialiased}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.wrap{max-width:940px;margin:0 auto;padding:40px 20px 90px;display:flex;flex-direction:column;gap:30px}
.eyebrow{font-size:11px;font-weight:650;letter-spacing:.13em;text-transform:uppercase;color:var(--ink3);margin:0 0 10px}
h1{font-size:clamp(26px,4.4vw,38px);line-height:1.12;letter-spacing:-.022em;margin:0 0 12px;font-weight:750;text-wrap:balance}
.lede{margin:0;color:var(--ink2);max-width:64ch}.lede a{color:var(--accent)}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.tile{background:var(--raised);padding:15px 17px;display:flex;flex-direction:column;gap:2px}
.tile b{font-size:26px;font-weight:730;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1.1}
.tile span{font-size:12px;color:var(--ink3)}.tile-a b{color:var(--accent)}
.controls{display:flex;flex-wrap:wrap;gap:7px}
.chip{font:inherit;font-size:12.5px;font-weight:550;cursor:pointer;background:var(--surface);color:var(--ink2);border:1px solid var(--line);border-radius:999px;padding:6px 13px;transition:background .13s,color .13s,border-color .13s}
.chip:hover{color:var(--ink);border-color:var(--ink3)}
.chip[aria-pressed="true"]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.chip:focus-visible,.tc:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
h2{font-size:13px;font-weight:650;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);margin:0 0 6px;padding-bottom:10px;border-bottom:1px solid var(--line)}
.hint{font-size:13px;color:var(--ink3);margin:0 0 16px}
ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.story{position:relative;background:var(--raised);border:1px solid var(--soft);border-radius:11px;padding:16px 18px 16px 46px;transition:opacity .15s,background .15s}
.story.is-parked{padding-left:18px;opacity:.62}
.story[hidden]{display:none}
.story.trimmed{opacity:.4;background:var(--surface)}
.story.trimmed .quote{text-decoration:line-through;text-decoration-thickness:1px}
.check{position:absolute;left:15px;top:16px;cursor:pointer;display:block}
.check input{position:absolute;opacity:0;width:18px;height:18px;margin:0;cursor:pointer}
.box{display:block;width:18px;height:18px;border:1.5px solid var(--line);border-radius:5px;background:var(--bg);transition:background .13s,border-color .13s}
.check:hover .box{border-color:var(--ink3)}
.check input:checked+.box{background:var(--ink);border-color:var(--ink)}
.check input:checked+.box::after{content:"";display:block;width:4px;height:9px;border:solid var(--bg);border-width:0 2px 2px 0;transform:rotate(45deg);margin:2px 0 0 5.5px}
.check input:focus-visible+.box{outline:2px solid var(--accent);outline-offset:2px}
.head{display:flex;align-items:baseline;gap:11px;margin-bottom:7px;flex-wrap:wrap}
.tc{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;font-variant-numeric:tabular-nums;color:var(--accent);text-decoration:none;letter-spacing:-.02em}
.tc:hover{text-decoration:underline}
h3{font-size:15.5px;font-weight:650;letter-spacing:-.01em;margin:0;line-height:1.3}
.quote{margin:0 0 11px;color:var(--ink2);font-size:14px;line-height:1.6;max-width:74ch}
.quote::before{content:"\\201C"}.quote::after{content:"\\201D"}
.why{margin:-4px 0 10px;font-size:12px;color:var(--ink3)}
.cast{margin:0;display:flex;flex-wrap:wrap;gap:6px}
.sub{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;padding:3px 9px;border-radius:6px;border:1px solid transparent}
.sub i{width:7px;height:7px;border-radius:50%;flex:none}
.sub em{font-style:normal;font-weight:500;opacity:.6;font-size:10.5px;letter-spacing:.04em;text-transform:uppercase}
.sub.is-new{border-style:dashed;border-color:currentColor}
.sub.is-review{border-style:solid;border-color:currentColor;box-shadow:inset 0 0 0 1px currentColor}
.sub-person{color:var(--person);background:var(--personbg)}.sub-person i{background:var(--person)}
.sub-place{color:var(--place);background:var(--placebg)}.sub-place i{background:var(--place)}
.sub-org{color:var(--org);background:var(--orgbg)}.sub-org i{background:var(--org)}
.sub-event{color:var(--event);background:var(--eventbg)}.sub-event i{background:var(--event)}
.sub-board{color:var(--board);background:var(--boardbg)}.sub-board i{background:var(--board)}
.bar{position:sticky;bottom:0;margin-top:8px;background:var(--raised);border:1px solid var(--line);border-radius:11px;padding:13px 16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;box-shadow:0 -2px 14px rgba(0,0,0,.05)}
.bar p{margin:0;font-size:13.5px;color:var(--ink2);flex:1;min-width:180px}
.bar b{color:var(--ink);font-variant-numeric:tabular-nums}
.btn{font:inherit;font-size:13px;font-weight:600;cursor:pointer;border-radius:8px;padding:8px 15px;border:1px solid var(--ink);background:var(--ink);color:var(--bg);transition:opacity .13s}
.btn:hover{opacity:.85}.btn:disabled{opacity:.35;cursor:default}
.btn-ghost{background:transparent;color:var(--ink2);border-color:var(--line)}
.btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
footer{border-top:1px solid var(--line);padding-top:20px;font-size:13px;color:var(--ink3)}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;background:var(--surface);border:1px solid var(--line);border-radius:4px;padding:1px 5px}
@media(max-width:560px){.story{padding:14px 14px 14px 42px}.story.is-parked{padding-left:14px}}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
<div class="wrap">
<header>
<p class="eyebrow">${epLine}</p>
<h1>${esc(epTitle)}</h1>
<p class="lede">${live.length} stories from the transcript, in episode order. Each one carries its whole cast, so the story lands intact on every person, place and brand in it. Tick a box to trim a story, then copy the list back to Claude.${VID ? ` <a href="https://www.youtube.com/watch?v=${VID}" target="_blank" rel="noopener noreferrer">Watch the episode</a>` : ""}</p>
</header>
<div class="tiles">
<div class="tile"><b>${live.length}</b><span>stories</span></div>
<div class="tile"><b>${liveSubs.length}</b><span>draft mentions</span></div>
<div class="tile tile-a"><b>${newSet.size}</b><span>new nodes created</span></div>
<div class="tile"><b>${matchSet.size}</b><span>matched in catalog</span></div>
${reviewSet.size ? `<div class="tile"><b>${reviewSet.size}</b><span>need a decision</span></div>` : ""}
</div>
<section>
<h2>The episode, story by story</h2>
<p class="hint">A dashed chip is an entity Linestry does not have yet and would create. A double-outlined chip is a near miss the importer refuses until someone picks: it looks like something already in the catalog. Plain chips already exist.</p>
<div class="controls" role="group" aria-label="Filter stories">
<button class="chip" data-f="all" aria-pressed="true">All</button>
<button class="chip" data-f="new" aria-pressed="false">Creates something new</button>
<button class="chip" data-f="person" aria-pressed="false">Riders</button>
<button class="chip" data-f="place" aria-pressed="false">Places</button>
<button class="chip" data-f="org" aria-pressed="false">Brands</button>
<button class="chip" data-f="event" aria-pressed="false">Events</button>
</div>
<ol id="list" style="margin-top:16px">
${live.map((s) => card(s, true)).join("\n")}
</ol>
</section>
${parked.length ? `<section>
<h2>Parked, not lost &middot; ${parked.length}</h2>
<p class="hint">Trimmed from this import but kept in the seed with their timecode and quote, so this episode never needs transcribing again.</p>
<ol>
${parked.map((s) => card(s, false)).join("\n")}
</ol>
</section>` : ""}
<div class="bar">
<p id="status">Nothing trimmed. <b>${live.length}</b> stories, <b>${liveSubs.length}</b> mentions will import.</p>
<button class="btn btn-ghost" id="clear" disabled>Clear</button>
<button class="btn" id="copy" disabled>Copy trim list</button>
</div>
<footer><p style="margin:0">Generated from <code>${esc(seedArg)}</code> by the <code>podcast-mentions</code> skill. Nothing here is live: import lands every row as a draft, editor-only until you publish it from the episode page.</p></footer>
</div>
<script>
const DATA=${JSON.stringify(live.map((s) => ({ i: s.i, t: s.timestamp, title: s.title, n: (s.subjects ?? []).length })))};
const list=document.getElementById("list"),status=document.getElementById("status");
const copyBtn=document.getElementById("copy"),clearBtn=document.getElementById("clear");
const trimmed=new Set();
function sync(){
  let rows=0,keep=0;
  DATA.forEach(d=>{if(!trimmed.has(d.i)){keep++;rows+=d.n}});
  status.innerHTML=trimmed.size?\`<b>\${trimmed.size}</b> trimmed. <b>\${keep}</b> stories, <b>\${rows}</b> mentions will import.\`
    :\`Nothing trimmed. <b>\${keep}</b> stories, <b>\${rows}</b> mentions will import.\`;
  copyBtn.disabled=clearBtn.disabled=trimmed.size===0;
  copyBtn.textContent="Copy trim list";
}
list.addEventListener("change",e=>{
  const cb=e.target.closest("input[type=checkbox]");if(!cb)return;
  const i=+cb.dataset.i;
  cb.checked?trimmed.add(i):trimmed.delete(i);
  cb.closest(".story").classList.toggle("trimmed",cb.checked);
  sync();
});
copyBtn.addEventListener("click",async()=>{
  const text="Trim these stories from the seed:\\n"+DATA.filter(d=>trimmed.has(d.i)).map(d=>\`- \${d.t} \${d.title}\`).join("\\n");
  try{await navigator.clipboard.writeText(text);copyBtn.textContent="Copied";setTimeout(()=>copyBtn.textContent="Copy trim list",1600)}
  catch{copyBtn.textContent="Press Cmd+C";const p=document.createElement("pre");p.textContent=text;document.body.appendChild(p);
    const r=document.createRange();r.selectNode(p);getSelection().removeAllRanges();getSelection().addRange(r)}
});
clearBtn.addEventListener("click",()=>{
  trimmed.clear();
  list.querySelectorAll("input[type=checkbox]").forEach(c=>{c.checked=false;c.closest(".story").classList.remove("trimmed")});
  sync();
});
const chips=[...document.querySelectorAll(".chip")];
chips.forEach(chip=>chip.addEventListener("click",()=>{
  const f=chip.dataset.f;chips.forEach(c=>c.setAttribute("aria-pressed",String(c===chip)));
  [...list.children].forEach(li=>{
    li.hidden=!(f==="all"||(f==="new"&&li.dataset.new==="true")||li.dataset.types.split(" ").includes(f));
  });
}));
</script>`

writeFileSync(OUT, html, "utf8")
console.log(`Review page: ${OUT}`)
console.log(`${live.length} stories, ${liveSubs.length} mentions, ${newSet.size} new nodes, ${parked.length} parked.`)
