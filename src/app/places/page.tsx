"use client"

import { useEffect, useState } from "react"
import { Nav } from "@/components/landing/atmosphere"
import { loadPlaces, loadPins, type Place } from "@/lib/places"

export default function PlacesPage() {
  const [places, setPlaces] = useState<Place[]>([])
  const [pinCounts, setPinCounts] = useState<Record<string, number>>({})
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const p = loadPlaces()
    setPlaces(p)
    const counts: Record<string, number> = {}
    for (const place of p) {
      counts[place.id] = loadPins(place.id).length
    }
    setPinCounts(counts)
    setMounted(true)
  }, [])

  return (
    <main className="min-h-screen bg-[#030305] text-neutral-200 selection:bg-violet-500/30">
      <Nav active="places" />

      <section className="max-w-5xl mx-auto px-6 pt-32 pb-24">
        <p className="text-[10px] tracking-[0.4em] uppercase text-neutral-600">your places</p>
        <h1 className="mt-4 text-2xl font-extralight text-neutral-100 tracking-wide">
          The spatial history of your life.
        </h1>

        {mounted && places.length === 0 && (
          <div className="mt-16 border border-dashed border-neutral-800/60 p-16 text-center">
            <p className="text-sm text-neutral-400 font-light">
              No places yet. The first one is usually a house you can&apos;t go back to.
            </p>
            <a
              href="/create"
              className="inline-block mt-8 px-8 py-3 text-[11px] tracking-[0.3em] uppercase border border-violet-500/40 text-violet-200 bg-violet-500/[0.06] hover:bg-violet-500/[0.14] transition-all"
            >
              create a place
            </a>
          </div>
        )}

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {places.map((p, i) => (
            <a
              key={p.id}
              href={`/place/${p.id}`}
              className="group border border-neutral-800/40 hover:border-neutral-600/60 transition-colors"
              style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? "translateY(0)" : "translateY(12px)",
                transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 90}ms`,
              }}
            >
              <div className="aspect-video overflow-hidden bg-gradient-to-br from-[#12101c] to-[#0a0a12] relative">
                {p.cover ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={p.cover}
                    alt={p.name}
                    className="w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-[1.03] transition-all duration-700"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl opacity-30">
                    🏠
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#030305] via-transparent to-transparent" />
              </div>
              <div className="p-5">
                <h3 className="text-sm text-neutral-200 font-light">{p.name}</h3>
                <p className="mt-1 text-[10px] tracking-[0.25em] uppercase text-neutral-500">
                  {p.startYear}–{p.endYear}
                </p>
                <p className="mt-3 text-[10px] tracking-[0.2em] uppercase text-neutral-500">
                  {p.contributors.length} contributor{p.contributors.length !== 1 ? "s" : ""} ·{" "}
                  {pinCounts[p.id] ?? 0} memories
                </p>
              </div>
            </a>
          ))}
        </div>
      </section>
    </main>
  )
}
