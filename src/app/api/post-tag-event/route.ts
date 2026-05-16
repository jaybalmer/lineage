// Soft-deprecated alias for /api/tag-event. Keep until 2026-06-30, then delete.
// Exists to cover clients with cached JS that still reference the old path
// after the PB-009 Phase 4 rename. New code should call /api/tag-event.
// Tracking: project_pb009_phase4_strategy.md
export { POST } from "../tag-event/route"
