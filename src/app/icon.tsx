import { ImageResponse } from "next/og"

export const size        = { width: 32, height: 32 }
export const contentType = "image/png"

// Blue  → Vercel production  (lineage.wtf)
// Amber → local dev + preview builds
const PROD_COLOR    = "#3b82f6"
const DEV_COLOR     = "#f59e0b"

export default function Icon() {
  const isProd = process.env.VERCEL_ENV === "production"
  const color  = isProd ? PROD_COLOR : DEV_COLOR

  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
      >
        {/* Outer hexagon */}
        <div
          style={{
            width: 30,
            height: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: color,
            clipPath:
              "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
          }}
        >
          {/* Inner hexagon ring */}
          <div
            style={{
              width: 18,
              height: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.18)",
              clipPath:
                "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
            }}
          >
            {/* White center dot */}
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.9)",
              }}
            />
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
