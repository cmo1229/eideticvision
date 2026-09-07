"use client"

/* ------------------------------------------------------------------ */
/*  Place page — the most important page in the product.               */
/*  PLACE + MEMORIES + PEOPLE + TIME                                   */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import SpatialViewer from "@/components/viewer/spatial-viewer"
import { Nav } from "@/components/landing/atmosphere"
import {
  getPlace,
  loadMemories,
  saveMemory,
  deleteMemory,
  placeYears,
  savePlace,
  addMember,
  getSplatUrl,
  fileToDataUrl,
  fileToMediaDataUrl,
  formatMemoryDate,
  exportPlace,
  importPlace,
  type Place,
  type PlaceMember,
  type Memory,
  type MemoryPosition,
} from "@/lib/places"

/* ---------------- 3D memory marker (splat mode) ---------------- */

function WorldPin({
  position,
  active,
  onSelect,
}: {
  position: MemoryPosition
  active: boolean
  onSelect: () => void
}) {
  return (
    <mesh
      position={[position.x, position.y, position.z]}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      <sphereGeometry args={[0.05, 12, 12]} />
      <meshStandardMaterial
        color={active ? "#f5efe2" : "#c9bda4"}
        emissive={active ? "#f5efe2" : "#8a8066"}
        emissiveIntensity={active ? 1.6 : 0.5}
      />
    </mesh>
  )
}

/* ---------------- HTML memory marker (no-capture mode) ---------------- */

function SurfacePin({
  memory,
  active,
  onSelect,
}: {
  memory: Memory
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      data-pin
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      className="absolute z-10 group -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${memory.position.x * 100}%`,
        top: `${memory.position.y * 100}%`,
        transition: "opacity 700ms ease, transform 700ms ease",
      }}
      aria-label={memory.title}
    >
      <span
        className={`block rounded-full border transition-all duration-300 ${
          active
            ? "w-3.5 h-3.5 bg-[#f5efe2] border-[#f5efe2] shadow-[0_0_12px_rgba(245,239,226,0.5)]"
            : "w-2.5 h-2.5 bg-[#c9bda4]/90 border-[#c9bda4] group-hover:scale-125 group-hover:bg-[#f5efe2]"
        }`}
      />
      <span
        className={`absolute left-1/2 -translate-x-1/2 top-full mt-2 whitespace-nowrap text-[9px] tracking-[0.2em] uppercase px-2 py-1 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
          active ? "text-neutral-100 opacity-100" : "text-neutral-400 opacity-0 group-hover:opacity-100"
        }`}
      >
        {memory.title}
      </span>
    </button>
  )
}

/* ---------------- Timeline ---------------- */

