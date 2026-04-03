"use client"

import { useRef, useState, useMemo, useEffect, useCallback } from "react"
import { Canvas, useThree, useFrame } from "@react-three/fiber"
import { OrbitControls, useProgress, Environment } from "@react-three/drei"
import { EffectComposer, Bloom, ColorAverage, Vignette, HueSaturation } from "@react-three/postprocessing"
import { GLTFLoader, PLYLoader } from "three-stdlib"
import * as THREE from "three"
import { BlendFunction, Effect, EffectPass } from "postprocessing"

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

  const preset = useMemo(() => PRESETS.find((p) => p.id === activeStyle.id) ?? PRESETS[0], [activeStyle.id])

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
          <OrbitControls makeDefault enablePan enableZoom minDistance={1} maxDistance={50} />
        </Canvas>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between mt-5">
        <div className="flex items-center gap-4">
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
        </div>

        <p className="text-[10px] tracking-[0.25em] uppercase text-neutral-800">
          orbit · zoom · pan
        </p>
      </div>
    </div>
  )
}
