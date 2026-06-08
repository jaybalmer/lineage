import type { Metadata } from "next"
import { buildDetailMetadata } from "@/lib/entity-metadata"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  return buildDetailMetadata({ type: "person", param: id, path: `/people/${id}` })
}

export default function PersonDetailLayout({ children }: { children: React.ReactNode }) {
  return children
}
