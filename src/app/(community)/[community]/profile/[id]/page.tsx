import { redirect } from "next/navigation"

// Legacy duplicate profile renderer (formerly ProfileDetailPage, reached from
// older Connections/Compare breadcrumbs) folded into the unified /people/[id].
// /{community}/profile/{id} -> /people/{id}, which canonicalizes the id to the
// name slug on arrival. (Profile Unification Phase 2.)
export default async function ProfileDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/people/${id}`)
}
