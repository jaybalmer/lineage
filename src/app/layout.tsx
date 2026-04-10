import type { Metadata } from "next"
import { DM_Serif_Display } from "next/font/google"
import "./globals.css"
import { CatalogLoader } from "@/components/catalog-loader"
import { ClientOverlays } from "@/components/ClientOverlays"
import { PasswordGate } from "@/components/PasswordGate"
import { Analytics } from "@vercel/analytics/next"

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-display",
})

export const metadata: Metadata = {
  title: "Lineage Community Tech",
  description: "A living, time-aware, community-authored snowboarding lineage graph",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dmSerif.variable} suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased min-h-screen">
        <PasswordGate>
          <CatalogLoader />
          <ClientOverlays />
          {children}
        </PasswordGate>
        <Analytics />
      </body>
    </html>
  )
}
