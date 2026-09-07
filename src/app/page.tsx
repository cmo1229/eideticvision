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
  { x: 0.24, y: 0.42, label: "First Night Here", color: "#c4b5fd", glow: "rgba(167,139,250,0.55)" },
  { x: 0.55, y: 0.36, label: "Late Night Dinner", color: "#fcd34d", glow: "rgba(251,191,36,0.4)" },
  { x: 0.76, y: 0.55, label: "The Desk", color: "#67e8f9", glow: "rgba(103,232,249,0.4)" },
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
      <section className="min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 relative overflow-hidden">
        {/* Cinematic video field */}
        <div className="absolute inset-0 z-0">
          <video autoPlay muted loop playsInline preload="auto" className="w-full h-full object-cover">
            <source src="/background.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="absolute inset-0 z-[1] bg-black/55" />
        <div className="absolute inset-0 z-[1] bg-gradient-to-b from-[#060607]/70 via-transparent to-[#060607]" />
        {/* brand color wash */}
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 45% at 50% 42%, rgba(139,92,246,0.14), transparent 70%), radial-gradient(ellipse 45% 35% at 78% 62%, rgba(34,211,238,0.07), transparent 70%), radial-gradient(ellipse 40% 30% at 22% 60%, rgba(217,70,239,0.07), transparent 70%)",
          }}
        />

        <div
          className="relative z-10 flex flex-col items-center text-center max-w-3xl"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(16px)",
            transition: "all 1.1s cubic-bezier(0.16, 1, 0.3, 1) 0.1s",
          }}
        >
          <p className="text-[10px] tracking-[0.5em] uppercase text-violet-300/80 mb-8">
            the spatial archive of a life
          </p>
          <h1 className="text-4xl md:text-6xl font-extralight tracking-[-0.02em] leading-[1.08]">
            <span className="text-neutral-100 font-light">Keep the places you</span>
            <br />
            <span className="bg-gradient-to-r from-violet-200 via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent font-light">
              can&apos;t keep forever.
            </span>
          </h1>

          <p className="mt-7 text-neutral-300 text-sm md:text-base font-light leading-relaxed max-w-xl">
            Preserve a meaningful place in 3D. Add the stories that happened there. Invite the
            people who remember it. Explore its history through time.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
            <Link
              href={exploreHref}
              className="px-8 py-3.5 text-[11px] tracking-[0.3em] uppercase border border-violet-400/50 text-violet-100 bg-violet-500/[0.1] hover:bg-violet-500/[0.2] hover:border-violet-300/70 transition-all shadow-[0_0_30px_rgba(139,92,246,0.15)]"
            >
              Explore a Place
            </Link>
            <Link
              href="/create"
              className="px-8 py-3.5 text-[11px] tracking-[0.3em] uppercase border border-neutral-700/70 text-neutral-300 hover:border-neutral-500 hover:text-neutral-100 bg-black/30 backdrop-blur-sm transition-all"
            >
              Create a Place
            </Link>
          </div>

          <p
            className="mt-8 text-[10px] tracking-[0.3em] uppercase"
            style={{
              opacity: mounted ? 1 : 0,
              transition: "opacity 1.4s cubic-bezier(0.16, 1, 0.3, 1) 0.9s",
            }}
          >
            <span className="text-neutral-600">featured · </span>
            <Link
              href={exploreHref}
              className="text-violet-300/80 hover:text-violet-200 transition-colors"
            >
              Studio Apartment — Claremont, California · 2025–2026 →
            </Link>
          </p>
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
      <section className="max-w-2xl mx-auto px-6 pb-40 text-center relative">
        <div
          className="absolute inset-x-0 bottom-0 h-64 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 50% 60% at 50% 100%, rgba(139,92,246,0.1), transparent 70%)",
          }}
        />
        <div className="flex items-center justify-center gap-3 mb-14">
          <span className="text-[9px] tracking-[0.3em] uppercase text-neutral-500">place</span>
          <span className="w-1 h-1 rounded-full bg-violet-400/60" />
          <span className="text-[9px] tracking-[0.3em] uppercase text-neutral-500">memories</span>
          <span className="w-1 h-1 rounded-full bg-fuchsia-400/60" />
          <span className="text-[9px] tracking-[0.3em] uppercase text-neutral-500">people</span>
          <span className="w-1 h-1 rounded-full bg-cyan-400/60" />
          <span className="text-[9px] tracking-[0.3em] uppercase text-neutral-500">time</span>
        </div>
        <Link
          href={exploreHref}
          className="relative inline-block px-10 py-4 text-[11px] tracking-[0.3em] uppercase border border-violet-400/50 text-violet-100 bg-violet-500/[0.1] hover:bg-violet-500/[0.2] hover:border-violet-300/70 transition-all"
        >
          Explore a Place
        </Link>
      </section>
    </main>
  )
}
