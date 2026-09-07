"use client"

/* ------------------------------------------------------------------ */
/*  Eidetic Vision — data layer                                        */
/*  Places + memories + members in localStorage;                       */
/*  splat files in IndexedDB. Private by default, local-first.         */
/* ------------------------------------------------------------------ */

export type MemberRole = "owner" | "contributor" | "viewer"

export interface PlaceMember {
  id: string
  name: string
  email?: string
  role: MemberRole
}

export interface Place {
  id: string
  ownerId: string
  name: string
  location: string
  description: string
  startYear: number
  endYear: number
  endOpen: boolean // endYear is "Present"
  coverImageUrl?: string
  hasSplat: boolean
  splatName?: string
  splatFormat?: string
  splatRenderingReady?: boolean // false = file stored, viewer integration pending
  cloudId?: string // set once the place has been published to the public archive
  members: PlaceMember[]
  createdAt: number
}

export interface MemoryPosition {
  // Normalized screen coordinates (0..1) while spatial capture is not
  // connected; true world coordinates once a splat is placed in the viewer.
  x: number
  y: number
  z: number
}

export interface Memory {
  id: string
  placeId: string
  contributorId: string // prototype: contributor name
  title: string
  story: string
  date: string // ISO-ish "YYYY-MM" from month input; display-formatted in UI
  year: number // timeline key, derived from date
  mediaType?: "image" | "video"
  mediaUrl?: string
  audioUrl?: string
  position: MemoryPosition
  createdAt: number
}

const PLACES_KEY = "eidetic.places.v3"
const MEMORIES_KEY = "eidetic.memories.v3"
const SPLAT_STORE = "splats"

/* ---------------- Migration from v2 ---------------- */

interface LegacyPin {
  id: string
  placeId: string
  title: string
  story: string
  year: number
  contributor: string
  photo?: string
  pos: [number, number, number]
  createdAt: number
}

function migrateV2() {
  try {
    const legacyPlaces = localStorage.getItem("eidetic.places.v2")
    const legacyPins = localStorage.getItem("eidetic.pins.v2")
    if (!legacyPlaces) return
    const places: Array<Record<string, unknown>> = JSON.parse(legacyPlaces)
    const migrated = places.map((p) => ({
      ownerId: "local",
      name: p.name,
      location: "",
      description: p.description ?? "",
      startYear: p.startYear,
      endYear: p.endYear,
      endOpen: false,
      coverImageUrl: p.cover,
      hasSplat: p.hasSplat ?? false,
      splatName: p.splatName as string | undefined,
      splatFormat:
        typeof p.splatName === "string" ? p.splatName.split(".").pop() : undefined,
      splatRenderingReady: p.hasSplat ? true : undefined,
      members: [
        { id: crypto.randomUUID(), name: "You", role: "owner" as MemberRole },
        ...((p.contributors as string[]) ?? [])
          .filter((c) => c !== "you" && c !== "You")
          .map((c) => ({ id: crypto.randomUUID(), name: c, role: "contributor" as MemberRole })),
      ],
      createdAt: p.createdAt ?? Date.now(),
      id: p.id,
    }))
    localStorage.setItem(PLACES_KEY, JSON.stringify(migrated))
    if (legacyPins) {
      const pins: LegacyPin[] = JSON.parse(legacyPins)
      const memories: Memory[] = pins.map((pin) => ({
        id: pin.id,
        placeId: pin.placeId,
        contributorId: pin.contributor,
        title: pin.title,
        story: pin.story,
        date: String(pin.year),
        year: pin.year,
        mediaType: pin.photo ? ("image" as const) : undefined,
        mediaUrl: pin.photo,
        position: { x: pin.pos[0], y: pin.pos[1], z: pin.pos[2] },
        createdAt: pin.createdAt,
      }))
      localStorage.setItem(MEMORIES_KEY, JSON.stringify(memories))
    }
    localStorage.removeItem("eidetic.places.v2")
    localStorage.removeItem("eidetic.pins.v2")
  } catch {
    // migration is best-effort
  }
}

