"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Nav, NoiseOverlay } from "@/components/landing/atmosphere"
import { savePlace, storeSplat, fileToDataUrl, type Place } from "@/lib/places"

export default function CreatePage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [startYear, setStartYear] = useState(1978)
  const [endYear, setEndYear] = useState(new Date().getFullYear())
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
      const place: Place = {
        id: crypto.randomUUID(),
        name: name.trim(),
        startYear: Math.min(startYear, endYear),
        endYear: Math.max(startYear, endYear),
        description: description.trim(),
        cover,
        hasSplat: !!splatFile,
        splatName: splatFile?.name,
        createdAt: Date.now(),
        contributors: ["you"],
      }
      savePlace(place)
      if (splatFile) {
        await storeSplat(place.id, splatFile)
      }
      router.push(`/place/${place.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "could not save the place")
      setSaving(false)
    }
  }

  const inputCls =
    "w-full bg-transparent border-b border-neutral-800/60 px-1 py-2.5 text-sm text-neutral-300 placeholder:text-neutral-600 focus:outline-none focus:border-violet-500/40 transition-colors"
  const labelCls = "text-[10px] tracking-[0.3em] uppercase text-neutral-500"

  return (
    <main className="min-h-screen bg-[#030305] text-neutral-200 selection:bg-violet-500/30">
      <Nav active="create" />
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <NoiseOverlay />
      </div>

      <section className="relative max-w-xl mx-auto px-6 pt-32 pb-24">
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

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelCls}>from</label>
              <input
                type="number"
                value={startYear}
                min={1800}
                max={currentYear}
                onChange={(e) => setStartYear(Number(e.target.value))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>to</label>
              <input
                type="number"
                value={endYear}
                min={1800}
                max={currentYear + 1}
                onChange={(e) => setEndYear(Number(e.target.value))}
                className={inputCls}
              />
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
              className="mt-2 w-full border border-neutral-800/60 hover:border-neutral-700 transition-colors p-4 text-left"
            >
              {cover ? (
                <div className="aspect-video w-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cover} alt="cover" className="w-full h-full object-cover" />
                </div>
              ) : (
                <span className="text-xs text-neutral-400">add a photo of the place…</span>
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
            <label className={labelCls}>3D capture — splat file (optional)</label>
            <button
              onClick={() => splatRef.current?.click()}
              className="mt-2 w-full border border-dashed border-neutral-800/60 hover:border-violet-500/40 transition-colors p-6 text-left"
            >
              {splatFile ? (
                <span className="text-xs text-violet-300/80">
                  ✓ {splatFile.name} ({(splatFile.size / 1024 / 1024).toFixed(1)} MB)
                </span>
              ) : (
                <span className="text-xs text-neutral-400">
                  Drop in a .spz / .ply / .splat captured with Scaniverse or another app — or skip it and
                  add one later. The archive works without it.
                </span>
              )}
            </button>
            <input
              ref={splatRef}
              type="file"
              accept=".ply,.splat,.spz"
              className="hidden"
              onChange={(e) => setSplatFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {error && (
            <p className="text-[10px] tracking-[0.2em] uppercase text-red-500/70">{error}</p>
          )}

          <button
            onClick={handleCreate}
            disabled={saving}
            className={`w-full py-4 text-[11px] tracking-[0.3em] uppercase border transition-all ${
              saving
                ? "border-violet-500/30 text-violet-400/60 cursor-wait"
                : "border-violet-500/40 text-violet-200 bg-violet-500/[0.06] hover:bg-violet-500/[0.14]"
            }`}
          >
            {saving ? "creating the place…" : "create the place"}
          </button>

          <p className="text-[10px] text-neutral-500 leading-relaxed">
            Private by default. Everything stays on this device until sharing is set up.
          </p>
        </div>
      </section>
    </main>
  )
}
