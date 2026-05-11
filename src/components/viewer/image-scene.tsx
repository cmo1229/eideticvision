"use client"

import { useRef, useEffect, useState, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Environment } from "@react-three/drei"
import * as THREE from "three"

/* ------------------------------------------------------------------ */
/*  Depth-displaced mesh                                                */
/* ------------------------------------------------------------------ */

function DepthMesh({
  imageUrl,
  depthUrl,
  videoUrl,
  onLoad,
}: {
  imageUrl: string
  depthUrl?: string | null
  videoUrl?: string | null
  onLoad: () => void
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const [error, setError] = useState(false)
  const segments = 120
  const textureRef = useRef<THREE.VideoTexture | null>(null)

  // Create geometry once
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(4, 3, segments, Math.floor(segments * 0.75))
    // Store original positions for displacement
    g.setAttribute(
      "originalPosition",
      new THREE.BufferAttribute(new Float32Array(g.attributes.position.array), 3)
    )
    return g
  }, [])

  // Load color texture (image or video)
  useEffect(() => {
    if (videoUrl) {
      const video = document.createElement("video")
      video.src = videoUrl
      video.crossOrigin = "anonymous"
      video.loop = true
      video.muted = true
      video.playsInline = true
      video.play().catch(() => {})

      const tex = new THREE.VideoTexture(video)
      tex.colorSpace = THREE.SRGBColorSpace
      textureRef.current = tex

      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        side: THREE.DoubleSide,
        roughness: 0.5,
      })
      meshRef.current.material = mat

      const onReady = () => {
        meshRef.current.geometry = geo
        onLoad()
      }
      if (video.readyState >= 2) onReady()
      else video.addEventListener("loadeddata", onReady, { once: true })

      return () => {
        video.pause()
        video.removeEventListener("loadeddata", onReady)
      }
    } else {
      const loader = new THREE.TextureLoader()
      loader.load(imageUrl, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        const mat = new THREE.MeshStandardMaterial({
          map: tex,
          side: THREE.DoubleSide,
          roughness: 0.5,
        })
        meshRef.current.material = mat
        meshRef.current.geometry = geo
        onLoad()
      })
    }
  }, [imageUrl, videoUrl, geo, onLoad])

  // Apply depth displacement
  useEffect(() => {
    if (!depthUrl) return

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = depthUrl
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.drawImage(img, 0, 0)
      const pixels = ctx.getImageData(0, 0, img.width, img.height).data

      const pos = geo.attributes.position.array as Float32Array
      const orig = (geo.attributes as Record<string, THREE.BufferAttribute>).originalPosition
        ?.array as Float32Array | undefined

      if (!orig) return

      // UV-based depth lookup
      const uv = geo.attributes.uv.array as Float32Array

      for (let i = 0; i < pos.length; i += 3) {
        const u = uv[(i / 3) * 2]
        const v = 1 - uv[(i / 3) * 2 + 1]

        const px = Math.floor(u * (img.width - 1))
        const py = Math.floor(v * (img.height - 1))
        const pixelIdx = (py * img.width + px) * 4

        // Depth from grayscale (average of RGB)
        const depth = (pixels[pixelIdx] + pixels[pixelIdx + 1] + pixels[pixelIdx + 2]) / (3 * 255)

        // Displace along z (normal direction for XY plane)
        pos[i + 2] = orig[i + 2] + depth * 1.5
      }

      geo.attributes.position.needsUpdate = true
      geo.computeVertexNormals()
    }
  }, [depthUrl, geo])

  useFrame(() => {
    if (textureRef.current && videoUrl) {
      // Keep video texture updated
    }
  })

  return (
    <mesh ref={meshRef}>
      <meshStandardMaterial side={THREE.DoubleSide} roughness={0.5} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Generation progress bar                                             */
/* ------------------------------------------------------------------ */

const PHASES = [
  { at: 0, label: "reading capture" },
  { at: 15, label: "estimating depth" },
  { at: 35, label: "Gen-4.5 processing" },
  { at: 60, label: "rendering spatial memory" },
  { at: 85, label: "almost there" },
]

function GenerationOverlay({ phaseOffset = 0 }: { phaseOffset?: number }) {
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState(PHASES[0].label)

  useEffect(() => {
    let p = 0
    const iv = setInterval(() => {
      if (p < 20) {
        p += 1.2
      } else if (p < 55) {
        p += 0.35
      } else if (p < 80) {
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
          depth-anything-v2 · gen4.5
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
}

export function ImageScene({ imageUrl, videoUrls, depthUrl, generating, error }: ImageSceneProps) {
  const [loaded, setLoaded] = useState(false)
  const showVideo = videoUrls && videoUrls.length > 0
  const hasDepth = !!depthUrl

  return (
    <div className="relative w-full">
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
            depthUrl={depthUrl}
            videoUrl={showVideo ? videoUrls[0] : undefined}
            onLoad={() => setLoaded(true)}
          />

          <Environment preset="night" />
          <OrbitControls
            makeDefault
            enablePan
            enableZoom
            minDistance={1.5}
            maxDistance={12}
            target={[0, 0, 0.5]}
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
            <span className="text-[11px] tracking-[0.25em] uppercase text-neutral-500">
              {hasDepth ? "spatial memory ready" : showVideo ? "neural memory ready" : "capture loaded"}
            </span>
          ) : null}
          {hasDepth && loaded && (
            <span className="text-[10px] tracking-[0.2em] uppercase text-violet-500/60">
              depth-aware
            </span>
          )}
        </div>

        <p className="text-[10px] tracking-[0.25em] uppercase text-neutral-800">
          orbit · zoom · pan
        </p>
      </div>
    </div>
  )
}
