"use client"

/* ------------------------------------------------------------------ */
/*  /invite/[token] — collaborator invitation landing                  */
/*  Preview the invite → sign in with the invited email → join →       */
/*  land in the place.                                                 */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Nav } from "@/components/landing/atmosphere"
import {
  getInvitePreview,
  acceptInvite,
  getCloudUser,
  sendMagicLink,
  completeSignIn,
  type InvitePreview,
  type CloudUser,
} from "@/lib/cloud"


export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<CloudUser | null>(null)
  const [checkedUser, setCheckedUser] = useState(false)
  const [busy, setBusy] = useState(false)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    ;(async () => {
      // Complete magic-link redirect if present
      const completed = await completeSignIn().catch(() => false)
      const u = await getCloudUser().catch(() => null)
      setUser(u)
      setCheckedUser(true)
      try {
        const pv = await getInvitePreview(token)
        if (!pv) {
          setError("This invitation doesn't exist or was removed.")
          return
        }
        setPreview(pv)
        // Already signed in as the right person? Join immediately.
        if (u && completed) await join()
      } catch (e) {
        setError(e instanceof Error ? e.message : "could not open the invitation")
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const join = async () => {
    setJoining(true)
    setError(null)
    try {
      const cloudId = await acceptInvite(token)
      router.push(`/place/cloud-${cloudId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not accept the invitation")
      setJoining(false)
    }
  }

  const handleSendLink = async () => {
    if (!preview) return
    setBusy(true)
    setError(null)
    try {
      await sendMagicLink(preview.email)
      setError(null)
      setPreview({ ...preview }) // re-render shows "link sent" state below
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not send the sign-in link")
    } finally {
      setBusy(false)
    }
  }

  const roleText = preview?.role === "viewer" ? "view" : "contribute to"

  return (
    <main className="min-h-[100dvh] bg-[#060607] text-neutral-200">
      <Nav />
      <section className="max-w-md mx-auto px-6 pt-40 pb-24">
        {error && !preview && (
          <div className="border border-dashed border-neutral-800 p-10 text-center">
            <p className="text-sm text-neutral-300 font-light">{error}</p>
            <Link
              href="/explore"
              className="inline-block mt-6 text-[10px] tracking-[0.3em] uppercase text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              ← explore places
            </Link>
          </div>
        )}

        {preview && (
          <div className="text-center">
            <p className="text-[10px] tracking-[0.4em] uppercase text-[#c9bda4]">invitation</p>
            <h1 className="mt-5 text-2xl font-light text-neutral-50 leading-relaxed">
              {preview.inviterName} invited you to {roleText}{" "}
              <span className="text-[#f5efe2]">{preview.placeName}</span>
            </h1>
            <p className="mt-4 text-sm text-neutral-500 leading-relaxed font-light">
              A place kept as a spatial archive — its rooms, its stories, and the people who
              remember it, pinned to where they happened.
            </p>

            {preview.status === "accepted" ? (
              <div className="mt-10 border border-neutral-800 p-8">
                <p className="text-sm text-neutral-300">
                  You&apos;ve already joined this place.
                </p>
                <button
                  onClick={() => {
                    setBusy(true)
                    getCloudUser()
                      .then(() => acceptInvite(token))
                      .then((id) => router.push(`/place/cloud-${id}`))
                      .catch(() => setBusy(false))
                  }}
                  disabled={busy}
                  className="mt-6 w-full py-3.5 text-[11px] tracking-[0.3em] uppercase border border-[#c9bda4]/40 text-[#f5efe2] bg-[#c9bda4]/[0.06] hover:bg-[#c9bda4]/[0.12] transition-all disabled:opacity-40"
                >
                  {busy ? "opening…" : "open the place"}
                </button>
              </div>
            ) : !checkedUser ? null : !user ? (
              <div className="mt-10 border border-neutral-800 p-8 text-left">
                <p className="text-[9px] tracking-[0.3em] uppercase text-neutral-500 text-center">
                  sign in to join
                </p>
                <p className="mt-4 text-xs text-neutral-500 leading-relaxed text-center">
                  This invite is for{" "}
                  <span className="text-neutral-300">{preview.email}</span>. We&apos;ll email you a
                  one-time sign-in link — open it on this device.
                </p>
                <button
                  onClick={handleSendLink}
                  disabled={busy}
                  className="mt-6 w-full py-3.5 text-[11px] tracking-[0.3em] uppercase border border-[#c9bda4]/40 text-[#f5efe2] bg-[#c9bda4]/[0.06] hover:bg-[#c9bda4]/[0.12] transition-all disabled:opacity-40"
                >
                  {busy ? "sending…" : "email me a sign-in link"}
                </button>
                <p className="mt-4 text-[10px] text-neutral-600 leading-relaxed text-center">
                  {busy ? "check your inbox in a moment…" : "the link signs you in and brings you right back here"}
                </p>
              </div>
            ) : (
              <div className="mt-10 border border-neutral-800 p-8">
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Signed in as <span className="text-neutral-200">{user.email}</span>
                </p>
                {preview.status === "pending" &&
                user.email.toLowerCase() !== preview.email.toLowerCase() ? (
                  <p className="mt-4 text-xs text-red-400/80 leading-relaxed">
                    This invitation was sent to {preview.email} — sign in with that email instead
                    (sign out from the Explore page first).
                  </p>
                ) : (
                  <>
                    <button
                      onClick={join}
                      disabled={joining}
                      className="mt-6 w-full py-3.5 text-[11px] tracking-[0.3em] uppercase border border-[#c9bda4]/40 text-[#f5efe2] bg-[#c9bda4]/[0.06] hover:bg-[#c9bda4]/[0.12] transition-all disabled:opacity-40"
                    >
                      {joining ? "joining…" : `join ${preview.placeName}`}
                    </button>
                    {error && (
                      <p className="mt-4 text-xs text-red-400/80 leading-relaxed">{error}</p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
