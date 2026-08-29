"use client"

import { useRef, useEffect, useState, useMemo } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { EffectComposer, Bloom, Vignette, HueSaturation } from "@react-three/postprocessing"
import * as THREE from "three"
import { getMood, type MoodId } from "@/lib/moods"
import { buildLdi, type LdiLayer } from "@/lib/ldi"
import { startAmbience, stopAmbience } from "@/lib/ambience"
import { PromptInput } from "@/components/ui/prompt-input"

/* ------------------------------------------------------------------ */
/*  Room dimensions                                                     */
/* ------------------------------------------------------------------ */

const ROOM_W = 24
const ROOM_H = 12
const ROOM_D = 24
const BACK_Z = -ROOM_D / 2 + 0.1
const LAYER_FAR_Z = -ROOM_D / 2 + 2
const LAYER_SPAN = 11 // near layers reach z = LAYER_FAR_Z + LAYER_SPAN
const WALL_IMG_W = ROOM_W * 0.92
const WALL_IMG_H = WALL_IMG_W * 0.62

/* ------------------------------------------------------------------ */
/*  Layer mesh — one depth slice of the memory                          */
/* ------------------------------------------------------------------ */

function LdiLayerMesh({ layer }: { layer: LdiLayer }) {
  const tex = useMemo(() => {
    const t = new THREE.TextureLoader().load(layer.texture)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [layer.texture])

  const z = LAYER_FAR_Z + layer.depth * LAYER_SPAN

  return (
    <mesh position={[0, ROOM_H * 0.52, z]} renderOrder={Math.round((1 - layer.depth) * 10)}>
      <planeGeometry args={[WALL_IMG_W, WALL_IMG_H]} />
      <meshBasicMaterial
        map={tex}
        transparent
        alphaTest={0.02}
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Room shell — real walls, floor, ceiling                             */
/* ------------------------------------------------------------------ */

function RoomShell({ backdrop, mood }: { backdrop: string; mood: MoodId }) {
  const m = getMood(mood)
  const tex = useMemo(() => {
    const t = new THREE.TextureLoader().load(backdrop)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [backdrop])

  const shellColor = m.id === "noir" ? "#0c0c0c" : m.id === "warm" ? "#14100a" : "#0a0a14"

  return (
    <group>
      {/* Back wall carries the memory image */}
      <mesh position={[0, ROOM_H / 2, BACK_Z]}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial map={tex} roughness={0.8} />
      </mesh>

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial color={shellColor} roughness={0.9} />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ROOM_H, 0]}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial color={shellColor} roughness={0.95} />
      </mesh>

      {/* Side walls */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-ROOM_W / 2, ROOM_H / 2, 0]}>
        <planeGeometry args={[ROOM_D, ROOM_H]} />
        <meshStandardMaterial color={shellColor} roughness={0.9} />
      </mesh>
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[ROOM_W / 2, ROOM_H / 2, 0]}>
        <planeGeometry args={[ROOM_D, ROOM_H]} />
        <meshStandardMaterial color={shellColor} roughness={0.9} />
      </mesh>

      {/* Front wall (behind the viewer) */}
      <mesh rotation={[0, Math.PI, 0]} position={[0, ROOM_H / 2, ROOM_D / 2]}>
        <planeGeometry args={[ROOM_W, ROOM_H]} />
        <meshStandardMaterial color={shellColor} roughness={0.95} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Walk camera — constrained inside the room                           */
/* ------------------------------------------------------------------ */

function RoomCamera({ active }: { active: boolean }) {
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
    const onMouseUp = () => (dragging.current = false)
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      yaw.current -= (e.clientX - lastMouse.current.x) * 0.003
      pitch.current -= (e.clientY - lastMouse.current.y) * 0.003
      pitch.current = Math.max(-1.2, Math.min(1.2, pitch.current))
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

    const accel = 20 * delta
    const damping = Math.pow(0.1, delta)

    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current))
    const right = new THREE.Vector3(Math.cos(yaw.current), 0, -Math.sin(yaw.current))

    if (keys.current.has("w")) velocity.current.add(forward.clone().multiplyScalar(accel))
    if (keys.current.has("s")) velocity.current.add(forward.clone().multiplyScalar(-accel))
    if (keys.current.has("a")) velocity.current.add(right.clone().multiplyScalar(-accel))
    if (keys.current.has("d")) velocity.current.add(right.clone().multiplyScalar(accel))
    if (keys.current.has(" ")) velocity.current.y += accel
    if (keys.current.has("shift")) velocity.current.y -= accel

    velocity.current.multiplyScalar(damping)
    camera.position.add(velocity.current.clone().multiplyScalar(delta))

    // Constrain inside the room
    const lim = ROOM_W / 2 - 1.5
    camera.position.x = Math.max(-lim, Math.min(lim, camera.position.x))
    camera.position.z = Math.max(-ROOM_D / 2 + 1.5, Math.min(ROOM_D / 2 - 1.5, camera.position.z))
    camera.position.y = Math.max(1, Math.min(ROOM_H - 1.5, camera.position.y))

    camera.lookAt(
      camera.position.x - Math.sin(yaw.current) * Math.cos(pitch.current),
      camera.position.y + Math.sin(pitch.current),
      camera.position.z - Math.cos(yaw.current) * Math.cos(pitch.current)
    )
  })

  return null
}

