"use client"

import { useEffect, useRef, useState } from "react"

export function FloatingOrbs() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animId: number
    const size = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
    }
    size()
    window.addEventListener("resize", size)

    type Orb = { x: number; y: number; r: number; vx: number; vy: number; color: string; alpha: number }
    const orbs: Orb[] = Array.from({ length: 18 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: (Math.random() * 80 + 30) * window.devicePixelRatio,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      color: Math.random() > 0.5 ? "139,92,246" : "192,38,211",
      alpha: Math.random() * 0.08 + 0.02,
    }))

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const o of orbs) {
        o.x += o.vx
        o.y += o.vy
        if (o.x < -o.r) o.x = canvas.width + o.r
        if (o.x > canvas.width + o.r) o.x = -o.r
        if (o.y < -o.r) o.y = canvas.height + o.r
        if (o.y > canvas.height + o.r) o.y = -o.r

        const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r)
        grad.addColorStop(0, `rgba(${o.color},${o.alpha})`)
        grad.addColorStop(1, `rgba(${o.color},0)`)
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2)
        ctx.fill()
      }
      animId = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", size)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.7 }} />
}

export function NoiseOverlay() {
  const [seed, setSeed] = useState(0)

  useEffect(() => {
    const iv = setInterval(() => setSeed((s) => s + 1), 200)
    return () => clearInterval(iv)
  }, [])

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.025 }}>
      <svg width="120" height="120" className="w-full h-full">
        <filter id="n">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" seed={seed} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#n)" opacity="0.5" />
      </svg>
    </div>
  )
}

export function Nav({ active }: { active?: "places" | "create" }) {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-sm bg-[#030305]/40">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <a href="/" className="text-sm font-light tracking-[0.2em] uppercase text-neutral-500">
          Eidetic
        </a>
        <div className="flex items-center gap-6">
          <a
            href="/places"
            className={`text-[10px] tracking-[0.3em] uppercase transition-colors ${active === "places" ? "text-violet-300" : "text-neutral-500 hover:text-neutral-300"}`}
          >
            my places
          </a>
          <a
            href="/create"
            className={`text-[10px] tracking-[0.3em] uppercase transition-colors px-4 py-1.5 border ${active === "create" ? "border-violet-500/40 text-violet-300 bg-violet-500/[0.04]" : "border-neutral-700/50 text-neutral-300 hover:border-neutral-500"}`}
          >
            + create a place
          </a>
        </div>
      </div>
    </nav>
  )
}
