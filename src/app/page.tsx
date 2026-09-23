"use client"

import { useEffect, useRef, useState } from "react"
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

const SCAN_STEPS = [
  {
    n: "I",
    title: "Scan the place",
    body: "Walk through it with your phone. Scaniverse is free, and a room takes a few minutes — no rig, no tripod, no specialist.",
    icon: "scan",
  },
  {
    n: "II",
    title: "Export as SPZ",
    body: "Share → Export → SPZ. It's the same scan at 5–10× smaller than .ply, and comfortably inside the upload limit.",
    icon: "export",
  },
  {
    n: "III",
    title: "Pin the memories",
    body: "Attach the scan when you create the place, then click the exact spot where each story belongs. The room holds them.",
    icon: "pin",
  },
] as const

const IVORY = "#c9bda4"

/* ------------------------------------------------------------------ */
/*  Reveal — quiet fade-up as a section enters the viewport            */
/* ------------------------------------------------------------------ */

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: "-8% 0px -12% 0px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(20px)",
        transition: `opacity 1s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 1s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  The archival plate — Place · Memories · People · Time as one figure */
/* ------------------------------------------------------------------ */

function PlateOne() {
  // Isometric room: floor rhombus with two walls rising from the back corner.
  const pins = [
    { x: 205, y: 150 },
    { x: 276, y: 137 },
    { x: 166, y: 176 },
    { x: 300, y: 178 },
    { x: 238, y: 198 },
  ]
  const ticks = [88, 164, 240, 316, 392]

  return (
    <svg viewBox="0 0 480 300" className="w-full h-auto" role="img"
      aria-label="An isometric room with memories pinned to points in the space, above a timeline">
      <g
        fill="none"
        stroke={IVORY}
        strokeWidth="1"
        strokeOpacity="0.55"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      >
        {/* floor */}
        <path d="M240 78 L392 156 L240 234 L88 156 Z" />
        {/* walls */}
        <path d="M240 78 L88 156 L88 94 L240 16 Z" strokeOpacity="0.35" />
        <path d="M240 78 L392 156 L392 94 L240 16 Z" strokeOpacity="0.35" />
        {/* corner seam */}
        <path d="M240 78 L240 16" strokeOpacity="0.2" />
      </g>

      {/* memory pins */}
      <g>
        {pins.map((p, i) => (
          <g key={i}>
            <line
              x1={p.x}
              y1={p.y}
              x2={p.x}
              y2={p.y - 11}
              stroke={IVORY}
              strokeOpacity="0.45"
              strokeWidth="1"
            />
            <circle cx={p.x} cy={p.y - 13} r="3.2" fill={IVORY} fillOpacity="0.85" />
          </g>
        ))}
      </g>

      {/* timeline axis */}
      <g>
        <line x1="88" y1="272" x2="392" y2="272" stroke={IVORY} strokeOpacity="0.3" strokeWidth="1" />
        {ticks.map((t) => (
          <line key={t} x1={t} y1="268" x2={t} y2="276" stroke={IVORY} strokeOpacity="0.3" strokeWidth="1" />
        ))}
        <text x="88" y="292" fill={IVORY} fillOpacity="0.5" fontSize="9" fontFamily="monospace" letterSpacing="1.5">
          2025
        </text>
        <text x="392" y="292" fill={IVORY} fillOpacity="0.5" fontSize="9" fontFamily="monospace" letterSpacing="1.5" textAnchor="end">
          2026
        </text>
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Step icons — hairline technical marks, same hand as the plate      */
/* ------------------------------------------------------------------ */

function StepIcon({ kind }: { kind: "scan" | "export" | "pin" }) {
  const common = {
    fill: "none",
    stroke: IVORY,
    strokeWidth: 1,
    strokeOpacity: 0.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  }
  return (
    <svg viewBox="0 0 48 48" className="w-11 h-11" aria-hidden="true">
      {kind === "scan" && (
        <>
          <rect x="16" y="8" width="16" height="32" rx="2.5" {...common} />
          <line x1="21" y1="35" x2="27" y2="35" {...common} strokeOpacity={0.45} />
          <path d="M38 14 A 14 14 0 0 1 38 34" {...common} strokeOpacity={0.4} />
          <path d="M10 14 A 14 14 0 0 0 10 34" {...common} strokeOpacity={0.4} />
        </>
      )}
      {kind === "export" && (
        <>
          <path d="M13 6 H28 L35 13 V36 H13 Z" {...common} />
          <path d="M28 6 V13 H35" {...common} strokeOpacity={0.45} />
          <line x1="24" y1="19" x2="24" y2="30" {...common} />
          <path d="M20 26 L24 30 L28 26" {...common} />
        </>
      )}
      {kind === "pin" && (
        <>
          <path d="M24 41 C 24 41 34 30.5 34 23 A 10 10 0 1 0 14 23 C 14 30.5 24 41 24 41 Z" {...common} />
          <circle cx="24" cy="23" r="3.4" {...common} strokeOpacity={0.5} />
        </>
      )}
    </svg>
  )
}

/* ------------------------------------------------------------------ */

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

  // Explore always opens the public archive directory; the featured strip
  // deep-links to the seeded example when it exists.
  const exploreHref = "/explore"
  const featuredHref = studioExists ? `/place/${SEED_PLACE_ID}` : "/explore"

  return (
    <main className="min-h-screen bg-[#060607] text-neutral-200">
      {/* Archival film grain — the texture of a kept thing, not a rendered one */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[60] opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <Nav />

      {/* Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 relative overflow-hidden">
        {/* Cinematic video field */}
        <div className="absolute inset-0 z-0">
          <video autoPlay muted loop playsInline preload="auto" className="w-full h-full object-cover">
            <source src="/background.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="absolute inset-0 z-[1] bg-black/65" />
        <div className="absolute inset-0 z-[1] bg-gradient-to-b from-[#060607]/70 via-transparent to-[#060607]" />
        {/* ivory wash */}
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 45% at 50% 42%, rgba(201,189,164,0.13), transparent 70%), radial-gradient(ellipse 45% 35% at 78% 62%, rgba(201,189,164,0.06), transparent 70%), radial-gradient(ellipse 40% 30% at 22% 60%, rgba(201,189,164,0.06), transparent 70%)",
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
          <p className="text-[10px] tracking-[0.5em] uppercase text-[#c9bda4] mb-8">
            the spatial archive of a life
          </p>
          <h1 className="text-4xl md:text-6xl font-extralight tracking-[-0.02em] leading-[1.08]">
            <span className="text-neutral-100 font-light">Keep the places you</span>
            <br />
            <span className="bg-gradient-to-r from-[#f5efe2] via-[#e8e2d4] to-[#a99c81] bg-clip-text text-transparent font-light">
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
              className="px-8 py-3.5 text-[11px] tracking-[0.3em] uppercase border border-[#c9bda4] text-[#0a0a0b] bg-[#c9bda4] hover:bg-[#f5efe2] hover:border-[#f5efe2] transition-all"
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

          {studioExists && (
            <p
              className="mt-8 text-[10px] tracking-[0.3em] uppercase hidden sm:block"
              style={{
                opacity: mounted ? 1 : 0,
                transition: "opacity 1.4s cubic-bezier(0.16, 1, 0.3, 1) 0.9s",
              }}
            >
              <span className="text-neutral-600">featured · </span>
              <Link
                href={featuredHref}
                className="text-[#c9bda4]/80 hover:text-[#f5efe2] transition-colors"
              >
                Studio Apartment — Claremont, California · 2025–2026 →
              </Link>
            </p>
          )}
        </div>
      </section>

      {/* ---------- What this is ---------- */}
      <section className="relative border-t border-neutral-900">
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-32 grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-14 lg:gap-20 items-center">
          <Reveal>
            <p className="text-[10px] tracking-[0.4em] uppercase text-neutral-600">what this is</p>
            <h2 className="mt-6 text-2xl md:text-3xl font-extralight text-neutral-100 leading-snug tracking-[-0.01em]">
              An archive that keeps the place itself,
              <span className="text-neutral-500"> not just the pictures of it.</span>
            </h2>
            <div className="mt-8 space-y-5 text-[13px] font-light leading-loose text-neutral-400 max-w-lg">
              <p>
                Eidetic Vision is a spatial archive. You keep a real place — a room, a house, a
                street — as a navigable 3D capture, and every memory is pinned to the exact spot
                where it happened.
              </p>
              <p>
                It isn&apos;t a photo album with a map on top, and it isn&apos;t a feed. Nothing
                scrolls past. There is one place, it stays put, and the years accumulate inside it.
              </p>
            </div>

            <dl className="mt-10 space-y-4 border-t border-neutral-900 pt-8 max-w-lg">
              <div className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1">
                <dt className="text-[10px] tracking-[0.25em] uppercase text-[#c9bda4]/70 pt-0.5">
                  vs. photo albums
                </dt>
                <dd className="text-[13px] font-light leading-relaxed text-neutral-500">
                  A folder of pictures shows you a birthday. A room shows you where everyone stood.
                </dd>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1">
                <dt className="text-[10px] tracking-[0.25em] uppercase text-[#c9bda4]/70 pt-0.5">
                  vs. social feeds
                </dt>
                <dd className="text-[13px] font-light leading-relaxed text-neutral-500">
                  A feed is ordered by now. A place is ordered by what happened there.
                </dd>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1">
                <dt className="text-[10px] tracking-[0.25em] uppercase text-[#c9bda4]/70 pt-0.5">
                  privacy
                </dt>
                <dd className="text-[13px] font-light leading-relaxed text-neutral-500">
                  Private by default. It stays on your device until you choose to share it.
                </dd>
              </div>
            </dl>
          </Reveal>

          <Reveal delay={0.15}>
            <figure className="border border-neutral-800/70 bg-[#0a0a0b]/60 p-6 sm:p-8">
              <PlateOne />
              <figcaption className="mt-6 flex items-baseline gap-3 border-t border-neutral-900 pt-4">
                <span className="text-[9px] tracking-[0.3em] uppercase text-[#c9bda4]/60 tabular-nums">
                  fig. 01
                </span>
                <span className="text-[9px] tracking-[0.3em] uppercase text-neutral-500">
                  the place is the archive
                </span>
              </figcaption>
            </figure>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
              {["place", "memories", "people", "time"].map((word, i) => (
                <span key={word} className="flex items-center gap-3">
                  {i > 0 && <span className="w-1 h-1 rounded-full bg-[#c9bda4]/50" />}
                  <span className="text-[9px] tracking-[0.3em] uppercase text-neutral-500">
                    {word}
                  </span>
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- The four ideas ---------- */}
      <section className="border-t border-neutral-900">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <Reveal>
            <p className="text-[10px] tracking-[0.4em] uppercase text-neutral-600">how it holds together</p>
          </Reveal>
          <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-16">
            {IDEAS.map((idea, i) => (
              <Reveal key={idea.n} delay={i * 0.08}>
                <div>
                  <span className="text-[10px] tracking-[0.3em] text-[#c9bda4]/70 tabular-nums">
                    {idea.n}
                  </span>
                  <h3 className="mt-4 text-sm font-light tracking-[0.15em] uppercase text-neutral-100">
                    {idea.title}
                  </h3>
                  <p className="mt-3 text-[13px] font-light leading-loose text-neutral-500">
                    {idea.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- One use case ---------- */}
      <section className="border-t border-neutral-900">
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          <Reveal>
            <p className="text-[10px] tracking-[0.4em] uppercase text-neutral-600">for example</p>
            <p className="mt-8 text-xl md:text-2xl font-extralight text-neutral-300 leading-loose">
              Your grandmother&apos;s house was sold last spring. The kitchen table where every
              holiday happened is gone.
              <span className="text-neutral-500"> The stories don&apos;t have to be.</span>
            </p>
            <p className="mt-8 text-xs text-neutral-500 leading-relaxed font-light max-w-md mx-auto">
              Capture the house before it changes hands. Pin the stories to the rooms they belong
              to. Let everyone who lived there add what they remember.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ---------- How to make one ---------- */}
      <section className="border-t border-neutral-900">
        <div className="max-w-5xl mx-auto px-6 py-24 md:py-28">
          <Reveal>
            <p className="text-[10px] tracking-[0.4em] uppercase text-neutral-600">making your own</p>
            <h2 className="mt-6 text-2xl md:text-3xl font-extralight text-neutral-100 leading-snug tracking-[-0.01em] max-w-xl">
              Anywhere you can walk through, you can scan.
            </h2>
            <p className="mt-6 text-[13px] font-light leading-loose text-neutral-500 max-w-lg">
              No rig and no specialist. A phone, a few minutes, and the room is yours to keep.
            </p>
          </Reveal>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
            {SCAN_STEPS.map((step, i) => (
              <Reveal key={step.n} delay={i * 0.1}>
                <div className="border-t border-neutral-800 pt-6">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] tracking-[0.3em] text-[#c9bda4]/70">{step.n}</span>
                    <StepIcon kind={step.icon} />
                  </div>
                  <h3 className="mt-6 text-sm font-light tracking-[0.15em] uppercase text-neutral-100">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-[13px] font-light leading-loose text-neutral-500">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.2}>
            <p className="mt-14 text-[11px] font-light text-neutral-600">
              The archive works without a scan — you can start with the memories and attach the
              capture later.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="border-t border-neutral-900">
        <div className="max-w-2xl mx-auto px-6 py-28 text-center relative">
          <div
            className="absolute inset-x-0 bottom-0 h-64 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 50% 60% at 50% 100%, rgba(201,189,164,0.09), transparent 70%)",
            }}
          />
          <Reveal>
            <p className="text-[13px] font-light leading-loose text-neutral-400 max-w-md mx-auto">
              Somewhere you love has already changed. Keep it while you still can.
            </p>
            <Link
              href={exploreHref}
              className="relative mt-12 inline-block px-10 py-4 text-[11px] tracking-[0.3em] uppercase border border-[#c9bda4] text-[#0a0a0b] bg-[#c9bda4] hover:bg-[#f5efe2] hover:border-[#f5efe2] transition-all"
            >
              Explore a Place
            </Link>
            <p className="mt-16 flex items-center justify-center gap-3 flex-wrap">
              {["place", "memories", "people", "time"].map((word, i) => (
                <span key={word} className="flex items-center gap-3">
                  {i > 0 && <span className="w-1 h-1 rounded-full bg-[#c9bda4]/50" />}
                  <span className="text-[9px] tracking-[0.3em] uppercase text-neutral-500">
                    {word}
                  </span>
                </span>
              ))}
            </p>
          </Reveal>
        </div>
      </section>
    </main>
  )
}
