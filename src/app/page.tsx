"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Nav } from "@/components/landing/atmosphere"
import { SEED_PLACE_ID } from "@/lib/places"

const IDEAS = [
  {
    n: "01",
    title: "Preserve the place",
    body: "A meaningful real-world place, captured in 3D and kept navigable — the rooms, the light, the way it actually was.",
  },
  {
    n: "02",
    title: "Add the memories",
    body: "Stories, photos, videos, recordings — each attached to the exact spot where it happened. The place itself becomes the archive.",
  },
  {
    n: "03",
    title: "Invite the people",
    body: "Everyone who remembers it can contribute. Different perspectives, same rooms — the whole history of a place, kept together.",
  },
  {
    n: "04",
    title: "Move through time",
    body: "Drag the timeline and watch the place's history unfold. What was added, and when. The years stay in order; the memories stay put.",
  },
]

const STUDIO_PINS = [
  { x: 0.24, y: 0.42, label: "First Night Here" },
  { x: 0.55, y: 0.36, label: "Late Night Dinner" },
  { x: 0.76, y: 0.55, label: "The Desk" },
]

export default function Page() {
  const [mounted, setMounted] = useState(false)
  const [studioExists, setStudioExists] = useState(false)
  useEffect(() => {
    // Intentional mount-time state (avoids hydration mismatch, enables entry animation)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
    try {
      const places = JSON.parse(localStorage.getItem("eidetic.places.v3") ?? "[]")
      setStudioExists(places.some((p: { id: string }) => p.id === SEED_PLACE_ID))
    } catch {}
  }, [])

  const exploreHref = studioExists ? `/place/${SEED_PLACE_ID}` : "/places"

  return (
    <main className="min-h-screen bg-[#060607] text-neutral-200">
      <Nav />

      {/* Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 relative">
        <div
          className="relative z-10 flex flex-col items-center text-center max-w-3xl"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(16px)",
            transition: "all 1.1s cubic-bezier(0.16, 1, 0.3, 1) 0.1s",
          }}
        >
          <h1 className="text-4xl md:text-6xl font-extralight tracking-[-0.02em] leading-[1.08] text-neutral-100">
            Keep the places you
            <br />
            can&apos;t keep forever.
          </h1>

          <p className="mt-7 text-neutral-400 text-sm md:text-base font-light leading-relaxed max-w-xl">
            Preserve a meaningful place in 3D. Add the stories that happened there. Invite the
            people who remember it. Explore its history through time.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
            <Link
              href={exploreHref}
              className="px-8 py-3.5 text-[11px] tracking-[0.3em] uppercase border border-[#c9bda4]/40 text-[#f5efe2] bg-[#c9bda4]/[0.06] hover:bg-[#c9bda4]/[0.12] transition-all"
            >
              Explore a Place
            </Link>
            <Link
              href="/create"
              className="px-8 py-3.5 text-[11px] tracking-[0.3em] uppercase border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200 transition-all"
            >
              Create a Place
            </Link>
          </div>
        </div>

        {/* Featured place preview */}
        <div
          className="relative z-10 mt-20 w-full max-w-4xl"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(24px)",
            transition: "all 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.4s",
          }}
        >
          <Link
            href={exploreHref}
            className="group block border border-neutral-900 hover:border-neutral-700 transition-colors"
          >
            <div className="relative aspect-[21/9] bg-[#08080a] overflow-hidden">
              {/* archival frame — an honest preview, not a fake capture */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-[9px] tracking-[0.4em] uppercase text-neutral-600">
                    featured place
                  </p>
                  <p className="mt-3 text-lg font-extralight text-neutral-300 tracking-wide">
                    Studio Apartment
                  </p>
                  <p className="mt-1.5 text-[9px] tracking-[0.3em] uppercase text-neutral-600">
                    Claremont, California · 2025–2026
                  </p>
                </div>
              </div>
              {/* memory pins, waiting where they were left */}
              {STUDIO_PINS.map((p) => (
                <span
                  key={p.label}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                  style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                >
                  <span className="w-2 h-2 rounded-full bg-[#c9bda4]/80 group-hover:bg-[#f5efe2] transition-colors" />
                  <span className="mt-2 text-[8px] tracking-[0.2em] uppercase text-neutral-700 group-hover:text-neutral-500 transition-colors">
                    {p.label}
                  </span>
                </span>
              ))}
              <div className="absolute bottom-4 right-5 text-[9px] tracking-[0.3em] uppercase text-neutral-600 group-hover:text-neutral-400 transition-colors">
                enter the place →
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* The four ideas */}
      <section className="max-w-5xl mx-auto px-6 py-28">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-16">
          {IDEAS.map((idea) => (
            <div key={idea.n}>
              <span className="text-[10px] tracking-[0.3em] text-[#c9bda4]/70 tabular-nums">
                {idea.n}
              </span>
              <h2 className="mt-4 text-sm font-light tracking-[0.15em] uppercase text-neutral-100">
                {idea.title}
              </h2>
              <p className="mt-3 text-[13px] font-light leading-loose text-neutral-500">
                {idea.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* One use case */}
      <section className="max-w-2xl mx-auto px-6 py-24 text-center">
        <p className="text-[10px] tracking-[0.4em] uppercase text-neutral-600">for example</p>
        <p className="mt-8 text-xl md:text-2xl font-extralight text-neutral-300 leading-loose">
          Your grandmother&apos;s house was sold last spring. The kitchen table where every holiday
          happened is gone.
          <span className="text-neutral-500"> The stories don&apos;t have to be.</span>
        </p>
        <p className="mt-8 text-xs text-neutral-500 leading-relaxed font-light max-w-md mx-auto">
          Capture the house before it changes hands. Pin the stories to the rooms they belong to.
          Let everyone who lived there add what they remember.
        </p>
      </section>

      {/* Final CTA */}
      <section className="max-w-2xl mx-auto px-6 pb-40 text-center">
        <div className="flex items-center justify-center gap-3 mb-14">
          <span className="text-[9px] tracking-[0.3em] uppercase text-neutral-600">place</span>
          <span className="w-1 h-1 rounded-full bg-neutral-700" />
          <span className="text-[9px] tracking-[0.3em] uppercase text-neutral-600">memories</span>
          <span className="w-1 h-1 rounded-full bg-neutral-700" />
          <span className="text-[9px] tracking-[0.3em] uppercase text-neutral-600">people</span>
          <span className="w-1 h-1 rounded-full bg-neutral-700" />
          <span className="text-[9px] tracking-[0.3em] uppercase text-neutral-600">time</span>
        </div>
        <Link
          href={exploreHref}
          className="inline-block px-10 py-4 text-[11px] tracking-[0.3em] uppercase border border-[#c9bda4]/40 text-[#f5efe2] bg-[#c9bda4]/[0.06] hover:bg-[#c9bda4]/[0.12] transition-all"
        >
          Explore a Place
        </Link>
      </section>
    </main>
  )
}