/* ---------------- Seed: the first working example ---------------- */

export const SEED_PLACE_ID = "studio-2026"

function seed(): void {
  const place: Place = {
    id: SEED_PLACE_ID,
    ownerId: "charlie",
    name: "Studio Apartment",
    location: "Claremont, California",
    description:
      "A small apartment near the college. The first place that was entirely mine — and where Eidetic Vision was born at the desk by the window.",
    startYear: 2025,
    endYear: 2026,
    endOpen: false,
    hasSplat: false,
    members: [
      { id: "charlie", name: "Charlie", role: "owner" },
      { id: "alex", name: "Alex", role: "contributor" },
      { id: "mom", name: "Mom", role: "contributor" },
    ],
    createdAt: Date.now(),
  }
  const memories: Memory[] = [
    {
      id: "seed-first-night",
      placeId: SEED_PLACE_ID,
      contributorId: "charlie",
      title: "First Night Here",
      story: "First night after moving into the apartment. Nothing on the walls yet, a mattress on the floor, and the whole future suddenly feeling real.",
      date: "2025-01",
      year: 2025,
      position: { x: 0.24, y: 0.42, z: 0 },
      createdAt: Date.now(),
    },
    {
      id: "seed-late-dinner",
      placeId: SEED_PLACE_ID,
      contributorId: "alex",
      title: "Late Night Dinner",
      story: "One of many nights we ended up talking in the kitchen way too late.",
      date: "2026-04",
      year: 2026,
      position: { x: 0.55, y: 0.36, z: 0 },
      createdAt: Date.now(),
    },
    {
      id: "seed-the-desk",
      placeId: SEED_PLACE_ID,
      contributorId: "charlie",
      title: "The Desk",
      story: "Built the first version of Eidetic Vision here.",
      date: "2026-09",
      year: 2026,
      position: { x: 0.76, y: 0.55, z: 0 },
      createdAt: Date.now(),
    },
  ]
  localStorage.setItem(PLACES_KEY, JSON.stringify([place]))
  localStorage.setItem(MEMORIES_KEY, JSON.stringify(memories))
}

/** Seed the Studio Apartment example on first visit only. */
export function ensureSeed(): void {
  migrateV2()
  if (!localStorage.getItem("eidetic.seeded.v1")) {
    if (JSON.parse(localStorage.getItem(PLACES_KEY) ?? "[]").length === 0) {
      seed()
    }
    localStorage.setItem("eidetic.seeded.v1", "true")
  }
}

/* ---------------- Places ---------------- */

export function loadPlaces(): Place[] {
  ensureSeed()
  try {
    return JSON.parse(localStorage.getItem(PLACES_KEY) ?? "[]") as Place[]
  } catch {
    return []
  }
}

export function savePlace(place: Place): Place[] {
  const places = loadPlaces().filter((p) => p.id !== place.id)
  places.unshift(place)
  localStorage.setItem(PLACES_KEY, JSON.stringify(places))
  return places
}

export function getPlace(id: string): Place | undefined {
  return loadPlaces().find((p) => p.id === id)
}

export function deletePlace(id: string): Place[] {
  const places = loadPlaces().filter((p) => p.id !== id)
  localStorage.setItem(PLACES_KEY, JSON.stringify(places))
  deleteSplat(id)
  const memories = loadMemories().filter((m) => m.placeId !== id)
  localStorage.setItem(MEMORIES_KEY, JSON.stringify(memories))
  return places
}

/* ---------------- Memories ---------------- */

export function loadMemories(placeId?: string): Memory[] {
  ensureSeed()
  try {
    const all = JSON.parse(localStorage.getItem(MEMORIES_KEY) ?? "[]") as Memory[]
    return placeId ? all.filter((m) => m.placeId === placeId) : all
  } catch {
    return []
  }
}

export function saveMemory(memory: Memory): Memory[] {
  const all = loadMemories().filter((m) => m.id !== memory.id)
  all.push(memory)
  localStorage.setItem(MEMORIES_KEY, JSON.stringify(all))
  return loadMemories(memory.placeId)
}

