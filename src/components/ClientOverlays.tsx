"use client"

import { MemberCardOverlay } from "@/components/ui/member-card-overlay"
import { CelebrationOverlay } from "@/components/ui/celebration-overlay"
import { WelcomeExplosion } from "@/components/ui/welcome-explosion"

export function ClientOverlays() {
  return (
    <>
      <MemberCardOverlay />
      <WelcomeExplosion />
      <CelebrationOverlay />
    </>
  )
}
