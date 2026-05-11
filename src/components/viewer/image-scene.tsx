"use client"

import { useRef, useEffect, useState, useMemo } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, Environment } from "@react-three/drei"
import * as THREE from "three"

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

  // Build depth using:
  // 1. Vertical gradient (higher pixels = farther for landscapes)
  // 2. Luminance (brighter = closer)
  // 3. Local contrast / edge detection for object boundaries
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4

      // Luminance component
      const lum = (src.data[i] * 0.299 + src.data[i + 1] * 0.587 + src.data[i + 2] * 0.114) / 255

      // Vertical position: bottom of image tends to be closer
      const vertFactor = 1 - y / h

      // Local contrast: sample neighbors for edge detection
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

      // Combine factors: weighted mix
      let depth = vertFactor * 0.55 + lum * 0.25 + contrast * 0.2

      // Boost edges for object separation
      if (contrast > 0.08) {
        depth += contrast * 0.3
      }

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

/* ------------------------------------------------------------------ */
/*  Depth-displaced mesh                                                */
/* ------------------------------------------------------------------ */

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
  const textureRef = useRef<THREE.VideoTexture | null>(null)
  const segments = 100

  // Create geometry once
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(4, 3, segments, Math.floor(segments * 0.75))
    g.setAttribute(
      "originalPosition",
      new THREE.BufferAttribute(new Float32Array(g.attributes.position.array), 3)
    )
    return g
  }, [])

  // Load image + compute depth + apply displacement
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = imageUrl

    img.onload = () => {
      // Client-side depth estimation
      const depthDataUrl = computeDepthFromImage(img)

      // Load depth map to apply displacement
      const depthImg = new Image()
      depthImg.src = depthDataUrl
      depthImg.onload = () => {
        const canvas = document.createElement("canvas")
        canvas.width = depthImg.width
        canvas.height = depthImg.height
        const ctx = canvas.getContext("2d")!
        ctx.drawImage(depthImg, 0, 0)
        const pixels = ctx.getImageData(0, 0, depthImg.width, depthImg.height).data

        const pos = geo.attributes.position.array as Float32Array
        const orig = geo.attributes.originalPosition?.array as Float32Array
        if (!orig) return

        const uv = geo.attributes.uv.array as Float32Array

        for (let i = 0; i < pos.length; i += 3) {
          const u = uv[(i / 3) * 2]
          const v = 1 - uv[(i / 3) * 2 + 1]

          const px = Math.floor(u * (depthImg.width - 1))
          const py = Math.floor(v * (depthImg.height - 1))
          const pixelIdx = (py * depthImg.width + px) * 4

          const depth = pixels[pixelIdx] / 255 // grayscale, 0-1
          pos[i + 2] = orig[i + 2] + depth * 2.0
        }

        geo.attributes.position.needsUpdate = true
        geo.computeVertexNormals()
      }

      // Load color texture
      const loader = new THREE.TextureLoader()
      loader.load(imageUrl, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        meshRef.current.material = new THREE.MeshStandardMaterial({
          map: tex,
          side: THREE.DoubleSide,
          roughness: 0.5,
        })
        meshRef.current.geometry = geo
      })
    }
  }, [imageUrl, geo])

  // Swap to video texture when available
  useEffect(() => {
    if (!videoUrl) return

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

    const updateMaterial = () => {
      if (meshRef.current) {
        meshRef.current.material = new THREE.MeshStandardMaterial({
          map: tex,
          side: THREE.DoubleSide,
          roughness: 0.5,
        })
        onLoad()
      }
    }

    if (video.readyState >= 2) {
      updateMaterial()
    } else {
      video.addEventListener("loadeddata", updateMaterial, { once: true })
    }

    return () => {
      video.pause()
      video.removeEventListener("loadeddata", updateMaterial)
    }
  }, [videoUrl, onLoad])

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
}

export function ImageScene({ imageUrl, videoUrls, depthUrl, generating, error }: ImageSceneProps) {
  const [loaded, setLoaded] = useState(false)
  const [introDone, setIntroDone] = useState(false)
  const showVideo = videoUrls && videoUrls.length > 0

  // End intro after 4.5 seconds
  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => setIntroDone(true), 4500)
    return () => clearTimeout(t)
  }, [loaded])

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
                {showVideo ? "spatial memory ready" : "capture loaded"}
              </span>
              <span className="text-[10px] tracking-[0.2em] uppercase text-violet-500/60">
                spatial depth
              </span>
            </>
          ) : null}
        </div>

        <p className="text-[10px] tracking-[0.25em] uppercase text-neutral-800">
          orbit · zoom · pan
        </p>
      </div>
    </div>
  )
}
