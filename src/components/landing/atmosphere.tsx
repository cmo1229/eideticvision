"use client"

import Link from "next/link"

export function Nav({ active }: { active?: "places" | "create" }) {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-sm bg-[#060607]/70 border-b border-neutral-900/60">
      <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="text-[13px] font-light tracking-[0.3em] uppercase text-neutral-300">
          Eidetic Vision
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/places"
            className={`text-[10px] tracking-[0.3em] uppercase transition-colors ${
              active === "places" ? "text-[#e8e2d4]" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            My Places
          </Link>
          <Link
            href="/create"
            className={`text-[10px] tracking-[0.3em] uppercase px-4 py-1.5 border transition-colors ${
              active === "create"
                ? "border-[#c9bda4]/50 text-[#e8e2d4]"
                : "border-neutral-800 text-neutral-300 hover:border-neutral-600"
            }`}
          >
            + Create a Place
          </Link>
        </div>
      </div>
    </nav>
  )
}
