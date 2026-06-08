import type { Metadata } from "next"
import { buildDetailMetadata } from "@/lib/entity-metadata"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ community: string; id: string }>
}): Promise<Metadata> {
  const { community, id } = await params
  return buildDetailMetadata({ type: "place", param: id, path: `/${community}/places/${id}` })
}

export default function PlaceDetailLayout({ children }: { children: React.ReactNode }) {
  return children
}
