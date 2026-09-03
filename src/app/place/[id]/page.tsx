"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Canvas, useThree, useFrame } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { PLYLoader } from "three-stdlib"
import { parseSplatFile, ensurePlyColors } from "@/lib/splat"
import * as THREE from "three"
import { Nav } from "@/components/landing/atmosphere"
import {
  getPlace,
  getSplatBlob,
  loadPins,
  savePin,
  deletePin,
  placeYears,
  savePlace,
  fileToDataUrl,
  exportPlace,
  importPlace,
  type Place,
  type MemoryPin,
} from "@/lib/places"

/* ------------------------------------------------------------------ */
/*  Point cloud — the splat canvas                                      */
/* ------------------------------------------------------------------ */

function makeDemoGeometry(): THREE.BufferGeometry {
  // A small house interior so the pin flow works without a scan
  const pos: number[] = []
  const col: number[] = []
  const c = new THREE.Color()
  const push = (x: number, y: number, z: number, color: string) => {
    pos.push(x, y, z)
    c.set(color)
    col.push(c.r, c.g, c.b)
  }
  // floor 12x12
  for (let i = 0; i < 5000; i++) {
    push((Math.random() - 0.5) * 12, 0, (Math.random() - 0.5) * 12, "#4a3f33")
  }
  // walls
  for (let i = 0; i < 3500; i++) {
    const t = (Math.random() - 0.5) * 12
    const h = Math.random() * 4
    push(t, h, -6, "#5a5468")
    push(t, h, 6, "#544e60")
    push(-6, h, t, "#504a5c")
    push(6, h, t, "#5e5870")
  }
  // ceiling
  for (let i = 0; i < 2500; i++) {
    push((Math.random() - 0.5) * 12, 4, (Math.random() - 0.5) * 12, "#3a3644")
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3))
  return geo
}

