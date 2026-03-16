import { useState, useRef, useCallback, useEffect } from "react";

// ─── FONTS ───────────────────────────────────────────────────────────────────
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&family=IBM+Plex+Mono:wght@400;700&display=swap');`;

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const BG    = "#05080f";
const CARD  = "#090f1c";
const SPINE = "#1a3040";
const MUTED = "#2a4a5a";
const TEXT  = "#d8eaf4";
const DIM   = "#0d1824";

const TYPE = {
  event:    { symbol: "◈", label: "Events",    color: "#00d4ff" },
  artifact: { symbol: "◉", label: "Artifacts", color: "#ff9f43" },
  story:    { symbol: "◎", label: "Stories",   color: "#a29bfe" },
  place:    { symbol: "◇", label: "Places",    color: "#55efc4" },
};

// ─── DATA ────────────────────────────────────────────────────────────────────
const YEAR_DATA = [
  { year: 1983, event: 2,  artifact: 1,  story: 1,  place: 0,  label: "Burton Performer"           },
  { year: 1985, event: 4,  artifact: 3,  story: 2,  place: 1,  label: "First World Championships"  },
  { year: 1987, event: 5,  artifact: 6,  story: 3,  place: 2,  label: "Sims dominate"               },
  { year: 1988, event: 6,  artifact: 9,  story: 4,  place: 2,  label: "US Open grows"               },
  { year: 1990, event: 11, artifact: 14, story: 6,  place: 4,  label: "Resorts open up"             },
  { year: 1991, event: 13, artifact: 17, story: 8,  place: 5,  label: "Video era starts"            },
  { year: 1992, event: 16, artifact: 22, story: 11, place: 6,  label: "US Open iconic"              },
  { year: 1993, event: 19, artifact: 28, story: 13, place: 8,  label: "Forum founded"               },
  { year: 1994, event: 24, artifact: 35, story: 16, place: 10, label: "Baker Legendary peaks"       },
  { year: 1995, event: 29, artifact: 44, story: 19, place: 13, label: "Mack Dawg era"               },
  { year: 1996, event: 34, artifact: 54, story: 23, place: 16, label: "Video parts explode"         },
  { year: 1997, event: 41, artifact: 64, story: 29, place: 19, label: "246 drops"                   },
  { year: 1998, event: 72, artifact: 91, story: 48, place: 32, label: "Olympics — Nagano"           },
  { year: 1999, event: 58, artifact: 78, story: 41, place: 26, label: "Peak Forum era"              },
  { year: 2000, event: 64, artifact: 88, story: 46, place: 31, label: "Destroyers released"         },
  { year: 2001, event: 59, artifact: 82, story: 43, place: 29, label: "Supernatural born"           },
  { year: 2002, event: 67, artifact: 95, story: 52, place: 35, label: "DCP era"                     },
  { year: 2003, event: 74, artifact: 104, story: 58, place: 40, label: "Baldface opens"             },
  { year: 2004, event: 68, artifact: 97, story: 54, place: 37, label: "Scene globalises"            },
  { year: 2005, event: 62, artifact: 87, story: 50, place: 36, label: "Backcountry grows"           },
  { year: 2006, event: 55, artifact: 76, story: 48, place: 34, label: "Park vs BC debate"           },
  { year: 2007, event: 51, artifact: 69, story: 52, place: 33, label: "Film culture shifts"         },
  { year: 2008, event: 48, artifact: 62, story: 58, place: 31, label: "Print media fades"           },
  { year: 2009, event: 44, artifact: 55, story: 64, place: 29, label: "Stories overtake"            },
  { year: 2010, event: 88, artifact: 64, story: 98, place: 67, label: "Shaun White 3rd gold"        },
  { year: 2011, event: 76, artifact: 58, story: 89, place: 59, label: "Backcountry mainstream"      },
  { year: 2012, event: 94, artifact: 61, story: 112, place: 74, label: "BC renaissance"            },
  { year: 2013, event: 82, artifact: 54, story: 99, place: 66, label: "Split touring grows"         },
  { year: 2014, event: 78, artifact: 51, story: 95, place: 62, label: "Sochi Olympics"              },
  { year: 2015, event: 69, artifact: 46, story: 87, place: 57, label: "New generation rises"        },
  { year: 2016, event: 63, artifact: 42, story: 81, place: 53, label: "Instagram era"               },
  { year: 2017, event: 58, artifact: 38, story: 76, place: 49, label: "Digital storytelling"        },
  { year: 2018, event: 54, artifact: 34, story: 71, place: 45, label: "Olympic controversy"         },
  { year: 2019, event: 48, artifact: 31, story: 65, place: 41, label: "Ikon Pass changes access"    },
  { year: 2020, event: 22, artifact: 14, story: 38, place: 19, label: "COVID season"                },
  { year: 2021, event: 41, artifact: 26, story: 58, place: 31, label: "Record pow years"            },
  { year: 2022, event: 36, artifact: 22, story: 51, place: 27, label: "Community rebuilds"          },
  { year: 2023, event: 31, artifact: 19, story: 44, place: 24, label: "New generation"              },
];

