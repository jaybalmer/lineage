// PB-010 Phase 2: presentational entity graphics for the public timeline cards.
//
// These are pure, store-free copies of the gradient tiles in post-card.tsx's
// EntityBlock. They are duplicated rather than imported because Phase 2 must not
// touch the store-coupled card components (post-card.tsx reads useLineageStore),
// and these tiles are static brand art that effectively never change. Keeping
// them here lets the public renderer carry zero store dependency (acceptance §5).

import type { EntityType } from "@/types"

function BoardGraphic() {
  return (
    <div
      className="flex-shrink-0"
      style={{
        width: 56, height: 56, borderRadius: 14, overflow: "hidden", position: "relative",
        background: "linear-gradient(145deg, #052e16 0%, #031a0e 100%)",
        border: "1px solid rgba(52,211,153,0.18)",
        boxShadow: "0 0 18px 2px rgba(52,211,153,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 80% at 50% 110%, rgba(52,211,153,0.22) 0%, transparent 65%)" }} />
      <div style={{
        width: 16, height: 38, borderRadius: 999,
        background: "linear-gradient(180deg, #6ee7b7 0%, #059669 38%, #065f46 72%, #022c22 100%)",
        boxShadow: "0 0 10px 3px rgba(52,211,153,0.28), inset 1px 0 0 rgba(167,243,208,0.3)",
        position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ width: 1.5, height: 24, borderRadius: 999, background: "linear-gradient(180deg, rgba(167,243,208,0.9) 0%, rgba(52,211,153,0.4) 60%, transparent 100%)" }} />
        <div style={{ position: "absolute", left: 4, top: 6, width: 1.5, height: 24, borderRadius: 999, background: "linear-gradient(180deg, rgba(167,243,208,0.35) 0%, transparent 100%)" }} />
      </div>
    </div>
  )
}

function PlaceGraphic() {
  return (
    <div
      className="flex-shrink-0"
      style={{
        width: 56, height: 56, borderRadius: 14, overflow: "hidden", position: "relative",
        background: "linear-gradient(170deg, #0c1e4a 0%, #071428 55%, #050d1a 100%)",
        border: "1px solid rgba(59,130,246,0.18)",
        boxShadow: "0 0 18px 2px rgba(30,64,175,0.15)",
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(37,99,235,0.38) 0%, transparent 70%)" }} />
      <div style={{ position: "absolute", top: 5, left: 10, width: 2, height: 2, borderRadius: "50%", background: "rgba(219,234,254,0.7)", boxShadow: "14px 4px 0 rgba(219,234,254,0.4), 28px 2px 0 rgba(219,234,254,0.5), 8px 10px 0 rgba(219,234,254,0.3)" }} />
      <svg viewBox="0 0 56 56" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <path d="M0 40 L8 24 L18 32 L28 18 L38 28 L48 20 L56 26 L56 56 L0 56 Z" fill="rgba(30,58,138,0.22)" />
        <path d="M0 46 L6 32 L16 40 L26 24 L36 36 L46 26 L56 34 L56 56 L0 56 Z" fill="rgba(37,99,235,0.3)" />
        <path d="M0 52 L4 40 L12 46 L22 32 L30 42 L42 30 L50 38 L56 36 L56 56 L0 56 Z" fill="rgba(59,130,246,0.5)" />
        <path d="M20 35 L22 32 L24 35.5 Z" fill="rgba(219,234,254,0.88)" />
        <path d="M40 33 L42 30 L44.5 33.5 Z" fill="rgba(219,234,254,0.78)" />
      </svg>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 14, background: "linear-gradient(0deg, rgba(37,99,235,0.2) 0%, transparent 100%)" }} />
    </div>
  )
}

