"use client"

/* ------------------------------------------------------------------ */
/*  Memory archive — worlds persisted to localStorage                   */
/* ------------------------------------------------------------------ */

import type { WorldViews } from "@/components/viewer/world-scene"

export interface ArchiveEntry {
  id: string
  kind: "world" | "image" | "room"
  prompt?: string
  mood?: string
  views?: WorldViews
  image?: string
  createdAt: number
}

const KEY = "eidetic.archive.v1"
const MAX_ENTRIES = 12

// Downscale a data-URL image so 4-view worlds fit comfortably in localStorage
async function shrink(dataUrl: string, maxW = 640): Promise<string> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error("img"))
      i.src = dataUrl
    })
    const scale = Math.min(1, maxW / img.width)
    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))
    const c = document.createElement("canvas")
    c.width = w
    c.height = h
    c.getContext("2d")!.drawImage(img, 0, 0, w, h)
    return c.toDataURL("image/jpeg", 0.72)
  } catch {
    return dataUrl
  }
}

export async function loadArchive(): Promise<ArchiveEntry[]> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    return JSON.parse(raw) as ArchiveEntry[]
  } catch {
    return []
  }
}

export async function saveWorld(entry: {
  kind: "world" | "image" | "room"
  prompt?: string
  mood?: string
  views?: WorldViews
  image?: string
}): Promise<ArchiveEntry | null> {
  try {
    // Shrink images to fit storage budget
    const shrunk: ArchiveEntry = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      ...entry,
    }
    if (entry.views) {
      shrunk.views = {
        front: await shrink(entry.views.front),
        right: await shrink(entry.views.right),
        back: await shrink(entry.views.back),
        left: await shrink(entry.views.left),
      }
    } else if (entry.image) {
      shrunk.image = await shrink(entry.image)
    }

    const archive = await loadArchive()
    archive.unshift(shrunk)
    // Keep the newest N; drop the rest
    while (archive.length > MAX_ENTRIES) archive.pop()

    localStorage.setItem(KEY, JSON.stringify(archive))
    return shrunk
  } catch {
    // Storage full or unavailable — fail silently
    return null
  }
}

export async function deleteWorld(id: string): Promise<ArchiveEntry[]> {
  const archive = (await loadArchive()).filter((e) => e.id !== id)
  try {
    localStorage.setItem(KEY, JSON.stringify(archive))
  } catch {}
  return archive
}
