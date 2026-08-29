"use client"

import { useRef, useEffect, useState, useMemo } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Environment } from "@react-three/drei"
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
/*  Open terrain world — depth becomes hills, no walls, fades to fog     */
/* ------------------------------------------------------------------ */

const TERRAIN_SIZE = 40
const TERRAIN_SEGS = 200
const TERRAIN_MAX_HEIGHT = 10
const DEPTH_SCALE = 8.0

function buildTerrainGeometry(depthData: Float32Array): THREE.BufferGeometry {
  const dw = Math.min(256, Math.floor(Math.sqrt(depthData.length)))
  const dh = dw

  const vertices: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let iy = 0; iy <= TERRAIN_SEGS; iy++) {
    const v = iy / TERRAIN_SEGS
    const z = (0.5 - v) * TERRAIN_SIZE

    for (let ix = 0; ix <= TERRAIN_SEGS; ix++) {
      const u = ix / TERRAIN_SEGS
      const x = (u - 0.5) * TERRAIN_SIZE

      // Distance from center for edge falloff
      const distFromCenter = Math.sqrt(
        (u - 0.5) ** 2 + (v - 0.5) ** 2
      ) / 0.7 // normalized, 0 at center, ~1 at edges

      // Depth sample
      const px = Math.floor(u * (dw - 1))
      const py = Math.floor((1 - v) * (dh - 1))
      const idx = Math.min(py * dw + px, depthData.length - 1)
      const rawDepth = depthData[idx] ?? 0

      // Height: depth creates terrain elevation
      // Close objects (depth=1) = tall, far objects (depth=0) = ground
      const height = rawDepth * TERRAIN_MAX_HEIGHT

      // Edge falloff: terrain sinks back to ground at edges
      const edgeFade = distFromCenter > 0.55
        ? Math.max(0, 1 - (distFromCenter - 0.55) / 0.45)
        : 1

      vertices.push(x, height * edgeFade, z)
      uvs.push(u, v)
    }
  }

  for (let iy = 0; iy < TERRAIN_SEGS; iy++) {
    for (let ix = 0; ix < TERRAIN_SEGS; ix++) {
      const a = iy * (TERRAIN_SEGS + 1) + ix
      const b = a + TERRAIN_SEGS + 1
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3))
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

