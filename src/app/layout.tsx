import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Lineage — Snowboarding History Graph",
  description: "A living, time-aware, community-authored snowboarding lineage graph",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0a0a] text-[#e5e5e5] antialiased min-h-screen">
        {children}
      </body>
    </html>
  )
}
