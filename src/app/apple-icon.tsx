import { ImageResponse } from "next/og"
import { brandMarkSvgString, BRAND_INK } from "@/components/ui/brand-mark"

export const size        = { width: 180, height: 180 }
export const contentType = "image/png"

const PROD_COLOR = "#3b82f6"
const DEV_COLOR  = "#f59e0b"

// White mark on the colored tile. The center punches a true transparent hole
// (knockout) so the tile shows through, and the dot never vanishes into it.
const MARK_COLOR = "#ffffff"

export default function AppleIcon() {
  const isProd = process.env.VERCEL_ENV === "production"
  const color  = isProd ? PROD_COLOR : DEV_COLOR
  const mark   = "data:image/svg+xml," + encodeURIComponent(brandMarkSvgString(MARK_COLOR, BRAND_INK, true))

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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img width={120} height={120} src={mark} alt="" />
      </div>
    ),
    { ...size }
  )
}
