"use client"

// Hand-rolled SVG scenes for the /intro slideshow (brief §6, D6/D8). Each scene
// is a self-contained, cheap SVG: tier-palette node colors, stroke-dashoffset
// draw-in via pathLength="1", CSS pop/pulse from globals.css (ftue-intro-*).
// Reduced motion is handled entirely in globals.css, so these components carry
// no motion branching. Node colors follow the tier palette (D8): stories/riders
// violet, places teal, events amber, boards emerald, brands cyan, accent blue is
// UI chrome only. Text/chrome uses theme tokens so light and dark both work.

const TIER = {
  story: "#8b5cf6", // violet-500 (stories / riders)
  place: "#0d9488", // teal-600
  event: "#f59e0b", // amber-500
  board: "#10b981", // emerald-500
  brand: "#06b6d4", // cyan-500
  accent: "#3b82f6", // brand accent (chrome)
} as const

// A drawn connector line. `d` in animation-delay seconds staggers the draw.
function Line({
  x1,
  y1,
  x2,
  y2,
  delay = 0,
  color = "var(--muted)",
  width = 1.5,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  delay?: number
  color?: string
  width?: number
}) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      pathLength={1}
      className="ftue-intro-draw"
      style={{ animationDelay: `${delay}s`, opacity: 0.55 }}
    />
  )
}

// A popped-in node dot.
function Node({
  cx,
  cy,
  r,
  color,
  delay = 0,
  pulse = false,
  pulseDelay = 0,
}: {
  cx: number
  cy: number
  r: number
  color: string
  delay?: number
  pulse?: boolean
  pulseDelay?: number
}) {
  return (
    <>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={color}
        className="ftue-intro-pop"
        style={{ animationDelay: `${delay}s` }}
      />
      {pulse && (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={color}
          className="ftue-intro-pulse"
          style={{ animationDelay: `${pulseDelay}s`, opacity: 0.55 }}
        />
      )}
    </>
  )
}

const svgProps = {
  className: "w-full h-full",
  preserveAspectRatio: "xMidYMid meet",
  "aria-hidden": true,
} as const

// ── Screen 1: self-drawing constellation, violet-dominant ────────────────────
export function ConstellationScene() {
  // 12 nodes; violet stories dominate, a few tier accents mixed in.
  const nodes: { x: number; y: number; r: number; c: string }[] = [
    { x: 150, y: 70, r: 7, c: TIER.story },
    { x: 90, y: 120, r: 5, c: TIER.story },
    { x: 220, y: 110, r: 6, c: TIER.place },
    { x: 60, y: 190, r: 6, c: TIER.story },
    { x: 130, y: 175, r: 9, c: TIER.story }, // pulses
    { x: 205, y: 185, r: 5, c: TIER.event },
    { x: 275, y: 160, r: 6, c: TIER.story },
    { x: 100, y: 250, r: 5, c: TIER.board },
    { x: 170, y: 255, r: 7, c: TIER.story },
    { x: 245, y: 240, r: 6, c: TIER.story },
    { x: 40, y: 95, r: 4, c: TIER.brand },
    { x: 300, y: 215, r: 5, c: TIER.story },
  ]
  const edges: [number, number][] = [
    [0, 1], [0, 2], [1, 4], [2, 6], [3, 4], [4, 5], [4, 8],
    [5, 6], [6, 11], [7, 8], [8, 9], [9, 11], [1, 3], [0, 10],
  ]
  return (
    <svg viewBox="0 0 340 320" {...svgProps}>
      {edges.map(([a, b], i) => (
        <Line
          key={i}
          x1={nodes[a].x}
          y1={nodes[a].y}
          x2={nodes[b].x}
          y2={nodes[b].y}
          delay={0.1 + i * 0.08}
          color={TIER.story}
        />
      ))}
      {nodes.map((n, i) => (
        <Node
          key={i}
          cx={n.x}
          cy={n.y}
          r={n.r}
          color={n.c}
          delay={0.15 + i * 0.06}
          pulse={i === 4}
          pulseDelay={1.6}
        />
      ))}
    </svg>
  )
}

// ── Screen 2: split scene, mountain timeline + rider hub ─────────────────────
export function ConnectionsScene() {
  return (
    <svg viewBox="0 0 340 320" {...svgProps}>
      {/* Left: teal mountain silhouette with a vertical story timeline */}
      <path
        d="M20 250 L70 150 L100 195 L140 110 L175 250 Z"
        fill={TIER.place}
        opacity={0.16}
        className="ftue-intro-fade"
        style={{ animationDelay: "0.05s" }}
      />
      <line
        x1={95}
        y1={80}
        x2={95}
        y2={250}
        stroke="var(--muted)"
        strokeWidth={1.5}
        pathLength={1}
        className="ftue-intro-draw"
        style={{ animationDelay: "0.15s", opacity: 0.4 }}
      />
      <Node cx={95} cy={100} r={5} color={TIER.story} delay={0.5} />
      <Node cx={95} cy={155} r={6} color={TIER.story} delay={0.7} />
      <Node cx={95} cy={210} r={5} color={TIER.story} delay={0.9} />

      {/* Right: rider hub with radiating tier connections */}
      <Line x1={250} y1={160} x2={250} y2={70} delay={0.4} color={TIER.event} />
      <Line x1={250} y1={160} x2={315} y2={140} delay={0.5} color={TIER.board} />
      <Line x1={250} y1={160} x2={310} y2={225} delay={0.6} color={TIER.place} />
      <Line x1={250} y1={160} x2={200} y2={235} delay={0.7} color={TIER.story} />
      {/* Cross-split joins */}
      <Line x1={95} y1={155} x2={250} y2={160} delay={1.0} color={TIER.story} width={1.25} />

      <Node cx={250} cy={70} r={5} color={TIER.event} delay={0.9} />
      <Node cx={315} cy={140} r={5} color={TIER.board} delay={1.0} />
      <Node cx={310} cy={225} r={5} color={TIER.place} delay={1.1} />
      <Node cx={200} cy={235} r={5} color={TIER.story} delay={1.2} />
      <Node cx={250} cy={160} r={10} color={TIER.story} delay={0.8} pulse pulseDelay={1.8} />
    </svg>
  )
}

