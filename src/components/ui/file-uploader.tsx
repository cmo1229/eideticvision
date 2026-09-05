"use client"

import { useState, useCallback, useRef } from "react"

export type AssetType = "ply" | "glb" | "gltf" | "image"

export interface UploadedAsset {
  url: string
  type: AssetType
  isBase64: boolean
}

interface UploaderProps {
  onUploadComplete: (asset: UploadedAsset) => void
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

export function FileUploader({ onUploadComplete }: UploaderProps) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      const validExts = [".mp4", ".ply", ".glb", ".gltf", ".jpg", ".jpeg", ".png", ".webp"]
      const imageExts = [".jpg", ".jpeg", ".png", ".webp"]
      const ext = `.${file.name.split(".").pop()?.toLowerCase()}`
      if (!validExts.includes(ext)) {
        setError("Only .mp4, .ply, .glb, .gltf, .jpg, .png, .webp")
        return
      }
      try {
        setLoading(true)
        setProgress(10)
        setError(null)

        const isImage = imageExts.includes(ext)

        if (isImage) {
          // Read as base64 for the dream-splat pipeline
          setProgress(40)
          const base64 = await readAsBase64(file)
          setProgress(80)
          onUploadComplete({ url: base64, type: "image", isBase64: true })
        } else {
          // 3D files: create local blob URL (no upload needed)
          setProgress(60)
          const blobUrl = URL.createObjectURL(file)
          setProgress(100)
          onUploadComplete({ url: blobUrl, type: ext.slice(1) as AssetType, isBase64: false })
        }

        setProgress(100)
      } catch (err: any) {
        setError(err.message ?? "Failed to read file.")
      } finally {
        setLoading(false)
      }
    },
    [onUploadComplete]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const statusText = loading
    ? "reading capture"
    : "drop a spatial capture"

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative border border-neutral-800/60 rounded-none p-12 text-center
          transition-all duration-700 cursor-pointer group
          ${dragging ? "border-violet-500/40 bg-violet-500/[0.03]" : "border-neutral-800/40"}
          ${loading ? "pointer-events-none" : "hover:border-neutral-700"}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".mp4,.ply,.glb,.gltf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={onInputChange}
          disabled={loading}
        />

        {/* Animated border corners */}
        <div className="absolute top-0 left-0 w-6 h-6 border-l border-b border-neutral-700/50" />
        <div className="absolute top-0 right-0 w-6 h-6 border-r border-b border-neutral-700/50" />
        <div className="absolute bottom-0 left-0 w-6 h-6 border-l border-t border-neutral-700/50" />
        <div className="absolute bottom-0 right-0 w-6 h-6 border-r border-t border-neutral-700/50" />

        <div className="flex flex-col items-center gap-3">
          <p className={`text-sm tracking-[0.2em] uppercase transition-colors duration-500
            ${loading ? "text-violet-400/80" : "text-neutral-600 group-hover:text-neutral-400"}
          `}>
            {statusText}
          </p>

          {loading && (
            <div className="mt-3 w-48 h-[1px] bg-neutral-800/60 relative overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-all duration-1000 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="text-[10px] tracking-[0.2em] uppercase text-red-500/60 mt-4 text-center">{error}</p>
      )}
    </div>
  )
}
