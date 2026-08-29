"use client"

import { useEffect, useState } from "react"
import { loadArchive, deleteWorld, type ArchiveEntry } from "@/lib/archive"

interface ArchivePanelProps {
  open: boolean
  onClose: () => void
  onLoad: (entry: ArchiveEntry) => void
}

export function ArchivePanel({ open, onClose, onLoad }: ArchivePanelProps) {
  const [entries, setEntries] = useState<ArchiveEntry[]>([])

  useEffect(() => {
    if (open) loadArchive().then(setEntries)
  }, [open])

  if (!open) return null

  const handleDelete = async (id: string) => {
    setEntries(await deleteWorld(id))
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-10">
          <div>
            <p className="text-[10px] tracking-[0.4em] uppercase text-neutral-600">
              memory archive
            </p>
            <h2 className="mt-2 text-lg font-light text-neutral-300 tracking-wide">
              Places you&apos;ve been
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-xs text-neutral-500 hover:text-neutral-300 uppercase tracking-[0.3em] transition-colors"
          >
            close
          </button>
        </div>

        {entries.length === 0 ? (
          <p className="text-xs text-neutral-600 tracking-[0.2em] uppercase text-center py-24">
            no saved memories yet — worlds you remember appear here
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {entries.map((e) => {
              const thumb = e.views?.front ?? e.image
              return (
                <div
                  key={e.id}
                  className="group border border-neutral-800/40 hover:border-neutral-700/60 transition-colors"
                >
                  <button
                    onClick={() => onLoad(e)}
                    className="block w-full text-left"
                  >
                    {thumb && (
                      <div className="aspect-video overflow-hidden bg-[#0a0a12]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={thumb}
                          alt={e.prompt ?? "memory"}
                          className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity duration-700"
                        />
                      </div>
                    )}
                    <div className="px-4 py-3">
                      <p className="text-xs text-neutral-400 truncate">
                        {e.prompt ?? "photo memory"}
                      </p>
                      <p className="text-[9px] tracking-[0.25em] uppercase text-neutral-700 mt-1">
                        {e.mood ?? "lucid"} · {e.kind} ·{" "}
                        {new Date(e.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleDelete(e.id)}
                    className="w-full px-4 pb-3 text-left text-[9px] tracking-[0.3em] uppercase text-neutral-800 hover:text-red-400/70 transition-colors"
                  >
                    forget
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
