"use client"

import { use } from "react"
import { redirect } from "next/navigation"
import { ORGS, getOrgBySlug, orgSlug } from "@/lib/mock-data"

export default function OrgPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const org = ORGS.find((o) => o.id === id) ?? getOrgBySlug(id)
  if (org) {
    redirect(`/brands/${orgSlug(org)}`)
  }
  redirect("/brands")
}
