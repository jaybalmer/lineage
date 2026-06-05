import type { Metadata } from "next"
import { Geologica } from "next/font/google"
import "./globals.css"
import { CatalogLoader } from "@/components/catalog-loader"
import { ClientOverlays } from "@/components/ClientOverlays"
import { PendingTagPoller } from "@/components/pending-tag-poller"
import { PostHogProvider } from "@/components/posthog-provider"
import { Analytics } from "@vercel/analytics/next"
import { Toasts } from "@/components/ui/toast"

const geologicaDisplay = Geologica({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-display",
  display: "swap",
})

const geologicaBody = Geologica({
  subsets: ["latin"],
  weight: ["300", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL("https://linestry.com"),
  title: "Linestry",
  description: "A living, community-authored snowboarding history graph",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geologicaDisplay.variable} ${geologicaBody.variable}`} suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased min-h-screen">
        <PostHogProvider>
          <CatalogLoader />
          <PendingTagPoller />
          <ClientOverlays />
          {children}
          <Toasts />
          <Analytics />
        </PostHogProvider>
      </body>
    </html>
  )
}
