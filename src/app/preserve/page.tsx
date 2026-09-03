"use client"

import { Nav } from "@/components/landing/atmosphere"

const GUIDE_STEPS = [
  {
    n: "01",
    app: "Scaniverse",
    free: true,
    steps: [
      "Download Scaniverse (free, iPhone/Android)",
      "Choose Map mode, then walk slowly around the space",
      "Get every corner — doorways, ceilings, the thing you'd forget",
      "Export as .PLY",
    ],
  },
  {
    n: "02",
    app: "Luma AI",
    free: true,
    steps: [
      "Download Luma AI (free)",
      "New capture → orbit the room slowly, then the details",
      "Wait for processing",
      "Export mesh or splat → upload here",
    ],
  },
  {
    n: "03",
    app: "Polycam",
    free: "freemium",
    steps: [
      "Download Polycam",
      "LiDAR or photo mode, sweep the space twice",
      "Export as .PLY",
      "Upload to your Place",
    ],
  },
]

export default function PreservePage() {
  return (
    <main className="min-h-screen bg-[#030305] text-neutral-200 selection:bg-violet-500/30">
      <Nav />

      <section className="max-w-3xl mx-auto px-6 pt-32 pb-16">
        <p className="text-[10px] tracking-[0.4em] uppercase text-neutral-600">capture guide</p>
        <h1 className="mt-4 text-3xl font-extralight text-neutral-300 tracking-wide leading-tight">
          A phone is all it takes.
        </h1>
        <p className="mt-6 text-sm text-neutral-500 leading-relaxed font-light">
          Ten slow minutes with a free app preserves a place forever. Walk the rooms like
          you&apos;re showing them to someone you love — that&apos;s the whole technique.
        </p>

        <div className="mt-14 space-y-6">
          {GUIDE_STEPS.map((g) => (
            <div key={g.app} className="border border-neutral-800/40 p-8">
              <div className="flex items-center justify-between">
                <span className="text-sm tracking-[0.15em] uppercase text-neutral-300">
                  {g.n} · {g.app}
                </span>
                <span className="text-[9px] tracking-[0.25em] uppercase text-violet-400/60">
                  {g.free === true ? "free" : g.free}
                </span>
              </div>
              <ol className="mt-5 space-y-2">
                {g.steps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-xs text-neutral-500 leading-relaxed">
                    <span className="text-violet-500/50 shrink-0">→</span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        <div className="mt-12 p-6 border border-violet-500/20 bg-violet-500/[0.03]">
          <p className="text-[10px] tracking-[0.3em] uppercase text-violet-400/70">the one rule</p>
          <p className="mt-3 text-sm text-neutral-400 font-light leading-relaxed">
            Move slowly. Overlap everything. The scan needs to see each spot from two directions —
            that&apos;s what makes the memory solid.
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-40">
        <div className="border border-neutral-800/40 p-10">
          <p className="text-[10px] tracking-[0.4em] uppercase text-neutral-600">
            professional place preservation
          </p>
          <h2 className="mt-4 text-xl font-extralight text-neutral-300">
            Selling the house tomorrow isn&apos;t the moment to learn new software.
          </h2>
          <p className="mt-5 text-sm text-neutral-500 leading-relaxed font-light">
            For places that can&apos;t wait — a family home on the market, an estate transition, a
            last visit — we handle everything. A professional capture of the entire property,
            cleaned and prepared. We set up the archive, import the family photos, and walk your
            family through their first visit.
          </p>
          <div className="mt-8 space-y-3">
            {[
              "Full-property professional 3D capture",
              "Splat cleaned and optimized for the archive",
              "Initial memories imported with your family on a call",
              "Everyone invited, everything private",
            ].map((f) => (
              <p key={f} className="flex gap-3 text-xs text-neutral-400">
                <span className="text-violet-500/60">✦</span>
                {f}
              </p>
            ))}
          </div>
          <a
            href="mailto:preserve@eideticvision.com?subject=Place%20Preservation"
            className="inline-block mt-8 px-8 py-3 text-[11px] tracking-[0.3em] uppercase border border-violet-500/40 text-violet-200 bg-violet-500/[0.06] hover:bg-violet-500/[0.14] transition-all"
          >
            request preservation
          </a>
        </div>
      </section>
    </main>
  )
}
