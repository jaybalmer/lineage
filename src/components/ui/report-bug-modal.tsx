"use client"

import { useEffect, useRef, useState, type ChangeEvent } from "react"
import posthog from "posthog-js"
import { cn } from "@/lib/utils"
import { useLineageStore } from "@/store/lineage-store"

interface ReportBugModalProps {
  open: boolean
  onClose: () => void
  /** When true, the helper line notes that the signed-in account is attached too. */
  includeAccount?: boolean
}

const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/gif"
const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // hard ceiling after client compression

/**
 * Downscale and re-encode a chosen image to JPEG in the browser. Keeps the upload
 * well under the serverless body limit, normalizes the format, and strips EXIF.
 * Falls back to the original file if anything goes wrong.
 */
async function compressImage(file: File, maxDim = 1920, quality = 0.85): Promise<Blob> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("read failed"))
    reader.readAsDataURL(file)
  })
  const img: HTMLImageElement = await new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error("decode failed"))
    im.src = dataUrl
  })
  let width = img.width
  let height = img.height
  if (width > maxDim || height > maxDim) {
    const scale = Math.min(maxDim / width, maxDim / height)
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return file
  ctx.drawImage(img, 0, 0, width, height)
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  )
  return blob ?? file
}

/**
 * "Report a bug" modal, opened from the avatar dropdown (signed-in) and the guest
 * menu (logged-out). Captures the current page, viewport, browser, and PostHog
 * session replay link automatically. An optional screenshot is sent along as an
 * email attachment so triage can see the bug without scanning a session replay.
 * Reporter identity is added server-side from the session, never sent from here.
 */
export function ReportBugModal({ open, onClose, includeAccount = false }: ReportBugModalProps) {
  const addToast = useLineageStore((s) => s.addToast)
  const [note, setNote] = useState("")
  const [expected, setExpected] = useState("")
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Captured when the widget OPENS, not when Send is hit: the bug predates
  // the typing, so triage wants the replay anchored just before the reporter
  // reached for the widget (10 second lookback). Reset on every open
  // transition so a closed-and-reopened widget gets fresh values. Declared
  // above the early return below (rules of hooks).
  const reportStartedAtRef = useRef<string | null>(null)
  const replayUrlAtOpenRef = useRef<string | null>(null)
  useEffect(() => {
    if (!open) return
    reportStartedAtRef.current = new Date().toISOString()
    try {
      replayUrlAtOpenRef.current =
        posthog.get_session_replay_url?.({ withTimestamp: true, timestampLookBack: 10 }) || null
    } catch {
      replayUrlAtOpenRef.current = null
    }
  }, [open])

  if (!open) return null

  const canSend = note.trim().length > 0 && !submitting

  function clearImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImage(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileInputRef.current) fileInputRef.current.value = "" // allow re-picking the same file
    if (!file) return
    if (!file.type.startsWith("image/")) {
      addToast("Please choose an image file.", "error")
      return
    }
    let blob: Blob = file
    try {
      blob = await compressImage(file)
    } catch {
      blob = file
    }
    if (blob.size > MAX_IMAGE_BYTES) {
      addToast("That image is too large. Try a smaller screenshot.", "error")
      return
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImage(new File([blob], "screenshot.jpg", { type: blob.type || "image/jpeg" }))
    setImagePreview(URL.createObjectURL(blob))
  }

  async function handleSend() {
    if (note.trim().length === 0 || submitting) return
    setSubmitting(true)

    // PostHog session replay link, captured at widget open (see the effect
    // above). Send-time capture is only the fallback for when PostHog wasn't
    // ready at open. The method name has drifted across versions, so guard it
    // and accept null rather than assuming it exists, or that PostHog is even
    // initialized (there is no key in some environments).
    let posthogSessionUrl: string | null = replayUrlAtOpenRef.current
    if (!posthogSessionUrl) {
      try {
        posthogSessionUrl = posthog.get_session_replay_url?.({ withTimestamp: true }) || null
      } catch {
        posthogSessionUrl = null
      }
    }

    try {
      const form = new FormData()
      form.append("note", note.trim())
      if (expected.trim()) form.append("expected", expected.trim())
      form.append("url", window.location.href)
      form.append("viewport", `${window.innerWidth}x${window.innerHeight}`)
      form.append("userAgent", navigator.userAgent)
      if (posthogSessionUrl) form.append("posthogSessionUrl", posthogSessionUrl)
      if (reportStartedAtRef.current) form.append("reportStartedAt", reportStartedAtRef.current)
      if (image) form.append("image", image, image.name)

      // No Content-Type header: the browser sets the multipart boundary itself.
      const res = await fetch("/api/bug-report", { method: "POST", body: form })
      if (!res.ok) throw new Error("request failed")
      addToast("Thanks. Bug report sent.", "info")
      setNote("")
      setExpected("")
      clearImage()
      onClose()
    } catch {
      addToast("Could not send. Please try again.", "error")
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface border border-border-default rounded-xl max-w-md w-full p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground mb-1">Report a bug</h2>
        <p className="text-sm text-muted mb-4">
          {includeAccount
            ? "Your current page, browser, and account are attached automatically so we can reproduce it."
            : "Your current page and browser are attached automatically so we can reproduce it."}
        </p>

        <label className="block text-xs font-medium text-foreground mb-1">What happened?</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Describe what went wrong"
          autoFocus
          rows={4}
          className="w-full p-2 rounded-lg border border-border-default bg-background text-foreground text-sm mb-4"
        />

        <label className="block text-xs font-medium text-foreground mb-1">
          What did you expect? <span className="text-muted font-normal">(optional)</span>
        </label>
        <textarea
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
          placeholder="What should have happened instead"
          rows={3}
          className="w-full p-2 rounded-lg border border-border-default bg-background text-foreground text-sm mb-4"
        />

        {/* Optional screenshot. Sent as an email attachment so the Gmail-to-Drive
            bridge files it into the bug folder triage already reviews. */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          onChange={handleFileSelect}
          className="hidden"
        />
        {imagePreview ? (
          <div className="mb-4 flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreview}
              alt="Screenshot preview"
              className="max-h-32 rounded-lg border border-border-default"
            />
            <button
              type="button"
              onClick={clearImage}
              disabled={submitting}
              className="text-xs text-muted hover:text-foreground disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting}
            className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground disabled:opacity-50"
          >
            <span aria-hidden="true">📎</span>
            Attach a screenshot <span className="text-muted font-normal">(optional)</span>
          </button>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm",
              !canSend
                ? "bg-surface-active text-muted cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700",
            )}
          >
            {submitting ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  )
}
