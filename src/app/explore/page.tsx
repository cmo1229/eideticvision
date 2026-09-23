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
  fetchMyCloudPlaces,
  getCloudUser,
  completeSignIn,
  isCloudConfigured,
  type PublicPlaceCard,
} from "@/lib/cloud"
import { ArchiveCard } from "@/components/archive-card"

export default function ExplorePage() {
  const [myPlaces, setMyPlaces] = useState<Place[]>([])
  const [cloudPlaces, setCloudPlaces] = useState<Array<PublicPlaceCard & { isPublic: boolean; isListed: boolean; ownerId: string }>>([])
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
      getCloudUser()
        .then(async (u) => {
          if (!u) return
          setCloudPlaces(await fetchMyCloudPlaces().catch(() => []))
        })
        .catch(() => {})
    }
  }, [cloudReady])

  const localCloudIds = new Set(myPlaces.map((p) => p.cloudId).filter(Boolean))
  const sharedCloudPlaces = cloudPlaces.filter((p) => !localCloudIds.has(p.id))

  return (
    <main className="min-h-[100dvh] bg-[#060607] text-neutral-200">
      <Nav active="explore" />

      <section className="max-w-5xl mx-auto px-6 pt-28 pb-24">
        <p className="text-[11px] tracking-[0.4em] uppercase text-neutral-500">explore</p>
        <h1 className="mt-4 text-3xl md:text-4xl font-light text-neutral-50 tracking-wide">
          The archive of places people kept.
        </h1>

        {/* ---------- Your places (on this device + shared with you) ---------- */}
        {(myPlaces.length > 0 || sharedCloudPlaces.length > 0) && (
          <div className="mt-14">
            <div className="flex items-baseline justify-between">
              <p className="text-xs tracking-[0.35em] uppercase text-[#c9bda4]">your places</p>
              <Link
                href="/places"
                className="text-[10px] tracking-[0.25em] uppercase text-neutral-400 hover:text-neutral-200 transition-colors"
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
              {sharedCloudPlaces.map((p, i) => (
                <ArchiveCard
                  key={p.id}
                  name={p.name}
                  location={p.location}
                  years={`${p.startYear}–${p.endOpen ? "Present" : p.endYear}`}
                  memories={p.memoryCount}
                  contributors={Math.max(1, p.contributorCount)}
                  coverUrl={p.coverUrl}
                  href={`/place/cloud-${p.id}`}
                  index={myPlaces.length + i}
                />
              ))}
            </div>
          </div>
        )}

        {/* ---------- The public archive ---------- */}
        <div className="mt-20">
          <p className="text-xs tracking-[0.35em] uppercase text-[#c9bda4]">
            the public archive
          </p>

          {!cloudReady && (
            <div className="mt-7 border border-dashed border-neutral-800 p-12 text-center">
              <p className="text-base text-neutral-200 font-light">
                The public archive opens when the archive backend is connected.
              </p>
              <p className="mt-3 text-sm text-neutral-500 leading-relaxed max-w-md mx-auto">
                Places are private on this device until then. When the archive opens, you&apos;ll be
                able to publish a place — its rooms, its memories, its voices — for anyone to walk
                through.
              </p>
            </div>
          )}

          {cloudReady && publicPlaces === null && !cloudError && (
            <p className="mt-7 text-xs tracking-[0.3em] uppercase text-neutral-500">
              opening the archive…
            </p>
          )}

          {cloudError && (
            <div className="mt-7 border border-dashed border-neutral-800 p-12 text-center">
              <p className="text-sm text-neutral-400 leading-relaxed">
                The archive could not be reached ({cloudError}).
              </p>
            </div>
          )}

          {publicPlaces !== null && publicPlaces.length === 0 && (
            <div className="mt-7 border border-dashed border-neutral-800 p-12 text-center">
              <p className="text-base text-neutral-200 font-light">
                Nothing published yet.
              </p>
              <p className="mt-3 text-sm text-neutral-500 leading-relaxed max-w-md mx-auto">
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
