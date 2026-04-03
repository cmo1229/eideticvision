"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { FileUploader } from "@/components/ui/file-uploader"
import { Scene } from "@/components/viewer/scene"

function GlitchText({ text }: { text: string }) {
  return (
    <div className="relative inline-block">
      <span className="relative z-10">{text}</span>
      <span className="absolute inset-0 text-cyan-400/80 z-0" style={{ transform: "translate(2px, -1px)", animation: "glitch1 3s infinite alternate" }}>
        {text}
      </span>
      <span className="absolute inset-0 text-fuchsia-500/60 z-0" style={{ transform: "translate(-2px, 1px)", animation: "glitch2 3s infinite alternate" }}>
        {text}
      </span>
    </div>
  )
}

function FloatingOrbs() {
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
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", size) }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.7 }} />
}

function NoiseOverlay() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [seed, setSeed] = useState(0)

  useEffect(() => {
    const iv = setInterval(() => setSeed((s) => s + 1), 200)
    return () => clearInterval(iv)
  }, [])

  let noise = ""
  for (let i = 0; i < 120; i++) {
    noise += `${((seed * 137 + i * 59) % 100)},${((seed * 97 + i * 31) % 100)},${Math.random() * 255 | 0} `
  }

  return (
    <div className="absolute inset-0 pointer-events-none opacity-[0.025]" style={{ backgroundRepeat: "repeat", backgroundSize: "120px 120px" }}>
      <svg ref={svgRef} width="120" height="120" className="w-full h-full">
        <filter id="n">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" seed={seed} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#n)" opacity="0.5" />
      </svg>
    </div>
  )
}

export function HeroSection() {
  const [assetUrl, setAssetUrl] = useState<string | undefined>()
  const [assetType, setAssetType] = useState<string>("glb")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleComplete = (url: string) => {
    const ext = url.split(".").pop()?.toLowerCase() ?? ""
    setAssetType(ext === "ply" ? "ply" : "glb")
    setAssetUrl(url)
  }

  if (assetUrl) {
    return (
      <section className="px-4 py-6 max-w-7xl mx-auto">
        <button
          onClick={() => setAssetUrl(undefined)}
          className="text-xs text-neutral-600 hover:text-neutral-400 mb-6 uppercase tracking-[0.3em] transition-colors"
        >
          ← return
        </button>
        <Scene assetUrl={assetUrl} assetType={assetType} />
      </section>
    )
  }

  return (
    <section className="relative min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center overflow-hidden">
      {/* Layers */}
      <div className="absolute inset-0 bg-[#030305]" />
      <FloatingOrbs />
      <NoiseOverlay />
      <div className="absolute inset-0 bg-gradient-to-t from-[#030305] via-transparent to-[#030305]/60" />

      {/* Content */}
      <div
        className="relative z-10 flex flex-col items-center px-6"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(20px)",
          transition: "all 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.2s",
        }}
      >
        {/* Abstract mark */}
        <div className="mb-8 flex items-end gap-1">
          <span className="block w-[1px] h-12 bg-gradient-to-b from-transparent via-violet-500/60 to-transparent" />
          <span className="block w-[1px] h-16 bg-gradient-to-b from-transparent via-fuchsia-500/40 to-transparent self-start mt-8" />
          <span className="block w-[1px] h-10 bg-gradient-to-b from-transparent via-cyan-400/50 to-transparent self-start mt-16" />
        </div>

        {/* Title */}
        <h1 className="text-[11vw] md:text-[9rem] font-extralight tracking-[-0.04em] leading-[0.85] text-center select-none">
          <span className="block text-neutral-800">Eidetic</span>
          <span className="block bg-gradient-to-r from-violet-300/90 via-fuchsia-300 to-cyan-300/80 bg-clip-text text-transparent">
            Vision
          </span>
        </h1>

        {/* Sub */}
        <p className="mt-6 text-neutral-600 text-sm tracking-[0.35em] uppercase font-light text-center">
          spatial memories · rendered
        </p>

        {/* Divider line */}
        <div className="mt-12 w-12 h-[1px] bg-gradient-to-r from-transparent via-neutral-700 to-transparent" />

        {/* Upload zone */}
        <div className="mt-12 w-full max-w-lg">
          <FileUploader onUploadComplete={handleComplete} />
        </div>

        {/* Tags */}
        <div className="mt-16 flex items-center gap-6 text-[10px] tracking-[0.3em] uppercase text-neutral-700">
          <span>3D Gaussians</span>
          <span className="w-1 h-1 rounded-full bg-neutral-700" />
          <span>Neural Styles</span>
          <span className="w-1 h-1 rounded-full bg-neutral-700" />
          <span>Live Capture</span>
        </div>
      </div>

      {/* Bottom edge */}
      <div className="absolute bottom-6 inset-x-0 flex items-center justify-center gap-2">
        <span className="block w-8 h-[1px] bg-neutral-800" />
        <span className="text-[10px] text-neutral-800 tracking-[0.4em] uppercase">scroll</span>
        <span className="block w-8 h-[1px] bg-neutral-800" />
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#030305] text-neutral-200 selection:bg-violet-500/30">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-sm bg-[#030305]/40">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-sm font-light tracking-[0.2em] uppercase text-neutral-500">
            Eidetic
          </span>
          <span className="text-[10px] font-mono text-neutral-700 tracking-widest">v0.1</span>
        </div>
      </nav>

      <div className="pt-0">
        <HeroSection />
      </div>
    </main>
  )
}
