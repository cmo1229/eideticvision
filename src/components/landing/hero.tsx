"use client"

import { useState, useRef } from "react"
import { FileUploader } from "@/components/ui/file-uploader"
import { Scene } from "@/components/viewer/scene"

export function HeroSection() {
  const [assetUrl, setAssetUrl] = useState<string | undefined>()
  const [assetType, setAssetType] = useState<string>("glb")

  const handleComplete = (url: string) => {
    const ext = url.split(".").pop()?.toLowerCase() ?? ""
    setAssetType(ext === "ply" ? "ply" : "glb")
    setAssetUrl(url)
  }

  return (
    <section className="relative min-h-screen flex flex-col">
      {/* Hero content */}
      <div className="relative z-10 flex-1 flex flex-col max-w-3xl mx-auto px-6">
        <div className="flex-1 flex flex-col items-center justify-center">
          <h1 className="text-6xl md:text-7xl font-bold tracking-tight bg-gradient-to-br from-violet-300 via-fuchsia-200 to-violet-400 bg-clip-text text-transparent">
            EideticVision
          </h1>
          <p className="mt-4 text-lg text-neutral-400 text-center max-w-md leading-relaxed">
            Transform spatial captures into navigable 3D worlds. Upload, explore, record.
          </p>

          <div className="mt-10 w-full">
            <FileUploader onUploadComplete={handleComplete} />
          </div>
        </div>
      </div>

      {/* Scene viewer takes over */}
      {assetUrl && (
        <section className="relative z-10 px-6 py-8 bg-neutral-950/90 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto">
            <button
              onClick={() => setAssetUrl(undefined)}
              className="text-sm text-neutral-500 hover:text-neutral-300 mb-4 inline-flex items-center gap-1 transition-colors"
            >
              ← Upload another capture
            </button>
            <Scene assetUrl={assetUrl} assetType={assetType} />
          </div>
        </section>
      )}

      {/* Background video */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover opacity-[0.06]"
        >
          <source src="/background.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/80 via-transparent to-neutral-950" />
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#050505] text-neutral-200 selection:bg-violet-500/30">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.04] backdrop-blur-xl bg-neutral-950/60">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-base font-semibold tracking-tight bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
            EideticVision
          </span>
          <span className="text-xs font-mono text-neutral-600">0.1.0</span>
        </div>
      </nav>

      <div className="pt-14">
        <HeroSection />
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.04] py-6 px-6">
        <p className="text-center text-xs text-neutral-700">
          © {new Date().getFullYear()} EideticVision — Spatial memories, reimagined.
        </p>
      </footer>
    </main>
  )
}
