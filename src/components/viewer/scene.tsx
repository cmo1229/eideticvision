"use client"

import { useRef, useState, useMemo, useEffect, useCallback } from "react"
import { Canvas, useThree, useFrame } from "@react-three/fiber"
import { OrbitControls, useProgress, Environment } from "@react-three/drei"
import { EffectComposer, Bloom, Vignette, HueSaturation } from "@react-three/postprocessing"
import { GLTFLoader, PLYLoader } from "three-stdlib"
import * as THREE from "three"
import axios from "axios"

/* ------------------------------------------------------------------ */
/*  Style presets                                                      */
/* ------------------------------------------------------------------ */

type StyleId = "dream" | "noir" | "neon" | "natural" | "ethereal"

interface StylePreset {
  id: StyleId
  label: string
  icon: string
  bloom: { threshold: number; intensity: number; smoothing: number }
  vignette: { darkness: number; offset: number }
  colorShift: { hue: number; saturation: number }
  envPreset: string
  ambientIntensity: number
  dirIntensity: number
}

const PRESETS: StylePreset[] = [
  {
    id: "dream",
    label: "Lucid Dream",
    icon: "✦",
    bloom: { threshold: 0.5, intensity: 1.5, smoothing: 0.95 },
    vignette: { darkness: 0.5, offset: 0.15 },
    colorShift: { hue: 0.08, saturation: 0.12 },
    envPreset: "night",
    ambientIntensity: 0.3,
    dirIntensity: 0.8,
  },
  {
    id: "noir",
    label: "Noir",
    icon: "◧",
    bloom: { threshold: 0.8, intensity: 0.3, smoothing: 0.8 },
    vignette: { darkness: 0.8, offset: 0.1 },
    colorShift: { hue: 0, saturation: -0.9 },
    envPreset: "city",
    ambientIntensity: 0.15,
    dirIntensity: 0.5,
  },
  {
    id: "neon",
    label: "Neon",
    icon: "⚡",
    bloom: { threshold: 0.2, intensity: 2.5, smoothing: 0.9 },
    vignette: { darkness: 0.3, offset: 0.2 },
    colorShift: { hue: 0.5, saturation: 0.4 },
    envPreset: "night",
    ambientIntensity: 0.2,
    dirIntensity: 0.6,
  },
  {
    id: "natural",
    label: "Natural",
    icon: "☀",
    bloom: { threshold: 0.7, intensity: 0.4, smoothing: 0.7 },
    vignette: { darkness: 0.15, offset: 0.1 },
    colorShift: { hue: 0, saturation: 0.05 },
    envPreset: "sunset",
    ambientIntensity: 0.6,
    dirIntensity: 1.0,
  },
  {
    id: "ethereal",
    label: "Ethereal",
    icon: "◌",
    bloom: { threshold: 0.4, intensity: 2.0, smoothing: 0.98 },
    vignette: { darkness: 0.4, offset: 0.25 },
    colorShift: { hue: 0.75, saturation: 0.2 },
    envPreset: "warehouse",
    ambientIntensity: 0.25,
    dirIntensity: 0.7,
  },
]

const STYLE_PROMPTS: Record<string, string> = {
  dream: "dreamlike, soft focus, ethereal glow, floating particles, cinematic slow motion",
  noir: "film noir, high contrast, black and white, dramatic shadows, 1940s cinema aesthetic",
  neon: "cyberpunk, neon lights, synthwave, electric colors, Blade Runner aesthetic",
  natural: "natural lighting, golden hour, photorealistic, warm sunlight, serene atmosphere",
  ethereal: "otherworldly, misty, celestial, soft pastels, heavenly atmosphere, floating dust motes",
}

/* ------------------------------------------------------------------ */
/*  Loading overlay                                                    */
/* ------------------------------------------------------------------ */

