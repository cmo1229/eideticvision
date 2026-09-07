"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Nav } from "@/components/landing/atmosphere"
import { loadPlaces, loadMemories, deletePlace, type Place } from "@/lib/places"
import { unpublishPlace } from "@/lib/cloud"

export default function PlacesPage() {
  const [places, setPlaces] = useState<Place[]>([])
  const [stats, setStats] = useState<Record<string, { memories: number; contributors: number }>>({})
  const [mounted, setMounted] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const p = loadPlaces()
    // Intentional mount-time load from localStorage (client-only data)
    setPlaces(p)
    const s: Record<string, { memories: number; contributors: number }> = {}
    for (const place of p) {
      s[place.id] = {
        memories: loadMemories(place.id).length,
        contributors: place.members.length,
      }
    }
    setStats(s)
    setMounted(true)
  }, [])

  const refresh = () => {
    const p = loadPlaces()
    setPlaces(p)
    const s: Record<string, { memories: number; contributors: number }> = {}
    for (const place of p) {
      s[place.id] = {
        memories: loadMemories(place.id).length,
        contributors: place.members.length,
      }
    }
    setStats(s)
  }

  const handleDelete = async (place: Place) => {
    setDeleting(true)
    try {
      // If published, also remove it from the public archive (best effort)
      if (place.cloudId) {
        await unpublishPlace(place.cloudId).catch(() => {})
      }
      deletePlace(place.id)
      refresh()
    } finally {
      setDeleting(false)
      setConfirmingId(null)
    }
  }

  return (
    <main className="min-h-screen bg-[#060607] text-neutral-200">
      <Nav active="places" />

      <section className="max-w-5xl mx-auto px-6 pt-32 pb-24">
        <p className="text-[10px] tracking-[0.4em] uppercase text-neutral-600">my places</p>
        <h1 className="mt-4 text-2xl font-extralight text-neutral-100 tracking-wide">
          The spatial history of your life.
        </h1>

        {mounted && places.length === 0 && (
          <div className="mt-16 border border-dashed border-neutral-800 p-16 text-center">
            <p className="text-sm text-neutral-400 font-light">
              No places yet. The first one is usually a house you can&apos;t go back to.
            </p>
            <Link
              href="/create"
              className="inline-block mt-8 px-8 py-3 text-[11px] tracking-[0.3em] uppercase border border-[#c9bda4]/40 text-[#f5efe2] bg-[#c9bda4]/[0.06] hover:bg-[#c9bda4]/[0.12] transition-all"
            >
              Create a Place
            </Link>
          </div>
        )}

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {places.map((p, i) => (
            <div
              key={p.id}
              className="relative"
              style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? "translateY(0)" : "translateY(12px)",
                transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 90}ms`,
              }}
            >
              <Link
                href={`/place/${p.id}`}
                className="group block border border-neutral-900 hover:border-neutral-700 transition-colors"
              >
                <div className="aspect-video overflow-hidden bg-[#0a0a0c] relative">
                  {p.coverImageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.coverImageUrl}
                      alt={p.name}
                      className="w-full h-full object-cover opacity-75 group-hover:opacity-95 group-hover:scale-[1.02] transition-all duration-700"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-[10px] tracking-[0.4em] uppercase text-neutral-700 group-hover:text-neutral-600 transition-colors">
                        {p.name}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#060607] via-transparent to-transparent" />
                </div>
                <div className="p-5">
                  <h3 className="text-sm text-neutral-100 font-light">{p.name}</h3>
                  {p.location && (
                    <p className="mt-1 text-[10px] tracking-[0.25em] uppercase text-neutral-500">
                      {p.location}
                    </p>
                  )}
                  <p className="mt-1 text-[10px] tracking-[0.25em] uppercase text-neutral-600">
                    {p.startYear}–{p.endOpen ? "Present" : p.endYear}
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-[10px] tracking-[0.2em] uppercase text-neutral-500">
                      {stats[p.id]?.memories ?? 0} memories · {stats[p.id]?.contributors ?? 0}{" "}
                      contributor{(stats[p.id]?.contributors ?? 0) !== 1 ? "s" : ""}
                    </p>
                    <span className="text-[9px] tracking-[0.25em] uppercase text-neutral-600 group-hover:text-[#e8e2d4] transition-colors">
                      enter →
                    </span>
                  </div>
                </div>
              </Link>

              {/* Delete with confirmation */}
              <button
                onClick={() => setConfirmingId(confirmingId === p.id ? null : p.id)}
                aria-label={`Delete ${p.name}`}
                className={`absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center text-sm leading-none border backdrop-blur-sm transition-colors ${
                  confirmingId === p.id
                    ? "border-red-400/50 text-red-300 bg-black/70"
                    : "border-neutral-800 text-neutral-600 hover:text-red-300 hover:border-red-400/40 bg-black/50"
                }`}
              >
                ×
              </button>

              {confirmingId === p.id && (
                <div className="absolute inset-0 z-20 bg-[#060607]/92 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6">
                  <p className="text-xs text-neutral-200 leading-relaxed">
                    Delete <span className="text-neutral-100">{p.name}</span> forever?
                  </p>
                  <p className="mt-2 text-[10px] text-neutral-500 leading-relaxed">
                    {p.cloudId
                      ? "Removes the place, its memories and its capture from this device and the public archive."
                      : "Removes the place, its memories and its capture from this device."}
                  </p>
                  <div className="mt-5 flex items-center gap-3">
                    <button
                      onClick={() => handleDelete(p)}
                      disabled={deleting}
                      className="px-4 py-2 text-[9px] tracking-[0.25em] uppercase border border-red-400/50 text-red-300 bg-red-500/[0.08] hover:bg-red-500/[0.16] transition-colors disabled:opacity-40"
                    >
                      {deleting ? "deleting…" : "yes, delete"}
                    </button>
                    <button
                      onClick={() => setConfirmingId(null)}
                      className="px-4 py-2 text-[9px] tracking-[0.25em] uppercase border border-neutral-800 text-neutral-400 hover:border-neutral-600 transition-colors"
                    >
                      keep it
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