function SplatPoints({
  blob,
  splatName,
  onPick,
  isEmpty,
}: {
  blob: Blob | null
  splatName?: string
  onPick: (p: [number, number, number]) => void
  isEmpty: boolean
}) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { raycaster } = useThree()

  useEffect(() => {
    raycaster.params.Points = { threshold: 0.12 }
  }, [raycaster])

  useEffect(() => {
    if (isEmpty) {
      setGeometry(makeDemoGeometry())
      return
    }
    if (!blob) return
    setError(null)
    let cancelled = false

    const isSplatFormat = splatName?.toLowerCase().endsWith(".splat")

    ;(async () => {
      try {
        if (isSplatFormat) {
          const buf = await blob.arrayBuffer()
          if (cancelled) return
          setGeometry(parseSplatFile(buf))
        } else {
          const url = URL.createObjectURL(blob)
          new PLYLoader().load(
            url,
            (geo) => {
              URL.revokeObjectURL(url)
              if (cancelled) return
              ensurePlyColors(geo)
              geo.computeBoundingBox()
              const center = new THREE.Vector3()
              geo.boundingBox!.getCenter(center)
              geo.translate(-center.x, -center.y, -center.z)
              setGeometry(geo)
            },
            undefined,
            () => {
              URL.revokeObjectURL(url)
              if (!cancelled) setError("could not read this splat file — try exporting as .ply from SuperSplat")
            }
          )
        }
      } catch {
        if (!cancelled) setError("could not read this splat file")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [blob, splatName, isEmpty])

  if (error) return <p className="text-red-400/70 text-xs p-8">{error}</p>
  if (!geometry) return null

  return (
    <points
      geometry={geometry}
      onClick={(e) => {
        e.stopPropagation()
        onPick([e.point.x, e.point.y, e.point.z])
      }}
    >
      <pointsMaterial size={0.02} vertexColors sizeAttenuation />
    </points>
  )
}

/* ------------------------------------------------------------------ */
/*  Pin markers                                                         */
/* ------------------------------------------------------------------ */

function PinMarker({
  pin,
  active,
  onSelect,
}: {
  pin: MemoryPin
  active: boolean
  onSelect: () => void
}) {
  const ref = useRef<THREE.Mesh>(null!)
  const hasPhoto = !!pin.photo

  useFrame(() => {
    if (!ref.current) return
    const t = Date.now() * 0.003
    const s = active ? 1.5 + Math.sin(t) * 0.25 : 1
    ref.current.scale.setScalar(s)
  })

  return (
    <mesh
      ref={ref}
      position={pin.pos}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      <sphereGeometry args={[0.055, 12, 12]} />
      <meshStandardMaterial
        color={hasPhoto ? "#e879f9" : "#a78bfa"}
        emissive={hasPhoto ? "#e879f9" : "#a78bfa"}
        emissiveIntensity={active ? 2.2 : 1.1}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Memory composer + card                                              */
/* ------------------------------------------------------------------ */

const inputCls =
  "w-full bg-transparent border-b border-neutral-800/60 px-1 py-2 text-xs text-neutral-300 placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40 transition-colors"

function Composer({
  pos,
  years,
  placeId,
  onDone,
}: {
  pos: [number, number, number]
  years: { min: number; max: number }
  placeId: string
  onDone: (pin: MemoryPin) => void
}) {
  const [title, setTitle] = useState("")
  const [story, setStory] = useState("")
  const [year, setYear] = useState(years.max)
  const [contributor, setContributor] = useState("")
  const [photo, setPhoto] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setContributor(localStorage.getItem("eidetic.me") ?? "")
  }, [])

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    localStorage.setItem("eidetic.me", contributor.trim())
    const pin: MemoryPin = {
      id: crypto.randomUUID(),
      placeId,
      title: title.trim(),
      story: story.trim(),
      year: Math.round(year),
      contributor: contributor.trim() || "someone",
      photo,
      pos,
      createdAt: Date.now(),
    }
    savePin(pin)
    onDone(pin)
  }

  return (
    <div className="border border-violet-500/30 bg-[#0a0a14]/95 p-5">
      <p className="text-[9px] tracking-[0.3em] uppercase text-violet-400/70">
        new memory · pinned at this spot
      </p>
      <div className="mt-4 space-y-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="what happened here?"
          className={inputCls}
          autoFocus
        />
        <textarea
          value={story}
          onChange={(e) => setStory(e.target.value)}
          placeholder="the story, if there is one…"
          rows={3}
          className={`${inputCls} resize-none`}
        />
        <div className="grid grid-cols-2 gap-4">
          <input
            type="number"
            value={year}
            min={years.min}
            max={years.max}
            onChange={(e) => setYear(Number(e.target.value))}
            className={inputCls}
          />
          <input
            value={contributor}
            onChange={(e) => setContributor(e.target.value)}
            placeholder="who remembers?"
            className={inputCls}
          />
        </div>
        <button
          onClick={() => photoRef.current?.click()}
          className="w-full border border-dashed border-neutral-800/60 hover:border-violet-500/40 transition-colors py-3 text-[10px] tracking-[0.2em] uppercase text-neutral-600"
        >
          {photo ? "✓ photo attached" : "+ attach a photo"}
        </button>
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) setPhoto(await fileToDataUrl(f, 800))
          }}
        />
        <button
          onClick={handleSave}
          disabled={!title.trim() || saving}
          className="w-full py-3 text-[10px] tracking-[0.3em] uppercase border border-violet-500/40 text-violet-200 bg-violet-500/[0.06] hover:bg-violet-500/[0.14] transition-all disabled:opacity-40"
        >
          {saving ? "pinning…" : "pin the memory"}
        </button>
      </div>
    </div>
  )
}

