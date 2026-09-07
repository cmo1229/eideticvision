"use client"

/* ------------------------------------------------------------------ */
/*  Explore — the public archive directory                             */
/*  Your places on top; published places from everyone below.          */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react"
import Link from "next/link"
import { Nav } from "@/components/landing/atmosphere"
import { loadPlaces, loadMemories, type Place } from "@/lib/places"
import {
  fetchPublicPlaces,
  completeSignIn,
  isCloudConfigured,
  type PublicPlaceCard,
} from "@/lib/cloud"

function ArchiveCard({
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
        <h3 className="text-sm text-neutral-100 font-light">{name}</h3>
        {location && (
          <p className="mt-1 text-[10px] tracking-[0.25em] uppercase text-neutral-500">{location}</p>
        )}
        <p className="mt-1 text-[10px] tracking-[0.25em] uppercase text-neutral-600">{years}</p>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[10px] tracking-[0.2em] uppercase text-neutral-500">
            {memories} memories · {contributors} voice{contributors !== 1 ? "s" : ""}
          </p>
          <span className="text-[9px] tracking-[0.25em] uppercase text-neutral-600 group-hover:text-[#e8e2d4] transition-colors">
            enter →
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function ExplorePage() {
  const [myPlaces, setMyPlaces] = useState<Place[]>([])
  const [publicPlaces, setPublicPlaces] = useState<PublicPlaceCard[] | null>(null)
  const [cloudError, setCloudError] = useState<string | null>(null)
  const cloudReady = isCloudConfigured()

  useEffect(() => {
    // Complete magic-link sign-in if we were redirected back with a code
    completeSignIn().catch(() => {})
    // Intentional mount-time load from localStorage (client-only data)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMyPlaces(loadPlaces())
    if (cloudReady) {
      fetchPublicPlaces()
        .then(setPublicPlaces)
        .catch((e) => setCloudError(e.message))
    }
  }, [cloudReady])

  return (
    <main className="min-h-[100dvh] bg-[#060607] text-neutral-200">
      <Nav active="explore" />

      <section className="max-w-5xl mx-auto px-6 pt-32 pb-24">
        <p className="text-[10px] tracking-[0.4em] uppercase text-neutral-600">explore</p>
        <h1 className="mt-4 text-2xl font-extralight text-neutral-100 tracking-wide">
          The archive of places people kept.
        </h1>

        {/* ---------- Your places (on this device) ---------- */}
        {myPlaces.length > 0 && (
          <div className="mt-12">
            <div className="flex items-baseline justify-between">
              <p className="text-[10px] tracking-[0.35em] uppercase text-[#c9bda4]/80">your places</p>
              <Link
                href="/places"
                className="text-[9px] tracking-[0.25em] uppercase text-neutral-600 hover:text-neutral-400 transition-colors"
              >
                manage →
              </Link>
            </div>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {myPlaces.map((p, i) => (
                <ArchiveCard
                  key={p.id}
                  name={p.name}
                  location={p.location}
                  years={`${p.startYear}–${p.endOpen ? "Present" : p.endYear}`}
                  memories={loadMemories(p.id).length}
                  contributors={p.members.length}
                  coverUrl={p.coverImageUrl}
                  href={`/place/${p.id}`}
                  index={i}
                />
              ))}
            </div>
          </div>
        )}

        {/* ---------- The public archive ---------- */}
        <div className="mt-20">
          <p className="text-[10px] tracking-[0.35em] uppercase text-[#c9bda4]/80">
            the public archive
          </p>

          {!cloudReady && (
            <div className="mt-6 border border-dashed border-neutral-800 p-12 text-center">
              <p className="text-sm text-neutral-300 font-light">
                The public archive opens when the archive backend is connected.
              </p>
              <p className="mt-3 text-xs text-neutral-600 leading-relaxed max-w-md mx-auto">
                Places are private on this device until then. When the archive opens, you&apos;ll be
                able to publish a place — its rooms, its memories, its voices — for anyone to walk
                through.
              </p>
            </div>
          )}

          {cloudReady && publicPlaces === null && !cloudError && (
            <p className="mt-6 text-xs tracking-[0.3em] uppercase text-neutral-600">
              opening the archive…
            </p>
          )}

          {cloudError && (
            <div className="mt-6 border border-dashed border-neutral-800 p-12 text-center">
              <p className="text-xs text-neutral-500 leading-relaxed">
                The archive could not be reached ({cloudError}).
              </p>
            </div>
          )}

          {publicPlaces !== null && publicPlaces.length === 0 && (
            <div className="mt-6 border border-dashed border-neutral-800 p-12 text-center">
              <p className="text-sm text-neutral-300 font-light">
                Nothing published yet.
              </p>
              <p className="mt-3 text-xs text-neutral-600 leading-relaxed max-w-md mx-auto">
                Open one of your places, sign in, and publish it — the rooms, the memories, and
                everyone&apos;s voices stay together.
              </p>
            </div>
          )}

          {publicPlaces !== null && publicPlaces.length > 0 && (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {publicPlaces.map((p, i) => (
                <ArchiveCard
                  key={p.id}
                  name={p.name}
                  location={p.location}
                  years={`${p.startYear}–${p.endOpen ? "Present" : p.endYear}`}
                  memories={p.memoryCount}
                  contributors={p.contributorCount}
                  coverUrl={p.coverUrl}
                  href={`/place/cloud-${p.id}`}
                  index={i}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
