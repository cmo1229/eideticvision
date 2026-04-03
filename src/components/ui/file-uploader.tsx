"use client"

import { useState, useCallback, useRef } from "react"
import { getSupabase } from "@/lib/supabase"
import axios from "axios"

interface UploaderProps {
  onUploadComplete: (assetUrl: string) => void
}

export function FileUploader({ onUploadComplete }: UploaderProps) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const uploadToSupabase = useCallback(async (file: File) => {
    setUploading(true)
    setProgress(0)
    setError(null)

    const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || "captures"
    const ext = file.name.split(".").pop()
    const uniqueName = `${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await getSupabase().storage
      .from(bucket)
      .upload(uniqueName, file, { cacheControl: "3600", upsert: false })

    if (uploadError) throw uploadError

    setProgress(Math.min(50, Math.round((file.size / (1024 * 1024)) * 5)))

    const { publicUrl } = getSupabase().storage.from(bucket).getPublicUrl(uniqueName).data
    return { publicUrl, uniqueName }
  }, [])

  const triggerProcessing = useCallback(async (publicUrl: string) => {
    setProcessing(true)
    const { data } = await axios.post("/api/process", { fileUrl: publicUrl })
    setProgress(100)
    return data.resultUrl
  }, [])

  const handleFile = useCallback(
    async (file: File) => {
      const validExts = [".mp4", ".ply", ".glb", ".gltf"]
      const ext = `.${file.name.split(".").pop()?.toLowerCase()}`
      if (!validExts.includes(ext)) {
        setError("Only .mp4, .ply, .glb, .gltf")
        return
      }
      try {
        const { publicUrl } = await uploadToSupabase(file)
        const resultUrl = await triggerProcessing(publicUrl)
        onUploadComplete(resultUrl)
      } catch (err: any) {
        setError(err.message ?? "Upload failed.")
      } finally {
        setUploading(false)
        setProcessing(false)
      }
    },
    [uploadToSupabase, triggerProcessing, onUploadComplete]
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
          ${uploading ? "pointer-events-none" : "hover:border-neutral-700"}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".mp4,.ply,.glb,.gltf"
          className="hidden"
          onChange={onInputChange}
          disabled={uploading}
        />

        {/* Animated border corners */}
        <div className="absolute top-0 left-0 w-6 h-6 border-l border-b border-neutral-700/50" />
        <div className="absolute top-0 right-0 w-6 h-6 border-r border-b border-neutral-700/50" />
        <div className="absolute bottom-0 left-0 w-6 h-6 border-l border-t border-neutral-700/50" />
        <div className="absolute bottom-0 right-0 w-6 h-6 border-r border-t border-neutral-700/50" />

        <div className="flex flex-col items-center gap-3">
          <p className={`text-sm tracking-[0.2em] uppercase transition-colors duration-500
            ${uploading || processing ? "text-violet-400/80" : "text-neutral-600 group-hover:text-neutral-400"}
          `}>
            {uploading && !processing
              ? "uploading capture"
              : processing
                ? "processing neural mesh"
                : "drop a spatial capture"}
          </p>

          {(uploading || processing) ? (
            <div className="mt-3 w-48 h-[1px] bg-neutral-800/60 relative overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-all duration-1000 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          ) : null}
        </div>
      </div>

      {error && (
        <p className="text-[10px] tracking-[0.2em] uppercase text-red-500/60 mt-4 text-center">{error}</p>
      )}
    </div>
  )
}
