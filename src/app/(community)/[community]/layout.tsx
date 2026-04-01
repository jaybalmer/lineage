import { notFound } from "next/navigation"
import { CommunityShell } from "@/components/community-shell"
import { isValidCommunitySlug } from "@/lib/community"

export default async function CommunityLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ community: string }>
}) {
  const { community } = await params

  if (!isValidCommunitySlug(community)) {
    notFound()
  }

  return <CommunityShell slug={community}>{children}</CommunityShell>
}
