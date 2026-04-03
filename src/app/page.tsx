"use client"

import { useState } from "react"
import { FileUploader } from "@/components/ui/file-uploader"
import { Scene } from "@/components/viewer/scene"

export default function Home() {
  const [assetUrl, setAssetUrl] = useState<string | undefined>()
  const [assetType, setAssetType] = useState<string>("glb")

  const handleComplete = (url: string) => {
    const ext = url.split(".").pop()?.toLowerCase() ?? ""
    setAssetType(ext === "ply" ? "ply" : "glb")
    setAssetUrl(url)
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-zinc-200">
      {/* Header */}
      <header className="px-6 py-4 border-b border-zinc-800">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Eidetic</h1>
          <span className="text-xs text-zinc-500">spatial memories</span>
        </div>
      </header>

      {/* Upload zone */}
      <section className="px-6 py-16">
        <div className="max-w-5xl mx-auto">
          {!assetUrl ? (
            <>
              <p className="text-zinc-400 text-center mb-8">
                Upload a raw spatial capture — it will be processed into a
                navigable 3D scene.
              </p>
              <FileUploader onUploadComplete={handleComplete} />
            </>
          ) : (
            <button
              onClick={() => setAssetUrl(undefined)}
              className="text-sm text-zinc-500 hover:text-zinc-300 mb-4 underline"
            >
              ← Upload another capture
            </button>
          )}
        </div>
      </section>

      {/* Scene viewer */}
      {assetUrl && (
        <section className="px-6 pb-16">
          <div className="max-w-5xl mx-auto">
            <Scene assetUrl={assetUrl} assetType={assetType} />
          </div>
        </section>
      )}
    </main>
  )
}