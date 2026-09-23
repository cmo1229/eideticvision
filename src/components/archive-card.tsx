"use client"

import Link from "next/link"

/* An archival card for a place: cover, name, place, years, counts. */
export function ArchiveCard({
  name,
  location,
  years,
  memories,
  contributors,
  coverUrl,
  href,
  index,
}: {
  name: string
  location: string
  years: string
  memories: number
  contributors: number
  coverUrl?: string | null
  href: string
  index: number
}) {
  return (
    <Link
      href={href}
      className="group border border-neutral-900 hover:border-neutral-700 transition-colors"
      style={{
        opacity: 1,
        animation: `ev-fade-up 0.7s cubic-bezier(0.16,1,0.3,1) ${Math.min(index, 8) * 70}ms both`,
      }}
    >
      <div className="aspect-video overflow-hidden bg-[#0a0a0c] relative">
        {coverUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={coverUrl}
            alt={name}
            className="w-full h-full object-cover opacity-75 group-hover:opacity-95 group-hover:scale-[1.02] transition-all duration-700"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[10px] tracking-[0.4em] uppercase text-neutral-700 group-hover:text-neutral-600 transition-colors">
              {name}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#060607] via-transparent to-transparent" />
      </div>
      <div className="p-5">
        <h3 className="text-base text-neutral-50 font-light">{name}</h3>
        {location && (
          <p className="mt-1.5 text-[11px] tracking-[0.25em] uppercase text-neutral-400">{location}</p>
        )}
        <p className="mt-1 text-[11px] tracking-[0.25em] uppercase text-neutral-500">{years}</p>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[11px] tracking-[0.2em] uppercase text-neutral-400">
            {memories} memories · {contributors} voice{contributors !== 1 ? "s" : ""}
          </p>
          <span className="text-[10px] tracking-[0.25em] uppercase text-neutral-500 group-hover:text-[#f5efe2] transition-colors">
            enter →
          </span>
        </div>
      </div>
    </Link>
  )
}
