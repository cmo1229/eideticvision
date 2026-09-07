"use client"

/* ------------------------------------------------------------------ */
/*  SpatialViewer — the reusable place viewer                          */
/*                                                                     */
/*  Renders a real Gaussian splat when one is available, using the     */
/*  Spark 3DGS renderer for three.js (true soft splats — not a point   */
/*  cloud). Designed so a SuperSplat / PlayCanvas embed could replace  */
/*  it later without changing consumers. When no capture exists it     */
/*  shows an honest, clearly-labeled placeholder — never fake geometry.*/
/*                                                                     */
/*  - splatUrl: the capture (blob or remote URL)                       */
/*  - loading / error states exposed                                   */
/*  - children render as an HTML overlay layer (memory markers, etc.)  */
/*  - onSurfacePick: click position as normalized coords (0..1) for    */
/*    pinning memories while spatial capture is not connected          */
/*  - renderSceneExtras: render-prop inserted inside the 3D canvas     */
/*    (3D memory markers, future pointer-to-world selection)           */
/*  - onWorldPick: click position as 3D world coordinates              */
/* ------------------------------------------------------------------ */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Canvas, useThree, useFrame } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark"

export type SplatFormat = "ply" | "splat" | "spz" | "sog"

/* ---------------- Keyboard movement (WASD / arrows) ---------------- */

const MOVE_KEYS = new Set([
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "q",
  "e",
])

/** Moves the camera and orbit target together — WASD/arrows walk, Q/E rise
 *  and sink. Mouse still handles look and zoom via OrbitControls. Speed
 *  scales with distance to the target so it works at any capture scale. */
function KeyboardMovement() {
  const { camera, controls } = useThree()
  const keys = useRef<Set<string>>(new Set())

  useEffect(() => {
    const isEditable = (t: EventTarget | null) => {
      const el = t as HTMLElement | null
      return (
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      )
    }
    const down = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return
      const k = e.key.toLowerCase()
      if (MOVE_KEYS.has(k)) {
        keys.current.add(k)
        e.preventDefault()
      }
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    const clear = () => keys.current.clear()
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", clear)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", clear)
    }
  }, [])

  useFrame((_, delta) => {
    if (keys.current.size === 0) return
    const c = controls as { target: THREE.Vector3; update: () => void } | null
    if (!c) return
    const k = keys.current
    const dist = camera.position.distanceTo(c.target)
    const speed = Math.max(0.4, dist * 0.9) * Math.min(delta, 0.1)

    // Horizontal forward/strafe basis from the camera's look direction
    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    forward.y = 0
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1)
    forward.normalize()
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0))

    const move = new THREE.Vector3()
    if (k.has("w") || k.has("arrowup")) move.add(forward)
    if (k.has("s") || k.has("arrowdown")) move.sub(forward)
    if (k.has("d") || k.has("arrowright")) move.add(right)
    if (k.has("a") || k.has("arrowleft")) move.sub(right)
    if (k.has("e")) move.y += 1
    if (k.has("q")) move.y -= 1
    if (move.lengthSq() === 0) return
    move.normalize().multiplyScalar(speed)

    camera.position.add(move)
    c.target.add(move)
    c.update()
  })

  return null
}

/* ---------------- Spark splat mesh with auto framing ---------------- */

