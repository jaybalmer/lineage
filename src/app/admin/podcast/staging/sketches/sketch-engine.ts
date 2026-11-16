// Podcast archive sketches: the drawing engine (brief Part B, B6 "port, do not
// redesign").
//
// A close port of podcast_archive/scripts/viz-template.html: the same four
// views (Constellation, Loom, Path, Map) and the same side panel, as one
// imperative module that owns a root element. React mounts it, hands it the
// data, and calls the returned cleanup on unmount. Changes from the template:
//   - every id is prefixed `sk-` and every lookup is scoped to the root;
//   - colors come from the app's theme tokens and the entity palette (the
//     `.sk-root` rules in sketches.css), read off the root, not :root;
//   - canvas text uses the app's body font, read off the root;
//   - dark mode follows the app's `.dark` class on <html>;
//   - stories have no years until the dating pass lands in staging (Part C),
//     so the Loom, Path and sparkline say so instead of drawing empty axes;
//   - trimmed stories, when shown, draw dimmed with a "Trimmed" label.

import * as d3 from "d3"
import { feature } from "topojson-client"
import type { Topology, GeometryCollection } from "topojson-specification"

export type EngineNode = { name: string; t: number; eps: number; st: number; id: string; decision: string; trimmedOnly: boolean }
export type EngineStory = { ep: number; ts: number; title: string; ex: string; ids: number[]; ys: number[]; decision: string; id: string }
export type EngineData = {
  N: EngineNode[]
  S: EngineStory[]
  /** [title, archive label, air date, video id, staging episode id] */
  E: [string, string, string, string, string][]
  meta: { episodes: number; stories_with_year: number; trimmed_shown: boolean; host_shown: boolean }
}
export type MapAssets = { land: Topology; coords: Record<string, [number, number]> }

type Node = EngineNode & { i: number; stories: Story[]; years: Record<number, number>; _m?: number; px?: number; py?: number }
type Story = Omit<EngineStory, never> & { i: number }
type Sim = d3.Simulation<SimNode, undefined>
type SimNode = d3.SimulationNodeDatum & { n: Node; r: number; x: number; y: number }
type SimLink = { source: SimNode | number; target: SimNode | number; w: number }
type View = "net" | "loom" | "path" | "map"

const TN = ["Person", "Place", "Brand or shop", "Event", "Board"]
const TN_PLURAL = ["People", "Places", "Brands and shops", "Events", "Boards"]
const TV = ["--person", "--place", "--org", "--event", "--board"]
const Y0 = 1975
const Y1 = 2025

const MARKUP = `
<div class="sk-bar">
 <button class="sk-tab" id="sk-tab-net" aria-pressed="true">Constellation</button>
 <button class="sk-tab" id="sk-tab-loom" aria-pressed="false">Loom</button>
 <button class="sk-tab" id="sk-tab-path" aria-pressed="false">Path</button>
 <button class="sk-tab" id="sk-tab-map" aria-pressed="false">Map</button>
 <span id="sk-types"></span>
 <label for="sk-count">Threads <input type="range" id="sk-count" min="30" max="400" step="10" value="140"><span id="sk-countv">140</span></label>
 <input type="search" id="sk-q" placeholder="Find a person, place, brand" list="sk-names" autocomplete="off" aria-label="Find a thread"><datalist id="sk-names"></datalist>
</div>
<p class="sk-sub" id="sk-sub"></p>
<div class="sk-main">
 <div id="sk-stage"><canvas id="sk-net"></canvas><div id="sk-loomwrap"><svg id="sk-loom" role="img" aria-label="Loom: threads by year"></svg><p class="sk-note" id="sk-loomnote"></p></div><div id="sk-pathwrap"><svg id="sk-path" role="img" aria-label="One thread's path: connections by year"></svg><p class="sk-note" id="sk-pathnote"></p></div><canvas id="sk-map"></canvas><div id="sk-mapui"></div><div id="sk-tip"></div></div>
 <aside id="sk-panel" aria-live="polite"></aside>
</div>`

const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string)

