"use client"

/* ------------------------------------------------------------------ */
/*  A public profile — a name and the places that person listed.       */
/*                                                                     */
/*  Reached at /@handle (rewritten to /u/handle; "@" cannot be a real  */
/*  App Router segment). There is no directory: a profile is only      */
/*  reachable if someone gives you the link.                           */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Nav } from "@/components/landing/atmosphere"
import { ArchiveCard } from "@/components/archive-card"
import { fetchPublicProfile, isCloudConfigured, type PublicProfile } from "@/lib/cloud"

export default function ProfilePage() {
  const params = useParams()
  const handle = decodeURIComponent((params.handle as string) ?? "")
  const cloudReady = isCloudConfigured()
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const missing = notFound || !cloudReady || !handle

  useEffect(() => {
    if (!cloudReady || !handle) return
    let alive = true
    fetchPublicProfile(handle)
      .then((p) => {
        if (!alive) return
        if (p) setProfile(p)
        else setNotFound(true)
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "could not load the profile"))
    return () => {
      alive = false
    }
  }, [handle, cloudReady])

  return (
    <main className="min-h-[100dvh] bg-[#060607] text-neutral-200">
      <Nav />

      <section className="max-w-5xl mx-auto px-6 pt-28 pb-24">
        {error && (
          <div className="border border-dashed border-neutral-800 p-12 text-center">
            <p className="text-sm text-neutral-400 leading-relaxed">
              This profile could not be reached ({error}).
            </p>
          </div>
        )}

        {missing && !error && (
          <div className="border border-dashed border-neutral-800 p-12 text-center">
            <p className="text-base text-neutral-200 font-light">Nobody here by that name.</p>
            <p className="mt-3 text-sm text-neutral-500 leading-relaxed max-w-md mx-auto">
              {cloudReady
                ? `@${handle} isn't a profile. Profiles are private links — you need the exact one someone gave you.`
                : "Profiles open when the archive backend is connected."}
            </p>
            <Link
              href="/explore"
              className="inline-block mt-7 text-[10px] tracking-[0.3em] uppercase border border-neutral-800 px-5 py-2.5 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200 transition-colors"
            >
              the public archive
            </Link>
          </div>
        )}

        {!profile && !missing && !error && (
          <p className="text-xs tracking-[0.3em] uppercase text-neutral-500">loading…</p>
        )}

        {profile && (
          <>
            <p className="text-[11px] tracking-[0.4em] uppercase text-neutral-500">profile</p>
            <h1 className="mt-4 text-3xl md:text-4xl font-light text-neutral-50 tracking-wide">
              {profile.displayName}
            </h1>
            {/* handles are slugs — the uppercase used for labels mangles them */}
            <p className="mt-3 text-[11px] tracking-[0.3em] text-[#c9bda4]">
              @{profile.handle}
            </p>

            <div className="mt-14">
              <p className="text-xs tracking-[0.35em] uppercase text-[#c9bda4]">
                places they&apos;re part of
              </p>

              {profile.places.length === 0 ? (
                <div className="mt-5 border border-dashed border-neutral-800 p-12 text-center">
                  <p className="text-base text-neutral-200 font-light">
                    Nothing listed yet.
                  </p>
                  <p className="mt-3 text-sm text-neutral-500 leading-relaxed max-w-md mx-auto">
                    A place appears here once its keeper has listed it in the archive. Nothing
                    private ever shows up.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {profile.places.map((p, i) => (
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
                      note={p.owned ? undefined : "contributed"}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  )
}
