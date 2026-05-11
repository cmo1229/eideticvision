"use client"

import { useEffect, useRef, useState } from "react"

/* ------------------------------------------------------------------ */
/*  Section heading                                                     */
/* ------------------------------------------------------------------ */

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 mb-16">
      <span className="block h-[1px] flex-1 bg-neutral-800/50" />
      <span className="text-[10px] tracking-[0.4em] uppercase text-neutral-700">{label}</span>
      <span className="block h-[1px] flex-1 bg-neutral-800/50" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Feature card                                                        */
/* ------------------------------------------------------------------ */

function FeatureCard({
  number,
  title,
  body,
  delay,
  visible,
}: {
  number: string
  title: string
  body: string
  delay: number
  visible: boolean
}) {
  return (
    <div
      className="flex-1 min-w-[260px] border border-neutral-800/30 p-8 hover:border-neutral-700/40 transition-all duration-1000"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `all 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
      }}
    >
      <span className="text-[10px] tracking-[0.3em] uppercase text-violet-500/60">{number}</span>
      <h3 className="mt-6 text-sm tracking-[0.15em] uppercase text-neutral-300">{title}</h3>
      <p className="mt-4 text-xs leading-relaxed text-neutral-600 max-w-xs">{body}</p>
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
      { threshold: 0.2 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <section ref={ref} className="max-w-5xl mx-auto px-6 pb-32">
      <SectionDivider label="how it works" />

      <div className="flex flex-wrap gap-0">
        <FeatureCard
          number="01"
          title="drop any photo"
          body="A landscape. A street corner. An old photograph. Drag it in — depth is mapped from luminance, position, and edge structure. No lidar."
          delay={100}
          visible={visible}
        />
        <FeatureCard
          number="02"
          title="ai reconstructs the space"
          body="Each pixel is placed in 3D. RunwayML Gen-4.5 generates a living video texture. What was flat becomes a navigable spatial mesh."
          delay={300}
          visible={visible}
        />
        <FeatureCard
          number="03"
          title="step into the memory"
          body="Orbit around the scene. Zoom into details. Record your path. Apply neural styles. You're not viewing a photo — you're inside it."
          delay={500}
          visible={visible}
        />
      </div>
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
      <p className="mt-6 text-sm text-neutral-600 leading-relaxed max-w-lg mx-auto">
        EideticVision reconstructs the depth, the light, the space between objects — then lets you walk through it. Built on depth estimation and RunwayML Gen-4.5, rendered in real-time.
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