/** Mount the sketches into `root`. Returns a cleanup function. */
export function mountSketches(root: HTMLElement, D: EngineData, loadMap: () => Promise<MapAssets>): () => void {
  root.innerHTML = MARKUP
  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector(s) as T
  const css = (v: string) => getComputedStyle(root).getPropertyValue(v).trim()
  const FONT = getComputedStyle(root).fontFamily || "system-ui, sans-serif"
  const cleanups: (() => void)[] = []
  let disposed = false
  const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement | Element, ev: K, fn: (e: HTMLElementEventMap[K]) => void) => {
    el.addEventListener(ev, fn as EventListener)
  }

  const N: Node[] = D.N.map((n, i) => ({ ...n, i, stories: [], years: {} }))
  const S: Story[] = D.S.map((s, i) => ({ ...s, i }))
  S.forEach((s) => s.ids.forEach((id) => { const n = N[id]; n.stories.push(s); s.ys.forEach((y) => (n.years[y] = (n.years[y] || 0) + 1)) }))
  const anyYears = D.meta.stories_with_year > 0

  const state: { view: View; types: boolean[]; count: number; sel: number | null; year: number | null; pair: number | null } = {
    view: "net", types: [true, true, true, true, true], count: 140, sel: null, year: null, pair: null,
  }
  $("#sk-sub").textContent =
    `${D.meta.episodes} FNRad episodes, ${S.length.toLocaleString()} stories, ${N.length.toLocaleString()} people, places, brands, events and boards that appear in two or more episodes. Drawn live from staging` +
    `${D.meta.trimmed_shown ? ", trimmed stories included and dimmed" : ", trimmed stories left out"}${D.meta.host_shown ? "" : ", host left out"}.`
  $("#sk-names").innerHTML = N.slice(0, 1200).map((n) => `<option value="${esc(n.name)}">`).join("")
  $("#sk-types").innerHTML = TN.map((t, i) => `<button class="sk-chipbtn sk-t${i}" data-type="${i}" aria-pressed="true"><span class="sk-dot"></span>${t}</button>`).join(" ")
  const shown = () => N.filter((n) => state.types[n.t]).slice(0, state.count)
  const neighbors = (n: Node, limit?: number) => {
    const c = new Map<number, number>()
    n.stories.forEach((s) => s.ids.forEach((id) => { if (id !== n.i) c.set(id, (c.get(id) || 0) + 1) }))
    return [...c].sort((a, b) => b[1] - a[1]).slice(0, limit || 400)
  }

  /* ---------- constellation ---------- */
  const cv = $<HTMLCanvasElement>("#sk-net")
  const cx = cv.getContext("2d") as CanvasRenderingContext2D
  let nodes: SimNode[] = [], links: SimLink[] = [], tr = d3.zoomIdentity, sim: Sim | null = null, hover: SimNode | null = null, W = 0, H = 0, dpr = 1
  const ep = (l: SimLink, k: "source" | "target") => l[k] as SimNode
  function buildNet() {
    const set = shown(), ix = new Map(set.map((n, k) => [n.i, k]))
    const pair = new Map<string, number>()
    S.forEach((s) => {
      const a = s.ids.filter((id) => ix.has(id))
      for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) { const k = a[i] < a[j] ? a[i] + "|" + a[j] : a[j] + "|" + a[i]; pair.set(k, (pair.get(k) || 0) + 1) }
    })
    const per = new Map<number, [string, number][]>()
    pair.forEach((w, k) => { const [a, b] = k.split("|").map(Number); [a, b].forEach((x) => { if (!per.has(x)) per.set(x, []); per.get(x)!.push([k, w]) }) })
    const keep = new Set<string>()
    per.forEach((l) => l.sort((a, b) => b[1] - a[1]).slice(0, 4).forEach((e) => { if (e[1] >= 2) keep.add(e[0]) }))
    const old = new Map(nodes.map((d) => [d.n.i, d]))
    nodes = set.map((n) => { const o = old.get(n.i); return { n, r: 3 + Math.sqrt(n.eps) * 1.25, x: o ? o.x : W / 2 + (Math.random() - 0.5) * 300, y: o ? o.y : H / 2 + (Math.random() - 0.5) * 300 } })
    const nix = new Map(nodes.map((d, k) => [d.n.i, k]))
    links = [...keep].map((k) => { const [a, b] = k.split("|").map(Number); return { source: nix.get(a)!, target: nix.get(b)!, w: pair.get(k)! } })
    if (sim) sim.stop()
    sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink<SimNode, SimLink>(links).distance((l) => 130 - Math.min(70, l.w * 2)).strength((l) => Math.min(0.9, 0.08 + l.w / 60)))
      .force("charge", d3.forceManyBody().strength(-260)).force("x", d3.forceX(W / 2).strength(0.03)).force("y", d3.forceY(H / 2).strength(0.045))
      .force("collide", d3.forceCollide<SimNode>((d) => d.r + 9)).on("tick", drawNet)
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { sim.stop(); sim.tick(250); drawNet() }
  }
  function sizeNet() { const b = $("#sk-stage").getBoundingClientRect(); dpr = devicePixelRatio || 1; W = b.width; H = b.height; cv.width = W * dpr; cv.height = H * dpr }
  function drawNet() {
    if (state.view !== "net") return
    const fg = css("--fg"), mut = css("--mut"), bg = css("--bg"), cols = TV.map(css)
    cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, W, H); cx.translate(tr.x, tr.y); cx.scale(tr.k, tr.k)
    const sel = state.sel, nb = sel != null ? new Set(neighbors(N[sel]).map((x) => x[0])) : null
    const lit = (d: SimNode) => sel == null || d.n.i === sel || nb!.has(d.n.i)
    links.forEach((l) => {
      const s = ep(l, "source"), t = ep(l, "target"), a = sel != null && (s.n.i === sel || t.n.i === sel)
      cx.globalAlpha = sel == null ? 0.22 : a ? 0.7 : 0.05; cx.strokeStyle = a ? fg : mut; cx.lineWidth = Math.min(4, 0.5 + l.w / 12) / Math.sqrt(tr.k)
      cx.beginPath(); cx.moveTo(s.x, s.y); cx.lineTo(t.x, t.y); cx.stroke()
    })
    nodes.forEach((d) => {
      cx.globalAlpha = (lit(d) ? 1 : 0.15) * (d.n.trimmedOnly ? 0.35 : 1); cx.beginPath(); cx.arc(d.x, d.y, d.r, 0, 6.3); cx.fillStyle = cols[d.n.t]; cx.fill(); cx.lineWidth = 2 / tr.k; cx.strokeStyle = bg; cx.stroke()
      if (d.n.i === sel || d === hover) { cx.lineWidth = 2 / tr.k; cx.strokeStyle = fg; cx.beginPath(); cx.arc(d.x, d.y, d.r + 3 / tr.k, 0, 6.3); cx.stroke() }
    })
    cx.textAlign = "center"; cx.textBaseline = "top"
    const labelMin = sel == null ? Math.max(8, 48 / tr.k) : 0
    nodes.forEach((d) => {
      const show = d === hover || d.n.i === sel || (sel == null ? d.n.eps >= labelMin : nb!.has(d.n.i) && d.n.eps >= Math.max(4, 14 / tr.k))
      if (!show) return
      cx.globalAlpha = 1; cx.font = `${d.n.i === sel ? 700 : 500} ${11 / tr.k}px ${FONT}`; cx.lineWidth = 3 / tr.k; cx.strokeStyle = bg
      cx.strokeText(d.n.name, d.x, d.y + d.r + 2 / tr.k); cx.fillStyle = fg; cx.fillText(d.n.name, d.x, d.y + d.r + 2 / tr.k)
    })
    cx.globalAlpha = 1
  }
  function pick(ev: MouseEvent) {
    const b = cv.getBoundingClientRect(), x = (ev.clientX - b.left - tr.x) / tr.k, y = (ev.clientY - b.top - tr.y) / tr.k
    let best: SimNode | null = null, bd = 1e9
    nodes.forEach((d) => { const q = Math.hypot(d.x - x, d.y - y) - d.r; if (q < 6 / tr.k && q < bd) { bd = q; best = d } })
    return best as SimNode | null
  }
  const zm = d3.zoom<HTMLCanvasElement, unknown>().scaleExtent([0.25, 6]).on("zoom", (e) => { tr = e.transform; drawNet() })
  d3.select(cv).call(zm)
  on(cv, "mousemove", (e) => { const d = pick(e); if (d !== hover) { hover = d; drawNet() } cv.style.cursor = d ? "pointer" : "grab"; tip(d ? `${d.n.name}: ${d.n.eps} episodes, ${d.n.st} stories` : null, e) })
  on(cv, "mouseleave", () => { hover = null; tip(null); drawNet() })
  on(cv, "click", (e) => { const d = pick(e); select(d ? d.n.i : null) })
  function tip(t: string | null, e?: MouseEvent) {
    const el = $("#sk-tip")
    if (!t || !e) { el.style.display = "none"; return }
    const b = $("#sk-stage").getBoundingClientRect(); el.textContent = t; el.style.display = "block"
    el.style.left = Math.min(b.width - 270, e.clientX - b.left + 14) + "px"; el.style.top = e.clientY - b.top + 14 + "px"
  }

  // Until the dating pass is loaded into staging there are no story years at
  // all. Say so in the wrapping note under the (emptied) drawing.
  function noDates(sv: SVGSVGElement, note: HTMLElement, what: string) {
    sv.setAttribute("width", "0"); sv.setAttribute("height", "0"); sv.removeAttribute("viewBox"); sv.innerHTML = ""
    note.textContent = `No dates loaded yet. ${what}`
  }

  /* ---------- loom ---------- */
  function drawLoom() {
    const sv = $<SVGSVGElement>("#sk-loom")
    if (!anyYears) {
      noDates(sv, $("#sk-loomnote"), "The Loom places stories by year, and staging stories have no years until the dating pass is loaded.")
      return
    }
    const rows = shown().filter((n) => Object.keys(n.years).length).slice(0, Math.min(state.count, 120))
    const med = (n: Node) => { const a: number[] = []; for (const y in n.years) for (let k = 0; k < n.years[y]; k++) a.push(+y); a.sort((p, q) => p - q); return a[a.length >> 1] }
    rows.forEach((n) => (n._m = med(n))); rows.sort((a, b) => a._m! - b._m! || b.eps - a.eps)
    const L = 190, cw = 15, rh = 17, top = 64, Wd = L + (Y1 - Y0 + 1) * cw + 20, Hd = top + rows.length * rh + 10
    const tot: Record<number, number> = {}; S.forEach((s) => s.ys.forEach((y) => (tot[y] = (tot[y] || 0) + 1))); const tm = Math.max(1, ...Object.values(tot))
    let h = `<g font-family="${esc(FONT)}" font-size="11">`
    for (let y = Y0; y <= Y1; y++) {
      const x = L + (y - Y0) * cw, bh = ((tot[y] || 0) / tm) * 36
      h += `<rect class="yr" data-y="${y}" x="${x + 1}" y="${top - 14 - bh}" width="${cw - 2}" height="${bh}" rx="2" fill="var(--mut)" opacity="${state.year === y ? 1 : 0.55}" style="cursor:pointer"><title>${y}: ${tot[y] || 0} stories mention this year</title></rect>`
      if (y % 5 === 0) h += `<text x="${x + cw / 2}" y="${top - 2}" text-anchor="middle" fill="var(--mut)">${y}</text><line x1="${x + cw / 2}" x2="${x + cw / 2}" y1="${top + 2}" y2="${Hd}" stroke="var(--line)"/>`
    }
    rows.forEach((n, r) => {
      const y = top + 6 + r * rh, mx = Math.max(...Object.values(n.years))
      h += `<text class="rowl" data-n="${n.i}" x="${L - 8}" y="${y + rh / 2 + 1}" text-anchor="end" dominant-baseline="middle" fill="var(--fg)" font-weight="${state.sel === n.i ? 700 : 300}" style="cursor:pointer">${esc(n.name.length > 28 ? n.name.slice(0, 27) + "…" : n.name)}</text>`
      h += `<line x1="${L}" x2="${Wd - 20}" y1="${y + rh / 2}" y2="${y + rh / 2}" stroke="var(${TV[n.t]})" opacity=".25"/>`
      for (const yk in n.years) {
        const yy = +yk
        if (yy < Y0 || yy > Y1) continue
        const c = n.years[yy], x = L + (yy - Y0) * cw
        h += `<rect class="cell" data-n="${n.i}" data-y="${yy}" x="${x + 1}" y="${y + 2}" width="${cw - 2}" height="${rh - 4}" rx="3" fill="var(${TV[n.t]})" opacity="${(0.3 + (0.7 * c) / mx).toFixed(2)}" style="cursor:pointer"><title>${esc(n.name)}, ${yy}: ${c} ${c > 1 ? "stories" : "story"}</title></rect>`
      }
    })
    h += "</g>"; sv.setAttribute("width", String(Wd)); sv.setAttribute("height", String(Hd)); sv.setAttribute("viewBox", `0 0 ${Wd} ${Hd}`); sv.innerHTML = h
    $("#sk-loomnote").textContent = `Each row is a thread, ordered by the middle year of its stories. A filled cell means stories that mention both the thread and that year. Only ${D.meta.stories_with_year.toLocaleString()} of ${S.length.toLocaleString()} stories have a year. The bars along the top count all stories per year.`
  }
  on($("#sk-loom"), "click", (e) => {
    const t = e.target as SVGElement & { dataset: DOMStringMap }
    if (t.classList.contains("cell")) { state.year = +t.dataset.y!; select(+t.dataset.n!, true) }
    else if (t.classList.contains("rowl")) { state.year = null; select(+t.dataset.n!) }
    else if (t.classList.contains("yr")) { state.year = +t.dataset.y!; state.sel = null; render() }
  })

  /* ---------- path: one thread, its connections by year ---------- */
  type Co = { id: number; total: number; dated: number; y: Record<number, number>; first?: number; last?: number; ds?: number[] }
  function coOf(n: Node) {
    const co = new Map<number, Co>()
    n.stories.forEach((s) => s.ids.forEach((id) => {
      if (id === n.i) return
      let c = co.get(id); if (!c) { c = { id, total: 0, dated: 0, y: {} }; co.set(id, c) }
      c.total++; if (s.ys.length) { c.dated++; s.ys.forEach((y) => (c!.y[y] = (c!.y[y] || 0) + 1)) }
    }))
    return co
  }
  function drawPath() {
    const sv = $<SVGSVGElement>("#sk-path")
    const msg = (inner: string) => { sv.setAttribute("width", "720"); sv.setAttribute("height", "60"); sv.removeAttribute("viewBox"); sv.innerHTML = inner; $("#sk-pathnote").textContent = "" }
    if (state.sel == null) { msg(`<text x="0" y="30" fill="var(--mut)" font-family="${esc(FONT)}" font-size="14">Pick a rider, brand or place from the list on the right to see its path.</text>`); return }
    const n = N[state.sel], co = coOf(n), K = [12, 9, 9, 6, 5]
    if (!anyYears) { noDates(sv, $("#sk-pathnote"), `The Path draws ${n.name} year by year once story years are in staging.`); return }
    const ys = Object.keys(n.years).map(Number).filter((y) => y >= 1968 && y <= 2026)
    if (!ys.length) { msg(`<text x="0" y="30" fill="var(--mut)" font-family="${esc(FONT)}" font-size="14">None of the stories about ${esc(n.name)} have a year, so there is no path to draw yet.</text>`); return }
    const a = Math.min(...ys) - 1, b = Math.max(...ys) + 1, L = 210
    const cw = Math.max(13, Math.min(22, Math.floor(($("#sk-stage").clientWidth - L - 110) / (b - a + 1)))), rh = 20, X = (y: number) => L + (y - a + 0.5) * cw, Wd = L + (b - a + 1) * cw + 90
    let y0 = 74, h = `<g font-family="${esc(FONT)}" font-size="11">`
    const mx = Math.max(...Object.values(n.years))
    for (let y = a; y <= b; y++) if (y % 5 === 0) h += `<text x="${X(y)}" y="12" text-anchor="middle" fill="var(--mut)">${y}</text>`
    h += `<text x="${L - 10}" y="46" text-anchor="end" fill="var(--fg)" font-weight="700" font-size="13">${esc(n.name)}</text><line x1="${X(a)}" x2="${X(b)}" y1="50" y2="50" stroke="var(${TV[n.t]})" stroke-width="2"/>`
    for (let y = a; y <= b; y++) { const c = n.years[y] || 0; if (c) { const bh = 4 + (c / mx) * 26; h += `<rect class="py" data-y="${y}" x="${X(y) - cw / 2 + 1.5}" y="${50 - bh}" width="${cw - 3}" height="${bh}" rx="3" fill="var(${TV[n.t]})" style="cursor:pointer"><title>${y}: ${c} ${c > 1 ? "stories" : "story"} about ${esc(n.name)}</title></rect>` } }
    h += `<text x="${Wd - 80}" y="46" fill="var(--mut)">no year</text>`
    let body = ""
    const active: Record<number, number> = {}
    TN_PLURAL.forEach((nm, t) => {
      if (!state.types[t]) return
      const ls = [...co.values()].filter((c) => N[c.id].t === t).sort((p, q) => q.total - p.total).slice(0, K[t])
      if (!ls.length) return
      ls.forEach((c) => { const d = Object.keys(c.y).map(Number).filter((y) => y >= a && y <= b); c.first = d.length ? Math.min(...d) : 9999; c.last = d.length ? Math.max(...d) : 0; c.ds = d })
      ls.sort((p, q) => p.first! - q.first! || q.total - p.total)
      body += `<text x="0" y="${y0 + 13}" fill="var(--mut)" font-weight="700">${nm}</text>`; y0 += 20
      ls.forEach((c) => {
        const m = N[c.id], cy = y0 + rh / 2, mxc = Math.max(1, ...Object.values(c.y))
        body += `<text class="pl" data-n="${c.id}" x="${L - 10}" y="${cy + 1}" text-anchor="end" dominant-baseline="middle" fill="var(--fg)" font-weight="${state.pair === c.id ? 700 : 300}" style="cursor:pointer">${esc(m.name.length > 30 ? m.name.slice(0, 29) + "…" : m.name)}</text>`
        if (c.ds!.length) body += `<line x1="${X(c.first!)}" x2="${X(c.last!)}" y1="${cy}" y2="${cy}" stroke="var(${TV[t]})" stroke-width="2" opacity=".45"/>`
        c.ds!.forEach((y) => { active[y] = Math.max(active[y] || 0, cy); body += `<circle class="pd" data-n="${c.id}" data-y="${y}" cx="${X(y)}" cy="${cy}" r="${(3.5 + (3.5 * c.y[y]) / mxc).toFixed(1)}" fill="var(${TV[t]})" stroke="var(--bg)" stroke-width="2" style="cursor:pointer"><title>${esc(n.name)} and ${esc(m.name)}, ${y}: ${c.y[y]} ${c.y[y] > 1 ? "stories" : "story"}</title></circle>` })
        const und = c.total - c.dated
        body += `<text class="pl" data-n="${c.id}" x="${Wd - 80}" y="${cy + 1}" dominant-baseline="middle" fill="var(--mut)" style="cursor:pointer;font-variant-numeric:tabular-nums">${und ? und + " more" : ""}</text>`; y0 += rh
      })
      y0 += 8
    })
    let weave = ""
    for (const y in active) weave += `<line x1="${X(+y)}" x2="${X(+y)}" y1="52" y2="${active[y]}" stroke="var(--line)"/>`
    h += weave + body + "</g>"; sv.setAttribute("width", String(Wd)); sv.setAttribute("height", String(y0 + 10)); sv.setAttribute("viewBox", `0 0 ${Wd} ${y0 + 10}`); sv.innerHTML = h
    const dated = n.stories.filter((s) => s.ys.length).length
    $("#sk-pathnote").textContent = `The bar row is ${n.name}: stories per year. Below it, each line is someone or something told in the same stories, starting at the first year they are told together. A dot is a year with shared stories. Only ${dated} of ${n.stories.length} stories about ${n.name} have a year; "more" counts the shared stories that do not.`
  }
  on($("#sk-path"), "click", (e) => {
    const t = e.target as SVGElement & { dataset: DOMStringMap }
    if (t.classList.contains("pd")) { state.pair = +t.dataset.n!; state.year = +t.dataset.y!; lim = 25; render() }
    else if (t.classList.contains("pl")) { state.pair = +t.dataset.n!; state.year = null; lim = 25; render() }
    else if (t.classList.contains("py")) { state.pair = null; state.year = +t.dataset.y!; lim = 25; render() }
  })

  /* ---------- map ---------- */
  const mc = $<HTMLCanvasElement>("#sk-map")
  const mx2 = mc.getContext("2d") as CanvasRenderingContext2D
  type MapPt = { n: Node; v: number; x: number; y: number; r: number }
  let mtr = d3.zoomIdentity, landPath: Path2D | null = null, proj: d3.GeoProjection | null = null, mpts: MapPt[] = [], mhover: MapPt | null = null
  let PLACES: Node[] = [], mapLoading = false
  const VIEWS: Record<string, [[number, number], [number, number]]> = {
    World: [[-170, -50], [180, 72]], "North America": [[-165, 25], [-55, 66]], "Pacific Northwest": [[-126.5, 44.5], [-113.5, 52.3]],
    Tahoe: [[-121.3, 38.2], [-119.3, 39.7]], Rockies: [[-112.5, 36.8], [-104, 41.5]], East: [[-82, 41.5], [-69, 48]], Alps: [[4, 44.5], [14, 48.5]], Japan: [[129, 31], [146, 45.5]],
  }
  async function initMap(): Promise<boolean> {
    if (proj) return false
    if (mapLoading) return false
    mapLoading = true
    const { land, coords } = await loadMap()
    if (disposed) return false
    proj = d3.geoMercator().scale(160).translate([0, 0])
    const geo = feature(land, land.objects.land as GeometryCollection)
    landPath = new Path2D(d3.geoPath(proj)(geo) ?? "")
    PLACES = N.filter((n) => n.t === 1 && coords[n.name])
    PLACES.forEach((n) => { const c = coords[n.name], p = proj!([c[1], c[0]])!; n.px = p[0]; n.py = p[1] })
    $("#sk-mapui").innerHTML = Object.keys(VIEWS).map((v) => `<button class="sk-tab" data-view="${v}">${v}</button>`).join("")
    const nt = document.createElement("p"); nt.className = "sk-note"; nt.id = "sk-mapnote"
    nt.textContent = `${PLACES.length} of ${N.filter((n) => n.t === 1).length} places are on the map. Coordinates were entered by hand, so positions are approximate. With a rider selected, dots are sized by stories told with them.`
    $("#sk-stage").appendChild(nt)
    return true
  }
  const mzoom = d3.zoom<HTMLCanvasElement, unknown>().scaleExtent([0.5, 900]).on("zoom", (e) => { mtr = e.transform; drawMap() })
  d3.select(mc).call(mzoom)
  function fly(name: string) {
    if (!proj) return
    const v = VIEWS[name], p0 = proj(v[0])!, p1 = proj(v[1])!, b = $("#sk-stage").getBoundingClientRect()
    const w = Math.abs(p1[0] - p0[0]), h = Math.abs(p1[1] - p0[1]), k = Math.min(b.width / w, b.height / h) * 0.92, cxm = (p0[0] + p1[0]) / 2, cym = (p0[1] + p1[1]) / 2
    d3.select(mc).call(mzoom.transform, d3.zoomIdentity.translate(b.width / 2 - cxm * k, b.height / 2 - cym * k).scale(k))
  }
  on($("#sk-mapui"), "click", (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>("[data-view]"); if (b) fly(b.dataset.view!) })
  function drawMap() {
    if (state.view !== "map" || !proj || !landPath) return
    const b = $("#sk-stage").getBoundingClientRect(), d = devicePixelRatio || 1
    if (mc.width !== Math.round(b.width * d) || mc.height !== Math.round(b.height * d)) { mc.width = b.width * d; mc.height = b.height * d }
    const fg = css("--fg"), bg = css("--bg"), sur = css("--sur"), line = css("--line"), col = css("--place"), k = mtr.k
    mx2.setTransform(d, 0, 0, d, 0, 0); mx2.fillStyle = bg; mx2.fillRect(0, 0, b.width, b.height); mx2.save(); mx2.translate(mtr.x, mtr.y); mx2.scale(k, k)
    mx2.fillStyle = sur; mx2.fill(landPath); mx2.lineWidth = 1 / k; mx2.strokeStyle = line; mx2.stroke(landPath); mx2.restore()
    const sel = state.sel != null ? N[state.sel] : null
    let w: Map<number, number> | null = null
    if (sel && sel.t !== 1) { w = new Map(); sel.stories.forEach((s) => s.ids.forEach((id) => { if (N[id].t === 1) w!.set(id, (w!.get(id) || 0) + 1) })) }
    mpts = PLACES.map((n) => { const v = w ? w.get(n.i) || 0 : n.eps; return { n, v, x: n.px! * k + mtr.x, y: n.py! * k + mtr.y, r: v ? (w ? 3 + Math.sqrt(v) * 2.6 : 2.5 + Math.sqrt(v) * 1.15) : 2 } })
      .filter((p) => p.x > -30 && p.y > -30 && p.x < b.width + 30 && p.y < b.height + 30).sort((p, q) => q.v - p.v)
    ;[...mpts].reverse().forEach((p) => {
      mx2.globalAlpha = (p.v ? (w ? 0.9 : 0.8) : 0.25) * (p.n.trimmedOnly ? 0.4 : 1); mx2.beginPath(); mx2.arc(p.x, p.y, p.r, 0, 6.3); mx2.fillStyle = p.v ? col : css("--mut"); mx2.fill(); mx2.lineWidth = 1.5; mx2.strokeStyle = bg; mx2.stroke()
      if (p === mhover || (sel && sel.i === p.n.i) || state.pair === p.n.i) { mx2.globalAlpha = 1; mx2.strokeStyle = fg; mx2.lineWidth = 2; mx2.beginPath(); mx2.arc(p.x, p.y, p.r + 3, 0, 6.3); mx2.stroke() }
    })
    mx2.globalAlpha = 1; mx2.font = `500 11px ${FONT}`; mx2.textBaseline = "middle"
    const boxes: number[][] = []
    let count = 0
    mpts.forEach((p) => {
      if (!p.v && p !== mhover) return
      if (count > 60 && p !== mhover) return
      const tw = mx2.measureText(p.n.name).width, bx = [p.x + p.r + 4, p.y - 7, tw, 14]
      if (p !== mhover && boxes.some((q) => bx[0] < q[0] + q[2] + 4 && bx[0] + bx[2] + 4 > q[0] && bx[1] < q[1] + q[3] && bx[1] + bx[3] > q[1])) return
      boxes.push(bx); count++; mx2.lineWidth = 3; mx2.strokeStyle = bg; mx2.strokeText(p.n.name, bx[0], p.y); mx2.fillStyle = fg; mx2.fillText(p.n.name, bx[0], p.y)
    })
  }
  function mpick(e: MouseEvent) {
    const b = mc.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top
    let best: MapPt | null = null, bd = 1e9
    mpts.forEach((p) => { const q = Math.hypot(p.x - x, p.y - y) - p.r; if (q < 5 && q < bd) { bd = q; best = p } })
    return best as MapPt | null
  }
  on(mc, "mousemove", (e) => {
    const p = mpick(e); if (p !== mhover) { mhover = p; drawMap() } mc.style.cursor = p ? "pointer" : "grab"
    const sel = state.sel != null ? N[state.sel] : null
    tip(p ? (sel && sel.t !== 1 ? `${p.n.name}: ${p.v} ${p.v === 1 ? "story" : "stories"} with ${sel.name}` : `${p.n.name}: ${p.n.eps} episodes, ${p.n.st} stories`) : null, e)
  })
  on(mc, "mouseleave", () => { mhover = null; tip(null); drawMap() })
  on(mc, "click", (e) => {
    const p = mpick(e); if (!p) return
    const sel = state.sel != null ? N[state.sel] : null
    if (sel && sel.t !== 1) { state.pair = p.n.i; state.year = null; lim = 25; render() } else { state.pair = null; state.sel = p.n.i; state.year = null; lim = 25; render() }
  })

  /* ---------- panel ---------- */
  function spark(n: Node) {
    const ys = Object.keys(n.years).map(Number)
    if (!ys.length) return ""
    const mx = Math.max(...Object.values(n.years)), w = 340, h = 44
    let s = `<svg class="sk-spark" width="${w}" height="${h + 14}" role="img" aria-label="Stories by year">`
    for (let y = Y0; y <= Y1; y++) { const c = n.years[y] || 0, x = ((y - Y0) / (Y1 - Y0 + 1)) * w, bh = (c / mx) * h; if (c) s += `<rect x="${x + 0.5}" y="${h - bh}" width="${w / (Y1 - Y0 + 1) - 1.5}" height="${bh}" rx="1.5" fill="var(${TV[n.t]})"><title>${y}: ${c}</title></rect>` }
    s += `<line x1="0" x2="${w}" y1="${h + 0.5}" y2="${h + 0.5}" stroke="var(--line)"/>`
    ;[1980, 1990, 2000, 2010, 2020].forEach((y) => (s += `<text x="${((y - Y0 + 0.5) / (Y1 - Y0 + 1)) * w}" y="${h + 12}" text-anchor="middle" font-size="10" fill="var(--mut)">${y}</text>`))
    return s + "</svg>"
  }
  function storyHtml(s: Story) {
    const e = D.E[s.ep], m = Math.floor(s.ts / 60), sec = String(s.ts % 60).padStart(2, "0"), trimmed = s.decision === "trimmed"
    return `<div class="sk-story${trimmed ? " sk-trimmed" : ""}"><b>${esc(s.title)}</b><p>${esc(s.ex)}</p><div class="sk-m">${trimmed ? "Trimmed · " : ""}${esc(e[0])}${e[1] && e[1] !== "SPECIAL" ? " · " + esc(e[1]) : ""}${e[2] ? " · " + esc(e[2].slice(0, 4)) : ""} · <a href="https://www.youtube.com/watch?v=${encodeURIComponent(e[3])}&t=${s.ts}s" target="_blank" rel="noopener">watch at ${m}:${sec}</a>${s.ys.length ? " · mentions " + s.ys.join(", ") : ""}</div></div>`
  }
  let lim = 25
  function panel() {
    const p = $("#sk-panel")
    if (state.sel == null && state.year == null) {
      const top = (t: number) => N.filter((n) => n.t === t).slice(0, 8).map((n) => `<button class="sk-link sk-t${n.t}" data-n="${n.i}"><span class="sk-dot"></span>${esc(n.name)} <small>${n.eps}</small></button>`).join("")
      p.innerHTML = `<h2>Pick a thread</h2><p class="sk-note" style="margin-top:4px">Click any dot, row or name. The number beside a name is how many episodes it comes up in.</p>` + TN.map((t, i) => `<h3>${t}</h3>${top(i)}`).join("")
      return
    }
    if (state.sel == null) {
      const ss = S.filter((s) => s.ys.includes(state.year!))
      p.innerHTML = `<h2>${state.year}</h2><div class="sk-kind">${ss.length} stories mention this year</div>` + ss.slice(0, lim).map(storyHtml).join("") + (ss.length > lim ? `<button class="sk-tab sk-more" id="sk-more">Show more</button>` : "")
      return
    }
    const n = N[state.sel]
    let ss = n.stories
    if (state.pair != null) ss = ss.filter((s) => s.ids.includes(state.pair!))
    if (state.year != null) ss = ss.filter((s) => s.ys.includes(state.year!))
    const pr = state.pair != null ? N[state.pair] : null
    const nb = neighbors(n, 400), by = (t: number) => nb.filter((x) => N[x[0]].t === t).slice(0, 8).map((x) => `<button class="sk-link sk-t${t}" data-n="${x[0]}"><span class="sk-dot"></span>${esc(N[x[0]].name)} <small>${x[1]}</small></button>`).join("")
    const views: [View, string][] = [["net", "Constellation"], ["loom", "Loom"], ["path", "Path"], ["map", "Map"]]
    p.innerHTML =
      `<h2>${esc(n.name)}</h2><div class="sk-kind sk-t${n.t}"><span class="sk-dot"></span>${TN[n.t]}</div><div class="sk-nums"><div><b>${n.eps}</b><span>episodes</span></div><div><b>${n.st}</b><span>stories</span></div><div><b>${nb.length}</b><span>connections</span></div></div><div class="sk-pviews" role="group" aria-label="View this thread as">${views.map((v) => `<button class="sk-tab" data-sv="${v[0]}" aria-pressed="${state.view === v[0]}">${v[1]}</button>`).join("")}</div>${spark(n)}` +
      TN.map((_, i) => { const h = by(i); return h ? `<h3>${TN_PLURAL[i]} in the same stories</h3>${h}` : "" }).join("") +
      `<h3>${pr || state.year != null ? `${ss.length} ${ss.length === 1 ? "story" : "stories"}${pr ? " with " + esc(pr.name) : ""}${state.year != null ? " that mention " + state.year : ""} <button class="sk-tab" id="sk-clry" style="margin-left:6px">All stories</button>${pr ? ` <button class="sk-tab" data-n="${pr.i}">Open ${esc(pr.name)}</button>` : ""}` : "Stories"}</h3>` +
      ss.slice(0, lim).map(storyHtml).join("") + (ss.length > lim ? `<button class="sk-tab sk-more" id="sk-more">Show more (${ss.length - lim} left)</button>` : "")
  }
  on($("#sk-panel"), "click", (e) => {
    const target = e.target as HTMLElement
    const sv = target.closest<HTMLElement>("[data-sv]"); if (sv) { setView(sv.dataset.sv as View); return }
    const b = target.closest<HTMLElement>("[data-n]"); if (b) { state.year = null; select(+b.dataset.n!); return }
    if (target.id === "sk-more") { lim += 40; panel() }
    if (target.id === "sk-clry") { state.year = null; state.pair = null; render() }
  })
  function select(i: number | null, keepYear?: boolean) {
    state.sel = i; state.pair = null; if (!keepYear) state.year = null; lim = 25
    if (i != null && state.view === "net" && !shown().some((n) => n.i === i)) {
      state.types[N[i].t] = true; root.querySelector(`[data-type="${N[i].t}"]`)?.setAttribute("aria-pressed", "true")
      const rank = N.filter((n) => state.types[n.t]).findIndex((n) => n.i === i)
      if (rank >= state.count) { state.count = Math.min(400, Math.ceil((rank + 1) / 10) * 10); $<HTMLInputElement>("#sk-count").value = String(state.count); $("#sk-countv").textContent = String(state.count) }
      rebuild()
    }
    render(); $("#sk-panel").scrollTop = 0
  }
  function render() { panel(); ({ net: drawNet, loom: drawLoom, path: drawPath, map: drawMap })[state.view]() }
  function rebuild() { if (state.view === "net") buildNet(); else render() }
  function setView(v: View) {
    state.view = v
    ;(["net", "loom", "path", "map"] as View[]).forEach((x) => $("#sk-tab-" + x).setAttribute("aria-pressed", String(v === x)))
    cv.style.display = v === "net" ? "block" : "none"; $("#sk-loomwrap").style.display = v === "loom" ? "block" : "none"; $("#sk-pathwrap").style.display = v === "path" ? "block" : "none"
    mc.style.display = v === "map" ? "block" : "none"; $("#sk-mapui").style.display = v === "map" ? "flex" : "none"
    const mn = root.querySelector<HTMLElement>("#sk-mapnote"); if (mn) mn.style.display = v === "map" ? "block" : "none"
    if (sim && v !== "net") sim.stop()
    if (v === "net") { sizeNet(); buildNet() }
    else if (v === "map") {
      if (!proj) {
        void initMap().then((first) => { if (first && state.view === "map") { root.querySelector<HTMLElement>("#sk-mapnote")!.style.display = "block"; fly("North America") } })
      } else drawMap()
    } else render()
    panel()
  }
  ;(["net", "loom", "path", "map"] as View[]).forEach((x) => ($("#sk-tab-" + x).onclick = () => setView(x)))
  on($("#sk-types"), "click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-type]"); if (!b) return
    const t = +b.dataset.type!; state.types[t] = !state.types[t]; if (!state.types.some(Boolean)) state.types[t] = true
    b.setAttribute("aria-pressed", String(state.types[t])); rebuild(); panel()
  })
  on($("#sk-count"), "input", (e) => { state.count = +(e.target as HTMLInputElement).value; $("#sk-countv").textContent = String(state.count); rebuild() })
  on($("#sk-q"), "change", (e) => {
    const el = e.target as HTMLInputElement, v = el.value.trim().toLowerCase(); if (!v) return
    const n = N.find((x) => x.name.toLowerCase() === v) || N.find((x) => x.name.toLowerCase().includes(v))
    if (n) { select(n.i); el.value = "" }
  })

  // Resize, theme and color-scheme listeners live outside the root: tear them down on unmount.
  const onResize = () => { if (state.view === "net") { sizeNet(); sim?.alpha(0.2).restart() } else render() }
  addEventListener("resize", onResize); cleanups.push(() => removeEventListener("resize", onResize))
  const mo = new MutationObserver(() => render())
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] }); cleanups.push(() => mo.disconnect())
  const mq = matchMedia("(prefers-color-scheme: dark)"), onScheme = () => render()
  mq.addEventListener("change", onScheme); cleanups.push(() => mq.removeEventListener("change", onScheme))

  setView("net")
  d3.select(cv).call(zm.transform, d3.zoomIdentity.translate(W * 0.2, H * 0.2).scale(0.6))

  return () => {
    disposed = true
    sim?.stop()
    cleanups.forEach((f) => f())
    root.innerHTML = ""
  }
}