export function deleteMemory(id: string, placeId: string): Memory[] {
  const all = loadMemories().filter((m) => m.id !== id)
  localStorage.setItem(MEMORIES_KEY, JSON.stringify(all))
  return loadMemories(placeId)
}

export function placeYears(place: Place, memories: Memory[]): { min: number; max: number } {
  const years = memories.map((m) => m.year)
  return {
    min: Math.min(place.startYear, ...(years.length ? years : [place.startYear])),
    max: Math.max(place.endYear, ...(years.length ? years : [place.endYear])),
  }
}

/* ---------------- Contributors (prototype) ---------------- */

/** Simulated invite — no email delivery. Clearly labeled as prototype in the UI. */
export function addMember(
  placeId: string,
  member: { name: string; email: string; role: MemberRole }
): Place | null {
  const place = getPlace(placeId)
  if (!place) return null
  const updated: Place = {
    ...place,
    members: [
      ...place.members,
      {
        id: crypto.randomUUID(),
        name: member.name || member.email.split("@")[0],
        email: member.email,
        role: member.role,
      },
    ],
  }
  savePlace(updated)
  return updated
}

/* ---------------- Splat files (IndexedDB) ---------------- */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("eidetic-splats", 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(SPLAT_STORE)) {
        db.createObjectStore(SPLAT_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function storeSplat(placeId: string, file: Blob): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SPLAT_STORE, "readwrite")
    tx.objectStore(SPLAT_STORE).put(file, placeId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getSplatBlob(placeId: string): Promise<Blob | null> {
  try {
    const db = await openDb()
    return new Promise((resolve) => {
      const tx = db.transaction(SPLAT_STORE, "readonly")
      const req = tx.objectStore(SPLAT_STORE).get(placeId)
      req.onsuccess = () => resolve((req.result as Blob) ?? null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function getSplatUrl(placeId: string): Promise<string | null> {
  const blob = await getSplatBlob(placeId)
  return blob ? URL.createObjectURL(blob) : null
}

export async function deleteSplat(placeId: string): Promise<void> {
  try {
    const db = await openDb()
    const tx = db.transaction(SPLAT_STORE, "readwrite")
    tx.objectStore(SPLAT_STORE).delete(placeId)
  } catch {}
}

/* ---------------- Export / Import (collaboration bridge) ---------------- */

export function exportPlace(id: string): string | null {
  const place = getPlace(id)
  if (!place) return null
  return JSON.stringify({ place, memories: loadMemories(id) }, null, 2)
}

export function importPlace(json: string): Place | null {
  try {
    const data = JSON.parse(json)
    if (!data.place?.id) return null
    savePlace(data.place)
    const existing = loadMemories().filter((m) => m.placeId !== data.place.id)
    const merged = [...existing, ...(data.memories ?? data.pins ?? [])]
    localStorage.setItem(MEMORIES_KEY, JSON.stringify(merged))
    return data.place
  } catch {
    return null
  }
}

/* ---------------- Media helpers ---------------- */

/** Downscale an image to a storage-friendly data URL. */
export function fileToDataUrl(file: File, maxW = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width)
      const c = document.createElement("canvas")
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL("image/jpeg", 0.75))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("image failed"))
    }
    img.src = url
  })
}

/** Read a media file as a data URL, rejecting anything too large for
 *  local prototype storage (localStorage holds everything). */
export async function fileToMediaDataUrl(file: File, maxBytes = 1_800_000): Promise<string> {
  if (file.size > maxBytes) {
    throw new Error(
      `file is ${(file.size / 1024 / 1024).toFixed(1)} MB — local prototype storage caps media at ${(maxBytes / 1024 / 1024).toFixed(1)} MB`
    )
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("could not read file"))
    reader.readAsDataURL(file)
  })
}

/** "2026-04" → "April 2026"; plain "1998" → "1998". */
export function formatMemoryDate(date: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(date)
  if (m) {
    const month = new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleString("en-US", { month: "long" })
    return `${month} ${m[1]}`
  }
  return date
}