const DECADE_DATA = [
  { year: 1983, decade: "1980s", event: 30,  artifact: 41,  story: 19,  place: 11,  label: "The outlaw era"           },
  { year: 1990, decade: "1990s", event: 234, artifact: 402, story: 162, place: 99,  label: "The golden era"           },
  { year: 2000, decade: "2000s", event: 571, artifact: 769, story: 465, place: 311, label: "Peak culture"             },
  { year: 2010, decade: "2010s", event: 662, artifact: 444, story: 808, place: 535, label: "The backcountry shift"    },
  { year: 2020, decade: "2020s", event: 130, artifact: 81,  story: 191, place: 101, label: "Post-pandemic riding"     },
];

const MY_YEARS = new Set([1997, 1999, 2000, 2003, 2006, 2009, 2012, 2015, 2019]);

// ─── CATMULL-ROM SPLINE → SVG PATH ───────────────────────────────────────────
function catmullRomPath(points, tension = 0.4) {
  if (points.length < 2) return "";
  const pts = [points[0], ...points, points[points.length - 1]];
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < pts.length - 2; i++) {
    const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2];
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function areaPath(points, bottomY, tension = 0.4) {
  if (points.length < 2) return "";
  const linePath = catmullRomPath(points, tension);
  return `${linePath} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`;
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function CollectiveTimeline() {
  const [mode, setMode]         = useState("year");
  const [activeYear, setActive] = useState(null);
  const [scrubX, setScrubX]     = useState(null);
  const svgRef                  = useRef(null);
  const scrollRef               = useRef(null);

  const data = mode === "decade" ? DECADE_DATA : YEAR_DATA;

  // Chart dimensions
  const CHART_H   = 150;
  const PAD_T     = 12;
  const PAD_B     = 0;
  const PLOT_H    = CHART_H - PAD_T - PAD_B;
  const NODE_Y    = CHART_H + 28;      // spine y
  const TOTAL_H   = NODE_Y + 40;

  const STEP      = mode === "decade" ? 62 : 22;
  const PAD_L     = 20;
  const CHART_W   = PAD_L * 2 + (data.length - 1) * STEP;

  // Map data → x coordinate
  const xOf = (i) => PAD_L + i * STEP;

  // Find max across all types for scaling
  const maxVal = Math.max(...data.flatMap(d => [d.event, d.artifact, d.story, d.place]));
  const yOf = (v) => PAD_T + PLOT_H - (v / maxVal) * PLOT_H;

  // Build point arrays per type
  const typeKeys = ["event", "artifact", "story", "place"];
  const linePoints = {};
  typeKeys.forEach(k => {
    linePoints[k] = data.map((d, i) => ({ x: xOf(i), y: yOf(d[k]), value: d[k], idx: i, year: d.year || d.decade }));
  });

  // Active data row
  const activeData = activeYear !== null ? data.find((d, i) => i === activeYear) : null;

  // Scrub interaction
  const handleSvgInteraction = useCallback((clientX) => {
    if (!svgRef.current || !scrollRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const scrollLeft = scrollRef.current.scrollLeft;
    const relX = clientX - svgRect.left + scrollLeft;
    // Find closest data point
    let closest = 0, minDist = Infinity;
    data.forEach((_, i) => {
      const dist = Math.abs(xOf(i) - relX);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    if (minDist < STEP * 0.7) {
      setActive(closest);
      setScrubX(xOf(closest));
    }
  }, [data, mode]);

  const onMouseMove = (e) => {
    if (e.buttons === 1) handleSvgInteraction(e.clientX);
  };
  const onClick = (e) => handleSvgInteraction(e.clientX);
  const onTouch = (e) => {
    e.preventDefault();
    handleSvgInteraction(e.touches[0].clientX);
  };

  // Reset scrubber when mode changes
  useEffect(() => { setActive(null); setScrubX(null); }, [mode]);

  // Build gradient IDs
  const gradId = (k) => `grad-${k}`;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#08090e",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "32px 16px 60px",
    }}>
      <style>{`
        ${FONTS}
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes scrubIn { from { opacity:0; } to { opacity:1; } }
        @keyframes nodePop { 0%,100% { r:3; } 50% { r:5; } }
      `}</style>

      {/* Page header */}
      <div style={{ textAlign: "center", marginBottom: 24, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ fontSize: 10, color: "#2a2a2a", letterSpacing: 4, marginBottom: 6 }}>LINEAGE.WTF</div>
        <div style={{ color: TEXT, fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Collective Timeline</div>
        <div style={{ color: "#333", fontSize: 12 }}>Community contributions · snowboarding</div>
      </div>

      {/* Phone */}
      <div style={{
        width: 320,
        background: "#161616",
        borderRadius: 46,
        padding: "14px 10px",
        boxShadow: "0 40px 120px #000000dd, inset 0 0 0 1.5px #242424",
      }}>
        <div style={{ width: 80, height: 5, background: "#252525", borderRadius: 10, margin: "0 auto 10px" }} />

        <div style={{
          borderRadius: 34, overflow: "hidden",
          background: BG, height: 640,
          display: "flex", flexDirection: "column",
        }}>

          {/* ── HEADER ── */}
          <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid #ffffff07", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: 2, lineHeight: 1 }}>
                  COLLECTIVE<span style={{ color: "#00d4ff" }}>.</span>
                </div>
                <div style={{ fontSize: 9, color: MUTED, fontFamily: "'IBM Plex Mono',monospace", marginTop: 3 }}>
                  // snowboarding · 1983–present
                </div>
              </div>
              {/* Toggle */}
              <div style={{ display: "flex", background: DIM, borderRadius: 100, border: "1px solid #ffffff08", overflow: "hidden" }}>
                {[["year", "1Y"], ["decade", "10Y"]].map(([m, lbl]) => (
                  <button key={m} onClick={() => setMode(m)} style={{
                    background: mode === m ? SPINE : "none",
                    border: "none", color: mode === m ? TEXT : MUTED,
                    fontSize: 9, padding: "5px 12px", cursor: "pointer",
                    fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 1,
                    transition: "all 0.2s", fontWeight: mode === m ? 700 : 400,
                  }}>{lbl}</button>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {Object.entries(TYPE).map(([k, t]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 16, height: 2, background: t.color, borderRadius: 1 }} />
                  <span style={{ fontSize: 8, color: MUTED, fontFamily: "'IBM Plex Mono',monospace" }}>{t.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── CHART + SPINE ── */}
          <div
            ref={scrollRef}
            style={{ overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none", flexShrink: 0 }}
          >
            <svg
              ref={svgRef}
              width={CHART_W}
              height={TOTAL_H}
              style={{ display: "block", cursor: "crosshair", userSelect: "none" }}
              onClick={onClick}
              onMouseMove={onMouseMove}
              onTouchStart={onTouch}
              onTouchMove={onTouch}
            >
              <defs>
                {/* Gradient fills per type */}
                {typeKeys.map(k => (
                  <linearGradient key={k} id={gradId(k)} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={TYPE[k].color} stopOpacity="0.18" />
                    <stop offset="100%" stopColor={TYPE[k].color} stopOpacity="0.00" />
                  </linearGradient>
                ))}
                {/* Scrubber gradient */}
                <linearGradient id="scrubGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.5" />
                  <stop offset="60%"  stopColor="#ffffff" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
                {/* Glow filter */}
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {/* Subtle horizontal grid lines */}
              {[0.25, 0.5, 0.75, 1.0].map(f => (
                <line key={f}
                  x1={0} y1={PAD_T + PLOT_H * (1 - f)}
                  x2={CHART_W} y2={PAD_T + PLOT_H * (1 - f)}
                  stroke="#ffffff" strokeOpacity="0.025" strokeWidth="1"
                  strokeDasharray={f === 1.0 ? "none" : "2 4"}
                />
              ))}

              {/* Area fills — behind lines */}
              {typeKeys.map(k => (
                <path key={`area-${k}`}
                  d={areaPath(linePoints[k], CHART_H)}
                  fill={`url(#${gradId(k)})`}
                />
              ))}

              {/* Lines */}
              {typeKeys.map(k => (
                <path key={`line-${k}`}
                  d={catmullRomPath(linePoints[k])}
                  fill="none"
                  stroke={TYPE[k].color}
                  strokeWidth={activeData ? "1.2" : "1.5"}
                  strokeOpacity={activeData ? "0.4" : "0.8"}
                  strokeLinecap="round"
                  style={{ transition: "stroke-opacity 0.3s, stroke-width 0.3s" }}
                />
              ))}

              {/* Active type lines brighten */}
              {activeData && typeKeys.map(k => (
                <path key={`line-active-${k}`}
                  d={catmullRomPath(linePoints[k])}
                  fill="none"
                  stroke={TYPE[k].color}
                  strokeWidth="2"
                  strokeOpacity="1"
                  strokeLinecap="round"
                  filter="url(#glow)"
                  clipPath={`url(#clip-active-${k})`}
                />
              ))}

              {/* Scrubber vertical line */}
              {scrubX !== null && (
                <g style={{ animation: "scrubIn 0.15s ease" }}>
                  <line
                    x1={scrubX} y1={0} x2={scrubX} y2={NODE_Y - 6}
                    stroke="url(#scrubGrad)" strokeWidth="1"
                  />
                  {/* Highlight active nodes on each line */}
                  {typeKeys.map(k => {
                    const pt = linePoints[k][activeYear];
                    if (!pt) return null;
                    return (
                      <g key={`active-node-${k}`} filter="url(#glow)">
                        <circle cx={pt.x} cy={pt.y} r="5" fill={BG} stroke={TYPE[k].color} strokeWidth="1.5" />
                        <circle cx={pt.x} cy={pt.y} r="2.5" fill={TYPE[k].color} />
                      </g>
                    );
                  })}
                </g>
              )}

              {/* All data nodes (small, always visible) */}
              {typeKeys.map(k =>
                linePoints[k].map((pt, i) => (
                  <circle key={`node-${k}-${i}`}
                    cx={pt.x} cy={pt.y} r="2"
                    fill={BG} stroke={TYPE[k].color}
                    strokeWidth="1" strokeOpacity="0.5"
                  />
                ))
              )}

              {/* ── SPINE ── */}
              {/* Spine axis line */}
              <line
                x1={PAD_L - 10} y1={NODE_Y} x2={CHART_W - PAD_L + 10} y2={NODE_Y}
                stroke={SPINE} strokeWidth="1"
              />

              {/* Year nodes on spine */}
              {data.map((d, i) => {
                const x    = xOf(i);
                const isMe = MY_YEARS.has(d.year);
                const isAct = activeYear === i;
                const yr   = d.year;

                return (
                  <g key={`spine-${i}`} onClick={(e) => { e.stopPropagation(); setActive(isAct ? null : i); setScrubX(isAct ? null : x); }}>
                    {/* Tick */}
                    <line x1={x} y1={NODE_Y - 4} x2={x} y2={NODE_Y + 4} stroke={isAct ? TEXT : SPINE} strokeWidth="1" />

                    {/* My-moment diamond */}
                    {isMe && (
                      <rect
                        x={x - 5} y={NODE_Y - 5} width={10} height={10}
                        transform={`rotate(45, ${x}, ${NODE_Y})`}
                        fill={isAct ? "#00d4ff" : BG}
                        stroke="#00d4ff"
                        strokeWidth={isAct ? "1.5" : "1"}
                        style={{ filter: isAct ? "drop-shadow(0 0 6px #00d4ff88)" : "none" }}
                      />
                    )}

                    {/* Regular node */}
                    {!isMe && (
                      <circle cx={x} cy={NODE_Y} r={isAct ? 4 : 2.5}
                        fill={isAct ? TEXT : BG}
                        stroke={isAct ? TEXT : MUTED}
                        strokeWidth="1"
                        style={{ transition: "all 0.2s" }}
                      />
                    )}

                    {/* Year label — show every Nth to avoid crowding */}
                    {(mode === "decade" || i % 4 === 0 || isAct) && (
                      <text
                        x={x} y={NODE_Y + 18}
                        textAnchor="middle"
                        fontSize={mode === "decade" ? "9" : "7.5"}
                        fill={isAct ? TEXT : MUTED}
                        fontFamily="'IBM Plex Mono', monospace"
                        style={{ transition: "fill 0.2s" }}
                      >
                        {mode === "decade" ? d.decade : `'${String(yr).slice(2)}`}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Active year label above scrubber */}
              {activeData && scrubX !== null && (
                <text
                  x={scrubX} y={6}
                  textAnchor="middle"
                  fontSize="8"
                  fill={TEXT}
                  fontFamily="'IBM Plex Mono', monospace"
                  opacity="0.7"
                >
                  {activeData.year || activeData.decade}
                </text>
              )}
            </svg>
          </div>

          {/* ── INFO PANEL ── */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            scrollbarWidth: "none",
            padding: "0 14px 0",
            marginTop: 2,
          }}>
            {activeData ? (
              <div key={activeData.year || activeData.decade} style={{
                animation: "fadeUp 0.2s ease",
                paddingBottom: 16,
              }}>
                {/* Title row */}
                <div style={{
                  display: "flex", alignItems: "flex-start",
                  justifyContent: "space-between", marginBottom: 10,
                  paddingTop: 12,
                  borderTop: "1px solid #ffffff06",
                }}>
                  <div>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "#00d4ff", letterSpacing: 2, marginBottom: 4 }}>
                      {activeData.year || activeData.decade}
                    </div>
                    <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 17, fontWeight: 700, color: TEXT, lineHeight: 1.2, marginBottom: 3 }}>
                      {activeData.label}
                    </div>
                  </div>
                  {MY_YEARS.has(activeData.year) && (
                    <div style={{
                      background: "#001a26", border: "1px solid #00d4ff33",
                      borderRadius: 100, padding: "3px 8px",
                      fontSize: 8, color: "#00d4ff",
                      fontFamily: "'IBM Plex Mono',monospace",
                      flexShrink: 0, marginLeft: 8, marginTop: 2,
                    }}>◆ yours</div>
                  )}
                </div>

                {/* Type rows */}
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {typeKeys.map(k => {
                    const t     = TYPE[k];
                    const val   = activeData[k];
                    const total = typeKeys.reduce((s, kk) => s + activeData[kk], 0);
                    const pct   = total > 0 ? (val / total) * 100 : 0;
                    return (
                      <div key={k}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                          <span style={{ fontSize: 9, color: t.color, fontFamily: "'IBM Plex Mono',monospace", width: 12 }}>{t.symbol}</span>
                          <span style={{ fontSize: 9, color: MUTED, fontFamily: "'IBM Plex Mono',monospace", flex: 1, letterSpacing: 0.5 }}>{t.label}</span>
                          <span style={{ fontSize: 9, color: t.color, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700 }}>{val.toLocaleString()}</span>
                          <span style={{ fontSize: 8, color: MUTED, fontFamily: "'IBM Plex Mono',monospace", width: 28, textAlign: "right" }}>{Math.round(pct)}%</span>
                        </div>
                        <div style={{ height: 2, background: "#ffffff08", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{
                            height: "100%", borderRadius: 2,
                            width: `${pct}%`,
                            background: t.color,
                            boxShadow: `0 0 6px ${t.color}88`,
                            transition: "width 0.4s ease",
                          }} />
                        </div>
                      </div>
                    );
                  })}

                  {/* Total */}
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    paddingTop: 8, marginTop: 2,
                    borderTop: "1px solid #ffffff06",
                  }}>
                    <span style={{ fontSize: 9, color: MUTED, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 1 }}>TOTAL ENTRIES</span>
                    <span style={{ fontSize: 9, color: TEXT, fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700 }}>
                      {typeKeys.reduce((s, k) => s + activeData[k], 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* CTA */}
                <button style={{
                  marginTop: 12, width: "100%",
                  background: "none", border: "1px solid #00d4ff33",
                  borderRadius: 100, color: "#00d4ff",
                  fontSize: 9, padding: "8px",
                  cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace",
                  letterSpacing: 1.5,
                  transition: "border-color 0.2s",
                }}>
                  + ADD TO YOUR TIMELINE
                </button>
              </div>
            ) : (
              <div style={{
                textAlign: "center", paddingTop: 22,
                color: "#1a3040", fontSize: 10,
                fontFamily: "'IBM Plex Mono',monospace", lineHeight: 2,
              }}>
                scrub or tap<br />any node to explore
              </div>
            )}
          </div>

          {/* Nav */}
          <div style={{
            borderTop: "1px solid #ffffff06", padding: "8px 14px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#030609", flexShrink: 0,
          }}>
            <span style={{ fontSize: 9, color: MUTED, fontFamily: "'IBM Plex Mono',monospace" }}>← drag to scrub</span>
            <div style={{ display: "flex", gap: 14 }}>
              {["│", "‡", "≡"].map((s, i) => (
                <span key={i} style={{ fontSize: 14, color: i === 2 ? "#00d4ff" : MUTED, cursor: "pointer" }}>{s}</span>
              ))}
            </div>
          </div>
        </div>

        <div style={{ width: 60, height: 4, background: "#252525", borderRadius: 10, margin: "10px auto 0" }} />
      </div>

      {/* Caption */}
      <div style={{ maxWidth: 300, marginTop: 20, textAlign: "center", fontFamily: "system-ui,sans-serif" }}>
        <p style={{ color: "#333", fontSize: 12, lineHeight: 1.8, margin: 0 }}>
          <span style={{ color: "#555" }}>Drag or tap</span> to scrub across time. Four line traces, one per type. <span style={{ color: "#00d4ff88" }}>◆ Diamonds</span> on the spine are your personal moments. Toggle <span style={{ color: "#555" }}>1Y / 10Y</span> to shift resolution.
        </p>
      </div>
    </div>
  );
}
