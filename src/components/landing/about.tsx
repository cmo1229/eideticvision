"use client"

import { useEffect, useRef, useState } from "react"

export function AboutSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative border-t border-white/[0.04]"
    >
      <div className="max-w-4xl mx-auto px-6 py-32">
        {/* Section label */}
        <p
          className={`text-[11px] tracking-[0.4em] uppercase text-neutral-700 mb-20 transition-all duration-[1200ms] ease-out
          ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        >
          about this project
        </p>

        {/* What it is */}
        <div
          className={`transition-all duration-[1200ms] ease-out delay-[100ms]
          ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        >
          <h2 className="text-2xl md:text-3xl font-extralight tracking-[-0.02em] text-neutral-300 leading-relaxed">
            EideticVision transforms raw spatial captures into navigable 3D
            worlds — then reimagines them through a stylistic lens.
          </h2>
        </div>

        {/* Body */}
        <div className="mt-12 space-y-6">
          {[
            {
              label: "The technology",
              text: "Built on 3D Gaussian Splatting — a photorealistic rendering technique that reconstructs full 3D scenes from video or image captures. Unlike traditional mesh-based 3D, splatting uses millions of tiny ellipsoids that capture appearance from every angle, producing scenes you can actually walk through.",
            },
            {
              label: "What makes it different",
              text: "Most Gaussian Splatting tools treat your capture as raw geometry data. EideticVision treats it as a memory. Every world ships with a real-time post-processing layer — bloom, color grading, vignette — that lets you shift the aesthetic. Noir. Neon. Ethereal. You're not just viewing a place; you're viewing how it felt.",
            },
            {
              label: "The workflow",
              text: "Drop a file. We handle the rest — upload, process, render. No parameters to tune, no camera paths to configure. You explore the result in your browser with full orbit controls, and you can record your navigation as a video to keep.",
            },
          ].map((item, i) => (
            <div
              key={item.label}
              className={`flex gap-8 md:gap-12 transition-all duration-[1200ms] ease-out transition-delay
              ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
            `}
              style={{ transitionDelay: `${200 + i * 150}ms` }}
            >
              <span className="shrink-0 w-28 md:w-40 text-[10px] tracking-[0.3em] uppercase text-neutral-600 md:text-right">
                {item.label}
              </span>
              <p className="text-neutral-500 leading-relaxed text-sm max-w-prose">
                {item.text}
              </p>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="mt-24 flex items-center gap-4">
          <div className="w-12 h-[1px] bg-neutral-800" />
          <span className="text-[10px] tracking-[0.4em] uppercase text-neutral-800">
            2026
          </span>
          <div className="flex-1 h-[1px] bg-neutral-800/30" />
        </div>
      </div>
    </section>
  )
}
