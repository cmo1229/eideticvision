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
  deletePlace,
  loadMemories,
  saveMemory,
  deleteMemory,
  placeYears,
  savePlace,
  getSplatUrl,
  getSplatBlob,
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
import {
  fetchPublicPlace,
  fetchCollab,
  getCloudUser,
  sendMagicLink,
  signOut,
  syncPlaceToCloud,
  updateCloudPlace,
  setPlacePublic,
  inviteMember,
  revokeInvite,
  addCloudMemory,
  updateCloudMemory,
  deleteCloudMemory,
  deleteCloudPlace,
  isCloudConfigured,
  type CloudUser,
  type PlaceCollab,
} from "@/lib/cloud"

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
      className="absolute z-10 group -translate-x-1/2 -translate-y-1/2 p-2.5 -m-2.5"
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
        className={`absolute left-1/2 -translate-x-1/2 top-full mt-1 whitespace-nowrap text-[9px] tracking-[0.2em] uppercase px-2 py-1 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
          active
            ? "text-neutral-100 opacity-100"
            : "text-neutral-400 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
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
    <div className="px-3 pt-2.5 pb-1.5 sm:px-10 sm:pt-5 sm:pb-3">
      <div className="relative h-9 sm:h-10">
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
        <span className="text-xs tracking-[0.3em] uppercase text-neutral-400 tabular-nums">{min}</span>
        <span className="text-sm tracking-[0.3em] uppercase text-[#f5efe2] tabular-nums">{value}</span>
        <span className="text-xs tracking-[0.3em] uppercase text-neutral-400 tabular-nums">{max}</span>
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
  fixedContributor,
  onSave,
  onCancel,
}: {
  position: MemoryPosition
  members: PlaceMember[]
  years: { min: number; max: number }
  fixedContributor?: string
  onSave: (m: Memory) => void
  onCancel: () => void
}) {
  const contributors = members.filter((m) => m.role === "owner" || m.role === "contributor")
  const [title, setTitle] = useState("")
  const [story, setStory] = useState("")
  const [date, setDate] = useState(`${years.max}-06`)
  const [contributorId, setContributorId] = useState(
    fixedContributor || localStorage.getItem("eidetic.me") || contributors[0]?.name || ""
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
    if (!fixedContributor) localStorage.setItem("eidetic.me", contributorId)
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
            {fixedContributor ? (
              <p className={`${inputCls} text-neutral-400`}>{fixedContributor}</p>
            ) : (
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
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

function DeleteMemoryButton({ onDelete }: { onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false)
  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="mt-5 text-[9px] tracking-[0.2em] uppercase text-neutral-700 hover:text-red-400/70 transition-colors"
      >
        remove this memory
      </button>
    )
  }
  return (
    <div className="mt-5 border border-red-500/20 p-3">
      <p className="text-[10px] text-neutral-300">Remove this memory forever?</p>
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={onDelete}
          className="px-3 py-1.5 text-[9px] tracking-[0.2em] uppercase border border-red-400/50 text-red-300 bg-red-500/[0.08] hover:bg-red-500/[0.16] transition-colors"
        >
          yes, remove
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-3 py-1.5 text-[9px] tracking-[0.2em] uppercase border border-neutral-800 text-neutral-400 hover:border-neutral-600 transition-colors"
        >
          keep it
        </button>
      </div>
    </div>
  )
}

function MemoryDetail({
  memory,
  member,
  onDelete,
  onEdit,
  onClose,
}: {
  memory: Memory
  member?: PlaceMember
  onDelete?: () => void
  onEdit?: (updated: Memory) => void
  onClose: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(memory.title)
  const [story, setStory] = useState(memory.story)
  const [date, setDate] = useState(memory.date.includes("-") ? memory.date : `${memory.year}-06`)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!title.trim() || !onEdit) return
    setBusy(true)
    setError(null)
    try {
      await onEdit({
        ...memory,
        title: title.trim(),
        story: story.trim(),
        date,
        year: Number(date.slice(0, 4)) || memory.year,
      })
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not save changes")
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <div className="border border-[#c9bda4]/30 bg-[#0a0a0b]/95 p-5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] tracking-[0.3em] uppercase text-[#c9bda4]/80">edit memory</p>
          <button
            onClick={() => setEditing(false)}
            className="text-[9px] tracking-[0.2em] uppercase text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            cancel
          </button>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <label className={labelCls}>title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>story</label>
            <textarea
              value={story}
              onChange={(e) => setStory(e.target.value)}
              rows={4}
              className={`${inputCls} resize-none`}
            />
          </div>
          <div>
            <label className={labelCls}>date</label>
            <input
              type="month"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${inputCls} [color-scheme:dark]`}
            />
          </div>
          {error && <p className="text-[10px] text-red-400/80">{error}</p>}
          <button
            onClick={handleSave}
            disabled={busy || !title.trim()}
            className="w-full py-3 text-[10px] tracking-[0.3em] uppercase border border-[#c9bda4]/40 text-[#f5efe2] bg-[#c9bda4]/[0.06] hover:bg-[#c9bda4]/[0.12] transition-all disabled:opacity-40"
          >
            {busy ? "saving…" : "save changes"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-neutral-800/70 bg-[#0a0a0b]/95">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base text-neutral-50 font-light">{memory.title}</h3>
            <p className="mt-1.5 text-[10px] tracking-[0.25em] uppercase text-neutral-400">
              {formatMemoryDate(memory.date)} · {memory.contributorId}
              {member?.role === "owner" ? " · owner" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[9px] tracking-[0.2em] uppercase text-neutral-500 hover:text-neutral-300 transition-colors shrink-0"
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
          <p className="mt-4 text-sm text-neutral-300 leading-relaxed font-light">{memory.story}</p>
        )}

        <div className="mt-5 flex items-center gap-5">
          {onEdit && (
            <button
              onClick={() => setEditing(true)}
              className="text-[10px] tracking-[0.2em] uppercase text-neutral-500 hover:text-[#e8e2d4] transition-colors"
            >
              edit memory
            </button>
          )}
          {onDelete && <DeleteMemoryButton onDelete={onDelete} />}
        </div>
      </div>
    </div>
  )
}

