"use client"

import { useState, useCallback, useRef, useEffect } from "react"
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

    const { data: uploadData, error: uploadError } = await getSupabase().storage
      .from(bucket)
      .upload(uniqueName, file, {
        cacheControl: "3600",
        upsert: false,
      })

    if (uploadError) throw uploadError

    const percent = Math.round(
      ((uploadData?.path?.length ?? 0) / (file.size || 1)) * 100
    )
    setProgress(Math.min(percent, 50))

    const { publicUrl } = getSupabase().storage.from(bucket).getPublicUrl(uniqueName).data

    return { publicUrl, uniqueName }
  }, [])

  const triggerProcessing = useCallback(async (publicUrl: string) => {
    setProcessing(true)

    const { data } = await axios.post("/api/process", {
      fileUrl: publicUrl,
    })

    setProgress(100)
    return data.resultUrl
  }, [])

  const handleFile = useCallback(
    async (file: File) => {
      const validExts = [".mp4", ".ply", ".glb", ".gltf"]
      const ext = `.${file.name.split(".").pop()?.toLowerCase()}`

      if (!validExts.includes(ext)) {
        setError("Only .mp4, .ply, .glb and .gltf files are accepted.")
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
    <div className="w-full max-w-xl mx-auto">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-2xl p-16 text-center
          transition-all duration-300 cursor-pointer group
          ${dragging
            ? "border-violet-400 bg-violet-500/10 scale-[1.02]"
            : "border-neutral-700 bg-neutral-900/50"
          }
          ${uploading ? "pointer-events-none" : "hover:border-violet-400/60 hover:bg-neutral-800/50"}
          backdrop-blur-sm
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

        <div className="flex flex-col items-center gap-4">
          <div className={`
            w-12 h-12 rounded-xl flex items-center justify-center
            transition-colors duration-300
            ${uploading ? "bg-violet-500/20 text-violet-400" : "bg-neutral-800 text-neutral-400 group-hover:bg-violet-500/20 group-hover:text-violet-400"}
          `}>
            {uploading ? (
              <svg className="w-6 h-6 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            ) : (
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            )}
          </div>

          <div>
            <p className="text-lg font-medium text-neutral-200">
              {uploading && !processing
                ? "Uploading capture…"
                : processing
                  ? "Processing — hang tight…"
                  : "Drop a spatial capture here"}
            </p>
            <p className="text-sm text-neutral-500 mt-1">
              {uploading || processing ? "" : ".mp4, .ply, .glb or .gltf"}
            </p>
          </div>

          {(uploading || processing) && (
            <div className="w-64 h-1.5 rounded-full bg-neutral-800 overflow-hidden mt-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="text-red-400 mt-4 text-sm text-center bg-red-500/5 border border-red-500/20 rounded-lg py-2">{error}</p>
      )}
    </div>
  )
}
