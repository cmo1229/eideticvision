"use client"

import { useEffect, useState } from "react"
import { FloatingOrbs, NoiseOverlay, Nav } from "@/components/landing/atmosphere"

const PATHS = [
  {
    tag: "i have a scan",
    title: "Upload your splat",
    body: "Made one with Scaniverse or another capture app? Drop it in. It renders in seconds.",
    cta: "Create a Place",
    href: "/create",
    icon: "◈",
    featured: true,
  },
  {
    tag: "help me make one",
    title: "Capture it yourself in 10 minutes",
    body: "A phone is all it takes. We walk you through it, step by step — no experience needed.",
    cta: "See the guide",
    href: "/preserve",
    icon: "◎",
  },
  {
    tag: "do it for me",
    title: "Professional preservation",
    body: "Selling the house tomorrow? We capture it properly, clean it, and set up the archive with your family.",
    cta: "Learn more",
    href: "/preserve#service",
    icon: "✦",
  },
]

const STEPS = [
  { n: "01", title: "create a place", body: "Name it. Set its years. This is the vessel — Grandma's House, 1978–2026." },
  { n: "02", title: "capture the space", body: "Walk the rooms once with a phone. The scan becomes a walkable 3D memory." },
  { n: "03", title: "gather the memories", body: "Pin photos, stories and voices to exact spots. Everyone who remembers, contributes." },
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

      {/* Hero — the three paths ARE the hero choice */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden py-28">
        <div className="absolute inset-0 z-0">
          <video autoPlay muted loop playsInline preload="auto" className="w-full h-full object-cover">
            <source src="/background.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="absolute inset-0 z-[1] bg-black/80" />
        <div className="absolute inset-0 z-[1] bg-gradient-to-t from-[#030305] via-[#030305]/50 to-[#030305]/70" />
        <FloatingOrbs />
        <NoiseOverlay />

        <div
          className="relative z-10 flex flex-col items-center px-6 w-full max-w-5xl text-center"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(20px)",
            transition: "all 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.2s",
          }}
        >
          <h1 className="text-4xl md:text-6xl font-extralight tracking-[-0.02em] leading-[1.05]">
            <span className="text-neutral-100 font-light">Keep the places you</span>
            <br />
            <span className="bg-gradient-to-r from-violet-200 via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent font-light">
              can&apos;t keep forever.
            </span>
          </h1>

          <p className="mt-7 text-neutral-300 text-sm md:text-base font-light leading-relaxed max-w-xl">
            Preserve a meaningful place in 3D. Add the stories that happened there.
            Invite the people who remember it. Explore its history through time.
          </p>

          <p className="mt-10 text-[10px] tracking-[0.4em] uppercase text-neutral-400">
            choose how you&apos;ll begin
          </p>

          {/* The three paths */}
          <div className="mt-6 w-full grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            {PATHS.map((p, i) => (
              <a
                key={p.tag}
                href={p.href}
                className={`group flex flex-col p-7 backdrop-blur-sm transition-all duration-500 border ${
                  p.featured
                    ? "border-violet-500/50 bg-violet-500/[0.08] hover:bg-violet-500/[0.15] hover:border-violet-400/70"
                    : "border-neutral-700/50 bg-black/40 hover:bg-black/60 hover:border-neutral-500/60"
                }`}
                style={{
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? "translateY(0)" : "translateY(24px)",
                  transition: `all 1s cubic-bezier(0.16, 1, 0.3, 1) ${300 + i * 150}ms`,
                }}
              >
                <span className={`text-lg ${p.featured ? "text-violet-300" : "text-neutral-400"}`}>{p.icon}</span>
                <span className="mt-4 text-[9px] tracking-[0.3em] uppercase text-violet-300/80">{p.tag}</span>
                <h2 className="mt-2 text-base text-neutral-100 font-light leading-snug">{p.title}</h2>
                <p className="mt-3 text-xs text-neutral-400 leading-relaxed flex-1">{p.body}</p>
                <span className={`mt-5 text-[10px] tracking-[0.25em] uppercase ${p.featured ? "text-violet-200" : "text-neutral-300 group-hover:text-violet-300"} transition-colors`}>
                  {p.cta} →
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-5xl mx-auto px-6 py-28">
        <div className="text-center mb-20">
          <p className="text-[10px] tracking-[0.4em] uppercase text-neutral-500">how it works</p>
          <h2 className="mt-5 text-2xl md:text-3xl font-extralight tracking-[-0.01em] leading-snug text-neutral-200">
            A place becomes a{" "}
            <span className="bg-gradient-to-r from-violet-200 via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
              memory
            </span>{" "}
            in three quiet steps.
          </h2>
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
              <span className="text-sm font-extralight tracking-[0.2em] text-violet-300/80">{s.n}</span>
              <h3 className="mt-5 text-[13px] font-light tracking-[0.2em] uppercase text-neutral-100">{s.title}</h3>
              <p className="mt-4 text-[13px] font-light leading-loose text-neutral-400">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing */}
      <section className="max-w-2xl mx-auto px-6 pb-40 text-center">
        <p className="text-xl font-extralight text-neutral-200 leading-loose">
          Every place holds its people.
          <br />
          Every person holds their memories.
          <br />
          <span className="bg-gradient-to-r from-violet-200 via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
            Nothing should be lost just because the house is gone.
          </span>
        </p>
        <div className="mt-12 flex items-center justify-center gap-3">
          <span className="text-[10px] tracking-[0.3em] uppercase text-neutral-500">space</span>
          <span className="w-1 h-1 rounded-full bg-neutral-700" />
          <span className="text-[10px] tracking-[0.3em] uppercase text-neutral-500">people</span>
          <span className="w-1 h-1 rounded-full bg-neutral-700" />
          <span className="text-[10px] tracking-[0.3em] uppercase text-neutral-500">memories</span>
          <span className="w-1 h-1 rounded-full bg-neutral-700" />
          <span className="text-[10px] tracking-[0.3em] uppercase text-neutral-500">time</span>
        </div>
      </section>
    </main>
  )
}
