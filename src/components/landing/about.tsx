"use client"

import { useEffect, useRef, useState } from "react"

/* ------------------------------------------------------------------ */
/*  Visual pipeline                                                      */
/* ------------------------------------------------------------------ */

function VisualPipe({ visible }: { visible: boolean }) {
  return (
    <div className="flex flex-col md:flex-row items-center justify-center gap-0 md:gap-0 max-w-4xl mx-auto">
      {/* Step 1 — photo */}
      <div
        className="flex-1 flex flex-col items-center gap-6 p-10"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0ms",
        }}
      >
        {/* Photo icon */}
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 border border-neutral-700/40" />
          <div className="absolute inset-2 border border-neutral-800/30" />
          <div
            className="absolute inset-3 opacity-20"
            style={{
              background:
                "linear-gradient(135deg, #a78bfa 0%, transparent 40%, #e879f9 100%)",
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-neutral-600 text-2xl">◉</span>
          </div>
        </div>

        <div className="text-center">
          <span className="text-[10px] tracking-[0.3em] uppercase text-neutral-500">
            any photo
          </span>
        </div>
      </div>

      {/* Arrow */}
      <div
        className="shrink-0 text-neutral-800 text-xl md:block hidden"
        style={{
          opacity: visible ? 1 : 0,
          transition: "all 0.9s cubic-bezier(0.16, 1, 0.3, 1) 200ms",
        }}
      >
        →
      </div>
      <div
        className="shrink-0 text-neutral-800 text-xl md:hidden block my-2"
        style={{
          opacity: visible ? 1 : 0,
          transition: "all 0.9s cubic-bezier(0.16, 1, 0.3, 1) 200ms",
        }}
      >
        ↓
      </div>

      {/* Step 2 — depth */}
      <div
        className="flex-1 flex flex-col items-center gap-6 p-10"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.9s cubic-bezier(0.16, 1, 0.3, 1) 250ms",
        }}
      >
        {/* Depth mesh visual */}
        <div className="relative w-24 h-24 overflow-hidden">
          <div className="absolute inset-0 border border-violet-500/20" />
          {/* Simulated depth wireframe */}
          <svg
            viewBox="0 0 96 96"
            className="absolute inset-0 w-full h-full opacity-30"
          >
            <defs>
              <pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse">
                <path d="M 8 0 L 0 0 0 8" fill="none" stroke="#a78bfa" strokeWidth="0.3" />
              </pattern>
            </defs>
            <rect width="96" height="96" fill="url(#grid)" />
          </svg>
          {/* Depth contour lines */}
          <svg
            viewBox="0 0 96 96"
            className="absolute inset-0 w-full h-full opacity-20"
          >
            {[20, 35, 50, 65, 80].map((y, i) => (
              <path
                key={y}
                d={`M 0 ${y + Math.sin(i * 1.5) * 8} Q 24 ${y + Math.sin(i + 1) * 10} 48 ${y + Math.sin(i * 0.7) * 6} T 96 ${y + Math.sin(i + 2) * 8}`}
                fill="none"
                stroke="#e879f9"
                strokeWidth="0.4"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-violet-500/60 text-2xl">◎</span>
          </div>
        </div>

        <div className="text-center">
          <span className="text-[10px] tracking-[0.3em] uppercase text-neutral-500">
            depth mapped
          </span>
        </div>
      </div>

      {/* Arrow */}
      <div
        className="shrink-0 text-neutral-800 text-xl md:block hidden"
        style={{
          opacity: visible ? 1 : 0,
          transition: "all 0.9s cubic-bezier(0.16, 1, 0.3, 1) 450ms",
        }}
      >
        →
      </div>
      <div
        className="shrink-0 text-neutral-800 text-xl md:hidden block my-2"
        style={{
          opacity: visible ? 1 : 0,
          transition: "all 0.9s cubic-bezier(0.16, 1, 0.3, 1) 450ms",
        }}
      >
        ↓
      </div>

      {/* Step 3 — explore */}
      <div
        className="flex-1 flex flex-col items-center gap-6 p-10"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.9s cubic-bezier(0.16, 1, 0.3, 1) 500ms",
        }}
      >
        {/* Exploded 3D view */}
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 border border-fuchsia-500/20" />
          {/* 3D isometric mesh lines */}
          <svg
            viewBox="0 0 96 96"
            className="absolute inset-0 w-full h-full opacity-30"
          >
            {/* Base plane */}
            <polygon
              points="20,75 48,60 76,75 48,90"
              fill="none"
              stroke="#c084fc"
              strokeWidth="0.5"
            />
            {/* Displaced surface */}
            <polygon
              points="20,55 48,35 76,55 48,70"
              fill="none"
              stroke="#e879f9"
              strokeWidth="0.6"
            />
            {/* Connecting edges */}
            <line x1="20" y1="55" x2="20" y2="75" stroke="#a78bfa" strokeWidth="0.3" />
            <line x1="48" y1="35" x2="48" y2="60" stroke="#a78bfa" strokeWidth="0.3" />
            <line x1="76" y1="55" x2="76" y2="75" stroke="#a78bfa" strokeWidth="0.3" />
            {/* Depth lines from surface to base */}
            {[30, 50, 65].map((x, i) => (
              <line
                key={x}
                x1={x}
                y1={45 + i * 10}
                x2={x + 12}
                y2={68 + i * 8}
                stroke="#e879f9"
                strokeWidth="0.2"
                strokeDasharray="1 2"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-fuchsia-400/60 text-2xl">◌</span>
          </div>
        </div>

        <div className="text-center">
          <span className="text-[10px] tracking-[0.3em] uppercase text-neutral-500">
            navigate memory
          </span>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  AboutSection                                                        */
/* ------------------------------------------------------------------ */

export function AboutSection() {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.25 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <section ref={ref} className="max-w-5xl mx-auto px-6 pb-32 pt-16">
      {/* Thin rule */}
      <div className="flex items-center gap-4 mb-24">
        <span className="block h-[1px] flex-1 bg-neutral-800/40" />
        <span className="block w-1 h-1 rounded-full bg-neutral-800" />
        <span className="block h-[1px] flex-1 bg-neutral-800/40" />
      </div>

      <VisualPipe visible={visible} />
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Closing section                                                     */
/* ------------------------------------------------------------------ */

export function ClosingSection() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.3 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className="max-w-2xl mx-auto px-6 pb-40 text-center"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: "all 1s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <p className="text-lg font-light text-neutral-400 leading-relaxed tracking-wide">
        A photograph is flat.
        <br />
        A memory isn&apos;t.
      </p>
      <div className="mt-12 flex items-center justify-center gap-3">
        <span className="text-[10px] tracking-[0.3em] uppercase text-neutral-700">
          depth estimation
        </span>
        <span className="w-1 h-1 rounded-full bg-neutral-800" />
        <span className="text-[10px] tracking-[0.3em] uppercase text-neutral-700">
          runway gen-4.5
        </span>
        <span className="w-1 h-1 rounded-full bg-neutral-800" />
        <span className="text-[10px] tracking-[0.3em] uppercase text-neutral-700">
          three.js
        </span>
      </div>
    </div>
  )
}