// ── Screen 3: avatar mosaic assembling into a snowboard silhouette ───────────
export function CommunityScene() {
  // A deck outline; circles fill inside it with a staggered pop. Ring colors
  // rotate through the tier palette, echoing rider-avatar rings.
  const ringColors = [TIER.story, TIER.place, TIER.event, TIER.board, TIER.brand]
  const dots: { x: number; y: number }[] = []
  // Lay a rough grid, keep points inside a tall rounded-rect deck.
  const cols = 5
  const rows = 8
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Stagger alternate rows for a packed look.
      const offset = r % 2 === 0 ? 0 : 14
      const x = 128 + c * 28 + offset
      const y = 40 + r * 30
      // Pinch the top and bottom rows inward so the mass reads deck-shaped.
      const edge = r === 0 || r === rows - 1
      if (edge && (c === 0 || c === cols - 1)) continue
      dots.push({ x, y })
    }
  }
  return (
    <svg viewBox="0 0 340 320" {...svgProps}>
      {/* Snowboard deck outline */}
      <rect
        x={118}
        y={20}
        width={150}
        height={288}
        rx={70}
        fill="none"
        stroke="var(--muted)"
        strokeWidth={1.5}
        pathLength={1}
        className="ftue-intro-draw"
        style={{ animationDelay: "0.1s", opacity: 0.4 }}
      />
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={9}
          fill="none"
          stroke={ringColors[i % ringColors.length]}
          strokeWidth={2.5}
          className="ftue-intro-pop"
          style={{ animationDelay: `${0.3 + i * 0.03}s` }}
        />
      ))}
    </svg>
  )
}

// ── Screen 4: BrandMark hub lighting up a ring of contributors ───────────────
export function EquityScene() {
  const cx = 170
  const cy = 160
  const R = 110
  const count = 12
  const ring = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2
    return { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle), i }
  })
  const ringColors = [TIER.story, TIER.place, TIER.event, TIER.board, TIER.brand]
  return (
    <svg viewBox="0 0 340 320" {...svgProps}>
      {ring.map((p) => (
        <Line
          key={`l${p.i}`}
          x1={cx}
          y1={cy}
          x2={p.x}
          y2={p.y}
          delay={0.3 + p.i * 0.07}
          color={TIER.accent}
          width={1.25}
        />
      ))}
      {ring.map((p) => (
        <Node
          key={`n${p.i}`}
          cx={p.x}
          cy={p.y}
          r={6}
          color={ringColors[p.i % ringColors.length]}
          delay={0.5 + p.i * 0.07}
        />
      ))}
      {/* Central mark: a violet ring hub standing in for the BrandMark, kept
          simple so the SVG stays a single cheap scene. */}
      <circle
        cx={cx}
        cy={cy}
        r={22}
        fill="var(--surface)"
        stroke={TIER.accent}
        strokeWidth={2.5}
        className="ftue-intro-pop"
        style={{ animationDelay: "0.2s" }}
      />
      <circle
        cx={cx}
        cy={cy}
        r={9}
        fill={TIER.accent}
        className="ftue-intro-pulse"
        style={{ animationDelay: "1.4s" }}
      />
    </svg>
  )
}

// ── Screen 5: horizontal timeline coming alive with a first story node ───────
export function TimelineAliveScene() {
  return (
    <svg viewBox="0 0 340 320" {...svgProps}>
      {/* Faint background constellation the first node connects into */}
      {[
        { x: 70, y: 70 },
        { x: 150, y: 50 },
        { x: 240, y: 80 },
        { x: 290, y: 130 },
        { x: 120, y: 110 },
      ].map((n, i) => (
        <circle
          key={i}
          cx={n.x}
          cy={n.y}
          r={4}
          fill={TIER.story}
          opacity={0.28}
          className="ftue-intro-fade"
          style={{ animationDelay: `${0.2 + i * 0.1}s` }}
        />
      ))}
      {/* Connect the first story node up into the constellation */}
      <Line x1={170} y1={210} x2={150} y2={50} delay={0.9} color={TIER.story} width={1.25} />
      {/* The timeline line brightening along its length */}
      <line
        x1={30}
        y1={210}
        x2={310}
        y2={210}
        stroke={TIER.accent}
        strokeWidth={3}
        strokeLinecap="round"
        pathLength={1}
        className="ftue-intro-draw"
        style={{ animationDelay: "0.3s" }}
      />
      {/* Tick nodes along the timeline */}
      {[70, 130, 250].map((x, i) => (
        <Node key={i} cx={x} cy={210} r={4} color="var(--muted)" delay={0.6 + i * 0.1} />
      ))}
      {/* The first story node drops in on the timeline */}
      <Node cx={170} cy={210} r={9} color={TIER.story} delay={0.8} pulse pulseDelay={1.6} />
    </svg>
  )
}
