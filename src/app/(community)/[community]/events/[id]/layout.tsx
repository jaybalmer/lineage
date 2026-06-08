import type { Metadata } from "next"
import { buildDetailMetadata } from "@/lib/entity-metadata"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ community: string; id: string }>
}): Promise<Metadata> {
  const { community, id } = await params
  return buildDetailMetadata({ type: "event", param: id, path: `/${community}/events/${id}` })
}

export default function EventDetailLayout({ children }: { children: React.ReactNode }) {
  return children
}
