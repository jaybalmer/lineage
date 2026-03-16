"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Nav } from "@/components/ui/nav"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"

type CodeStatus = "loading" | "valid" | "invalid" | "already_redeemed" | "redeemed"

export default function GiftRedemptionPage() {
  const params = useParams()
  const code = typeof params.code === "string" ? params.code : ""
  const { activePersonId } = useLineageStore()

  const [status, setStatus] = useState<CodeStatus>("loading")
  const [giftedBy, setGiftedBy] = useState<string | null>(null)

  const isAuth = isAuthUser(activePersonId)

  useEffect(() => {
    if (!code) { setStatus("invalid"); return }
    // TODO: fetch from /api/gift/validate once Supabase gift_codes table exists
    // For now, stub: all codes are "valid" if the user is authenticated
    setTimeout(() => {
      if (!isAuth) {
        setStatus("valid") // valid but needs login
      } else {
        setStatus("valid")
        setGiftedBy("a community member") // replace with real data
      }
    }, 800)
  }, [code, isAuth])

  const handleRedeem = async () => {
    if (!isAuth) return
    setStatus("loading")
    // TODO: POST to /api/gift/redeem
    setTimeout(() => setStatus("redeemed"), 800)
  }

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=IBM+Plex+Mono:wght@400;700&display=swap" />

      <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
        <Nav />
        <div className="max-w-md mx-auto px-4 pt-20 pb-24 text-center">

          {status === "loading" && (
            <div className="text-muted animate-pulse" style={{ fontSize: 11 }}>Checking gift code…</div>
          )}

          {status === "invalid" && (
            <div>
              <div className="text-muted mb-4" style={{ fontSize: 40 }}>◎</div>
              <div className="text-foreground mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700 }}>
                INVALID CODE
              </div>
              <p className="text-muted mb-6" style={{ fontSize: 11, lineHeight: 1.7 }}>
                This gift code doesn&apos;t look right. Check the link and try again.
              </p>
              <Link href="/membership" className="underline text-muted hover:text-foreground" style={{ fontSize: 10 }}>
                View membership options →
              </Link>
            </div>
          )}

          {status === "already_redeemed" && (
            <div>
              <div className="text-muted mb-4" style={{ fontSize: 40 }}>◎</div>
              <div className="text-foreground mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 700 }}>
                ALREADY REDEEMED
              </div>
              <p className="text-muted mb-6" style={{ fontSize: 11, lineHeight: 1.7 }}>
                This gift code has already been used.
              </p>
              <Link href="/membership" className="underline text-muted hover:text-foreground" style={{ fontSize: 10 }}>
                View membership options →
              </Link>
            </div>
          )}

          {status === "valid" && (
            <div>
              <div className="mb-4" style={{ fontSize: 48, color: "#3b82f6" }}>◈</div>
              <div className="text-foreground mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: 2 }}>
                YOU&apos;VE BEEN GIFTED<br />A MEMBERSHIP
              </div>
              {giftedBy && (
                <p className="text-muted mb-6" style={{ fontSize: 11, lineHeight: 1.7 }}>
                  {giftedBy} gifted you an annual membership to Lineage.
                </p>
              )}

              {!isAuth ? (
                <div>
                  <p className="text-muted mb-4" style={{ fontSize: 11, lineHeight: 1.7 }}>
                    Create or sign in to your Lineage account to claim your membership.
                  </p>
                  <Link href="/profile"
                    className="inline-block px-6 py-3 rounded-full font-bold"
                    style={{ background: "#3b82f6", color: "#fff", fontSize: 11, letterSpacing: 1, fontFamily: "'IBM Plex Mono', monospace" }}>
                    Sign in to claim →
                  </Link>
                </div>
              ) : (
                <div>
                  <p className="text-muted mb-6" style={{ fontSize: 11, lineHeight: 1.7 }}>
                    Claim your annual membership — it counts fully toward your status and tokens.
                  </p>
                  <button
                    onClick={handleRedeem}
                    className="px-8 py-3 rounded-full font-bold hover:opacity-80 transition-opacity"
                    style={{
                      background: "#3b82f6", color: "#fff",
                      fontSize: 11, letterSpacing: 1.5,
                      fontFamily: "'IBM Plex Mono', monospace",
                      border: "none", cursor: "pointer",
                    }}>
                    Claim membership →
                  </button>
                </div>
              )}
            </div>
          )}

          {status === "redeemed" && (
            <div>
              <div className="mb-4" style={{ fontSize: 48, color: "#10b981" }}>✓</div>
              <div className="text-foreground mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: 2 }}>
                MEMBERSHIP ACTIVATED
              </div>
              <p className="text-muted mb-6" style={{ fontSize: 11, lineHeight: 1.7 }}>
                You&apos;re now an annual member of Lineage. Welcome to the community.
              </p>
              <Link href="/profile"
                className="inline-block px-6 py-3 rounded-full border border-border-default text-muted hover:text-foreground hover:border-foreground transition-all"
                style={{ fontSize: 10, letterSpacing: 1, fontFamily: "'IBM Plex Mono', monospace" }}>
                Go to your profile →
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
