import { NextRequest, NextResponse } from "next/server"
import { requireEditor } from "@/lib/auth"
import { runMentionImport } from "@/lib/mention-import-server"

// Podcast mention import: one route, two modes.
//
// POST /api/admin/mentions/import
//   { seed, dryRun: true }   resolve against the catalog, write NOTHING, return
//                            the plan the review surface renders
//   { seed, dryRun: false }  create the ghosts, insert the draft mentions,
//                            skip anything already there
//
// The plan and the import come out of the SAME function, so what a person
// reviews is produced by the code that executes it.
//
// APPLY IS EXPLICIT. Anything other than `dryRun: false` plans. The brief
// specified a bare { seed } as the apply call; requiring the field instead means
// a malformed or truncated body can never write to prod by omission, and the
// page always sends it explicitly.
//
// Editor-gated, then service-role, per the standing API pattern. Deliberately
// NOT routed through POST /api/catalog/entity for ghost creation: that path
// awards contribution tokens, which would pay the importer for every entity an
// episode happens to name.

// A seed is a few hundred KB at most. Resolution reads the whole catalog once
// per subject type and an apply run inserts row by row, so a big episode is
// well past the default serverless budget.
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const { user, response } = await requireEditor()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const { seed, dryRun } = body as { seed?: unknown; dryRun?: unknown }
  if (seed === undefined || seed === null) {
    return NextResponse.json({ error: "seed is required" }, { status: 400 })
  }

  const apply = dryRun === false

  const result = await runMentionImport(seed, { actorId: user.id, apply })
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json(result.plan)
}
