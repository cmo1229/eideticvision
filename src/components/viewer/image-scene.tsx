"use client"

import { useRef, useEffect, useState, useMemo } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, Environment } from "@react-three/drei"
import { EffectComposer, Bloom, Vignette, HueSaturation } from "@react-three/postprocessing"
import * as THREE from "three"
import { getMood, type MoodId } from "@/lib/moods"
import { PromptInput } from "@/components/ui/prompt-input"

/* ------------------------------------------------------------------ */
/*  Client-side depth estimation from image                             */
/* ------------------------------------------------------------------ */

function computeDepthFromImage(img: HTMLImageElement): string {
  const w = Math.min(img.width, 256)
  const h = Math.min(img.height, Math.floor(w * (img.height / img.width)))

  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(img, 0, 0, w, h)
  const src = ctx.getImageData(0, 0, w, h)
  const out = ctx.createImageData(w, h)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const lum = (src.data[i] * 0.299 + src.data[i + 1] * 0.587 + src.data[i + 2] * 0.114) / 255
      const vertFactor = 1 - y / h

      let contrast = 0
      if (x > 0 && x < w - 1 && y > 0 && y < h - 1) {
        const center = (src.data[i] + src.data[i + 1] + src.data[i + 2]) / 3
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const ni = ((y + dy) * w + (x + dx)) * 4
            const n = (src.data[ni] + src.data[ni + 1] + src.data[ni + 2]) / 3
            contrast += Math.abs(center - n)
          }
        }
        contrast /= 9 * 255
      }

      let depth = vertFactor * 0.55 + lum * 0.25 + contrast * 0.2
      if (contrast > 0.08) depth += contrast * 0.3
      depth = Math.max(0, Math.min(1, depth))

      const val = Math.floor(depth * 255)
      out.data[i] = val
      out.data[i + 1] = val
      out.data[i + 2] = val
      out.data[i + 3] = 255
    }
  }

  ctx.putImageData(out, 0, 0)
  return canvas.toDataURL("image/png")
}

function loadDepthData(depthDataUrl: string): Promise<Float32Array> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(img, 0, 0)
      const pixels = ctx.getImageData(0, 0, img.width, img.height).data
      const depth = new Float32Array(img.width * img.height)
      for (let i = 0; i < depth.length; i++) {
        depth[i] = pixels[i * 4] / 255
      }
      resolve(depth)
    }
    img.src = depthDataUrl
  })
}

/* ------------------------------------------------------------------ */
/*  Depth-displaced mesh                                                */
/* ------------------------------------------------------------------ */

const SEGMENTS = 100
const PLANE_W = 4
const PLANE_H = 3
const DEPTH_SCALE = 2.0