function Timeline({
  min,
  max,
  value,
  memoryYears,
  onChange,
}: {
  min: number
  max: number
  value: number
  memoryYears: Set<number>
  onChange: (year: number) => void
}) {
  const span = Math.max(1, max - min)
  const ticks: number[] = []
  for (let y = min; y <= max; y++) ticks.push(y)

  return (
    <div className="px-4 sm:px-10 pt-5 pb-3">
      <div className="relative h-10">
        {/* track */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-neutral-800" />
        {/* progress */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-px bg-[#c9bda4]/70"
          style={{ left: 0, width: `${((value - min) / span) * 100}%` }}
        />
        {/* ticks */}
        {ticks.map((y) => (
          <button
            key={y}
            onClick={() => onChange(y)}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 group py-3 px-1.5"
            style={{ left: `${((y - min) / span) * 100}%` }}
            aria-label={`Jump to ${y}`}
          >
            <span
              className={`block mx-auto transition-all duration-300 ${
                memoryYears.has(y)
                  ? "w-px h-3.5 bg-[#c9bda4]"
                  : "w-px h-1.5 bg-neutral-700 group-hover:bg-neutral-500"
              }`}
            />
            {memoryYears.has(y) && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 text-[8px] tracking-widest text-[#c9bda4]/70 tabular-nums">
                {String(y).slice(2)}
              </span>
            )}
          </button>
        ))}
        {/* handle */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-[left] duration-150"
          style={{ left: `${((value - min) / span) * 100}%` }}
        >
          <div className="w-3 h-3 rounded-full bg-[#f5efe2] shadow-[0_0_14px_rgba(245,239,226,0.35)]" />
        </div>
        {/* invisible native range for interaction */}
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
          aria-label="Timeline"
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] tracking-[0.3em] uppercase text-neutral-600 tabular-nums">{min}</span>
        <span className="text-[11px] tracking-[0.3em] uppercase text-[#e8e2d4] tabular-nums">{value}</span>
        <span className="text-[10px] tracking-[0.3em] uppercase text-neutral-600 tabular-nums">{max}</span>
      </div>
    </div>
  )
}

/* ---------------- Memory composer ---------------- */

const inputCls =
  "w-full bg-transparent border-b border-neutral-800 px-1 py-2 text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-[#c9bda4]/50 transition-colors"
const labelCls = "block text-[9px] tracking-[0.3em] uppercase text-neutral-500"

function Composer({
  position,
  members,
  years,
  onSave,
  onCancel,
}: {
  position: MemoryPosition
  members: PlaceMember[]
  years: { min: number; max: number }
  onSave: (m: Memory) => void
  onCancel: () => void
}) {
  const contributors = members.filter((m) => m.role === "owner" || m.role === "contributor")
  const [title, setTitle] = useState("")
  const [story, setStory] = useState("")
  const [date, setDate] = useState(`${years.max}-06`)
  const [contributorId, setContributorId] = useState(
    localStorage.getItem("eidetic.me") || contributors[0]?.name || ""
  )
  const [mediaType, setMediaType] = useState<"image" | "video" | undefined>()
  const [mediaUrl, setMediaUrl] = useState<string | undefined>()
  const [audioUrl, setAudioUrl] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const mediaRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLInputElement>(null)

  const year = Number(date.slice(0, 4)) || years.max

  const handleMedia = async (f: File | undefined) => {
    if (!f) return
    setError(null)
    try {
      if (f.type.startsWith("image/")) {
        setMediaType("image")
        setMediaUrl(await fileToDataUrl(f, 900))
      } else if (f.type.startsWith("video/")) {
        setMediaType("video")
        setMediaUrl(await fileToMediaDataUrl(f))
      } else {
        setError("images and video are supported here")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not read file")
      setMediaType(undefined)
      setMediaUrl(undefined)
    }
  }

  const handleAudio = async (f: File | undefined) => {
    if (!f) return
    setError(null)
    try {
      setAudioUrl(await fileToMediaDataUrl(f))
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not read file")
    }
  }

  const handleSave = () => {
    if (!title.trim()) return
    localStorage.setItem("eidetic.me", contributorId)
    onSave({
      id: crypto.randomUUID(),
      placeId: "",
      contributorId: contributorId || "someone",
      title: title.trim(),
      story: story.trim(),
      date,
      year: Math.min(years.max, Math.max(years.min, year)),
      mediaType,
      mediaUrl,
      audioUrl,
      position,
      createdAt: Date.now(),
    })
  }

  return (
    <div className="border border-[#c9bda4]/25 bg-[#0a0a0b]/95 p-5">
      <div className="flex items-center justify-between">
        <p className="text-[9px] tracking-[0.3em] uppercase text-[#c9bda4]/80">new memory</p>
        <button
          onClick={onCancel}
          className="text-[9px] tracking-[0.2em] uppercase text-neutral-600 hover:text-neutral-300 transition-colors"
        >
          cancel
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <label className={labelCls}>title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What happened here?"
            className={inputCls}
            autoFocus
          />
        </div>
        <div>
          <label className={labelCls}>story</label>
          <textarea
            value={story}
            onChange={(e) => setStory(e.target.value)}
            placeholder="Tell it the way you remember it…"
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>date</label>
            <input
              type="month"
              value={date}
              min={`${years.min}-01`}
              max={`${years.max}-12`}
              onChange={(e) => setDate(e.target.value)}
              className={`${inputCls} [color-scheme:dark]`}
            />
          </div>
          <div>
            <label className={labelCls}>contributor</label>
            <select
              value={contributorId}
              onChange={(e) => setContributorId(e.target.value)}
              className={`${inputCls} bg-[#0a0a0b] [color-scheme:dark]`}
            >
              {contributors.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => mediaRef.current?.click()}
            className="border border-dashed border-neutral-800 hover:border-[#c9bda4]/40 transition-colors py-3 text-[9px] tracking-[0.2em] uppercase text-neutral-500"
          >
            {mediaUrl ? "media attached ✓" : "+ photo or video"}
          </button>
          <button
            onClick={() => audioRef.current?.click()}
            className="border border-dashed border-neutral-800 hover:border-[#c9bda4]/40 transition-colors py-3 text-[9px] tracking-[0.2em] uppercase text-neutral-500"
          >
            {audioUrl ? "audio attached ✓" : "+ audio recording"}
          </button>
          <input
            ref={mediaRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => handleMedia(e.target.files?.[0])}
          />
          <input
            ref={audioRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => handleAudio(e.target.files?.[0])}
          />
        </div>

        {error && <p className="text-[10px] text-red-400/80">{error}</p>}

        <button
          onClick={handleSave}
          disabled={!title.trim()}
          className="w-full py-3 text-[10px] tracking-[0.3em] uppercase border border-[#c9bda4]/40 text-[#f5efe2] bg-[#c9bda4]/[0.06] hover:bg-[#c9bda4]/[0.12] transition-all disabled:opacity-40"
        >
          pin the memory
        </button>
      </div>
    </div>
  )
}

/* ---------------- Memory detail ---------------- */

function MemoryDetail({
  memory,
  member,
  onDelete,
  onClose,
}: {
  memory: Memory
  member?: PlaceMember
  onDelete: () => void
  onClose: () => void
}) {
  return (
    <div className="border border-neutral-800/70 bg-[#0a0a0b]/95">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm text-neutral-100 font-light">{memory.title}</h3>
            <p className="mt-1.5 text-[9px] tracking-[0.25em] uppercase text-neutral-500">
              {formatMemoryDate(memory.date)} · {memory.contributorId}
              {member?.role === "owner" ? " · owner" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[9px] tracking-[0.2em] uppercase text-neutral-600 hover:text-neutral-300 transition-colors shrink-0"
          >
            close
          </button>
        </div>

        {memory.mediaType === "image" && memory.mediaUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={memory.mediaUrl}
            alt={memory.title}
            className="mt-4 w-full border border-neutral-800/60 object-cover"
          />
        )}
        {memory.mediaType === "video" && memory.mediaUrl && (
          <video src={memory.mediaUrl} controls className="mt-4 w-full border border-neutral-800/60" />
        )}
        {memory.audioUrl && <audio src={memory.audioUrl} controls className="mt-4 w-full" />}

        {memory.story && (
          <p className="mt-4 text-xs text-neutral-400 leading-relaxed font-light">{memory.story}</p>
        )}

        <button
          onClick={onDelete}
          className="mt-5 text-[9px] tracking-[0.2em] uppercase text-neutral-700 hover:text-red-400/70 transition-colors"
        >
          remove this memory
        </button>
      </div>
    </div>
  )
}

/* ---------------- Contributors panel ---------------- */

function ContributorsPanel({
  place,
  onUpdate,
}: {
  place: Place
  onUpdate: (p: Place) => void
}) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"contributor" | "viewer">("contributor")
  const [invited, setInvited] = useState<string | null>(null)

  const handleInvite = () => {
    if (!email.includes("@")) {
      setInvited("enter a valid email")
      return
    }
    const updated = addMember(place.id, { name: "", email, role })
    if (updated) {
      onUpdate(updated)
      setInvited(email)
      setEmail("")
    }
  }

  return (
    <div className="space-y-4">
      <div className="border border-neutral-800/70 bg-[#0a0a0b]/95 p-5">
        <p className="text-[9px] tracking-[0.3em] uppercase text-neutral-500">contributors</p>
        <div className="mt-4 space-y-3">
          {place.members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-7 h-7 rounded-full border border-neutral-700 flex items-center justify-center text-[10px] text-neutral-400 shrink-0">
                  {m.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-neutral-200 truncate">{m.name}</p>
                  {m.email && <p className="text-[10px] text-neutral-600 truncate">{m.email}</p>}
                </div>
              </div>
              <span className="text-[9px] tracking-[0.2em] uppercase text-neutral-500 shrink-0">
                {m.role}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-neutral-800/70 bg-[#0a0a0b]/95 p-5">
        <p className="text-[9px] tracking-[0.3em] uppercase text-neutral-500">invite contributor</p>
        <div className="mt-4 space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email address"
            className={inputCls}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "contributor" | "viewer")}
            className={`${inputCls} bg-[#0a0a0b] [color-scheme:dark]`}
          >
            <option value="contributor">Contributor — can add memories</option>
            <option value="viewer">Viewer — can only visit</option>
          </select>
          <button
            onClick={handleInvite}
            className="w-full py-3 text-[10px] tracking-[0.3em] uppercase border border-neutral-700 text-neutral-200 hover:border-neutral-500 transition-colors"
          >
            send invite
          </button>
          {invited && (
            <p className="text-[10px] text-neutral-500 leading-relaxed">
              {invited.includes("@") ? (
                <>
                  Prototype behavior — the invite for <span className="text-neutral-300">{invited}</span> is
                  stored locally. No email was sent; real delivery arrives with accounts.
                </>
              ) : (
                invited
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------------- About panel ---------------- */

function AboutPanel({ place }: { place: Place }) {
  return (
    <div className="border border-neutral-800/70 bg-[#0a0a0b]/95 p-5 space-y-4">
      <p className="text-[9px] tracking-[0.3em] uppercase text-neutral-500">about this place</p>
      {place.description && (
        <p className="text-xs text-neutral-400 leading-relaxed font-light">{place.description}</p>
      )}
      <div className="pt-2 space-y-2 text-[10px] tracking-[0.15em] uppercase">
        <div className="flex justify-between gap-4">
          <span className="text-neutral-600">location</span>
          <span className="text-neutral-400 text-right">{place.location || "—"}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-neutral-600">years</span>
          <span className="text-neutral-400 text-right">
            {place.startYear}–{place.endOpen ? "Present" : place.endYear}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-neutral-600">privacy</span>
          <span className="text-neutral-400 text-right">private</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-neutral-600">spatial capture</span>
          <span className="text-neutral-400 text-right">
            {place.hasSplat
              ? `${place.splatName ?? "file"} — rendering ${place.splatRenderingReady === false ? "integration pending" : "ready"}`
              : "not connected yet"}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ---------------- Page ---------------- */

type Panel = "memories" | "contributors" | "about"

export default function PlacePage() {
  const params = useParams()
  const router = useRouter()
  const placeId = params.id as string

  const [place, setPlace] = useState<Place | null>(null)
  const [memories, setMemories] = useState<Memory[]>([])
  const [splatUrl, setSplatUrl] = useState<string | null>(null)
  const [splatLoaded, setSplatLoaded] = useState(false)
  const [panel, setPanel] = useState<Panel | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [picking, setPicking] = useState<MemoryPosition | null>(null)
  const [awaitingPick, setAwaitingPick] = useState(false)
  const [timelineYear, setTimelineYear] = useState<number | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const p = getPlace(placeId)
    if (!p) {
      router.push("/places")
      return
    }
    // Intentional mount-time load from localStorage (client-only data)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlace(p)
    setMemories(loadMemories(placeId))
    getSplatUrl(placeId).then((url) => {
      setSplatUrl(url)
      setSplatLoaded(true)
    })
  }, [placeId, router])

  const years = useMemo(
    () => (place ? placeYears(place, memories) : { min: 2025, max: 2026 }),
    [place, memories]
  )
  const sliderYear = timelineYear ?? years.max
  const visibleMemories = useMemo(
    () =>
      memories
        .filter((m) => m.year <= sliderYear)
        .sort((a, b) => a.year - b.year || a.createdAt - b.createdAt),
    [memories, sliderYear]
  )
  const memoryYears = useMemo(() => new Set(memories.map((m) => m.year)), [memories])
  const selected = visibleMemories.find((m) => m.id === selectedId) ?? null

  const handleSurfacePick = useCallback((pos: MemoryPosition) => {
    if (!awaitingPick) return
    setPicking(pos)
    setAwaitingPick(false)
    setSelectedId(null)
  }, [awaitingPick])

  const handleWorldPick = useCallback((pos: MemoryPosition) => {
    if (!awaitingPick) return
    setPicking(pos)
    setAwaitingPick(false)
    setSelectedId(null)
  }, [awaitingPick])

  const handleSaveMemory = (m: Memory) => {
    if (!place) return
    const saved = { ...m, placeId }
    saveMemory(saved)
    setMemories(loadMemories(placeId))
    setPicking(null)
    setAwaitingPick(false)
    // Make the new memory visible immediately, wherever the timeline was
    setTimelineYear(Math.min(saved.year, years.max))
    setPanel("memories")
    // Contributor who added a memory becomes a member if they weren't one
    if (!place.members.some((mem) => mem.name === saved.contributorId)) {
      const updated: Place = {
        ...place,
        members: [
          ...place.members,
          { id: crypto.randomUUID(), name: saved.contributorId, role: "contributor" },
        ],
      }
      savePlace(updated)
      setPlace(updated)
    }
    setSelectedId(saved.id)
  }

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
    const p = importPlace(await f.text())
    if (p && p.id === placeId) {
      setPlace(p)
      setMemories(loadMemories(placeId))
    }
  }

  if (!place) {
    return (
      <main className="min-h-screen bg-[#060607] text-neutral-500">
        <Nav />
        <div className="pt-40 text-center text-xs tracking-[0.3em] uppercase">opening the place…</div>
      </main>
    )
  }

  const navItem = (id: Panel, label: string) => (
    <button
      key={id}
      onClick={() => setPanel(panel === id ? null : id)}
      className={`text-[10px] tracking-[0.25em] uppercase transition-colors ${
        panel === id ? "text-[#e8e2d4]" : "text-neutral-500 hover:text-neutral-300"
      }`}
    >
      {label}
    </button>
  )

  return (
    <main className="min-h-screen bg-[#060607] text-neutral-200">
      <Nav />

      {/* Header: identity left, navigation right */}
      <header className="fixed top-14 inset-x-0 z-40 bg-[#060607]/85 backdrop-blur-sm border-b border-neutral-900">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between gap-6">
          <div className="min-w-0">
            <h1 className="text-sm font-light text-neutral-100 tracking-wide truncate">{place.name}</h1>
            <p className="text-[9px] tracking-[0.3em] uppercase text-neutral-500 mt-0.5 truncate">
              {place.location} · {place.startYear}–{place.endOpen ? "Present" : place.endYear}
            </p>
          </div>
          <nav className="flex items-center gap-4 sm:gap-6 shrink-0">
            {navItem("memories", `Memories ${memories.length > 0 ? `(${memories.length})` : ""}`)}
            {navItem("contributors", "Contributors")}
            {navItem("about", "About")}
            <button
              onClick={() => {
                setAwaitingPick((v) => !v)
                setSelectedId(null)
              }}
              className={`text-[10px] tracking-[0.25em] uppercase px-4 py-2 border transition-all ${
                awaitingPick
                  ? "border-[#f5efe2]/60 text-[#f5efe2] bg-[#c9bda4]/[0.15]"
                  : "border-[#c9bda4]/40 text-[#f5efe2] bg-[#c9bda4]/[0.06] hover:bg-[#c9bda4]/[0.12]"
              }`}
            >
              {awaitingPick ? "choose a spot…" : "+ Add Memory"}
            </button>
          </nav>
        </div>
      </header>

      <div className="pt-30 flex flex-col h-screen">
        {/* Viewer — the place is visually dominant */}
        <div className="flex-1 min-h-0 px-4 sm:px-6 pt-4">
          <div className="relative w-full h-full border border-neutral-900">
            <SpatialViewer
              splatUrl={splatUrl}
              splatName={place.splatName}
              splatFormat={place.splatFormat}
              loading={!splatLoaded}
              onSurfacePick={handleSurfacePick}
              onWorldPick={handleWorldPick}
              renderSceneExtras={
                <>
                  {splatUrl &&
                    visibleMemories.map((m) => (
                      <WorldPin
                        key={m.id}
                        position={m.position}
                        active={selectedId === m.id}
                        onSelect={() => {
                          setSelectedId(selectedId === m.id ? null : m.id)
                          setPicking(null)
                          setPanel("memories")
                        }}
                      />
                    ))}
                </>
              }
            >
              {/* HTML overlay markers for the no-capture mode */}
              {!splatUrl &&
                visibleMemories.map((m) => (
                  <SurfacePin
                    key={m.id}
                    memory={m}
                    active={selectedId === m.id}
                    onSelect={() => {
                      setSelectedId(selectedId === m.id ? null : m.id)
                      setPicking(null)
                      setPanel("memories")
                    }}
                  />
                ))}

              {/* Picking hint */}
              {(awaitingPick || picking) && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 text-[9px] tracking-[0.3em] uppercase text-[#e8e2d4] bg-black/70 px-4 py-2 backdrop-blur-sm pointer-events-none">
                  click a spot in the place to pin the memory
                </div>
              )}
            </SpatialViewer>
          </div>
        </div>

        {/* Persistent timeline at the bottom */}
        <div className="shrink-0 border-t border-neutral-900 bg-[#060607]">
          <Timeline
            min={years.min}
            max={years.max}
            value={sliderYear}
            memoryYears={memoryYears}
            onChange={setTimelineYear}
          />
        </div>
      </div>

      {/* Side panel — memories / contributors / about / composer */}
      {(panel || picking || awaitingPick) && (
        <aside className="fixed right-0 top-30 bottom-0 z-40 w-full sm:w-[380px] bg-[#060607]/95 backdrop-blur-md border-l border-neutral-900 overflow-y-auto p-5 space-y-4">
          {picking && (
            <div className="space-y-3">
              <Composer
                position={picking}
                members={place.members}
                years={years}
                onSave={handleSaveMemory}
                onCancel={() => setPicking(null)}
              />
              <p className="text-[9px] tracking-[0.2em] uppercase text-neutral-700 text-center">
                pinned at {(picking.x * 100).toFixed(0)}%, {(picking.y * 100).toFixed(0)}%
                {splatUrl ? " of the space" : " of the frame — re-anchor once capture is connected"}
              </p>
            </div>
          )}

          {awaitingPick && !picking && (
            <div className="border border-neutral-800/70 bg-[#0a0a0b]/95 p-5">
              <p className="text-[9px] tracking-[0.3em] uppercase text-[#c9bda4]/80">
                where did it happen?
              </p>
              <p className="mt-3 text-xs text-neutral-500 leading-relaxed font-light">
                Click the spot in the place where this memory belongs. You can also cancel from the
                Add Memory button.
              </p>
            </div>
          )}

          {!picking && panel === "memories" && (
            <>
              {selected && (
                <MemoryDetail
                  memory={selected}
                  member={place.members.find((m) => m.name === selected.contributorId)}
                  onDelete={() => {
                    setMemories(deleteMemory(selected.id, placeId))
                    setSelectedId(null)
                  }}
                  onClose={() => setSelectedId(null)}
                />
              )}
              <div className="border border-neutral-800/70 bg-[#0a0a0b]/95 p-5">
                <p className="text-[9px] tracking-[0.3em] uppercase text-neutral-500">
                  {visibleMemories.length === 0
                    ? "no memories yet"
                    : `${visibleMemories.length} memor${visibleMemories.length === 1 ? "y" : "ies"} by ${sliderYear}`}
                </p>
                {visibleMemories.length === 0 ? (
                  <p className="mt-3 text-xs text-neutral-500 leading-relaxed font-light">
                    {memories.length > 0
                      ? "Nothing recorded before this point in time. Move the timeline forward."
                      : "Click Add Memory, choose a spot in the place, and pin the first story to it."}
                  </p>
                ) : (
                  <div className="mt-4 space-y-2">
                    {[...visibleMemories].reverse().map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setSelectedId(m.id === selectedId ? null : m.id)
                          setPicking(null)
                        }}
                        className={`block w-full text-left p-3 border transition-colors ${
                          selectedId === m.id
                            ? "border-[#c9bda4]/40 bg-[#c9bda4]/[0.05]"
                            : "border-neutral-800/60 hover:border-neutral-700"
                        }`}
                      >
                        <p className="text-xs text-neutral-200 font-light">{m.title}</p>
                        <p className="mt-1 text-[9px] tracking-[0.2em] uppercase text-neutral-500">
                          {formatMemoryDate(m.date)} · {m.contributorId}
                          {m.mediaUrl ? " · media" : ""}
                          {m.audioUrl ? " · audio" : ""}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {!picking && panel === "contributors" && (
            <ContributorsPanel
              place={place}
              onUpdate={(p) => {
                setPlace(p)
                setMemories(loadMemories(placeId))
              }}
            />
          )}

          {!picking && panel === "about" && (
            <>
              <AboutPanel place={place} />
              <div className="border border-neutral-800/70 bg-[#0a0a0b]/95 p-5">
                <p className="text-[9px] tracking-[0.3em] uppercase text-neutral-500">archive data</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    onClick={handleExport}
                    className="py-3 text-[9px] tracking-[0.25em] uppercase border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200 transition-colors"
                  >
                    export
                  </button>
                  <button
                    onClick={() => importRef.current?.click()}
                    className="py-3 text-[9px] tracking-[0.25em] uppercase border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200 transition-colors"
                  >
                    import
                  </button>
                </div>
                <input
                  ref={importRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => handleImport(e.target.files?.[0])}
                />
                <p className="mt-3 text-[10px] text-neutral-600 leading-relaxed">
                  Memories export as JSON — a bridge for moving this archive to another device or,
                  later, to shared storage.
                </p>
              </div>
              <button
                onClick={() => router.push("/places")}
                className="w-full text-left text-[10px] tracking-[0.3em] uppercase text-neutral-600 hover:text-neutral-400 transition-colors px-1"
              >
                ← back to my places
              </button>
            </>
          )}
        </aside>
      )}
    </main>
  )
}
