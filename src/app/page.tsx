"use client"

import { useEffect, useState } from "react"
import { FloatingOrbs, NoiseOverlay, Nav } from "@/components/landing/atmosphere"

const STEPS = [
  { n: "01", title: "create a place", body: "Name it. Set its years. This is the vessel — Grandma's House, 1978–2026." },
  { n: "02", title: "capture the space", body: "Walk the rooms once with a phone. The scan becomes a walkable 3D memory." },
  { n: "03", title: "gather the memories", body: "Pin photos, stories and voices to exact spots. Everyone who remembers, contributes." },
]

const ENTRY_POINTS = [
  {
    tag: "i have a scan",
    title: "Upload your splat",
    body: "Made one with Scaniverse or another capture app? Drop it in. It renders in seconds.",
    cta: "Create a Place",
    href: "/create",
  },
  {
    tag: "help me make one",
    title: "Capture it yourself in 10 minutes",
    body: "A phone is all it takes. We walk you through it, step by step — no experience needed.",
    cta: "See the guide",
    href: "/preserve",
  },
  {
    tag: "do it for me",
    title: "Professional preservation",
    body: "Selling the house tomorrow? We capture it properly, clean it, and set up the archive with your family.",
    cta: "Learn more",
    href: "/preserve",
  },
]

export default function Page() {
  const [mounted, setMounted] = useState(false)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    setMounted(true)
    const obs = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold: 0.2 })
    const el = document.getElementById("how")
    if (el) obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <main className="min-h-screen bg-[#030305] text-neutral-200 selection:bg-violet-500/30">
      <Nav />

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <video autoPlay muted loop playsInline preload="auto" className="w-full h-full object-cover">
            <source src="/background.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="absolute inset-0 z-[1] bg-black/70" />
        <div className="absolute inset-0 z-[1] bg-gradient-to-t from-[#030305] via-[#030305]/40 to-[#030305]/60" />
        <FloatingOrbs />
        <NoiseOverlay />

        <div
          className="relative z-10 flex flex-col items-center px-6 text-center"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(20px)",
            transition: "all 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.2s",
          }}
        >
          <h1 className="text-4xl md:text-6xl font-extralight tracking-[-0.02em] leading-[1.05] max-w-3xl">
            <span className="text-neutral-400">Keep the places you</span>
            <br />
            <span className="bg-gradient-to-r from-violet-300/90 via-fuchsia-300 to-cyan-300/80 bg-clip-text text-transparent">
              can&apos;t keep forever.
            </span>
          </h1>

          <p className="mt-8 text-neutral-500 text-sm md:text-base font-light leading-relaxed max-w-xl">
            Preserve a meaningful place in 3D. Add the stories that happened there.
            Invite the people who remember it. Explore its history through time.
          </p>

          <div className="mt-12 flex flex-col sm:flex-row items-center gap-4">
            <a
              href="/create"
              className="px-8 py-3 text-[11px] tracking-[0.3em] uppercase border border-violet-500/40 text-violet-200 bg-violet-500/[0.06] hover:bg-violet-500/[0.14] hover:border-violet-400/60 transition-all"
            >
              create a place
            </a>
            <a
              href="/preserve"
              className="px-8 py-3 text-[11px] tracking-[0.3em] uppercase border border-neutral-800 text-neutral-500 hover:text-neutral-300 hover:border-neutral-600 transition-all"
            >
              have us preserve a place
            </a>
          </div>

          <div className="mt-16 flex items-center gap-6 text-[10px] tracking-[0.3em] uppercase text-neutral-700">
            <span>3D capture</span>
            <span className="w-1 h-1 rounded-full bg-neutral-700" />
            <span>family memories</span>
            <span className="w-1 h-1 rounded-full bg-neutral-700" />
            <span>time</span>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-5xl mx-auto px-6 py-32">
        <div className="flex items-center gap-4 mb-20">
          <span className="block h-[1px] flex-1 bg-neutral-800/40" />
          <span className="block w-1 h-1 rounded-full bg-neutral-800" />
          <span className="block h-[1px] flex-1 bg-neutral-800/40" />
        </div>

        <div className="flex flex-col md:flex-row gap-0">
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              className="flex-1 p-8"
              style={{
                opacity: seen ? 1 : 0,
                transform: seen ? "translateY(0)" : "translateY(20px)",
                transition: `all 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${i * 200}ms`,
              }}
            >
              <span className="text-[10px] tracking-[0.3em] uppercase text-violet-500/60">{s.n}</span>
              <h3 className="mt-5 text-sm tracking-[0.15em] uppercase text-neutral-300">{s.title}</h3>
              <p className="mt-4 text-xs leading-relaxed text-neutral-600">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Three ways in */}
      <section className="max-w-5xl mx-auto px-6 pb-32">
        <p className="text-[10px] tracking-[0.4em] uppercase text-neutral-700 text-center mb-12">
          three ways to begin
        </p>
        <div className="flex flex-col md:flex-row gap-4">
          {ENTRY_POINTS.map((e) => (
            <div key={e.tag} className="flex-1 border border-neutral-800/40 p-8 hover:border-neutral-700/60 transition-colors flex flex-col">
              <span className="text-[9px] tracking-[0.3em] uppercase text-violet-500/60">{e.tag}</span>
              <h3 className="mt-4 text-sm tracking-[0.1em] text-neutral-300">{e.title}</h3>
              <p className="mt-3 text-xs leading-relaxed text-neutral-600 flex-1">{e.body}</p>
              <a
                href={e.href}
                className="mt-6 text-[10px] tracking-[0.25em] uppercase text-violet-400/70 hover:text-violet-300 transition-colors"
              >
                {e.cta} →
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Closing */}
      <section className="max-w-2xl mx-auto px-6 pb-40 text-center">
        <p className="text-lg font-light text-neutral-400 leading-relaxed">
          Every place holds its people.
          <br />
          Every person holds their memories.
          <br />
          Nothing should be lost just because the house is gone.
        </p>
        <div className="mt-12 flex items-center justify-center gap-3">
          <span className="text-[10px] tracking-[0.3em] uppercase text-neutral-700">space</span>
          <span className="w-1 h-1 rounded-full bg-neutral-800" />
          <span className="text-[10px] tracking-[0.3em] uppercase text-neutral-700">people</span>
          <span className="w-1 h-1 rounded-full bg-neutral-800" />
          <span className="text-[10px] tracking-[0.3em] uppercase text-neutral-700">memories</span>
          <span className="w-1 h-1 rounded-full bg-neutral-800" />
          <span className="text-[10px] tracking-[0.3em] uppercase text-neutral-700">time</span>
        </div>
      </section>
    </main>
  )
}
