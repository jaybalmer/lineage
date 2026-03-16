import { ImageResponse } from "next/og"

export const size        = { width: 180, height: 180 }
export const contentType = "image/png"

const PROD_COLOR = "#3b82f6"
const DEV_COLOR  = "#f59e0b"

export default function AppleIcon() {
  const isProd = process.env.VERCEL_ENV === "production"
  const color  = isProd ? PROD_COLOR : DEV_COLOR

  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: color,
          borderRadius: 36,
        }}
      >
        {/* Outer hexagon */}
        <div
          style={{
            width: 120,
            height: 120,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.15)",
            clipPath:
              "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
          }}
        >
          {/* Inner hexagon */}
          <div
            style={{
              width: 70,
              height: 70,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.2)",
              clipPath:
                "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
            }}
          >
            {/* Center dot */}
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.95)",
              }}
            />
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
