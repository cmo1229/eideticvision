"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import {
  getCloudUser,
  sendMagicLink,
  signOut,
  watchAuth,
  updateDisplayName,
  isCloudConfigured,
  type CloudUser,
} from "@/lib/cloud"

/* ------------------------------------------------------------------ */
/*  Account — sign-in state, always visible in the top right           */
/* ------------------------------------------------------------------ */

function Account() {
  const [user, setUser] = useState<CloudUser | null>(null)
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState("")
  const [nameBusy, setNameBusy] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isCloudConfigured()) {
      setReady(true)
      return
    }
    let alive = true
    const load = () => {
      getCloudUser()
        .then((u) => {
          if (!alive) return
          setUser(u)
          setReady(true)
        })
        .catch(() => alive && setReady(true))
    }
    load()
    const stop = watchAuth(load)
    return () => {
      alive = false
      stop()
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const handleSend = async () => {
    if (!email.includes("@")) {
      setError("enter a valid email")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await sendMagicLink(email.trim())
      setSent(true)
      setEmail("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not send the link")
    } finally {
      setBusy(false)
    }
  }

  const handleSaveName = async () => {
    if (!user) return
    setNameBusy(true)
    setNameError(null)
    try {
      await updateDisplayName(name)
      setUser({ ...user, displayName: name.trim() })
      setEditingName(false)
    } catch (e) {
      setNameError(e instanceof Error ? e.message : "could not save the name")
    } finally {
      setNameBusy(false)
    }
  }

  // Keep the nav the same width while auth resolves to avoid a layout jump.
  if (!ready) return <span className="hidden sm:block w-16" aria-hidden="true" />

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        onClick={() => {
          // closing mid-edit shouldn't leave the name form open next time
          if (open) {
            setEditingName(false)
            setNameError(null)
          }
          setOpen(!open)
        }}
        aria-expanded={open}
        aria-label={user ? `Signed in as ${user.email}` : "Sign in"}
        title={user ? `Signed in as ${user.email}` : "Sign in"}
        className={`flex items-center gap-2 text-[10px] tracking-[0.2em] sm:tracking-[0.3em] uppercase py-1.5 transition-colors ${
          open ? "text-[#f5efe2]" : "text-neutral-500 hover:text-neutral-300"
        }`}
      >
        {user ? (
          <>
            <span className="w-5 h-5 rounded-full border border-[#c9bda4]/50 text-[#c9bda4] flex items-center justify-center text-[9px] leading-none">
              {/* flex centres the line box, not the capital: cap height sits above
                  the line box centre. 0.25px is the measured residue — exact at
                  DPR 3 and 4, and no worse than any other value at DPR 1, where
                  the glyph snaps to whole device pixels. */}
              <span className="translate-y-[0.25px]">
                {user.displayName.slice(0, 1).toUpperCase()}
              </span>
            </span>
            <span className="hidden sm:inline max-w-[12ch] truncate normal-case tracking-normal text-[11px] text-neutral-400">
              {user.displayName}
            </span>
          </>
        ) : (
          <>
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4 sm:hidden"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            >
              <circle cx="12" cy="8" r="3.4" />
              <path d="M4.6 20c1.4-3.8 4.1-5.6 7.4-5.6s6 1.8 7.4 5.6" />
            </svg>
            <span className="hidden sm:inline">Sign in</span>
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 w-64 border border-neutral-800 bg-[#0a0a0b]/95 backdrop-blur-md p-4 space-y-3 text-left">
          {user ? (
            <>
              <p className="text-[9px] tracking-[0.3em] uppercase text-neutral-500">signed in</p>
              <p className="text-xs text-neutral-300 break-all">{user.email}</p>

              {/* the name shown on your profile and beside your memories */}
              {editingName ? (
                <>
                  <input
                    type="text"
                    value={name}
                    autoFocus
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveName()
                      if (e.key === "Escape") setEditingName(false)
                    }}
                    placeholder="your name"
                    className="w-full bg-transparent border-b border-neutral-800 px-1 py-2 text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-[#c9bda4]/60 transition-colors"
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={nameBusy}
                    className="w-full py-2.5 text-[10px] tracking-[0.25em] uppercase border border-[#c9bda4]/40 text-[#f5efe2] bg-[#c9bda4]/[0.06] hover:bg-[#c9bda4]/[0.12] transition-all disabled:opacity-40"
                  >
                    {nameBusy ? "saving…" : "save name"}
                  </button>
                  {nameError && (
                    <p className="text-[10px] text-red-400/80 leading-relaxed">{nameError}</p>
                  )}
                </>
              ) : (
                <button
                  onClick={() => {
                    setName(user.displayName)
                    setNameError(null)
                    setEditingName(true)
                  }}
                  className="w-full flex items-center justify-between gap-2 py-2.5 px-1 text-[10px] tracking-[0.25em] uppercase border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200 transition-colors"
                >
                  <span className="truncate normal-case tracking-normal text-[11px]">
                    {user.displayName}
                  </span>
                  <span className="shrink-0">edit</span>
                </button>
              )}

              {user.handle ? (
                <Link
                  href={`/@${user.handle}`}
                  onClick={() => setOpen(false)}
                  className="block py-2.5 text-center text-[10px] tracking-[0.25em] uppercase border border-[#c9bda4]/40 text-[#f5efe2] bg-[#c9bda4]/[0.06] hover:bg-[#c9bda4]/[0.12] transition-all"
                >
                  your profile
                </Link>
              ) : (
                <p className="text-[10px] text-neutral-600 leading-relaxed">
                  Profile links turn on once the archive is set up on your account.
                </p>
              )}
              <button
                onClick={() => {
                  setOpen(false)
                  signOut().then(() => setUser(null))
                }}
                className="w-full py-2.5 text-[10px] tracking-[0.25em] uppercase border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200 transition-colors"
              >
                sign out
              </button>
            </>
          ) : (
            <>
              <p className="text-[9px] tracking-[0.3em] uppercase text-neutral-500">sign in</p>
              {sent ? (
                <p className="text-[11px] text-[#c9bda4]/90 leading-relaxed">
                  Link sent. Open it on this device and you&apos;ll be signed in.
                </p>
              ) : (
                <>
                  <p className="text-[10px] text-neutral-500 leading-relaxed">
                    We&apos;ll email you a one-time link. No password.
                  </p>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="you@email.com"
                    className="w-full bg-transparent border-b border-neutral-800 px-1 py-2 text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-[#c9bda4]/60 transition-colors"
                  />
                  <button
                    onClick={handleSend}
                    disabled={busy}
                    className="w-full py-2.5 text-[10px] tracking-[0.25em] uppercase border border-[#c9bda4]/40 text-[#f5efe2] bg-[#c9bda4]/[0.06] hover:bg-[#c9bda4]/[0.12] transition-all disabled:opacity-40"
                  >
                    {busy ? "sending…" : "email me a link"}
                  </button>
                </>
              )}
              {error && <p className="text-[10px] text-red-400/80 leading-relaxed">{error}</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function Nav({ active }: { active?: "explore" | "places" | "create" }) {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-sm bg-[#060607]/70 border-b border-neutral-900/60">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-3">
        <Link
          href="/"
          className="text-[11px] sm:text-[13px] font-light tracking-[0.2em] sm:tracking-[0.3em] uppercase text-neutral-300 shrink-0"
        >
          Eidetic Vision
        </Link>
        <div className="flex items-center gap-2.5 sm:gap-6">
          <Link
            href="/explore"
            className={`whitespace-nowrap text-[10px] tracking-[0.2em] sm:tracking-[0.3em] uppercase transition-colors ${
              active === "explore" ? "text-[#e8e2d4]" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            Explore
          </Link>
          <Link
            href="/places"
            className={`whitespace-nowrap text-[10px] tracking-[0.2em] sm:tracking-[0.3em] uppercase transition-colors ${
              active === "places" ? "text-[#e8e2d4]" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <span className="sm:hidden">Places</span>
            <span className="hidden sm:inline">My Places</span>
          </Link>
          <Link
            href="/create"
            className={`whitespace-nowrap text-[10px] tracking-[0.2em] sm:tracking-[0.3em] uppercase px-2.5 sm:px-4 py-1.5 border transition-colors shrink-0 ${
              active === "create"
                ? "border-[#c9bda4]/50 text-[#e8e2d4]"
                : "border-neutral-800 text-neutral-300 hover:border-neutral-600"
            }`}
          >
            + Create<span className="hidden sm:inline"> a Place</span>
          </Link>
          <Account />
        </div>
      </div>
    </nav>
  )
}
