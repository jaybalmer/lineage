import type { Metadata } from "next"
import { buildDetailMetadata } from "@/lib/entity-metadata"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ community: string; id: string }>
}): Promise<Metadata> {
  const { community, id } = await params
  return buildDetailMetadata({ type: "board", param: id, path: `/${community}/boards/${id}` })
}

export default function BoardDetailLayout({ children }: { children: React.ReactNode }) {
  return children
}