function DepthMesh({
  imageUrl,
  videoUrl,
  onLoad,
  sourceType,
}: {
  imageUrl: string
  videoUrl?: string | null
  onLoad: () => void
  sourceType: "image" | "text"
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null)

  // Build curved geometry with depth (image) or without (text prompt)
  useEffect(() => {
    let cancelled = false

    async function build() {
      let geo: THREE.BufferGeometry
      let textureUrl: string

      if (sourceType === "text") {
        // Text prompt: no source image, use flat depth (all zeros) for gentle curve
        const flatDepth = new Float32Array(256 * 256) // all zeros
        geo = buildTerrainGeometry(flatDepth)

        // Video is the texture (or will be swapped in)
        textureUrl = videoUrl ?? imageUrl
      } else {
        // Image upload: full depth computation
        const img = await new Promise<HTMLImageElement>((resolve) => {
          const i = new Image()
          i.crossOrigin = "anonymous"
          i.onload = () => resolve(i)
          i.src = imageUrl
        })

        if (cancelled) return

        const depthDataUrl = computeDepthFromImage(img)
        const depthData = await loadDepthData(depthDataUrl)

        if (cancelled) return

        geo = buildTerrainGeometry(depthData)
        textureUrl = imageUrl
      }

      if (cancelled) return

      // Load texture (image or first video frame)
      if (sourceType === "text" && videoUrl) {
        // Text: load video directly
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

        const mat = new THREE.MeshStandardMaterial({
          map: tex,
          side: THREE.DoubleSide,
          roughness: 0.5,
        })
        materialRef.current = mat
        meshRef.current.geometry = geo
        meshRef.current.material = mat

        if (video.readyState >= 2) {
          onLoad()
        } else {
          video.addEventListener("loadeddata", () => onLoad(), { once: true })
        }
      } else {
        // Image: load image texture
        const tex = await new Promise<THREE.Texture>((resolve) => {
          new THREE.TextureLoader().load(textureUrl, (t) => {
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

        // Swap to video texture when available
        if (videoUrl) {
          const video = document.createElement("video")
          video.src = videoUrl
          video.crossOrigin = "anonymous"
          video.loop = true
          video.muted = true
          video.playsInline = true
          video.play().catch(() => {})
          videoRef.current = video

          const vTex = new THREE.VideoTexture(video)
          vTex.colorSpace = THREE.SRGBColorSpace

          const swapTexture = () => {
            if (materialRef.current) {
              materialRef.current.map = vTex
              materialRef.current.needsUpdate = true
            }
          }

          if (video.readyState >= 2) {
            swapTexture()
          } else {
            video.addEventListener("loadeddata", swapTexture, { once: true })
          }
        }

        onLoad()
      }
    }

    build()
    return () => { cancelled = true }
  }, [imageUrl, videoUrl, sourceType])

  // Breathing world — subtle pulse like the memory is alive
  useFrame(() => {
    if (!meshRef.current) return
    const t = Date.now() * 0.0003
    const breathe = 1 + Math.sin(t) * 0.008 + Math.sin(t * 1.7) * 0.005
    meshRef.current.scale.setScalar(breathe)
  })

  return (
    <mesh ref={meshRef}>
      <meshStandardMaterial side={THREE.DoubleSide} roughness={0.5} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  FreeCamera — walk through the memory                                */
/* ------------------------------------------------------------------ */

function FreeCamera({ active, intro }: { active: boolean; intro: boolean }) {
  const { camera, gl } = useThree()
  const keys = useRef<Set<string>>(new Set())
  const dragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const pitch = useRef(0)
  const yaw = useRef(0)
  const introTime = useRef(0)

  useEffect(() => {
    const el = gl.domElement

    const onKeyDown = (e: KeyboardEvent) => keys.current.add(e.key.toLowerCase())
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    const onMouseDown = (e: MouseEvent) => {
      dragging.current = true
      lastMouse.current = { x: e.clientX, y: e.clientY }
    }
    const onMouseUp = () => { dragging.current = false }
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const dx = e.clientX - lastMouse.current.x
      const dy = e.clientY - lastMouse.current.y
      yaw.current -= dx * 0.003
      pitch.current -= dy * 0.003
      pitch.current = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, pitch.current))
      lastMouse.current = { x: e.clientX, y: e.clientY }
    }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    el.addEventListener("mousedown", onMouseDown)
    window.addEventListener("mouseup", onMouseUp)
    window.addEventListener("mousemove", onMouseMove)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      el.removeEventListener("mousedown", onMouseDown)
      window.removeEventListener("mouseup", onMouseUp)
      window.removeEventListener("mousemove", onMouseMove)
    }
  }, [gl])

  useFrame((_, delta) => {
    if (!active) return

    // Intro: auto-sweep to reveal the 360 world
    if (intro) {
      introTime.current += delta
      yaw.current = introTime.current * 0.6 // gentle spin
      if (introTime.current > 5) yaw.current = 0 // reset after intro
    }

    const speed = 4 * delta
    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current))
    const right = new THREE.Vector3(Math.cos(yaw.current), 0, -Math.sin(yaw.current))

    if (keys.current.has("w")) {
      camera.position.add(forward.clone().multiplyScalar(speed))
    }
    if (keys.current.has("s")) {
      camera.position.add(forward.clone().multiplyScalar(-speed))
    }
    if (keys.current.has("a")) {
      camera.position.add(right.clone().multiplyScalar(-speed))
    }
    if (keys.current.has("d")) {
      camera.position.add(right.clone().multiplyScalar(speed))
    }

    // Keep camera within terrain bounds, above ground
    const halfTerrain = TERRAIN_SIZE / 2 - 2
    camera.position.x = Math.max(-halfTerrain, Math.min(halfTerrain, camera.position.x))
    camera.position.z = Math.max(-halfTerrain, Math.min(halfTerrain, camera.position.z))
    camera.position.y = Math.max(0.8, camera.position.y)

    // Apply look direction
    const lookTarget = new THREE.Vector3(
      camera.position.x - Math.sin(yaw.current) * Math.cos(pitch.current),
      camera.position.y + Math.sin(pitch.current),
      camera.position.z - Math.cos(yaw.current) * Math.cos(pitch.current)
    )
    camera.lookAt(lookTarget)
  })

  return null
}

