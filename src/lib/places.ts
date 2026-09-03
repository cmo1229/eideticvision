"use client"

/* ------------------------------------------------------------------ */
/*  Places — the memory archive data layer                             */
/*  Metadata + memories in localStorage; splat files in IndexedDB      */
/* ------------------------------------------------------------------ */

export interface MemoryPin {
  id: string
  placeId: string
  title: string
  story: string
  year: number
  contributor: string
  photo?: string // data URL
  pos: [number, number, number]
  createdAt: number
}

export interface Place {
  id: string
  name: string
  startYear: number
  endYear: number
  description: string
  cover?: string // data URL
  hasSplat: boolean
  splatName?: string
  createdAt: number
  contributors: string[]
}

const PLACES_KEY = "eidetic.places.v2"
const PINS_KEY = "eidetic.pins.v2"
const SPLAT_STORE = "splats"

/* ---------------- Places ---------------- */

export function loadPlaces(): Place[] {
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
  // delete pins too
  const pins = loadPins().filter((m) => m.placeId !== id)
  localStorage.setItem(PINS_KEY, JSON.stringify(pins))
  return places
}

/* ---------------- Memories ---------------- */

export function loadPins(placeId?: string): MemoryPin[] {
  try {
    const all = JSON.parse(localStorage.getItem(PINS_KEY) ?? "[]") as MemoryPin[]
    return placeId ? all.filter((m) => m.placeId === placeId) : all
  } catch {
    return []
  }
}

export function savePin(pin: MemoryPin): MemoryPin[] {
  const pins = loadPins().filter((m) => m.id !== pin.id)
  pins.push(pin)
  localStorage.setItem(PINS_KEY, JSON.stringify(pins))
  return loadPins(pin.placeId)
}

export function deletePin(id: string, placeId: string): MemoryPin[] {
  const pins = loadPins().filter((m) => m.id !== id)
  localStorage.setItem(PINS_KEY, JSON.stringify(pins))
  return loadPins(placeId)
}

export function placeYears(place: Place, pins: MemoryPin[]): { min: number; max: number } {
  const years = pins.map((m) => m.year)
  return {
    min: Math.min(place.startYear, ...(years.length ? years : [place.startYear])),
    max: Math.max(place.endYear, ...(years.length ? years : [place.endYear])),
  }
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

export async function getSplatUrl(placeId: string): Promise<string | null> {
  try {
    const db = await openDb()
    return new Promise((resolve) => {
      const tx = db.transaction(SPLAT_STORE, "readonly")
      const req = tx.objectStore(SPLAT_STORE).get(placeId)
      req.onsuccess = () => {
        const blob = req.result as Blob | undefined
        resolve(blob ? URL.createObjectURL(blob) : null)
      }
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
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
  return JSON.stringify({ place, pins: loadPins(id) }, null, 2)
}

export function importPlace(json: string): Place | null {
  try {
    const data = JSON.parse(json)
    if (!data.place?.id) return null
    savePlace(data.place)
    const existing = loadPins().filter((m) => m.placeId !== data.place.id)
    const merged = [...existing, ...(data.pins ?? [])]
    localStorage.setItem(PINS_KEY, JSON.stringify(merged))
    return data.place
  } catch {
    return null
  }
}

/* Downscale a photo to a storage-friendly data URL */
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
