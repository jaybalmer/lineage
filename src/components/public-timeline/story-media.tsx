"use client"

// PB-010 cleanup: the shared story media block (external link, YouTube embed,
// photo grid + lightbox) for the read-only public surfaces.
//
// Extracted from PublicStoryCard so the chromeless timeline fallback and the
// in-place Stack expansion render story media identically. Store-free: fed a
// resolved Story; renders nothing when the story has no media.

import { useState } from "react"
import type { Story } from "@/types"
import { cn, parseYouTubeId } from "@/lib/utils"

export function StoryMedia({ story, className }: { story: Story; className?: string }) {
  const [lightbox, setLightbox] = useState<string | null>(null)
  const photos = (story.photos ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const ytId = story.youtube_url ? parseYouTubeId(story.youtube_url) : null

  const hasMedia = !!story.url || !!ytId || photos.length > 0
  if (!hasMedia) return null

  return (
    <div className={className}>
      {story.url && (
        <a
          href={story.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-1.5 text-sm text-accent-strong hover:underline mb-3 break-all"
        >
          🔗 {story.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
        </a>
      )}

      {ytId && (
        <div className="mt-1 mb-3 rounded-xl overflow-hidden aspect-video bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${ytId}`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            title="Story video"
          />
        </div>
      )}

      {photos.length > 0 && (
        <div className={cn(
          "grid gap-1.5 mb-1 rounded-lg overflow-hidden",
          photos.length === 1 ? "grid-cols-1" : photos.length === 2 ? "grid-cols-2" : "grid-cols-3",
        )}>
          {photos.slice(0, 6).map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightbox(photo.url) }}
              className={cn(
                "relative cursor-pointer overflow-hidden bg-surface-hover",
                photos.length === 1 ? "aspect-[16/9]" : "aspect-square",
                i === 0 && photos.length === 3 ? "col-span-2" : "",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.caption ?? `Photo ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
              {i === 5 && photos.length > 6 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">+{photos.length - 6}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 cursor-zoom-out"
          onClick={(e) => { e.stopPropagation(); setLightbox(null) }}
          role="dialog"
          aria-modal="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  )
}
