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
/*  Loading screen                                                      */
/* ------------------------------------------------------------------ */

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-10 backdrop-blur-md">
      <p className="text-sm tracking-[0.3em] uppercase text-violet-400/80 animate-pulse">{message}</p>
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
        {!loaded && <LoadingScreen message="loading capture" />}
        {generating && loaded && <LoadingScreen message="generating neural memory" />}

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