/* ------------------------------------------------------------------ */
/*  Memory atmosphere — fog, particles, breathing world                  */
/* ------------------------------------------------------------------ */

function MemoryFog({ mood }: { mood: MoodId }) {
  const { scene } = useThree()
  const m = getMood(mood)

  useEffect(() => {
    const fogColor = m.id === "noir" ? "#0a0a0a" : m.id === "warm" ? "#1a1410" : "#030310"
    scene.fog = new THREE.FogExp2(fogColor, 0.0012)
    scene.background = new THREE.Color(fogColor)
    return () => {
      scene.fog = null
      scene.background = new THREE.Color("#030305")
    }
  }, [scene, m.id])

  return null
}

function MemoryParticles() {
  const pointsRef = useRef<THREE.Points>(null!)

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const count = 200
    const pos = new Float32Array(count * 3)
    const halfTerrain = TERRAIN_SIZE / 2
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * TERRAIN_SIZE
      pos[i * 3 + 1] = 1 + Math.random() * TERRAIN_MAX_HEIGHT
      pos[i * 3 + 2] = (Math.random() - 0.5) * TERRAIN_SIZE
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    return g
  }, [])

  useFrame((_, delta) => {
    const pos = pointsRef.current.geometry.attributes.position.array as Float32Array
    for (let i = 0; i < pos.length; i += 3) {
      pos[i + 1] += Math.sin(Date.now() * 0.0005 + i) * delta * 0.15
      const angle = Math.atan2(pos[i + 2], pos[i])
      const newAngle = angle + delta * 0.03
      const radius = Math.sqrt(pos[i] ** 2 + pos[i + 2] ** 2)
      pos[i] = Math.cos(newAngle) * radius
      pos[i + 2] = Math.sin(newAngle) * radius
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry />
      <pointsMaterial
        size={0.04}
        color="#c4b5fd"
        transparent
        opacity={0.35}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
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
  { at: 35, label: "imagining the memory" },
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
          spatial depth · imagined
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
  videoUrl?: string | null
  depthUrl?: string | null
  generating: boolean
  error: string | null
  onPromptExpand?: (prompt: string) => void
  memoryStack?: string[]
  activeMemoryIndex?: number
  onMemorySelect?: (index: number) => void
  mood?: MoodId
  sourceType?: "image" | "text"
}

export function ImageScene({
  imageUrl,
  videoUrl,
  depthUrl,
  generating,
  error,
  onPromptExpand,
  memoryStack,
  activeMemoryIndex = 0,
  onMemorySelect,
  mood = "lucid",
  sourceType = "image",
}: ImageSceneProps) {
  const [loaded, setLoaded] = useState(false)
  const [introDone, setIntroDone] = useState(false)
  const [recalling, setRecalling] = useState(true)

  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => setIntroDone(true), 5000)
    return () => clearTimeout(t)
  }, [loaded])

  // Recall fade-in: world emerges from fog over 3 seconds
  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => setRecalling(false), 3000)
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
        {/* Recall fade-in — memory emerges from darkness */}
        {loaded && recalling && (
          <div
            className="absolute inset-0 z-10 bg-[#030310] pointer-events-none"
            style={{
              opacity: recalling ? 1 : 0,
              transition: "opacity 2.5s ease-out",
            }}
          />
        )}

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
          camera={{ position: [0, 2.5, 8], fov: 65 }}
          style={{ background: "#030305" }}
        >
          <ambientLight intensity={0.5} />
          <directionalLight position={[3, 3, 3]} intensity={0.8} />
          <directionalLight position={[-2, 1, -1]} intensity={0.3} />

          <DepthMesh
            imageUrl={imageUrl}
            videoUrl={videoUrl}
            sourceType={sourceType}
            onLoad={() => setLoaded(true)}
          />

          <Environment preset="night" />
          <MoodEffects mood={mood} />
          <MemoryFog mood={mood} />
          <MemoryParticles />
          <FreeCamera active={loaded && !generating} intro={loaded && !introDone} />
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
                spatial memory ready
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
          wasd to walk · mouse to look
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
