"use client"

import { useRef, useEffect, useState, useMemo } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { EffectComposer, Bloom, Vignette, HueSaturation } from "@react-three/postprocessing"
import * as THREE from "three"
import { getMood, type MoodId } from "@/lib/moods"
import { PromptInput } from "@/components/ui/prompt-input"

/* ------------------------------------------------------------------ */
/*  Depth estimation (shared logic)                                     */
/* ------------------------------------------------------------------ */

function computeDepthFromImage(img: HTMLImageElement): Float32Array {
  const w = Math.min(img.width, 256)
  const h = Math.min(img.height, Math.floor(w * (img.height / img.width)))

  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(img, 0, 0, w, h)
  const src = ctx.getImageData(0, 0, w, h)

  const depth = new Float32Array(w * h)

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

      let d = vertFactor * 0.5 + lum * 0.25 + contrast * 0.25
      if (contrast > 0.08) d += contrast * 0.3
      depth[y * w + x] = Math.max(0, Math.min(1, d))
    }
  }

  return depth
}

/* ------------------------------------------------------------------ */
/*  World wall geometry — depth pushes geometry toward the flyer        */
/* ------------------------------------------------------------------ */

const WALL_SEGS_X = 120
const WALL_SEGS_Y = 80
const WALL_W = 56
const WALL_H = 28
const WALL_DIST = 28
const WALL_DEPTH_SCALE = 12

function buildWallGeometry(depthData: Float32Array): THREE.BufferGeometry {
  const dw = Math.min(256, Math.floor(Math.sqrt(depthData.length)))
  const dh = dw

  const vertices: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let iy = 0; iy <= WALL_SEGS_Y; iy++) {
    const v = iy / WALL_SEGS_Y
    const y = (0.5 - v) * WALL_H

    for (let ix = 0; ix <= WALL_SEGS_X; ix++) {
      const u = ix / WALL_SEGS_X
      const x = (u - 0.5) * WALL_W

      const px = Math.floor(u * (dw - 1))
      const py = Math.floor((1 - v) * (dh - 1))
      const depth = depthData[Math.min(py * dw + px, depthData.length - 1)] ?? 0

      // Displace toward the viewer (into the world volume)
      vertices.push(x, y, -depth * WALL_DEPTH_SCALE)
      uvs.push(u, v)
    }
  }

  for (let iy = 0; iy < WALL_SEGS_Y; iy++) {
    for (let ix = 0; ix < WALL_SEGS_X; ix++) {
      const a = iy * (WALL_SEGS_X + 1) + ix
      const b = a + WALL_SEGS_X + 1
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

/* ------------------------------------------------------------------ */
/*  World wall — one side of the surrounding volume                     */
/* ------------------------------------------------------------------ */

function WorldWall({
  imageUrl,
  position,
  rotationY,
  onReady,
}: {
  imageUrl: string
  position: [number, number, number]
  rotationY: number
  onReady: () => void
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null)

  useEffect(() => {
    let cancelled = false

    async function build() {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image()
        i.crossOrigin = "anonymous"
        i.onload = () => resolve(i)
        i.onerror = () => reject(new Error("wall image failed"))
        i.src = imageUrl
      })
      if (cancelled) return

      const depthData = computeDepthFromImage(img)
      const geo = buildWallGeometry(depthData)

      const tex = await new Promise<THREE.Texture>((resolve, reject) => {
        new THREE.TextureLoader().load(
          imageUrl,
          (t) => {
            t.colorSpace = THREE.SRGBColorSpace
            resolve(t)
          },
          undefined,
          () => reject(new Error("wall texture failed"))
        )
      })
      if (cancelled) return

      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        side: THREE.DoubleSide,
        roughness: 0.6,
      })
      materialRef.current = mat
      meshRef.current.geometry = geo
      meshRef.current.material = mat
      onReady()
    }

    build().catch(() => onReady())
    return () => {
      cancelled = true
    }
  }, [imageUrl, onReady])

  // Breathing world
  useFrame(() => {
    if (!meshRef.current) return
    const t = Date.now() * 0.0003
    meshRef.current.scale.setScalar(1 + Math.sin(t) * 0.006)
  })

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={[0, rotationY, 0]}
    >
      <meshStandardMaterial side={THREE.DoubleSide} roughness={0.6} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  FlightCamera — full 6DOF movement through the world                 */
