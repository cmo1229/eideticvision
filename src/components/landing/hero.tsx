"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import axios from "axios"
import { FileUploader, type UploadedAsset } from "@/components/ui/file-uploader"
import { PromptInput } from "@/components/ui/prompt-input"
import { Scene } from "@/components/viewer/scene"
import { ImageScene } from "@/components/viewer/image-scene"
import { MOODS, type MoodId } from "@/lib/moods"


/* ------------------------------------------------------------------ */
/*  Floating orbs                                                      */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Noise overlay                                                      */
/* ------------------------------------------------------------------ */

function NoiseOverlay() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [seed, setSeed] = useState(0)

  useEffect(() => {
    const iv = setInterval(() => setSeed((s) => s + 1), 200)
    return () => clearInterval(iv)
  }, [])

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.025 }}>
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

/* ------------------------------------------------------------------ */
/*  Visual step                                                         */
/* ------------------------------------------------------------------ */

function VisualSteps() {
  const steps = [
    { icon: "◉", label: "drop a photo" },
    { icon: "◎", label: "ai reconstructs depth" },
    { icon: "◌", label: "navigate the memory" },
  ]

  return (
    <div className="flex items-center gap-8 mt-16">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-8">
          <div className="flex flex-col items-center gap-2">
            <span className="text-neutral-500 text-lg">{s.icon}</span>
            <span className="text-[10px] tracking-[0.25em] uppercase text-neutral-600">{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <span className="text-neutral-800 text-xs">→</span>
          )}
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Hero                                                               */
/* ------------------------------------------------------------------ */

export function HeroSection() {
  const [assetUrl, setAssetUrl] = useState<string | undefined>()
  const [assetType, setAssetType] = useState<string>("glb")
  const [videoUrls, setVideoUrls] = useState<string[] | undefined>()
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  // Memory aesthetic mood
  const [mood, setMood] = useState<MoodId>("lucid")
  const [sourceType, setSourceType] = useState<"image" | "text">("image")

  // Memory stack for chained prompt expansion
  const [memoryStack, setMemoryStack] = useState<string[]>([])
  const [activeMemoryIndex, setActiveMemoryIndex] = useState(0)

  useEffect(() => { setMounted(true) }, [])

  const handleComplete = async (asset: UploadedAsset) => {
    if (asset.type === "image") {
      setAssetUrl(asset.url)
      setAssetType("image")
      setSourceType("image")
      setGenerating(true)
      setGenError(null)

      try {
        const { data } = await axios.post("/api/generate", { imageUrl: asset.url, mood })
        setVideoUrls(data.videoUrls)
        if (data.videoUrls?.[0]) {
          setMemoryStack([data.videoUrls[0]])
          setActiveMemoryIndex(0)
        }
      } catch (err: any) {
        setGenError(err.response?.data?.error ?? err.message ?? "Generation failed")
      } finally {
        setGenerating(false)
      }
      return
    }
    setAssetType(asset.type)
    setAssetUrl(asset.url)
  }

  const handlePrompt = async (promptText: string) => {
    setAssetType("image")
    setSourceType("text")
    setGenerating(true)
    setGenError(null)
    setMemoryStack([])

    try {
      const { data } = await axios.post("/api/generate", { promptText, mood, duration: 5 })
      setVideoUrls(data.videoUrls)
      if (data.videoUrls?.[0]) {
        setAssetUrl(data.videoUrls[0])
        setMemoryStack([data.videoUrls[0]])
        setActiveMemoryIndex(0)
      }
    } catch (err: any) {
      setGenError(err.response?.data?.error ?? err.message ?? "Generation failed")
    } finally {
      setGenerating(false)
    }
  }

  const handlePromptExpand = async (promptText: string) => {
    setGenerating(true)
    setGenError(null)

    try {
      const { data } = await axios.post("/api/generate", { promptText, mood, duration: 5 })
      if (data.videoUrls?.[0]) {
        const newStack = [...memoryStack, data.videoUrls[0]]
        setMemoryStack(newStack)
        setActiveMemoryIndex(newStack.length - 1)
        setVideoUrls(data.videoUrls)
      }
    } catch (err: any) {
      setGenError(err.response?.data?.error ?? err.message ?? "Generation failed")
    } finally {
      setGenerating(false)
    }
  }

  const handleReturn = () => {
    setAssetUrl(undefined)
    setVideoUrls(undefined)
    setMemoryStack([])
    setActiveMemoryIndex(0)
    setGenError(null)
  }

  if (assetUrl && assetType === "image") {
    return (
      <section className="px-4 py-6 max-w-7xl mx-auto">
        <button
          onClick={handleReturn}
          className="text-xs text-neutral-600 hover:text-neutral-400 mb-6 uppercase tracking-[0.3em] transition-colors"
        >
          ← return
        </button>
        <ImageScene
          imageUrl={assetUrl}
          videoUrls={videoUrls}
          generating={generating}
          error={genError}
          onPromptExpand={handlePromptExpand}
          memoryStack={memoryStack}
          activeMemoryIndex={activeMemoryIndex}
          onMemorySelect={setActiveMemoryIndex}
          mood={mood}
          sourceType={sourceType}
        />
      </section>
    )
  }

  if (assetUrl && assetType !== "image") {
    return (
      <section className="px-4 py-6 max-w-7xl mx-auto">
        <button
          onClick={handleReturn}
          className="text-xs text-neutral-600 hover:text-neutral-400 mb-6 uppercase tracking-[0.3em] transition-colors"
        >
          ← return
        </button>
        <Scene assetUrl={assetUrl} assetType={assetType} />
      </section>
    )
  }

  return (
    <section className="relative min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center overflow-hidden pt-20">
      {/* Background video */}
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="w-full h-full object-cover"
          style={{ filter: "brightness(1)" }}
        >
          <source src="/background.mp4" type="video/mp4" />
        </video>
      </div>

      {/* Dim overlays */}
      <div className="absolute inset-0 z-[1] bg-black/70" />
      <div className="absolute inset-0 z-[1] bg-gradient-to-t from-[#030305] via-[#030305]/40 to-[#030305]/60" />

      <FloatingOrbs />
      <NoiseOverlay />

      {/* Content */}
      <div
        className="relative z-10 flex flex-col items-center px-6"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(20px)",
          transition: "all 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.2s",
        }}
      >
        {/* Title */}
        <h1 className="text-[11vw] md:text-[9rem] font-extralight tracking-[-0.04em] leading-[0.85] text-center select-none">
          <span className="block text-neutral-800">Eidetic</span>
          <span className="block bg-gradient-to-r from-violet-300/90 via-fuchsia-300 to-cyan-300/80 bg-clip-text text-transparent">
            Vision
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-neutral-500 text-sm tracking-[0.35em] uppercase font-light text-center max-w-md">
          any photo becomes a navigable memory
        </p>

        {/* How it works - visual steps */}
        <VisualSteps />

        {/* Mood selector */}
        <div className="mt-10 flex items-center gap-1">
          <span className="text-[9px] tracking-[0.3em] uppercase text-neutral-700 mr-3">feel</span>
          {MOODS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMood(m.id)}
              className={`px-3 py-1 text-[10px] tracking-[0.2em] uppercase transition-all duration-500 border
                ${mood === m.id
                  ? "border-neutral-600/40 text-neutral-300"
                  : "border-transparent text-neutral-600 hover:text-neutral-500 hover:border-neutral-800/30"
                }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="mt-12 w-12 h-[1px] bg-gradient-to-r from-transparent via-neutral-700 to-transparent" />

        {/* Upload zone */}
        <div className="mt-12 w-full max-w-lg">
          <FileUploader onUploadComplete={handleComplete} />
        </div>

        {/* Divider */}
        <div className="mt-8 flex items-center gap-3 max-w-lg w-full">
          <span className="block h-[1px] flex-1 bg-neutral-800/40" />
          <span className="text-[9px] tracking-[0.3em] uppercase text-neutral-700">or</span>
          <span className="block h-[1px] flex-1 bg-neutral-800/40" />
        </div>

        {/* Prompt input */}
        <div className="mt-8 w-full max-w-lg">
          <PromptInput
            onSubmit={handlePrompt}
            generating={generating}
            placeholder="describe a memory..."
          />
        </div>

        {/* Prompt chips */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {[
            "a foggy morning in tokyo",
            "grandma's kitchen",
            "sunset over the canyon",
            "a rainy street at night",
            "your childhood home",
          ].map((p) => (
            <span
              key={p}
              className="text-[10px] tracking-[0.2em] uppercase text-neutral-700 border border-neutral-800/40 px-3 py-1 hover:border-neutral-700 hover:text-neutral-500 transition-colors cursor-default"
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-6 inset-x-0 z-10 flex items-center justify-center gap-2">
        <span className="block w-8 h-[1px] bg-neutral-800" />
        <span className="text-[10px] text-neutral-800 tracking-[0.4em] uppercase">scroll</span>
        <span className="block w-8 h-[1px] bg-neutral-800" />
      </div>
    </section>
  )
}

export { type AssetType } from "@/components/ui/file-uploader"

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
