import type { Metadata } from "next"
import { buildDetailMetadata } from "@/lib/entity-metadata"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ community: string; slug: string }>
}): Promise<Metadata> {
  const { community, slug } = await params
  return buildDetailMetadata({ type: "org", param: slug, path: `/${community}/brands/${slug}` })
}

export default function BrandDetailLayout({ children }: { children: React.ReactNode }) {
  return children
}