/* ------------------------------------------------------------------ */
/*  Atmosphere                                                          */
/* ------------------------------------------------------------------ */

function RoomEffects({ mood }: { mood: MoodId }) {
  const { scene } = useThree()
  const m = getMood(mood)

  useEffect(() => {
    const fogColor = m.id === "noir" ? "#080808" : m.id === "warm" ? "#171208" : "#06060f"
    scene.fog = new THREE.FogExp2(fogColor, 0.02)
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

function RoomParticles() {
  const pointsRef = useRef<THREE.Points>(null!)

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const count = 220
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * (ROOM_W - 2)
      pos[i * 3 + 1] = Math.random() * (ROOM_H - 1)
      pos[i * 3 + 2] = (Math.random() - 0.5) * (ROOM_D - 2)
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    return g
  }, [])

  useFrame((_, delta) => {
    const pos = pointsRef.current.geometry.attributes.position.array as Float32Array
    for (let i = 0; i < pos.length; i += 3) {
      pos[i + 1] += Math.sin(Date.now() * 0.0005 + i) * delta * 0.12
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={pointsRef} geometry={geo}>
      <pointsMaterial
        size={0.05}
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
/*  RoomScene                                                           */
/* ------------------------------------------------------------------ */

interface RoomSceneProps {
  imageUrl: string
  generating: boolean
  error: string | null
  onPromptExpand?: (prompt: string) => void
  mood?: MoodId
}

export function RoomScene({
  imageUrl,
  generating,
  error,
  onPromptExpand,
  mood = "lucid",
}: RoomSceneProps) {
  const [layers, setLayers] = useState<LdiLayer[] | null>(null)
  const [soundOn, setSoundOn] = useState(false)

  useEffect(() => {
    setLayers(null)
    let cancelled = false
    buildLdi(imageUrl, 5)
      .then((r) => {
        if (!cancelled) setLayers(r.layers)
      })
      .catch(() => {
        if (!cancelled) setLayers([]) // fall back to backdrop only
      })
    return () => {
      cancelled = true
    }
  }, [imageUrl])

  useEffect(() => {
    if (soundOn && layers) startAmbience(mood)
    else stopAmbience()
    return () => stopAmbience()
  }, [soundOn, layers, mood])

  const loaded = layers !== null

  return (
    <div className="relative w-full">
      <div className="relative w-full h-[75vh] overflow-hidden border border-neutral-800/30 bg-[#06060f]">
        {!loaded && !generating && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-10 backdrop-blur-md">
            <p className="text-sm tracking-[0.3em] uppercase text-violet-400/80 animate-pulse">
              reconstructing the room
            </p>
            <p className="text-[10px] tracking-[0.25em] uppercase text-neutral-700 mt-3">
              carving depth layers
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
          camera={{ position: [0, 3, 8], fov: 65 }}
          style={{ background: "#06060f" }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 8, 4]} intensity={0.6} />
          <directionalLight position={[-4, 3, -2]} intensity={0.2} />

          {layers !== null && (
            <>
              <RoomShell backdrop={imageUrl} mood={mood} />
              {layers.map((l, i) => (
                <LdiLayerMesh key={i} layer={l} />
              ))}
            </>
          )}

          <RoomParticles />
          <RoomEffects mood={mood} />
          <RoomCamera active={loaded && !generating} />
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
                room ready · {layers?.length ?? 0} depth layers
              </span>
              <span
                className="text-[10px] tracking-[0.2em] uppercase"
                style={{ color: getMood(mood).color }}
              >
                {getMood(mood).label}
              </span>
              <button
                onClick={() => setSoundOn((v) => !v)}
                className={`text-[10px] tracking-[0.2em] uppercase transition-colors ${soundOn ? "text-violet-400" : "text-neutral-700 hover:text-neutral-500"}`}
              >
                {soundOn ? "◉ sound" : "○ sound"}
              </button>
            </>
          ) : null}
        </div>

        <p className="text-[10px] tracking-[0.25em] uppercase text-neutral-800">
          wasd walk · space/shift up-down · drag look
        </p>
      </div>

      {/* Expand prompt bar */}
      {onPromptExpand && !generating && loaded && (
        <div className="mt-4">
          <PromptInput
            onSubmit={onPromptExpand}
            generating={false}
            placeholder="expand this room..."
            compact
          />
        </div>
      )}
    </div>
  )
}