/* ------------------------------------------------------------------ */

function FlightCamera({ active }: { active: boolean }) {
  const { camera, gl } = useThree()
  const keys = useRef<Set<string>>(new Set())
  const dragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const pitch = useRef(0)
  const yaw = useRef(0)
  const velocity = useRef(new THREE.Vector3())

  useEffect(() => {
    const el = gl.domElement

    const onKeyDown = (e: KeyboardEvent) => keys.current.add(e.key.toLowerCase())
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    const onMouseDown = (e: MouseEvent) => {
      dragging.current = true
      lastMouse.current = { x: e.clientX, y: e.clientY }
    }
    const onMouseUp = () => {
      dragging.current = false
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const dx = e.clientX - lastMouse.current.x
      const dy = e.clientY - lastMouse.current.y
      yaw.current -= dx * 0.003
      pitch.current -= dy * 0.003
      pitch.current = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch.current))
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

    const boost = keys.current.has("shift") && keys.current.has("w") ? 2.5 : 1
    const accel = 26 * boost * delta
    const damping = Math.pow(0.12, delta)

    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current))
    const right = new THREE.Vector3(Math.cos(yaw.current), 0, -Math.sin(yaw.current))
    const up = new THREE.Vector3(0, 1, 0)

    if (keys.current.has("w")) velocity.current.add(forward.clone().multiplyScalar(accel))
    if (keys.current.has("s")) velocity.current.add(forward.clone().multiplyScalar(-accel))
    if (keys.current.has("a")) velocity.current.add(right.clone().multiplyScalar(-accel))
    if (keys.current.has("d")) velocity.current.add(right.clone().multiplyScalar(accel))
    if (keys.current.has(" ")) velocity.current.add(up.clone().multiplyScalar(accel))
    if (keys.current.has("shift")) velocity.current.add(up.clone().multiplyScalar(-accel))

    velocity.current.multiplyScalar(damping)

    camera.position.add(velocity.current.clone().multiplyScalar(delta))

    // Keep within the world volume
    const limit = WALL_DIST - 3
    camera.position.x = Math.max(-limit, Math.min(limit, camera.position.x))
    camera.position.z = Math.max(-limit, Math.min(limit, camera.position.z))
    camera.position.y = Math.max(0.8, Math.min(WALL_H - 2, camera.position.y))

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
/*  Mood effects + fog                                                  */
/* ------------------------------------------------------------------ */