/* ---------------- Contributors panel ---------------- */

function ContributorsPanel({
  place,
  isCloud,
  cloudUser,
  collab,
  reloadCollab,
  onEnableSharing,
  sharing,
}: {
  place: Place
  isCloud: boolean
  cloudUser: CloudUser | null
  collab: PlaceCollab | null
  reloadCollab: () => Promise<void>
  onEnableSharing: () => void
  sharing: boolean
}) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"contributor" | "viewer">("contributor")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [manualLink, setManualLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signInEmail, setSignInEmail] = useState("")
  const [signInBusy, setSignInBusy] = useState(false)
  const [signInMsg, setSignInMsg] = useState<string | null>(null)
  const [signInError, setSignInError] = useState<string | null>(null)
  const cloudId = place.cloudId

  const handleInvite = async () => {
    setError(null)
    setMessage(null)
    setManualLink(null)
    if (!email.includes("@")) {
      setError("enter a valid email")
      return
    }
    if (!cloudId) return
    setBusy(true)
    try {
      const ownerName = place.members.find((m) => m.role === "owner")?.name ?? "Someone"
      const result = await inviteMember(cloudId, email.trim(), role, place.name, ownerName)
      if (result.emailed) {
        setMessage(`invite sent to ${email.trim()} — it's pending until they join`)
      } else {
        setManualLink(result.acceptUrl ?? null)
        setMessage(`email delivery isn't configured yet — share this link with ${email.trim()}`)
      }
      setEmail("")
      await reloadCollab()
    } catch (e) {
      setError(e instanceof Error ? e.message : "invite failed")
    } finally {
      setBusy(false)
    }
  }

  const handleRevoke = async (inviteId: string) => {
    if (!cloudId) return
    try {
      await revokeInvite(inviteId)
      await reloadCollab()
    } catch (e) {
      setError(e instanceof Error ? e.message : "revoke failed")
    }
  }

  const pendingInvites = collab?.invites.filter((i) => i.status === "pending") ?? []

  return (
    <div className="space-y-4">
      {/* Members */}
      <div className="border border-neutral-800/70 bg-[#0a0a0b]/95 p-5">
        <p className="text-[9px] tracking-[0.3em] uppercase text-neutral-500">contributors</p>
        <div className="mt-4 space-y-3">
          {place.members
            .filter((m) => m.role === "owner" || !cloudId || collab?.members.some((cm) => cm.name === m.name))
            .map((m) => (
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
          {collab?.members
            .filter((cm) => !place.members.some((m) => m.name === cm.name))
            .map((cm) => (
              <div key={cm.userId} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-7 h-7 rounded-full border border-neutral-700 flex items-center justify-center text-[10px] text-neutral-400 shrink-0">
                    {cm.name.charAt(0).toUpperCase()}
                  </span>
                  <p className="text-xs text-neutral-200 truncate">{cm.name}</p>
                </div>
                <span className="text-[9px] tracking-[0.2em] uppercase text-neutral-500 shrink-0">
                  {cm.role}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Pending invites (owner, cloud) */}
      {cloudId && pendingInvites.length > 0 && (
        <div className="border border-neutral-800/70 bg-[#0a0a0b]/95 p-5">
          <p className="text-[9px] tracking-[0.3em] uppercase text-neutral-500">
            pending · {pendingInvites.length}
          </p>
          <div className="mt-4 space-y-3">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-neutral-300 truncate">{inv.email}</p>
                  <p className="text-[9px] tracking-[0.2em] uppercase text-[#c9bda4]/70">
                    pending · {inv.role}
                  </p>
                </div>
                <button
                  onClick={() => handleRevoke(inv.id)}
                  className="text-[9px] tracking-[0.2em] uppercase text-neutral-600 hover:text-red-400/70 transition-colors shrink-0"
                >
                  revoke
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite form (owner with a cloud place) */}
      {cloudId && collab?.isOwner && (
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
              disabled={busy}
              className="w-full py-3 text-[10px] tracking-[0.3em] uppercase border border-[#c9bda4]/40 text-[#f5efe2] bg-[#c9bda4]/[0.06] hover:bg-[#c9bda4]/[0.12] transition-all disabled:opacity-40"
            >
              {busy ? "sending…" : "send invite"}
            </button>
            {message && (
              <p className="text-[10px] text-[#c9bda4]/90 leading-relaxed">{message}</p>
            )}
            {manualLink && (
              <p className="text-[10px] text-neutral-400 break-all border border-neutral-800 p-2">
                {typeof window !== "undefined"
                  ? `${window.location.origin}${manualLink}`
                  : manualLink}
              </p>
            )}
            {error && <p className="text-[10px] text-red-400/80 leading-relaxed">{error}</p>}
          </div>
        </div>
      )}

      {/* Not yet shared — set up invites */}
      {!cloudId && !isCloud && (
        <div className="border border-neutral-800/70 bg-[#0a0a0b]/95 p-5">
          <p className="text-[10px] tracking-[0.3em] uppercase text-neutral-400">
            invite by email
          </p>
          {!cloudUser ? (
            <>
              <p className="mt-3 text-xs text-neutral-500 leading-relaxed font-light">
                Invite someone by email — they&apos;ll get a link, sign in, and add their own
                memories. First, sign in so the invite comes from you:
              </p>
              <div className="mt-4 space-y-3">
                <input
                  type="email"
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  placeholder="your email address"
                  className={inputCls}
                />
                <button
                  onClick={async () => {
                    setSignInError(null)
                    if (!signInEmail.includes("@")) {
                      setSignInError("enter a valid email")
                      return
                    }
                    setSignInBusy(true)
                    try {
                      await sendMagicLink(signInEmail)
                      setSignInMsg(
                        `sign-in link sent to ${signInEmail} — open it on this device, then come back and tap invite collaborators`
                      )
                    } catch (e) {
                      setSignInError(e instanceof Error ? e.message : "could not send the link")
                    } finally {
                      setSignInBusy(false)
                    }
                  }}
                  disabled={signInBusy}
                  className="w-full py-3 text-[10px] tracking-[0.3em] uppercase border border-[#c9bda4]/40 text-[#f5efe2] bg-[#c9bda4]/[0.06] hover:bg-[#c9bda4]/[0.12] transition-all disabled:opacity-40"
                >
                  {signInBusy ? "sending…" : "email me a sign-in link"}
                </button>
                {signInMsg && (
                  <p className="text-[10px] text-[#c9bda4]/90 leading-relaxed">{signInMsg}</p>
                )}
                {signInError && (
                  <p className="text-[10px] text-red-400/80 leading-relaxed">{signInError}</p>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-xs text-neutral-500 leading-relaxed font-light">
                They&apos;ll get a link, sign in, and add their own memories to this place. Only
                they can see it until you publish.
              </p>
              <button
                onClick={onEnableSharing}
                disabled={sharing}
                className="mt-4 w-full py-3 text-[10px] tracking-[0.3em] uppercase border border-[#c9bda4]/40 text-[#f5efe2] bg-[#c9bda4]/[0.06] hover:bg-[#c9bda4]/[0.12] transition-all disabled:opacity-40"
              >
                {sharing ? "preparing…" : "invite collaborators"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------------- Publish panel (owner, local place) ---------------- */

function PublishPanel({
  place,
  onPlaceChange,
}: {
  place: Place
  onPlaceChange: (p: Place) => void
}) {
  const [user, setUser] = useState<CloudUser | null>(null)
  const [checked, setChecked] = useState(false)
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ phase: string; percent: number | null } | null>(null)
  const cloudReady = isCloudConfigured()

  useEffect(() => {
    getCloudUser()
      .then((u) => setUser(u))
      .catch(() => {})
      .finally(() => setChecked(true))
  }, [])

  const handleSendLink = async () => {
    setError(null)
    setMessage(null)
    if (!email.includes("@")) {
      setError("enter a valid email")
      return
    }
    setBusy(true)
    try {
      await sendMagicLink(email)
      setMessage(`sign-in link sent to ${email} — open it on this device to continue`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not send the link")
    } finally {
      setBusy(false)
    }
  }

  const handlePublish = async () => {
    setError(null)
    setMessage(null)
    setBusy(true)
    setProgress(null)
    try {
      const splatBlob = await getSplatBlob(place.id)
      const result = await syncPlaceToCloud(place, loadMemories(place.id), splatBlob, true, (phase, percent) =>
        setProgress({ phase, percent })
      )
      const updated = { ...place, cloudId: result.cloudId }
      savePlace(updated)
      onPlaceChange(updated)
      setMessage("published — the place is now in the public archive")
    } catch (e) {
      setError(e instanceof Error ? e.message : "publish failed")
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const handleUnpublish = async () => {
    if (!place.cloudId) return
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      await setPlacePublic(place.cloudId, false)
      setMessage("unpublished — no longer in the public archive, still shared with collaborators")
    } catch (e) {
      setError(e instanceof Error ? e.message : "unpublish failed")
    } finally {
      setBusy(false)
    }
  }

  if (!cloudReady) {
    return (
      <div className="border border-neutral-800/70 bg-[#0a0a0b]/95 p-5">
        <p className="text-[9px] tracking-[0.3em] uppercase text-neutral-500">public archive</p>
        <p className="mt-3 text-xs text-neutral-500 leading-relaxed font-light">
          The archive backend is not connected yet, so publishing is pending. Your place stays
          private on this device.
        </p>
      </div>
    )
  }

  return (
    <div className="border border-neutral-800/70 bg-[#0a0a0b]/95 p-5">
      <p className="text-[9px] tracking-[0.3em] uppercase text-neutral-500">public archive</p>

      {!checked ? null : !user ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-neutral-500 leading-relaxed font-light">
            Sign in to publish this place — its rooms, memories, and voices — so anyone can walk
            through it.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email address"
            className={inputCls}
          />
          <button
            onClick={handleSendLink}
            disabled={busy}
            className="w-full py-3 text-[10px] tracking-[0.3em] uppercase border border-[#c9bda4]/40 text-[#f5efe2] bg-[#c9bda4]/[0.06] hover:bg-[#c9bda4]/[0.12] transition-all disabled:opacity-40"
          >
            {busy ? "sending…" : "email me a sign-in link"}
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-neutral-300">
              signed in as <span className="text-neutral-500">{user.email}</span>
            </p>
            <button
              onClick={() => signOut().then(() => setUser(null))}
              className="text-[9px] tracking-[0.2em] uppercase text-neutral-600 hover:text-neutral-300 transition-colors"
            >
              sign out
            </button>
          </div>
          {place.cloudId ? (
            <>
              <p className="text-[10px] tracking-[0.15em] uppercase text-[#c9bda4]/80">
                ✓ published to the public archive
              </p>
              <button
                onClick={handleUnpublish}
                disabled={busy}
                className="w-full py-3 text-[10px] tracking-[0.3em] uppercase border border-neutral-700 text-neutral-300 hover:border-neutral-500 transition-colors disabled:opacity-40"
              >
                {busy ? "working…" : "unpublish (make private)"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handlePublish}
                disabled={busy}
                className="w-full py-3 text-[10px] tracking-[0.3em] uppercase border border-[#c9bda4]/40 text-[#f5efe2] bg-[#c9bda4]/[0.06] hover:bg-[#c9bda4]/[0.12] transition-all disabled:opacity-40"
              >
                {busy ? "working…" : "publish to the public archive"}
              </button>
              {progress && (
                <div className="pt-1">
                  <div className="h-1 w-full bg-neutral-900 overflow-hidden">
                    <div
                      className="h-full bg-[#c9bda4] transition-[width] duration-200 ease-out"
                      style={{
                        width:
                          progress.percent === null
                            ? "100%"
                            : `${Math.round(progress.percent * 100)}%`,
                        opacity: progress.percent === null ? 0.4 : 1,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-[10px] tracking-[0.15em] uppercase text-neutral-500 tabular-nums">
                    {progress.phase}
                    {progress.percent !== null ? ` · ${Math.round(progress.percent * 100)}%` : "…"}
                  </p>
                </div>
              )}
            </>
          )}

          <p className="text-[10px] text-neutral-600 leading-relaxed">
            Publishing uploads the capture, memories, and contributors. Private places are never
            listed; you can unpublish at any time.
          </p>
        </div>
      )}

      {message && <p className="mt-3 text-[10px] text-[#c9bda4]/90 leading-relaxed">{message}</p>}
      {error && <p className="mt-3 text-[10px] text-red-400/80 leading-relaxed">{error}</p>}
    </div>
  )
}

/* ---------------- About panel ---------------- */

function AboutPanel({
  place,
  isCloud,
  cloudUser,
  onPlaceChange,
}: {
  place: Place
  isCloud: boolean
  cloudUser: CloudUser | null
  onPlaceChange: (p: Place) => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState(place.name)
  const [location, setLocation] = useState(place.location)
  const [description, setDescription] = useState(place.description)
  const [startYear, setStartYear] = useState(place.startYear)
  const [endYear, setEndYear] = useState(place.endYear)
  const [endOpen, setEndOpen] = useState(place.endOpen)

  const handleSave = async () => {
    if (!name.trim()) {
      setError("the place needs a name")
      return
    }
    setSaving(true)
    setError(null)
    setMessage(null)
    const updated: Place = {
      ...place,
      name: name.trim(),
      location: location.trim(),
      description: description.trim(),
      startYear: Math.min(startYear, endYear),
      endYear: Math.max(startYear, endYear),
      endOpen,
    }
    savePlace(updated)
    onPlaceChange(updated)
    try {
      if (place.cloudId && cloudUser) {
        await updateCloudPlace(place.cloudId, {
          name: updated.name,
          location: updated.location,
          description: updated.description,
          startYear: updated.startYear,
          endYear: updated.endYear,
          endOpen: updated.endOpen,
        })
      }
      setEditing(false)
      setMessage(null)
    } catch (e) {
      setMessage("saved on this device — the cloud copy couldn't be updated right now")
      setError(null)
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <div className="border border-neutral-800/70 bg-[#0a0a0b]/95 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[9px] tracking-[0.3em] uppercase text-neutral-500">about this place</p>
        {!isCloud && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-[9px] tracking-[0.2em] uppercase text-neutral-600 hover:text-neutral-300 transition-colors"
          >
            edit details
          </button>
        )}
        {editing && (
          <button
            onClick={() => setEditing(false)}
            className="text-[9px] tracking-[0.2em] uppercase text-neutral-600 hover:text-neutral-300 transition-colors"
          >
            cancel
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          <div>
            <label className={labelCls}>place name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>location</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Newton, Massachusetts"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>from</label>
              <input
                type="number"
                value={startYear}
                onChange={(e) => setStartYear(Number(e.target.value))}
                className={`${inputCls} [color-scheme:dark]`}
              />
            </div>
            <div>
              <label className={labelCls}>to</label>
              <input
                type="number"
                value={endYear}
                disabled={endOpen}
                onChange={(e) => setEndYear(Number(e.target.value))}
                className={`${inputCls} [color-scheme:dark] disabled:opacity-30`}
              />
              <label className="mt-2 flex items-center gap-2 text-[9px] tracking-[0.2em] uppercase text-neutral-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={endOpen}
                  onChange={(e) => setEndOpen(e.target.checked)}
                  className="accent-[#c9bda4]"
                />
                present
              </label>
            </div>
          </div>
          <div>
            <label className={labelCls}>description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>
          {error && <p className="text-[10px] text-red-400/80">{error}</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 text-[10px] tracking-[0.3em] uppercase border border-[#c9bda4]/40 text-[#f5efe2] bg-[#c9bda4]/[0.06] hover:bg-[#c9bda4]/[0.12] transition-all disabled:opacity-40"
          >
            {saving ? "saving…" : "save details"}
          </button>
        </div>
      ) : (
        <>
      {place.description && (
        <p className="text-xs text-neutral-400 leading-relaxed font-light">{place.description}</p>
      )}
      <div className="pt-3 space-y-2.5 text-xs tracking-[0.15em] uppercase">
        <div className="flex justify-between gap-4">
          <span className="text-neutral-500">location</span>
          <span className="text-neutral-200 text-right normal-case">{place.location || "—"}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-neutral-500">years</span>
          <span className="text-neutral-200 text-right">{place.startYear}–{place.endOpen ? "Present" : place.endYear}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-neutral-500">privacy</span>
          <span className="text-neutral-400 text-right">
            {isCloud ? "public archive" : place.cloudId ? "published" : "private"}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-neutral-500">spatial capture</span>
          <span className="text-neutral-400 text-right">
            {place.hasSplat
              ? `${place.splatName ?? "file"} — rendering ${place.splatRenderingReady === false ? "integration pending" : "ready"}`
              : "not connected yet"}
          </span>
        </div>
      </div>
        </>
      )}
      {message && <p className="text-[10px] text-[#c9bda4]/90 leading-relaxed">{message}</p>}
    </div>
    {!isCloud && <PublishPanel place={place} onPlaceChange={onPlaceChange} />}
    {isCloud && (
      <p className="text-[10px] text-neutral-600 leading-relaxed px-1">
        This place belongs to its owner. Visits are read-only — the archive above is exactly as
        they published it.
      </p>
    )}
    </>
  )
}

/* ---------------- Danger zone (delete place) ---------------- */

function DangerZone({
  place,
  onDeleted,
}: {
  place: Place
  onDeleted: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      if (place.cloudId) {
        await deleteCloudPlace(place.cloudId).catch(() => {})
      }
      deletePlace(place.id)
      onDeleted()
    } catch {
      setError("could not delete the place")
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <div className="border border-red-500/20 bg-[#0a0a0b]/95 p-5">
      {!confirming ? (
        <>
          <p className="text-[9px] tracking-[0.3em] uppercase text-red-400/60">danger zone</p>
          <button
            onClick={() => setConfirming(true)}
            className="mt-3 text-[10px] tracking-[0.25em] uppercase text-neutral-500 hover:text-red-300 transition-colors"
          >
            delete this place…
          </button>
        </>
      ) : (
        <>
          <p className="text-xs text-neutral-200 leading-relaxed">
            Delete <span className="text-neutral-100">{place.name}</span> forever?
          </p>
          <p className="mt-2 text-[10px] text-neutral-500 leading-relaxed">
            {place.cloudId
              ? "Removes the place, its memories and its capture from this device and the public archive."
              : "Removes the place, its memories and its capture from this device. This cannot be undone."}
          </p>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 text-[9px] tracking-[0.25em] uppercase border border-red-400/50 text-red-300 bg-red-500/[0.08] hover:bg-red-500/[0.16] transition-colors disabled:opacity-40"
            >
              {deleting ? "deleting…" : "yes, delete forever"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-4 py-2 text-[9px] tracking-[0.25em] uppercase border border-neutral-800 text-neutral-400 hover:border-neutral-600 transition-colors"
            >
              keep it
            </button>
          </div>
          {error && <p className="mt-3 text-[10px] text-red-400/80">{error}</p>}
        </>
      )}
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
  const [isCloud, setIsCloud] = useState(false)
  const [cloudUser, setCloudUser] = useState<CloudUser | null>(null)
  const [collab, setCollab] = useState<PlaceCollab | null>(null)
  const [sharing, setSharing] = useState(false)
  const [panel, setPanel] = useState<Panel | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [picking, setPicking] = useState<MemoryPosition | null>(null)
  const [awaitingPick, setAwaitingPick] = useState(false)
  const [timelineYear, setTimelineYear] = useState<number | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Published place from the public archive — read-only visit
    if (placeId.startsWith("cloud-")) {
      const cloudId = placeId.slice("cloud-".length)
      setIsCloud(true)
      fetchPublicPlace(cloudId).then((cp) => {
        if (!cp) {
          router.push("/explore")
          return
        }
        setPlace(cp.place)
        setMemories(cp.memories)
        setSplatUrl(cp.splatUrl)
        setSplatLoaded(true)
      })
      return
    }

    const p = getPlace(placeId)
    if (!p) {
      router.push("/explore")
      return
    }
    setPlace(p)
    setMemories(loadMemories(placeId))
    getSplatUrl(placeId).then((url) => {
      setSplatUrl(url)
      setSplatLoaded(true)
    })
  }, [placeId, router])

  // Cloud session + collaboration. Once a place is synced, the cloud copy is
  // the source of truth for memories (so contributors' additions show up).
  const activeCloudId = isCloud
    ? placeId.slice("cloud-".length)
    : place?.cloudId ?? null

  const reloadCollab = useCallback(async () => {
    if (!activeCloudId) return
    setCollab(await fetchCollab(activeCloudId).catch(() => null))
  }, [activeCloudId])

  useEffect(() => {
    if (!activeCloudId) return
    getCloudUser()
      .then(async (u) => {
        setCloudUser(u)
        await reloadCollab()
        if (u) {
          const cp = await fetchPublicPlace(activeCloudId).catch(() => null)
          if (cp) {
            setMemories(cp.memories)
            if (cp.splatUrl) setSplatUrl(cp.splatUrl)
          }
        }
      })
      .catch(() => {})
  }, [activeCloudId, reloadCollab])

  // Write access: owner locally, or signed-in owner/contributor on the cloud copy
  const canWrite = isCloud
    ? !!cloudUser &&
      (collab?.isOwner ||
        !!collab?.members.some((m) => m.userId === cloudUser.id && m.role === "contributor"))
    : true

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

  const handleSaveMemory = async (m: Memory) => {
    if (!place) return

    // Cloud place: write through to the archive (owner or invited contributor)
    if (activeCloudId && cloudUser) {
      const saved = { ...m, contributorId: cloudUser.displayName }
      try {
        await addCloudMemory(activeCloudId, saved)
        const cp = await fetchPublicPlace(activeCloudId)
        if (cp) setMemories(cp.memories)
        setPicking(null)
        setAwaitingPick(false)
        setTimelineYear(Math.min(saved.year, years.max))
        setPanel("memories")
        setSelectedId(saved.id)
      } catch (e) {
        // error surfaced by composer? keep simple: log to console state
        setPanel("memories")
        console.error(e)
      }
      return
    }

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
      className={`text-xs tracking-[0.25em] uppercase transition-colors ${
        panel === id ? "text-[#f5efe2]" : "text-neutral-400 hover:text-neutral-100"
      }`}
    >
      {label}
    </button>
  )

  return (
    <main className="h-[100dvh] bg-[#060607] text-neutral-200 flex flex-col overflow-hidden">
      <Nav />

      <div className="pt-14 flex flex-col flex-1 min-h-0">
      {/* Header: identity left, navigation right — stacks on mobile */}
      <header className="shrink-0 bg-[#060607]/95 backdrop-blur-sm border-b border-neutral-900">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2 sm:py-0 sm:h-16 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-light text-neutral-50 tracking-wide truncate">{place.name}</h1>
            <p className="text-[10px] tracking-[0.3em] uppercase text-neutral-400 mt-0.5 truncate">
              {place.location} · {place.startYear}–{place.endOpen ? "Present" : place.endYear}
            </p>
          </div>
          <nav className="flex items-center gap-3 sm:gap-6 shrink-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {navItem("memories", `Memories ${memories.length > 0 ? `(${memories.length})` : ""}`)}
            {navItem("contributors", "Contributors")}
            {navItem("about", "About")}
            {canWrite && (
            <button
              onClick={() => {
                setAwaitingPick((v) => !v)
                setSelectedId(null)
              }}
              className={`text-[10px] tracking-[0.25em] uppercase px-4 py-2 border transition-all shrink-0 ${
                awaitingPick
                  ? "border-[#f5efe2]/60 text-[#f5efe2] bg-[#c9bda4]/[0.15]"
                  : "border-[#c9bda4]/40 text-[#f5efe2] bg-[#c9bda4]/[0.06] hover:bg-[#c9bda4]/[0.12]"
              }`}
            >
              {awaitingPick ? "choose a spot…" : "+ Add Memory"}
            </button>
            )}
          </nav>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col">
        {/* Viewer — the place is visually dominant */}
        <div className="flex-1 min-h-0 px-2 pt-2 sm:px-6 sm:pt-4">
          <div className="relative w-full h-full border border-neutral-900">
            <SpatialViewer
              splatUrl={splatUrl}
              splatName={place.splatName}
              splatFormat={place.splatFormat}
              loading={!splatLoaded}
              onSurfacePick={canWrite ? handleSurfacePick : undefined}
              onWorldPick={canWrite ? handleWorldPick : undefined}
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
      </div>

      {/* Side panel — bottom sheet on mobile, right panel on desktop */}
      {(panel || picking || awaitingPick) && (
        <aside className="fixed z-40 inset-x-0 bottom-0 max-h-[68dvh] rounded-t-lg border-t border-neutral-800 sm:rounded-none sm:border-t-0 sm:border-l sm:border-neutral-900 sm:inset-x-auto sm:right-0 sm:top-30 sm:bottom-0 sm:max-h-none sm:w-[380px] bg-[#060607]/95 backdrop-blur-md overflow-y-auto p-4 sm:p-5 space-y-4">
        <div className="sm:hidden sticky -top-4 -mx-4 mb-1 pt-2 pb-1 flex justify-center bg-[#060607]/95">
          <span className="w-10 h-1 rounded-full bg-neutral-700" />
        </div>
          {picking && (
            <div className="space-y-3">
              <Composer
                position={picking}
                members={place.members}
                years={years}
                fixedContributor={activeCloudId && cloudUser ? cloudUser.displayName : undefined}
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
                  onEdit={
                    activeCloudId && cloudUser && collab?.isOwner
                      ? async (updated) => {
                          await updateCloudMemory(activeCloudId, updated)
                          const cp = await fetchPublicPlace(activeCloudId).catch(() => null)
                          if (cp) setMemories(cp.memories)
                        }
                      : !activeCloudId
                        ? async (updated) => {
                            saveMemory({ ...updated, placeId })
                            setMemories(loadMemories(placeId))
                          }
                        : undefined
                  }
                  onDelete={
                    !activeCloudId || !cloudUser || !collab?.isOwner
                      ? !activeCloudId
                        ? () => {
                            setMemories(deleteMemory(selected.id, placeId))
                            setSelectedId(null)
                          }
                        : undefined
                      : async () => {
                          await deleteCloudMemory(activeCloudId, selected.id).catch(() => {})
                          const cp = await fetchPublicPlace(activeCloudId).catch(() => null)
                          if (cp) setMemories(cp.memories)
                          setSelectedId(null)
                        }
                  }
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
              isCloud={isCloud}
              cloudUser={cloudUser}
              collab={collab}
              reloadCollab={reloadCollab}
              sharing={sharing}
              onEnableSharing={async () => {
                if (!cloudUser) {
                  setPanel("about")
                  return
                }
                setSharing(true)
                try {
                  const splatBlob = await getSplatBlob(place.id)
                  const result = await syncPlaceToCloud(place, loadMemories(place.id), splatBlob, false)
                  const updated = { ...place, cloudId: result.cloudId }
                  savePlace(updated)
                  setPlace(updated)
                  await reloadCollab()
                } finally {
                  setSharing(false)
                }
              }}
            />
          )}

          {!picking && panel === "about" && (
            <>
              <AboutPanel place={place} isCloud={isCloud} cloudUser={cloudUser} onPlaceChange={setPlace} />
              {!isCloud && (
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
              )}
              {!isCloud && (
                <DangerZone
                  place={place}
                  onDeleted={() => router.push("/places")}
                />
              )}
              <button
                onClick={() => router.push(isCloud ? "/explore" : "/places")}
                className="w-full text-left text-[10px] tracking-[0.3em] uppercase text-neutral-600 hover:text-neutral-400 transition-colors px-1"
              >
                ← {isCloud ? "back to explore" : "back to my places"}
              </button>
            </>
          )}
        </aside>
      )}
    </main>
  )
}