function LoadingOverlay() {
  const { progress } = useProgress()
  return (
    <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-10 backdrop-blur-md">
      <p className="text-lg font-medium text-neutral-200 tracking-wide">Loading your world…</p>
      <div className="w-72 h-1 rounded-full bg-neutral-800 overflow-hidden mt-5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-neutral-500 mt-2 tabular-nums">{Math.round(progress)}%</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  3D model loader                                                    */
/* ------------------------------------------------------------------ */

function ViewerModel({ url, type }: { url: string; type: string }) {
  const groupRef = useRef<THREE.Group>(null!)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (type === "ply") {
    return <PlyModel url={url} />
  }

  useEffect(() => {
    const loader = new GLTFLoader()
    loader.load(
      url,
      (gltf) => {
        groupRef.current.add(gltf.scene)
        setLoaded(true)
      },
      undefined,
      (err) => setError(err?.message ?? "Failed to load 3D scene.")
    )
  }, [url])

  if (error) return <p className="text-red-400 p-8">{error}</p>

  return (
    <>
      {!loaded && <LoadingOverlay />}
      <group ref={groupRef} />
    </>
  )
}

function PlyModel({ url }: { url: string }) {
  const groupRef = useRef<THREE.Group>(null!)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loader = new PLYLoader()
    loader.load(url, (geometry) => {
      geometry.computeVertexNormals()
      const material = new THREE.PointsMaterial({ size: 0.02, vertexColors: true, sizeAttenuation: true })
      groupRef.current.add(new THREE.Points(geometry, material))
      setLoaded(true)
    }, undefined, (err) => setError(err?.message ?? "Failed to load PLY."))
  }, [url])

  if (error) return <p className="text-red-400 p-8">{error}</p>
  return (
    <>
      {!loaded && <LoadingOverlay />}
      <group ref={groupRef} />
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Effects layer                                                      */
/* ------------------------------------------------------------------ */

function SceneEffects({ preset }: { preset: StylePreset }) {
  return (
    <EffectComposer enableNormalPass={false} multisampling={0}>
      <Bloom
        luminanceThreshold={preset.bloom.threshold}
        luminanceSmoothing={preset.bloom.smoothing}
        intensity={preset.bloom.intensity}
        width={480}
      />
      <HueSaturation
        hue={preset.colorShift.hue}
        saturation={preset.colorShift.saturation}
      />
      <Vignette
        offset={preset.vignette.offset}
        darkness={preset.vignette.darkness}
      />
    </EffectComposer>
  )
}

/* ------------------------------------------------------------------ */
/*  MemoryCamera — human-like auto-flythrough                           */
/* ------------------------------------------------------------------ */

function MemoryCamera({ active, onCycle }: { active: boolean; onCycle: () => void }) {
  const { camera } = useThree()
  const timeRef = useRef(0)
  const saccadeRef = useRef({ x: 0, y: 0, z: 0 })
  const lastSaccadeRef = useRef(0)
  const baseTarget = useRef(new THREE.Vector3(0, 0, 0))

  useEffect(() => {
    if (active) {
      // Snap to a good starting orbit position
      camera.position.set(3, 1.5, 4)
      camera.lookAt(baseTarget.current)
      timeRef.current = 0
    }
  }, [active, camera])

  useFrame((_, delta) => {
    if (!active) return
    timeRef.current += delta

    const t = timeRef.current

    // Human-like gaze: layered sine waves at incommensurate frequencies
    const orbitX = Math.sin(t * 0.23) * 2.5
    const orbitZ = Math.cos(t * 0.23) * 2.5
    const verticalBob = Math.sin(t * 0.37 + 1.2) * 0.6
    const breathing = Math.sin(t * 0.15) * 0.3 + 3.5  // distance

    // Micro-saccades every ~1.5 seconds
    if (t - lastSaccadeRef.current > 1.2 + Math.random() * 0.8) {
      saccadeRef.current = {
        x: (Math.random() - 0.5) * 0.15,
        y: (Math.random() - 0.5) * 0.1,
        z: (Math.random() - 0.5) * 0.08,
      }
      lastSaccadeRef.current = t
    }

    // Gradually shift focal point for organic exploration
    const focalX = Math.sin(t * 0.17 + 0.8) * 0.4
    const focalY = Math.cos(t * 0.19 + 0.3) * 0.3

    camera.position.x = orbitX + saccadeRef.current.x
    camera.position.y = 1.5 + verticalBob + saccadeRef.current.y
    camera.position.z = orbitZ * (breathing / 3) + saccadeRef.current.z

    camera.lookAt(
      baseTarget.current.x + focalX,
      baseTarget.current.y + focalY,
      baseTarget.current.z
    )

    onCycle()
  })

  return null
}

/* ------------------------------------------------------------------ */
/*  DustParticles — floating light motes                                */
/* ------------------------------------------------------------------ */

function DustParticles() {
  const pointsRef = useRef<THREE.Points>(null!)
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const count = 120
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 8
      pos[i * 3 + 1] = (Math.random() - 0.5) * 6
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    return g
  }, [])

  useFrame((_, delta) => {
    if (!pointsRef.current) return
    const pos = pointsRef.current.geometry.attributes.position.array as Float32Array
    for (let i = 0; i < pos.length; i += 3) {
      pos[i + 1] += Math.sin(Date.now() * 0.001 + i) * delta * 0.08
      pos[i] += Math.cos(Date.now() * 0.0013 + i) * delta * 0.05
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry />
      <pointsMaterial
        size={0.015}
        color="#c4b5fd"
        transparent
        opacity={0.5}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

/* ------------------------------------------------------------------ */
/*  Scene wrapper                                                      */
/* ------------------------------------------------------------------ */

interface SceneProps {
  assetUrl: string
  assetType: string
}

const RECORDER_MIME = "video/webm;codecs=vp9,opus"

export function Scene({ assetUrl, assetType }: SceneProps) {
  const [activeStyle, setActiveStyle] = useState<StylePreset>(PRESETS[0])
  const canvasRef = useRef<HTMLDivElement>(null)
  const [recording, setRecording] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  /* neural memory */
  const [neuralGenerating, setNeuralGenerating] = useState(false)
  const [neuralVideo, setNeuralVideo] = useState<string | null>(null)
  const [neuralError, setNeuralError] = useState<string | null>(null)
  const [showNeural, setShowNeural] = useState(false)

  /* re-live mode */
  const [reliving, setReliving] = useState(false)
  const reliveCyclesRef = useRef(0)
  const reliveMaxCycles = 900 // ~30 seconds at 30fps
  const reliveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const preset = useMemo(() => PRESETS.find((p) => p.id === activeStyle.id) ?? PRESETS[0], [activeStyle.id])

  /* ---------- re-live ---------- */

  const handleReliveCycle = useCallback(() => {
    reliveCyclesRef.current += 1
  }, [])

  const startReliving = useCallback(() => {
    setReliving(true)
    reliveCyclesRef.current = 0

    // Auto-start recording
    const canvas = canvasRef.current?.querySelector("canvas")
    if (!canvas) return
    const stream = canvas.captureStream(30)
    const recorder = new MediaRecorder(stream, {
      mimeType: RECORDER_MIME,
      videoBitsPerSecond: 6_000_000,
    })
    chunksRef.current = []
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `eidetic-memory-${Date.now()}.webm`
      a.click()
      URL.revokeObjectURL(url)
    }
    recorder.start()
    recorderRef.current = recorder
    setRecording(true)

    // Auto-stop after ~30 seconds
    reliveTimeoutRef.current = setTimeout(() => {
      setReliving(false)
      recorderRef.current?.stop()
      recorderRef.current = null
      setRecording(false)
    }, 30000)
  }, [])

  const stopReliving = useCallback(() => {
    setReliving(false)
    if (reliveTimeoutRef.current) clearTimeout(reliveTimeoutRef.current)
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
  }, [])

  /* ---------- recording ---------- */

  const startRecording = useCallback(() => {
    const canvas = canvasRef.current?.querySelector("canvas")
    if (!canvas) return

    const stream = canvas.captureStream(30)
    const recorder = new MediaRecorder(stream, {
      mimeType: RECORDER_MIME,
      videoBitsPerSecond: 6_000_000,
    })
    chunksRef.current = []
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `eidetic-capture-${Date.now()}.webm`
      a.click()
      URL.revokeObjectURL(url)
    }
    recorder.start()
    recorderRef.current = recorder
    setRecording(true)
  }, [])

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
  }, [])

  /* ---------- neural memory generation ---------- */

  const generateNeuralMemory = useCallback(async () => {
    const canvas = canvasRef.current?.querySelector("canvas")
    if (!canvas) return

    setNeuralGenerating(true)
    setNeuralError(null)

    try {
      const frameUrl = canvas.toDataURL("image/jpeg", 0.9)
      const prompt = STYLE_PROMPTS[activeStyle.id] ?? STYLE_PROMPTS.ethereal
      const { data } = await axios.post("/api/generate", {
        imageUrl: frameUrl,
        style: activeStyle.id,
        prompt,
        duration: 5,
      })
      setNeuralVideo(data.videoUrls[0] ?? null)
      setShowNeural(true)
    } catch (err: any) {
      setNeuralError(err.response?.data?.error ?? err.message ?? "Generation failed")
    } finally {
      setNeuralGenerating(false)
    }
  }, [activeStyle.id])

  return (
    <div className="relative w-full">
      {/* Style selector */}
      <div className="flex items-center gap-0 mb-5 overflow-x-auto pb-1">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveStyle(p)}
            className={`
              shrink-0 px-5 py-1.5 text-[11px] tracking-[0.25em] uppercase transition-all duration-700 border
              ${activeStyle.id === p.id
                ? "border-violet-500/40 text-violet-300 bg-violet-500/[0.04]"
                : "border-neutral-800/40 text-neutral-700 hover:text-neutral-500 hover:border-neutral-700"
              }
            `}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="relative w-full h-[75vh] overflow-hidden border border-neutral-800/30 bg-[#030305]"
      >
        <Canvas
          camera={{ position: [0, 2, 5], fov: 50 }}
          style={{ background: "#030305" }}
        >
          <ambientLight intensity={preset.ambientIntensity} />
          <directionalLight position={[5, 5, 5]} intensity={preset.dirIntensity} />
          <ViewerModel url={assetUrl} type={assetType} />
          <Environment preset={preset.envPreset as any} />
          <SceneEffects preset={preset} />
          <DustParticles />
          <MemoryCamera active={reliving} onCycle={handleReliveCycle} />
          <OrbitControls
            makeDefault
            enablePan={!reliving}
            enableZoom={!reliving}
            minDistance={1}
            maxDistance={50}
          />
        </Canvas>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between mt-5">
        <div className="flex items-center gap-6">
          {reliving ? (
            <button
              onClick={stopReliving}
              className="inline-flex items-center gap-3 text-[11px] tracking-[0.25em] uppercase text-amber-400/70 hover:text-amber-300 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              re-living · tap to stop
            </button>
          ) : (
            <>
              <button
                onClick={startReliving}
                className="inline-flex items-center gap-3 text-[11px] tracking-[0.25em] uppercase text-amber-500/70 hover:text-amber-400 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60" />
                re-live
              </button>

              {recording ? (
                <button
                  onClick={stopRecording}
                  className="inline-flex items-center gap-3 text-[11px] tracking-[0.25em] uppercase text-red-400/70 hover:text-red-400 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  recording
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  className="inline-flex items-center gap-3 text-[11px] tracking-[0.25em] uppercase text-neutral-600 hover:text-neutral-400 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-600 group-hover:bg-neutral-400" />
                  record
                </button>
              )}

              <button
                onClick={generateNeuralMemory}
                disabled={neuralGenerating}
                className={`inline-flex items-center gap-3 text-[11px] tracking-[0.25em] uppercase transition-colors
                  ${neuralGenerating
                    ? "text-violet-400/70 cursor-wait"
                    : "text-neutral-600 hover:text-violet-400"
                  }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${neuralGenerating ? "bg-violet-500 animate-pulse" : "bg-violet-600/50"}`} />
                {neuralGenerating ? "generating" : "neural memory"}
              </button>
            </>
          )}
        </div>

        <p className="text-[10px] tracking-[0.25em] uppercase text-neutral-800">
          {reliving ? "re-living memory" : "orbit · zoom · pan"}
        </p>
      </div>

      {/* Neural memory overlay */}
      {showNeural && neuralVideo && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="relative max-w-4xl w-full">
            <video
              src={neuralVideo}
              controls
              autoPlay
              loop
              playsInline
              className="w-full border border-neutral-800/50"
            />
            <button
              onClick={() => setShowNeural(false)}
              className="absolute -top-10 right-0 text-xs text-neutral-500 hover:text-neutral-300 uppercase tracking-[0.3em] transition-colors"
            >
              close
            </button>
          </div>
          <p className="mt-6 text-[10px] tracking-[0.3em] uppercase text-neutral-600">
            {activeStyle.label} — neural memory
          </p>
          <div className="mt-8 flex items-center gap-4">
            <button
              onClick={() => setShowNeural(false)}
              className="text-[11px] tracking-[0.25em] uppercase text-neutral-500 hover:text-neutral-300 transition-colors border border-neutral-800 px-6 py-2 hover:border-neutral-700"
            >
              back to viewer
            </button>
            <a
              href={neuralVideo}
              download={`eidetic-neural-${Date.now()}.mp4`}
              className="text-[11px] tracking-[0.25em] uppercase text-violet-400/70 hover:text-violet-300 transition-colors border border-violet-500/30 px-6 py-2 hover:border-violet-500/60"
            >
              download
            </a>
          </div>
        </div>
      )}

      {showNeural && neuralError && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center">
          <p className="text-sm tracking-[0.2em] uppercase text-red-400/70">generation failed</p>
          <p className="text-xs text-neutral-500 mt-4 max-w-md text-center">{neuralError}</p>
          <button
            onClick={() => { setShowNeural(false); setNeuralError(null) }}
            className="mt-8 text-[11px] tracking-[0.25em] uppercase text-neutral-500 hover:text-neutral-300 transition-colors border border-neutral-800 px-6 py-2"
          >
            back to viewer
          </button>
        </div>
      )}
    </div>
  )
}
