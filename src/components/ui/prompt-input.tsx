"use client"

import { useState, useRef, useCallback } from "react"

interface PromptInputProps {
  onSubmit: (prompt: string) => void
  generating: boolean
  placeholder?: string
  compact?: boolean
}

export function PromptInput({
  onSubmit,
  generating,
  placeholder = "describe a memory...",
  compact = false,
}: PromptInputProps) {
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = value.trim()
      if (!trimmed || generating) return
      onSubmit(trimmed)
      setValue("")
    },
    [value, generating, onSubmit]
  )

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={generating ? "generating..." : placeholder}
          disabled={generating}
          className="flex-1 bg-transparent border-b border-neutral-800/50 px-1 py-1.5 text-xs text-neutral-400 placeholder:text-neutral-700 focus:outline-none focus:border-violet-500/40 transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!value.trim() || generating}
          className="text-[10px] tracking-[0.25em] uppercase text-violet-500/60 hover:text-violet-400 disabled:text-neutral-800 transition-colors shrink-0"
        >
          {generating ? "..." : "generate"}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-lg">
      <div
        className={`
          relative border border-neutral-800/60 rounded-none transition-all duration-700
          ${generating ? "border-violet-500/30 bg-violet-500/[0.02]" : "hover:border-neutral-700 focus-within:border-violet-500/30"}
        `}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="text-neutral-700 text-xs">→</span>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={generating ? "generating your world..." : placeholder}
            disabled={generating}
            className="flex-1 bg-transparent text-xs text-neutral-300 placeholder:text-neutral-600 focus:outline-none disabled:opacity-50 tracking-wide"
          />
          <button
            type="submit"
            disabled={!value.trim() || generating}
            className="text-[10px] tracking-[0.3em] uppercase text-violet-500/60 hover:text-violet-400 disabled:text-neutral-800 transition-colors shrink-0"
          >
            {generating ? "···" : "create"}
          </button>
        </div>

        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-4 h-4 border-l border-t border-neutral-700/30" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-r border-b border-neutral-700/30" />
      </div>
    </form>
  )
}
