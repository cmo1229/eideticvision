"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, Environment } from "@react-three/drei"
import * as THREE from "three"

/* ------------------------------------------------------------------ */
/*  Image plane in 3D space                                             */
/* ------------------------------------------------------------------ */

function ImagePlane({ url, onLoad }: { url: string; onLoad: () => void }) {
  const meshRef = useRef<THREE.Mesh>(null!)

  useEffect(() => {
    const loader = new THREE.TextureLoader()
    loader.load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      const aspect = tex.image.width / tex.image.height
      const h = 3
      const w = h * aspect
      const geo = new THREE.PlaneGeometry(w, h)
      const mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide })
      meshRef.current.geometry = geo
      meshRef.current.material = mat
      onLoad()
    })
  }, [url, onLoad])

  return <mesh ref={meshRef} />
}

/* ------------------------------------------------------------------ */
/*  Video plane in 3D space                                             */
/* ------------------------------------------------------------------ */

function VideoPlane({ url, onLoad }: { url: string; onLoad: () => void }) {
  const meshRef = useRef<THREE.Mesh>(null!)

  useEffect(() => {
    const video = document.createElement("video")
    video.src = url
    video.crossOrigin = "anonymous"
    video.loop = true
    video.muted = true
    video.playsInline = true
    video.play().catch(() => {})

    const tex = new THREE.VideoTexture(video)
    tex.colorSpace = THREE.SRGBColorSpace

    const onMeta = () => {
      const aspect = video.videoWidth / video.videoHeight
      const h = 3
      const w = h * aspect
      const geo = new THREE.PlaneGeometry(w, h)
      const mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide })
      meshRef.current.geometry = geo
      meshRef.current.material = mat
      onLoad()
    }

    if (video.readyState >= 2) {
      onMeta()
    } else {
      video.addEventListener("loadeddata", onMeta, { once: true })
    }

    return () => {
      video.pause()
      video.removeEventListener("loadeddata", onMeta)
    }
  }, [url, onLoad])

  return <mesh ref={meshRef} />
}

/* ------------------------------------------------------------------ */
/*  Generation progress bar                                             */
/* ------------------------------------------------------------------ */

const PHASES = [
  { at: 0, label: "reading capture" },
  { at: 15, label: "sending to runway" },
  { at: 35, label: "Gen-4.5 processing" },
  { at: 60, label: "rendering neural memory" },
  { at: 85, label: "almost there" },
]

function GenerationOverlay() {
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState(PHASES[0].label)

  useEffect(() => {
    let p = 0
    const startTime = Date.now()

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
          gen4.5
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
  generating: boolean
  error: string | null
}

export function ImageScene({ imageUrl, videoUrls, generating, error }: ImageSceneProps) {
  const [loaded, setLoaded] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const showVideo = videoUrls && videoUrls.length > 0

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
          {showVideo && videoUrls[0] ? (
            <VideoPlane url={videoUrls[0]} onLoad={() => { setLoaded(true); setVideoReady(true) }} />
          ) : (
            <ImagePlane url={imageUrl} onLoad={() => setLoaded(true)} />
          )}
          <Environment preset="night" />
          <OrbitControls
            makeDefault
            enablePan
            enableZoom
            minDistance={1.5}
            maxDistance={15}
            target={[0, 0, 0]}
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
          ) : showVideo && videoReady ? (
            <span className="text-[11px] tracking-[0.25em] uppercase text-neutral-500">
              neural memory ready
            </span>
          ) : error ? (
            <span className="text-[11px] tracking-[0.25em] uppercase text-red-400/50">
              using original
            </span>
          ) : null}
        </div>

        <p className="text-[10px] tracking-[0.25em] uppercase text-neutral-800">
          orbit · zoom · pan
        </p>
      </div>
    </div>
  )
}