function WorldEffects({ mood }: { mood: MoodId }) {
  const { scene } = useThree()
  const m = getMood(mood)

  useEffect(() => {
    const fogColor = m.id === "noir" ? "#0a0a0a" : m.id === "warm" ? "#1a1410" : "#030310"
    scene.fog = new THREE.FogExp2(fogColor, 0.008)
    scene.background = new THREE.Color(fogColor)
    return () => {
      scene.fog = null
      scene.background = new THREE.Color("#030305")
    }
  }, [scene, m.id])

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
/*  Drifting memory particles                                           */
/* ------------------------------------------------------------------ */

function WorldParticles() {
  const pointsRef = useRef<THREE.Points>(null!)

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const count = 300
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * (WALL_DIST * 2)
      pos[i * 3 + 1] = Math.random() * WALL_H
      pos[i * 3 + 2] = (Math.random() - 0.5) * (WALL_DIST * 2)
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    return g
  }, [])

  useFrame((_, delta) => {
    const pos = pointsRef.current.geometry.attributes.position.array as Float32Array
    for (let i = 0; i < pos.length; i += 3) {
      pos[i + 1] += Math.sin(Date.now() * 0.0005 + i) * delta * 0.2
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={pointsRef} geometry={geo}>
      <pointsMaterial
        size={0.06}
        color="#c4b5fd"
        transparent
        opacity={0.3}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

/* ------------------------------------------------------------------ */
/*  WorldScene — surrounding 3D world from 4 generated views            */
/* ------------------------------------------------------------------ */

export interface WorldViews {
  front: string
  right: string
  back: string
  left: string
}

interface WorldSceneProps {
  views: WorldViews
  generating: boolean
  error: string | null
  onPromptExpand?: (prompt: string) => void
  worldCount?: number
  activeWorldIndex?: number
  onWorldSelect?: (index: number) => void
  mood?: MoodId
}

export function WorldScene({
  views,
  generating,
  error,
  onPromptExpand,
  worldCount = 1,
  activeWorldIndex = 0,
  onWorldSelect,
  mood = "lucid",
}: WorldSceneProps) {
  const [wallsReady, setWallsReady] = useState(0)

  useEffect(() => {
    setWallsReady(0)
  }, [views])

  const loaded = wallsReady >= 4

  return (
    <div className="relative w-full">
      {/* World stack navigation */}
      {worldCount > 1 && (
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          {Array.from({ length: worldCount }).map((_, i) => (
            <button
              key={i}
              onClick={() => onWorldSelect?.(i)}
              className={`shrink-0 w-2 h-2 rounded-full transition-all
                ${i === activeWorldIndex
                  ? "bg-violet-400 shadow-[0_0_6px_rgba(167,139,250,0.6)]"
                  : "bg-neutral-800 hover:bg-neutral-700"
                }`}
              title={`World ${i + 1}`}
            />
          ))}
          <span className="text-[9px] tracking-[0.2em] uppercase text-neutral-700 ml-2">
            world {activeWorldIndex + 1}/{worldCount}
          </span>
        </div>
      )}

      {/* Canvas */}
      <div className="relative w-full h-[75vh] overflow-hidden border border-neutral-800/30 bg-[#030310]">
        {!loaded && !generating && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-10 backdrop-blur-md">
            <p className="text-sm tracking-[0.3em] uppercase text-violet-400/80 animate-pulse">
              building world · {wallsReady}/4 sides
            </p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-20 backdrop-blur-md gap-4">
            <p className="text-sm tracking-[0.2em] uppercase text-red-400/70">generation failed</p>
            <p className="text-xs text-neutral-500 max-w-md text-center">{error}</p>
          </div>
        )}

        <Canvas
          camera={{ position: [0, 3, 0], fov: 70 }}
          style={{ background: "#030310" }}
        >
          <ambientLight intensity={0.55} />
          <directionalLight position={[4, 8, 4]} intensity={0.7} />
          <directionalLight position={[-4, 2, -4]} intensity={0.25} />

          <WorldWall
            imageUrl={views.front}
            position={[0, WALL_H / 2, -WALL_DIST]}
            rotationY={0}
            onReady={() => setWallsReady((n) => n + 1)}
          />
          <WorldWall
            imageUrl={views.right}
            position={[WALL_DIST, WALL_H / 2, 0]}
            rotationY={-Math.PI / 2}
            onReady={() => setWallsReady((n) => n + 1)}
          />
          <WorldWall
            imageUrl={views.back}
            position={[0, WALL_H / 2, WALL_DIST]}
            rotationY={Math.PI}
            onReady={() => setWallsReady((n) => n + 1)}
          />
          <WorldWall
            imageUrl={views.left}
            position={[-WALL_DIST, WALL_H / 2, 0]}
            rotationY={Math.PI / 2}
            onReady={() => setWallsReady((n) => n + 1)}
          />

          {/* Ground */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <planeGeometry args={[WALL_DIST * 2, WALL_DIST * 2]} />
            <meshStandardMaterial color="#0a0a12" roughness={0.9} />
          </mesh>

          <WorldParticles />
          <WorldEffects mood={mood} />
          <FlightCamera active={loaded && !generating} />
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
                world ready · 4-sided
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
          wasd fly · space/shift up-down · drag look
        </p>
      </div>

      {/* Expand prompt bar */}
      {onPromptExpand && !generating && loaded && (
        <div className="mt-4">
          <PromptInput
            onSubmit={onPromptExpand}
            generating={false}
            placeholder="expand this world..."
            compact
          />
        </div>
      )}
    </div>
  )
}