function SparkSplat({
  url,
  fileName,
  onReady,
  onError,
  onPick,
}: {
  url: string
  fileName?: string
  onReady: () => void
  onError: (message: string) => void
  onPick?: (pos: { x: number; y: number; z: number }) => void
}) {
  const { gl: renderer, camera, controls } = useThree()
  const controlsRef = useRef(controls)
  controlsRef.current = controls
  const spark = useMemo(() => new SparkRenderer({ renderer }), [renderer])

  // Fetch bytes up front so we can pass the original file name — Spark uses
  // the extension to detect headerless formats (.splat) that blob URLs lack.
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null)
  useEffect(() => {
    let cancelled = false
    setBytes(null)
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((b) => {
        if (!cancelled) setBytes(b)
      })
      .catch(() => {
        if (!cancelled) onError("could not read the file data")
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  const splat = useMemo(
    () => (bytes ? new SplatMesh({ fileBytes: bytes, fileName: fileName ?? "capture.ply" }) : null),
    [bytes, fileName]
  )

  useEffect(() => {
    let cancelled = false
    if (!splat) return

    splat.initialized
      .then(() => {
        if (cancelled) return
        // Splat files are authored Y-down — canonical 180° X flip
        splat.quaternion.set(1, 0, 0, 0)
        splat.updateMatrixWorld(true)
        // Center the capture at the origin
        const box = new THREE.Box3().setFromObject(splat)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        splat.position.x -= center.x
        splat.position.y -= center.y
        splat.position.z -= center.z
        splat.updateMatrixWorld(true)

        // Fit the camera to the capture's physical extent
        const radius = Math.max(size.x, size.y, size.z) / 2 || 2
        const fov = ((camera as THREE.PerspectiveCamera).fov ?? 60) * (Math.PI / 180)
        const dist = Math.min(30, Math.max(1.5, (radius / Math.tan(fov / 2)) * 0.85))
        camera.position.set(dist * 0.35, dist * 0.3, dist)
        camera.lookAt(0, 0, 0)
        if (controlsRef.current) {
          ;(controlsRef.current as unknown as { target: THREE.Vector3 }).target.set(0, 0, 0)
          ;(controlsRef.current as unknown as { update: () => void }).update()
        }
        onReady()
      })
      .catch((e: unknown) => {
        if (!cancelled) onError(e instanceof Error ? e.message : String(e))
      })

    return () => {
      cancelled = true
      splat.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splat])

  if (!splat) return null
  return (
    <>
      <primitive object={spark} />
      <primitive
        object={splat}
        onClick={(e: { stopPropagation: () => void; point: THREE.Vector3 }) => {
          e.stopPropagation()
          onPick?.({ x: e.point.x, y: e.point.y, z: e.point.z })
        }}
      />
    </>
  )
}

export function Placeholder({
  label,
  detail,
  compact,
}: {
  label: string
  detail?: string
  compact?: boolean
}) {
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center text-center px-8 pointer-events-none select-none ${
        compact ? "" : "bg-[#060607]"
      }`}
    >
      <div
        className="w-px bg-neutral-700 mb-6"
        style={{ height: compact ? "24px" : "64px" }}
      />
      <p
        className={`uppercase text-neutral-200 ${compact ? "text-[12px] tracking-[0.25em]" : "text-lg md:text-xl font-light tracking-[0.15em]"}`}
      >
        {label}
      </p>
      {detail && (
        <p
          className={`mt-4 max-w-md leading-relaxed text-neutral-400 ${compact ? "text-[11px]" : "text-sm font-light"}`}
        >
          {detail}
        </p>
      )}
      <div
        className="w-px bg-neutral-700 mt-6"
        style={{ height: compact ? "24px" : "64px" }}
      />
    </div>
  )
}

export default function SpatialViewer({
  splatUrl,
  splatName,
  loading = false,
  loadingLabel = "opening the place",
  onSurfacePick,
  onWorldPick,
  renderSceneExtras,
  children,
  className = "",
}: {
  splatUrl?: string | null
  splatName?: string
  splatFormat?: string // retained for API compatibility — Spark detects from file contents/name
  loading?: boolean
  loadingLabel?: string
  onSurfacePick?: (pos: { x: number; y: number; z: number }) => void
  onWorldPick?: (pos: { x: number; y: number; z: number }) => void
  renderSceneExtras?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const hasCapture = !!splatUrl
  const [splatReady, setSplatReady] = useState(false)
  const [splatError, setSplatError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Reset per-URL load state (intentional sync reset on capture change)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSplatReady(false)
    setSplatError(null)
  }, [splatUrl])

  // Track fullscreen state so the button label and ESC hint stay accurate.
  // ESC exits fullscreen natively; this listener keeps the UI in sync.
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", onChange)
    // Guaranteed ESC exit even when the browser doesn't handle it itself
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("fullscreenchange", onChange)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation()
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      el.requestFullscreen().catch(() => {})
    }
  }

  const handleSurfaceClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSurfacePick || hasCapture) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    // ignore clicks on interactive overlay children
    if ((e.target as HTMLElement).closest("[data-pin], button, a, input, video, audio")) return
    onSurfacePick({ x, y, z: 0 })
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-[#060607] overflow-hidden select-none ${className}`}
      onClick={handleSurfaceClick}
    >
      {hasCapture ? (
        <Canvas camera={{ position: [0, 1.6, 6], fov: 60 }} style={{ background: "#060607" }}>
          <KeyboardMovement />
          <SparkSplat
            url={splatUrl!}
            fileName={splatName}
            onReady={() => {
              setSplatReady(true)
            }}
            onError={(message) => setSplatError(message)}
            onPick={onWorldPick}
          />
          {renderSceneExtras}
          <OrbitControls
            makeDefault
            enablePan
            enableZoom
            minDistance={0.5}
            maxDistance={30}
          />
        </Canvas>
      ) : (
        <Placeholder
          label="Spatial capture not connected yet"
          detail="This place is an archive without its scan for now. Memories are pinned to positions on this frame and can be re-anchored to the 3D space later."
        />
      )}

      {(loading || (hasCapture && !splatReady && !splatError)) && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#060607]/80">
          <p className="text-[10px] tracking-[0.35em] uppercase text-neutral-500">{loadingLabel}…</p>
        </div>
      )}

      {splatError && (
        <Placeholder
          label="The capture could not be rendered"
          detail={
            splatError
              ? `Renderer said: ${splatError}. If this persists, re-export the file from the capture app.`
              : "The splat file could not be displayed. Try re-exporting it from the capture app."
          }
        />
      )}

      {/* Movement hint — only when a real capture is being navigated */}
      {hasCapture && splatReady && (
        <div className="absolute bottom-3 left-4 z-20 text-[9px] tracking-[0.25em] uppercase text-neutral-600 pointer-events-none">
          wasd / arrows move · q e rise sink · drag to look
        </div>
      )}

      {/* Viewer chrome — fullscreen toggle (ESC exits) */}
      <button
        onClick={toggleFullscreen}
        className={`absolute top-3 right-3 z-30 px-3 py-1.5 text-[9px] tracking-[0.25em] uppercase backdrop-blur-sm border transition-all ${
          isFullscreen
            ? "border-[#c9bda4]/50 text-[#f5efe2] bg-black/60"
            : "border-neutral-700/60 text-neutral-400 hover:text-neutral-100 hover:border-neutral-500 bg-black/40"
        }`}
        title={isFullscreen ? "Exit fullscreen (Esc)" : "Enter fullscreen"}
      >
        {isFullscreen ? "× exit fullscreen · esc" : "⛶ fullscreen"}
      </button>

      {/* HTML overlay layer — memory markers, HUD. Rendering engine stays below. */}
      {children}
    </div>
  )
}