function OrgGraphic({ name }: { name: string }) {
  return (
    <div
      className="flex-shrink-0"
      style={{
        width: 56, height: 56, borderRadius: 14, position: "relative",
        background: "linear-gradient(145deg, #1c1c1f 0%, #111113 100%)",
        border: "1px solid rgba(161,161,170,0.1)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 16px rgba(0,0,0,0.4)",
        overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(161,161,170,0.18) 1px, transparent 1px)", backgroundSize: "8px 8px" }} />
      <div style={{ position: "absolute", top: -12, right: -12, width: 40, height: 40, borderRadius: "50%", background: "radial-gradient(circle, rgba(161,161,170,0.12) 0%, transparent 70%)" }} />
      <span style={{
        position: "relative", fontSize: 26, fontWeight: 800, letterSpacing: -1,
        background: "linear-gradient(140deg, #f4f4f5 0%, #a1a1aa 100%)",
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", lineHeight: 1,
      }}>
        {(name[0] ?? "?").toUpperCase()}
      </span>
    </div>
  )
}

function EventGraphic({ year }: { year?: number | string }) {
  const yr = year ? `'${String(year).slice(2)}` : null
  return (
    <div
      className="flex-shrink-0"
      style={{
        width: 56, height: 56, borderRadius: 14, position: "relative", overflow: "hidden",
        background: "linear-gradient(145deg, #1a1000 0%, #0d0800 100%)",
        border: "1px solid rgba(251,191,36,0.16)",
        boxShadow: "0 0 22px 3px rgba(245,158,11,0.1)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(45deg, rgba(251,191,36,0.05) 0px, rgba(251,191,36,0.05) 1px, transparent 1px, transparent 9px)" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 75% 75% at 50% 60%, rgba(245,158,11,0.22) 0%, transparent 70%)" }} />
      {yr ? (
        <span style={{
          position: "relative", fontSize: yr.length > 3 ? 16 : 20, fontWeight: 800, color: "#fbbf24",
          textShadow: "0 0 10px rgba(251,191,36,0.9), 0 0 22px rgba(251,191,36,0.5), 0 0 40px rgba(251,191,36,0.2)",
          letterSpacing: -0.5, lineHeight: 1,
        }}>
          {yr}
        </span>
      ) : (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" style={{ position: "relative", filter: "drop-shadow(0 0 5px rgba(251,191,36,0.7)) drop-shadow(0 0 12px rgba(251,191,36,0.35))" }}>
          <rect x="3" y="4" width="18" height="16" rx="2" stroke="#fbbf24" strokeWidth="1.5" strokeOpacity="0.85" />
          <path d="M8 2v4M16 2v4" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.75" />
          <path d="M3 9h18" stroke="#fbbf24" strokeWidth="1" strokeOpacity="0.4" />
          <circle cx="8.5" cy="14" r="1.2" fill="#fbbf24" fillOpacity="0.8" />
          <circle cx="12" cy="14" r="1.2" fill="#fbbf24" fillOpacity="0.8" />
          <circle cx="15.5" cy="14" r="1.2" fill="#fbbf24" fillOpacity="0.8" />
        </svg>
      )}
      <div style={{ position: "absolute", bottom: 0, left: "20%", right: "20%", height: 1, background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.4), transparent)" }} />
    </div>
  )
}

function PersonGraphic({ name }: { name: string }) {
  return (
    <div
      className="flex-shrink-0"
      style={{
        width: 56, height: 56, borderRadius: "50%", padding: 2,
        background: "conic-gradient(from 200deg at 50% 50%, #7c3aed 0%, #a855f7 30%, #c084fc 50%, #a855f7 70%, #7c3aed 100%)",
        boxShadow: "0 0 18px 4px rgba(139,92,246,0.32), inset 0 0 0 1px rgba(196,132,252,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div style={{
        width: "100%", height: "100%", borderRadius: "50%",
        background: "linear-gradient(145deg, #2e1065 0%, #1e0b50 45%, #130830 100%)",
        boxShadow: "inset 0 1px 0 rgba(196,132,252,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{
          fontSize: 22, fontWeight: 700,
          background: "linear-gradient(140deg, #ede9fe 0%, #c084fc 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", lineHeight: 1,
        }}>
          {(name[0] ?? "?").toUpperCase()}
        </span>
      </div>
    </div>
  )
}

/** Single entry point: the gradient tile for an entity type, matching the
 *  in-app EntityBlock graphic. `name` seeds the lettered org/person tiles;
 *  `year` seeds the event tile. */
export function EntityGraphic({
  type, name = "", year,
}: {
  type: EntityType
  name?: string
  year?: number | string
}) {
  switch (type) {
    case "board": return <BoardGraphic />
    case "place": return <PlaceGraphic />
    case "org":   return <OrgGraphic name={name} />
    case "event": return <EventGraphic year={year} />
    case "person": return <PersonGraphic name={name} />
    default: return null
  }
}
