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

  const uploadToSupabase = useCallback(
    async (file: File) => {
      setUploading(true)
      setProgress(0)
      setError(null)

      const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || "captures"
      const ext = file.name.split(".").pop()
      const uniqueName = `${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await getSupabase().storage
        .from(bucket)
        .upload(uniqueName, file, {
          cacheControl: "3600",
          upsert: false,
        })

      if (uploadError) throw uploadError

      setProgress(50)

      const { publicUrl } = getSupabase().storage.from(bucket).getPublicUrl(uniqueName).data

      return { publicUrl, uniqueName }
    },
    []
  )

  const triggerProcessing = useCallback(
    async (publicUrl: string, uniqueName: string) => {
      setProcessing(true)
      setProgress(75)

      const { data } = await axios.post("/api/process", {
        fileUrl: publicUrl,
        fileName: uniqueName,
      })

      setProgress(100)
      return data.resultUrl
    },
    []
  )

  const handleFile = useCallback(
    async (file: File) => {
      const validTypes = ["video/mp4", "application/octet-stream"]
      const validExts = [".mp4", ".ply"]
      const ext = `.${file.name.split(".").pop()?.toLowerCase()}`

      if (!validExts.includes(ext)) {
        setError("Only .mp4 and .ply files are accepted.")
        return
      }

      try {
        const { publicUrl, uniqueName } = await uploadToSupabase(file)
        const resultUrl = await triggerProcessing(publicUrl, uniqueName)
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
          relative border-2 border-dashed rounded-2xl p-12 text-center
          transition-colors cursor-pointer
          ${dragging ? "border-accent bg-accent/5" : "border-zinc-700"}
          ${uploading ? "pointer-events-none opacity-60" : "hover:border-zinc-500"}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".mp4,.ply"
          className="hidden"
          onChange={onInputChange}
          disabled={uploading}
        />

        <p className="text-lg font-medium text-zinc-200">
          {uploading
            ? "Uploading…"
            : processing
              ? "Processing your capture…"
              : "Drop a spatial capture here"}
        </p>
        <p className="text-sm text-zinc-500 mt-1">
          .mp4 or .ply — large files accepted
        </p>

        {uploading && (
          <div className="mt-6 h-1 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {error && (
        <p className="text-red-400 mt-3 text-sm text-center">{error}</p>
      )}
    </div>
  )
}