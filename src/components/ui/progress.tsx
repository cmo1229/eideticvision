"use client"

/* ------------------------------------------------------------------ */
/*  Retention progress bar                                              */
/*  Decelerating curve so users never see it stall:                     */
/*   0-60% fast, 60-85% medium, 85-94% crawl, holds at 94-97%           */
/*   until the real work completes, then snaps to 100.                  */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react"

export function useRetentionProgress(active: boolean, estimatedMs = 20000) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!active) {
      setProgress(0)
      return
    }
    let p = 0
    const start = Date.now()
    const iv = setInterval(() => {
      const elapsed = Date.now() - start
      // expected duration shapes the crawl
      if (p < 55) p += 2600 / estimatedMs * (iv && 1)
      // simpler: piecewise
      if (p < 55) p += (2600 / estimatedMs) * 1.2
      else if (p < 80) p += (1600 / estimatedMs) * 1.0
      else if (p < 92) p += (900 / estimatedMs) * 0.8
      else p += 0.008 + Math.random() * 0.01 // eternal crawl
      p = Math.min(p, 97)
      setProgress(p)
    }, 200)
    return () => clearInterval(iv)
  }, [active, estimatedMs])

  const finish = () => setProgress(100)
  return { progress: active ? (progress >= 100 ? 100 : progress) : 100, setProgress }
}

interface RetentionBarProps {
  phase: string
  subtext?: string
  estimatedMs?: number
  /** turns 100 immediately (completion signal) */
  done?: boolean
}

export function RetentionBar({ phase, subtext, estimatedMs = 20000, done = false }: RetentionBarProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (done) {
      setProgress(100)
      return
    }
    let p = 0
    const start = Date.now()
    const iv = setInterval(() => {
      const elapsed = Date.now() - start
      if (p < 55) p += (3200 / estimatedMs) * 1.1
      else if (p < 80) p += (1400 / estimatedMs)
      else if (p < 92) p += (700 / estimatedMs) * 0.7
      else p += 0.006 + Math.random() * 0.012 // crawl forever, never stalls visually
      p = Math.min(p, 97)
      setProgress(p)
    }, 200)
    return () => clearInterval(iv)
  }, [estimatedMs, done])

  return (
    <div className="absolute inset-0 bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center z-20">
      <div className="max-w-sm w-full px-8">
        <p className="text-[11px] tracking-[0.3em] uppercase text-violet-400/80 text-center mb-6 animate-pulse">
          {phase}
        </p>

        <div className="relative w-full h-[1px] bg-neutral-800/60 overflow-visible">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-violet-400 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
          {/* shimmer sweep at the leading edge */}
          <div
            className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            style={{ left: `${progress}%`, transform: "translateX(-50%)" }}
          />
          {/* glowing head */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)] transition-all duration-300 ease-out"
            style={{ left: `${progress}%` }}
          />
        </div>

        <p className="text-[10px] tracking-[0.2em] uppercase text-neutral-600 text-center mt-4 tabular-nums">
          {Math.round(progress)}%
        </p>
        {subtext && (
          <p className="text-[9px] tracking-[0.25em] uppercase text-neutral-700 text-center mt-5">
            {subtext}
          </p>
        )}
      </div>
    </div>
  )
}