function DepthMesh({
  imageUrl,
  videoUrl,
  onLoad,
}: {
  imageUrl: string
  videoUrl?: string | null
  onLoad: () => void
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null)

  // Create displaced geometry once per imageUrl
  useEffect(() => {
    let cancelled = false

    async function build() {
      // Load image
      const img = await new Promise<HTMLImageElement>((resolve) => {
        const i = new Image()
        i.crossOrigin = "anonymous"
        i.onload = () => resolve(i)
        i.src = imageUrl
      })

      if (cancelled) return

      // Compute depth map
      const depthDataUrl = computeDepthFromImage(img)
      const depthData = await loadDepthData(depthDataUrl)

      if (cancelled) return

      // Build geometry with depth displacement
      const geo = new THREE.PlaneGeometry(PLANE_W, PLANE_H, SEGMENTS, Math.floor(SEGMENTS * 0.75))
      const pos = geo.attributes.position.array as Float32Array
      const uv = geo.attributes.uv.array as Float32Array

      for (let i = 0; i < pos.length; i += 3) {
        const u = uv[(i / 3) * 2]
        const v = 1 - uv[(i / 3) * 2 + 1]
        const px = Math.floor(u * (depthData.length > 0 ? Math.sqrt(depthData.length) - 1 : 0)) % 256
        const py = Math.floor(v * (Math.sqrt(depthData.length) - 1)) % 256
        const w = Math.min(256, Math.floor(Math.sqrt(depthData.length)))
        const idx = py * w + px
        const depth = depthData[Math.min(idx, depthData.length - 1)] ?? 0
        pos[i + 2] = depth * DEPTH_SCALE
      }

      geo.computeVertexNormals()

      // Load color texture
      const tex = await new Promise<THREE.Texture>((resolve) => {
        new THREE.TextureLoader().load(imageUrl, (t) => {
          t.colorSpace = THREE.SRGBColorSpace
          resolve(t)
        })
      })

      if (cancelled) return

      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        side: THREE.DoubleSide,
        roughness: 0.5,
      })
      materialRef.current = mat
      meshRef.current.geometry = geo
      meshRef.current.material = mat
      onLoad()
    }

    build()
    return () => { cancelled = true }
  }, [imageUrl])

  // Swap to video texture when available
  useEffect(() => {
    if (!videoUrl || !meshRef.current) return

    const video = document.createElement("video")
    video.src = videoUrl
    video.crossOrigin = "anonymous"
    video.loop = true
    video.muted = true
    video.playsInline = true
    video.play().catch(() => {})
    videoRef.current = video

    const tex = new THREE.VideoTexture(video)
    tex.colorSpace = THREE.SRGBColorSpace

    const swapTexture = () => {
      if (materialRef.current) {
        materialRef.current.map = tex
        materialRef.current.needsUpdate = true
      }
    }

    if (video.readyState >= 2) {
      swapTexture()
    } else {
      video.addEventListener("loadeddata", swapTexture, { once: true })
    }

    return () => {
      video.pause()
      video.removeEventListener("loadeddata", swapTexture)
    }
  }, [videoUrl])

  return (
    <mesh ref={meshRef}>
      <meshStandardMaterial side={THREE.DoubleSide} roughness={0.5} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Mood post-processing effects                                        */
/* ------------------------------------------------------------------ */

function MoodEffects({ mood }: { mood: MoodId }) {
  const m = getMood(mood)
  return (
    <EffectComposer enableNormalPass={false} multisampling={0}>
      <Bloom
        luminanceThreshold={m.bloom.threshold}
        luminanceSmoothing={m.bloom.smoothing}
        intensity={m.bloom.intensity}
        width={480}
      />
      <HueSaturation hue={m.hue} saturation={m.saturation} />
      <Vignette offset={m.vignette.offset} darkness={m.vignette.darkness} />
    </EffectComposer>
  )
}

/* ------------------------------------------------------------------ */
/*  Generation progress bar                                             */
/* ------------------------------------------------------------------ */

const PHASES = [
  { at: 0, label: "reading capture" },
  { at: 12, label: "estimating depth" },
  { at: 25, label: "building spatial mesh" },
  { at: 35, label: "Gen-4.5 processing" },
  { at: 60, label: "rendering spatial memory" },
  { at: 85, label: "almost there" },
]

function GenerationOverlay() {
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState(PHASES[0].label)

  useEffect(() => {
    let p = 0
    const iv = setInterval(() => {
      if (p < 15) {
        p += 1.5
      } else if (p < 30) {
        p += 0.8
      } else if (p < 50) {
        p += 0.3
      } else if (p < 78) {
        p += 0.15 + Math.random() * 0.08
      } else if (p < 92) {
        p += 0.03 + Math.random() * 0.03
      }
      p = Math.min(p, 94)
      setProgress(p)

      const currentPhase = [...PHASES].reverse().find((ph) => p >= ph.at)
      if (currentPhase) setPhase(currentPhase.label)
    }, 250)

    return () => clearInterval(iv)
  }, [])

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
          <div
            className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            style={{ left: `${progress}%`, transform: "translateX(-50%)" }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)] transition-all duration-300 ease-out"
            style={{ left: `${progress}%` }}
          />
        </div>

        <p className="text-[10px] tracking-[0.2em] uppercase text-neutral-600 text-center mt-4 tabular-nums">
          {Math.round(progress)}%
        </p>

        <p className="text-[9px] tracking-[0.25em] uppercase text-neutral-700 text-center mt-6">
          spatial depth · gen4.5
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  ImageScene                                                          */
/* ------------------------------------------------------------------ */

interface ImageSceneProps {
  imageUrl: string
  videoUrls?: string[]
  depthUrl?: string | null
  generating: boolean
  error: string | null
  onPromptExpand?: (prompt: string) => void
  memoryStack?: string[]
  activeMemoryIndex?: number
  onMemorySelect?: (index: number) => void
  mood?: MoodId
}

export function ImageScene({
  imageUrl,
  videoUrls,
  depthUrl,
  generating,
  error,
  onPromptExpand,
  memoryStack,
  activeMemoryIndex = 0,
  onMemorySelect,
  mood = "lucid",
}: ImageSceneProps) {
  const [loaded, setLoaded] = useState(false)
  const [introDone, setIntroDone] = useState(false)
  const showVideo = videoUrls && videoUrls.length > 0

  // Determine which video to show
  const activeVideo = memoryStack && memoryStack.length > 0
    ? memoryStack[activeMemoryIndex]
    : showVideo ? videoUrls![0] : undefined

  // End intro after 4.5 seconds
  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => setIntroDone(true), 4500)
    return () => clearTimeout(t)
  }, [loaded])

  return (
    <div className="relative w-full">
      {/* Memory stack navigation */}
      {memoryStack && memoryStack.length > 1 && (
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          {memoryStack.map((_, i) => (
            <button
              key={i}
              onClick={() => onMemorySelect?.(i)}
              className={`shrink-0 w-2 h-2 rounded-full transition-all
                ${i === activeMemoryIndex
                  ? "bg-violet-400 shadow-[0_0_6px_rgba(167,139,250,0.6)]"
                  : "bg-neutral-800 hover:bg-neutral-700"
                }`}
              title={`Memory ${i + 1}`}
            />
          ))}
          <span className="text-[9px] tracking-[0.2em] uppercase text-neutral-700 ml-2">
            memory {activeMemoryIndex + 1}/{memoryStack.length}
          </span>
        </div>
      )}

      {/* Canvas */}
      <div className="relative w-full h-[75vh] overflow-hidden border border-neutral-800/30 bg-[#030305]">
        {!loaded && !generating && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-10 backdrop-blur-md">
            <p className="text-sm tracking-[0.3em] uppercase text-violet-400/80 animate-pulse">loading capture</p>
          </div>
        )}

        {generating && <GenerationOverlay />}

        {error && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-20 backdrop-blur-md gap-4">
            <p className="text-sm tracking-[0.2em] uppercase text-red-400/70">generation failed</p>
            <p className="text-xs text-neutral-500 max-w-md text-center">{error}</p>
            <p className="text-[10px] tracking-[0.3em] uppercase text-neutral-600 mt-4">
              showing original capture
            </p>
          </div>
        )}

        <Canvas
          camera={{ position: [0, 0, 4], fov: 45 }}
          style={{ background: "#030305" }}
        >
          <ambientLight intensity={0.5} />
          <directionalLight position={[3, 3, 3]} intensity={0.8} />
          <directionalLight position={[-2, 1, -1]} intensity={0.3} />

          <DepthMesh
            imageUrl={imageUrl}
            videoUrl={activeVideo}
            onLoad={() => setLoaded(true)}
          />

          <Environment preset="night" />
          <MoodEffects mood={mood} />
          <OrbitControls
            makeDefault
            enablePan
            enableZoom
            minDistance={1.5}
            maxDistance={12}
            target={[0, 0, 0.5]}
            autoRotate={loaded && !introDone}
            autoRotateSpeed={1.5}
          />
        </Canvas>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between mt-5">
        <div className="flex items-center gap-4">
          {generating ? (
            <span className="inline-flex items-center gap-3 text-[11px] tracking-[0.25em] uppercase text-violet-400/70">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
              generating
            </span>
          ) : loaded ? (
            <>
              <span className="text-[11px] tracking-[0.25em] uppercase text-neutral-500">
                {activeVideo ? "spatial memory ready" : "capture loaded"}
              </span>
              <span
                className="text-[10px] tracking-[0.2em] uppercase"
                style={{ color: getMood(mood).color }}
              >
                {getMood(mood).label}
              </span>
            </>
          ) : null}
        </div>

        <p className="text-[10px] tracking-[0.25em] uppercase text-neutral-800">
          drag to orbit · scroll to zoom
        </p>
      </div>

      {/* Expand prompt bar */}
      {onPromptExpand && !generating && loaded && (
        <div className="mt-4">
          <PromptInput
            onSubmit={onPromptExpand}
            generating={false}
            placeholder="expand this memory..."
            compact
          />
        </div>
      )}
    </div>
  )
}
