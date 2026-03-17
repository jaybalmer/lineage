import type { Metadata } from "next"
import "./globals.css"
import { CatalogLoader } from "@/components/catalog-loader"
import { ClientOverlays } from "@/components/ClientOverlays"

export const metadata: Metadata = {
  title: "Lineage — Snowboarding History Graph",
  description: "A living, time-aware, community-authored snowboarding lineage graph",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased min-h-screen">
        <CatalogLoader />
        <ClientOverlays />
        {children}
      </body>
    </html>
  )
}
