"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Nav } from "@/components/landing/atmosphere"
import { savePlace, storeSplat, fileToDataUrl, type Place } from "@/lib/places"

// All accepted formats render in the Spark viewer
const RENDER_READY: Record<string, boolean> = {
  ply: true,
  splat: true,
  spz: true,
  sog: true,
}

export default function CreatePage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [location, setLocation] = useState("")
  const [startYear, setStartYear] = useState(new Date().getFullYear() - 1)
  const [endYear, setEndYear] = useState(new Date().getFullYear())
  const [endOpen, setEndOpen] = useState(true)
  const [description, setDescription] = useState("")
  const [cover, setCover] = useState<string | undefined>()
  const [splatFile, setSplatFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const coverRef = useRef<HTMLInputElement>(null)
  const splatRef = useRef<HTMLInputElement>(null)

  const currentYear = new Date().getFullYear()

  const handleCover = async (f: File | undefined) => {
    if (!f) return
    try {
      setCover(await fileToDataUrl(f, 640))
    } catch {}
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("give the place a name")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const format = splatFile?.name.split(".").pop()?.toLowerCase()
      const place: Place = {
        id: crypto.randomUUID(),
        ownerId: "local",
        name: name.trim(),
        location: location.trim(),
        description: description.trim(),
        startYear: Math.min(startYear, endYear),
        endYear: endOpen ? Math.max(startYear, endYear) : Math.max(startYear, endYear),
        endOpen,
        coverImageUrl: cover,
        hasSplat: !!splatFile,
        splatName: splatFile?.name,
        splatFormat: format,
        splatRenderingReady: format ? RENDER_READY[format] : undefined,
        members: [{ id: crypto.randomUUID(), name: "You", role: "owner" }],
        createdAt: Date.now(),
      }
      savePlace(place)
      if (splatFile) await storeSplat(place.id, splatFile)
      router.push(`/place/${place.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "could not save the place")
      setSaving(false)
    }
  }

  const inputCls =
    "w-full bg-transparent border-b border-neutral-800 px-1 py-2.5 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-[#c9bda4]/50 transition-colors"
  const labelCls = "block text-[10px] tracking-[0.3em] uppercase text-neutral-500"

  return (
    <main className="min-h-screen bg-[#060607] text-neutral-200">
      <Nav active="create" />

      <section className="max-w-xl mx-auto px-6 pt-32 pb-24">
        <p className="text-[10px] tracking-[0.4em] uppercase text-neutral-600">new place</p>
        <h1 className="mt-4 text-2xl font-extralight text-neutral-100 tracking-wide">
          Name the place. Everything else follows.
        </h1>

        <div className="mt-12 space-y-8">
          <div>
            <label className={labelCls}>place name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Grandma's House"
              className={inputCls}
              autoFocus
            />
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

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelCls}>from</label>
              <input
                type="number"
                value={startYear}
                min={1800}
                max={currentYear}
                onChange={(e) => setStartYear(Number(e.target.value))}
                className={`${inputCls} [color-scheme:dark]`}
              />
            </div>
            <div>
              <label className={labelCls}>to</label>
              <input
                type="number"
                value={endYear}
                min={1800}
                max={currentYear + 1}
                disabled={endOpen}
                onChange={(e) => setEndYear(Number(e.target.value))}
                className={`${inputCls} [color-scheme:dark] disabled:opacity-30`}
              />
              <label className="mt-3 flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase text-neutral-500 cursor-pointer">
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
            <label className={labelCls}>what is this place? (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="The house on Willow Street. Summer evenings on the porch, the smell of Sunday dinner…"
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>

          <div>
            <label className={labelCls}>cover image (optional)</label>
            <button
              onClick={() => coverRef.current?.click()}
              className="mt-2 w-full border border-neutral-800 hover:border-neutral-700 transition-colors p-4 text-left"
            >
              {cover ? (
                <div className="aspect-video w-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cover} alt="cover" className="w-full h-full object-cover" />
                </div>
              ) : (
                <span className="text-xs text-neutral-500 font-light">add a photo of the place…</span>
              )}
            </button>
            <input
              ref={coverRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleCover(e.target.files?.[0])}
            />
          </div>

          <div>
            <label className={labelCls}>spatial capture (optional)</label>
            <button
              onClick={() => splatRef.current?.click()}
              className="mt-2 w-full border border-dashed border-neutral-800 hover:border-[#c9bda4]/40 transition-colors p-6 text-left"
            >
              {splatFile ? (
                <span className="text-xs text-[#c9bda4]/90">
                  ✓ {splatFile.name} ({(splatFile.size / 1024 / 1024).toFixed(1)} MB)
                </span>
              ) : (
                <span className="text-xs text-neutral-500 font-light leading-relaxed">
                  Attach a Gaussian splat captured with Scaniverse or another capture app — .spz
                  recommended (.ply, .splat and .sog also work). The archive works without one.
                </span>
              )}
            </button>
            <p className="mt-2 text-[10px] text-neutral-500 leading-relaxed">
              Capturing with Scaniverse? Share → Export →{" "}
              <span className="text-[#c9bda4]/90">SPZ</span> — the same scan at 5–10× smaller, and
              well under the 50 MB upload limit. Large .ply files won't fit.
            </p>
            {splatFile && splatFile.name.toLowerCase().endsWith(".sog") && (
              <p className="mt-2 text-[10px] text-neutral-500 leading-relaxed">
                .sog files render in the place viewer.
              </p>
            )}
            {splatFile && splatFile.size > 49_500_000 && (
              <p className="mt-2 text-[10px] text-red-400/80 leading-relaxed">
                This file is {(splatFile.size / 1024 / 1024).toFixed(1)} MB — over the 50 MB
                upload limit. Export it as .spz from your capture app instead.
              </p>
            )}
            <input
              ref={splatRef}
              type="file"
              accept=".ply,.splat,.spz,.sog"
              className="hidden"
              onChange={(e) => setSplatFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {error && <p className="text-[10px] tracking-[0.2em] uppercase text-red-500/70">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={saving}
            className={`w-full py-4 text-[11px] tracking-[0.3em] uppercase border transition-all ${
              saving
                ? "border-neutral-800 text-neutral-600 cursor-wait"
                : "border-[#c9bda4]/40 text-[#f5efe2] bg-[#c9bda4]/[0.06] hover:bg-[#c9bda4]/[0.12]"
            }`}
          >
            {saving ? "creating the place…" : "create the place"}
          </button>

          <p className="text-[10px] text-neutral-600 leading-relaxed">
            Private by default. Everything stays on this device until sharing is set up.
          </p>
        </div>
      </section>
    </main>
  )
}
