"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Nav } from "@/components/landing/atmosphere"
import { loadPlaces, loadMemories, type Place } from "@/lib/places"

export default function PlacesPage() {
  const [places, setPlaces] = useState<Place[]>([])
  const [stats, setStats] = useState<Record<string, { memories: number; contributors: number }>>({})
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const p = loadPlaces()
    // Intentional mount-time load from localStorage (client-only data)
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
            <Link
              key={p.id}
              href={`/place/${p.id}`}
              className="group border border-neutral-900 hover:border-neutral-700 transition-colors"
              style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? "translateY(0)" : "translateY(12px)",
                transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 90}ms`,
              }}
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
          ))}
        </div>
      </section>
    </main>
  )
}
