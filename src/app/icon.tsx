import { ImageResponse } from "next/og"
import { brandMarkSvgString } from "@/components/ui/brand-mark"

export const size        = { width: 32, height: 32 }
export const contentType = "image/png"

// Blue  → Vercel production  (linestry.com)
// Amber → local dev + preview builds
const PROD_COLOR    = "#3b82f6"
const DEV_COLOR     = "#f59e0b"

export default function Icon() {
  const isProd = process.env.VERCEL_ENV === "production"
  const color  = isProd ? PROD_COLOR : DEV_COLOR
  // At 32px a contrast dot reads as noise, so render mono: body and dot share
  // the one color. Keep the existing dev/prod color signal.
  const mark   = "data:image/svg+xml," + encodeURIComponent(brandMarkSvgString(color, color))

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
        {/* Landscape mark (aspect ~1.518): match the img box to that aspect so
            Satori does not squish it into the square tile. Flex-centered. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img width={30} height={20} src={mark} alt="" />
      </div>
    ),
    { ...size }
  )
}