function MemoryCard({
  pin,
  onDelete,
}: {
  pin: MemoryPin
  onDelete: () => void
}) {
  return (
    <div className="border border-neutral-800/60 bg-[#0a0a14]/95 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-200 font-light">{pin.title}</p>
          <p className="mt-1 text-[9px] tracking-[0.25em] uppercase text-violet-400/60">
            {pin.year} · {pin.contributor}
          </p>
        </div>
        <button
          onClick={onDelete}
          className="text-[9px] tracking-[0.2em] uppercase text-neutral-800 hover:text-red-400/70 transition-colors shrink-0"
        >
          forget
        </button>
      </div>
      {pin.photo && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={pin.photo} alt={pin.title} className="mt-3 w-full object-cover" />
      )}
      {pin.story && <p className="mt-3 text-xs text-neutral-500 leading-relaxed">{pin.story}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function PlacePage() {
  const params = useParams()
  const router = useRouter()
  const placeId = params.id as string

  const [place, setPlace] = useState<Place | null>(null)
  const [splatBlob, setSplatBlob] = useState<Blob | null>(null)
  const [pins, setPins] = useState<MemoryPin[]>([])
  const [picking, setPicking] = useState<[number, number, number] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const p = getPlace(placeId)
    if (!p) {
      router.push("/places")
      return
    }
    setPlace(p)
    setPins(loadPins(placeId))
    getSplatBlob(placeId).then((b) => {
      setSplatBlob(b)
      setLoaded(true)
    })
  }, [placeId, router])

  const years = useMemo(() => (place ? placeYears(place, pins) : { min: 1900, max: 2026 }), [place, pins])
  const sliderYear = timeline ?? years.max
  const visiblePins = pins.filter((m) => m.year <= sliderYear)

  const handleAddPin = useCallback(
    (pin: MemoryPin) => {
      setPins(loadPins(placeId))
      setPicking(null)
      setSelected(pin.id)
      if (place && !place.contributors.includes(pin.contributor)) {
        const updated = { ...place, contributors: [...place.contributors, pin.contributor] }
        savePlace(updated)
        setPlace(updated)
      }
    },
    [placeId, place]
  )

  const handleExport = () => {
    const json = exportPlace(placeId)
    if (!json) return
    const blob = new Blob([json], { type: "application/json" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${place?.name ?? "place"}-memories.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleImport = async (f: File | undefined) => {
    if (!f) return
    const text = await f.text()
    const p = importPlace(text)
    if (p && p.id === placeId) {
      setPins(loadPins(placeId))
      setPlace(p)
    }
  }

  if (!place) {
    return (
      <main className="min-h-screen bg-[#030305] text-neutral-500">
        <Nav />
        <div className="pt-40 text-center text-xs tracking-[0.3em] uppercase">loading the place…</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#030305] text-neutral-200 selection:bg-violet-500/30">
      <Nav />

      <section className="max-w-7xl mx-auto px-6 pt-20 pb-16">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <button
              onClick={() => router.push("/places")}
              className="text-[10px] tracking-[0.3em] uppercase text-neutral-600 hover:text-neutral-400 transition-colors"
            >
              ← my places
            </button>
            <h1 className="mt-2 text-xl font-extralight text-neutral-200 tracking-wide">{place.name}</h1>
            <p className="text-[10px] tracking-[0.3em] uppercase text-neutral-600 mt-1">
              {place.startYear}–{place.endYear} · {place.contributors.length} contributor
              {place.contributors.length !== 1 ? "s" : ""} · {pins.length} memories · private
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              className="text-[9px] tracking-[0.25em] uppercase text-neutral-600 hover:text-neutral-400 border border-neutral-800/60 px-4 py-2 transition-colors"
            >
              export memories
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="text-[9px] tracking-[0.25em] uppercase text-neutral-600 hover:text-neutral-400 border border-neutral-800/60 px-4 py-2 transition-colors"
            >
              import
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => handleImport(e.target.files?.[0])}
            />
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* 3D canvas */}
          <div className="flex-1 min-w-0">
            <div className="relative w-full h-[68vh] border border-neutral-800/30 bg-[#030305] overflow-hidden">
              {!loaded && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/80">
                  <p className="text-xs tracking-[0.3em] uppercase text-violet-400/70 animate-pulse">
                    opening the place…
                  </p>
                </div>
              )}

              <Canvas camera={{ position: [0, 1.6, 6], fov: 60 }} style={{ background: "#030305" }}>
                <ambientLight intensity={0.7} />
                <SplatPoints
                  blob={splatBlob}
                  splatName={place.splatName}
                  isEmpty={!splatBlob && loaded}
                  onPick={(p) => {
                    setPicking(p)
                    setSelected(null)
                  }}
                />
                {visiblePins.map((pin) => (
                  <PinMarker
                    key={pin.id}
                    pin={pin}
                    active={selected === pin.id}
                    onSelect={() => {
                      setSelected(pin.id === selected ? null : pin.id)
                      setPicking(null)
                    }}
                  />
                ))}
                <OrbitControls makeDefault enablePan enableZoom minDistance={0.5} maxDistance={30} />
              </Canvas>

              {picking && (
                <div className="absolute top-4 right-4 text-[9px] tracking-[0.3em] uppercase text-violet-300/80 bg-black/60 px-3 py-1.5 backdrop-blur-sm">
                  spot chosen — name the memory
                </div>
              )}

              <p className="absolute bottom-3 left-4 text-[9px] tracking-[0.3em] uppercase text-neutral-800">
                click anywhere in the space to pin a memory
              </p>
            </div>

            {/* Timeline */}
            <div className="mt-6 px-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] tracking-[0.3em] uppercase text-neutral-600">
                  {place.startYear}
                </span>
                <span className="text-[11px] tracking-[0.3em] uppercase text-violet-300/80 tabular-nums">
                  {sliderYear}
                </span>
                <span className="text-[9px] tracking-[0.3em] uppercase text-neutral-600">
                  {place.endYear}
                </span>
              </div>
              <input
                type="range"
                min={years.min}
                max={years.max}
                value={sliderYear}
                onChange={(e) => setTimeline(Number(e.target.value))}
                className="w-full accent-violet-400 cursor-pointer"
              />
              <p className="mt-2 text-center text-[9px] tracking-[0.3em] uppercase text-neutral-700">
                {visiblePins.length} memor{visiblePins.length === 1 ? "y" : "ies"} by {sliderYear}
              </p>
            </div>
          </div>

          {/* Side panel */}
          <div className="w-full lg:w-96 shrink-0 space-y-4 max-h-[80vh] overflow-y-auto pr-1">
            {picking && (
              <Composer
                pos={picking}
                years={years}
                placeId={placeId}
                onDone={handleAddPin}
              />
            )}

            {selected && (
              <MemoryCard
                pin={pins.find((m) => m.id === selected)!}
                onDelete={() => {
                  setPins(deletePin(selected, placeId))
                  setSelected(null)
                }}
              />
            )}

            {!picking && !selected && (
              <div className="border border-neutral-800/40 p-5">
                <p className="text-[10px] tracking-[0.3em] uppercase text-neutral-600">
                  {visiblePins.length === 0 ? "the first memory" : `${visiblePins.length} memories`}
                </p>
                {visiblePins.length === 0 ? (
                  <p className="mt-3 text-xs text-neutral-500 leading-relaxed">
                    Click a spot in the space — the kitchen table, the porch steps — and pin the
                    first story to it.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {[...visiblePins]
                      .sort((a, b) => b.year - a.year)
                      .map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setSelected(m.id === selected ? null : m.id)}
                          className={`block w-full text-left p-3 border transition-colors ${
                            selected === m.id
                              ? "border-violet-500/40 bg-violet-500/[0.05]"
                              : "border-neutral-800/50 hover:border-neutral-700/60"
                          }`}
                        >
                          <p className="text-xs text-neutral-300">{m.title}</p>
                          <p className="mt-1 text-[9px] tracking-[0.25em] uppercase text-neutral-600">
                            {m.year} · {m.contributor}
                            {m.photo ? " · 📷" : ""}
                          </p>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
