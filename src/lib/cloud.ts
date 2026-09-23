"use client"

/* ------------------------------------------------------------------ */
/*  Cloud layer — Supabase auth + public archive                       */
/*                                                                     */
/*  Private by default: places live on-device until the owner signs    */
/*  in and explicitly publishes. Publishing uploads the full archive   */
/*  (splat, memories, timeline) and lists it in /explore.              */
/*                                                                     */
/*  If Supabase env vars are absent (backend not connected yet), every */
/*  function reports it honestly — no fake data.                       */
/* ------------------------------------------------------------------ */

import { getSupabase } from "@/lib/supabase"
import type { Place, Memory } from "@/lib/places"

export function isCloudConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith("http") &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

/* ---------------- Auth (magic link) ---------------- */

export interface CloudUser {
  id: string
  email: string
  displayName: string
  /** Public profile slug. Null until migration-5 has run. */
  handle: string | null
}

export async function getCloudUser(): Promise<CloudUser | null> {
  if (!isCloudConfigured()) return null
  const supabase = getSupabase()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return null
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, handle")
    .eq("id", data.user.id)
    .single()
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    displayName: profile?.display_name ?? data.user.email?.split("@")[0] ?? "someone",
    handle: (profile?.handle as string | null) ?? null,
  }
}

export async function sendMagicLink(email: string, redirectTo?: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo ?? `${window.location.origin}/explore` },
  })
  if (error) throw new Error(error.message)
}

export async function signOut(): Promise<void> {
  if (!isCloudConfigured()) return
  await getSupabase().auth.signOut()
}

/** Handle the ?code=... redirect from a magic-link click. */
export async function completeSignIn(): Promise<boolean> {
  if (!isCloudConfigured()) return false
  const supabase = getSupabase()
  if (typeof window === "undefined") return false
  const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href)
  if (error) return false
  return !!data.session
}

/** Notify when the session changes, so UI reflects sign-in without a reload.
 *  The callback is deferred: supabase-js holds a lock while notifying, and
 *  calling back into the client from inside it can deadlock. */
export function watchAuth(onChange: () => void): () => void {
  if (!isCloudConfigured()) return () => {}
  const { data } = getSupabase().auth.onAuthStateChange(() => {
    setTimeout(onChange, 0)
  })
  return () => data.subscription.unsubscribe()
}

/* ---------------- Publishing ---------------- */

/** Who can reach a synced place:
 *  "private" → only the owner and invited members.
 *  "link"    → anyone with the link can read it, anonymously; not listed anywhere.
 *  "listed"  → anonymously readable AND shown in the public archive directory. */
export type PlaceVisibility = "private" | "link" | "listed"

export interface PublishResult {
  cloudId: string
  splatUrl: string | null
}

function mapPlaceToRow(place: Place, ownerId: string, visibility: PlaceVisibility) {
  const row: Record<string, unknown> = {
    owner_id: ownerId,
    name: place.name,
    location: place.location,
    description: place.description,
    start_year: place.startYear,
    end_year: place.endYear,
    end_open: place.endOpen,
    cover_url: place.coverImageUrl ?? null,
    splat_name: place.splatName ?? null,
    splat_format: place.splatFormat ?? null,
    is_public: visibility !== "private",
    is_listed: visibility === "listed",
  }
  return row
}

function mapMemoryToRow(memory: Memory, placeId: string) {
  return {
    place_id: placeId,
    contributor_name: memory.contributorId,
    title: memory.title,
    story: memory.story,
    date: memory.date,
    year: memory.year,
    media_type: memory.mediaType ?? null,
    media_url: memory.mediaUrl ?? null,
    audio_url: memory.audioUrl ?? null,
    position_x: memory.position.x,
    position_y: memory.position.y,
    position_z: memory.position.z,
  }
}

/** Upload progress reporter: phase label + 0..1 percent (null = indeterminate). */
export type SyncProgress = (phase: string, percent: number | null) => void

/** Supabase free plan caps uploads at 50 MB per file. */
const MAX_UPLOAD_BYTES = 49_500_000

/** XHR upload with real progress events (supabase-js upload has none). */
function uploadWithProgress(
  supabaseUrl: string,
  jwt: string,
  anonKey: string,
  bucket: string,
  path: string,
  blob: Blob,
  contentType: string,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", `${supabaseUrl}/storage/v1/object/${bucket}/${path}`)
    xhr.setRequestHeader("apikey", anonKey)
    xhr.setRequestHeader("Authorization", `Bearer ${jwt}`)
    xhr.setRequestHeader("x-upsert", "true")
    xhr.setRequestHeader("Content-Type", contentType)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status < 300) resolve()
      else {
        let detail = ""
        try {
          detail = (JSON.parse(xhr.responseText as string) as { message?: string }).message ?? ""
        } catch {}
        reject(new Error(detail || `upload failed (${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error("upload failed — network error"))
    xhr.send(blob)
  })
}

/** Sync a local place to the cloud (create or update).
 *  visibility="private" → shared privately with invited members only.
 *  visibility="link"    → anyone with the link can read it; not listed.
 *  visibility="listed"  → anonymously readable and listed in the archive.
 *  First sync copies the memories; afterwards the cloud copy is the
 *  source of truth (owner + contributors write to it directly). */
export async function syncPlaceToCloud(
  place: Place,
  memories: Memory[],
  splatBlob: Blob | null,
  visibility: PlaceVisibility,
  onProgress?: SyncProgress
): Promise<PublishResult> {
  const supabase = getSupabase()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) throw new Error("sign in first")
  if (place.id.startsWith("cloud-")) throw new Error("cloud places cannot be synced again")
  const { data: session } = await supabase.auth.getSession()
  const jwt = session.session?.access_token ?? ""
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""

  const existingId = place.cloudId
  const row = mapPlaceToRow(place, user.id, visibility)

  // Honest size check before starting — free plan caps uploads at 50 MB
  const bigFile = [splatBlob, place.coverImageUrl?.startsWith("data:")
    ? await (await fetch(place.coverImageUrl)).blob() : null]
    .find((b): b is Blob => !!b && b.size > MAX_UPLOAD_BYTES)
  if (bigFile) {
    const mb = (bigFile.size / 1024 / 1024).toFixed(1)
    throw new Error(
      `a file is ${mb} MB — Supabase's free plan caps uploads at 50 MB. Export the capture as .spz (much smaller) or upgrade the Supabase plan.`
    )
  }

  // Upload cover
  if (place.coverImageUrl?.startsWith("data:")) {
    onProgress?.("uploading the cover image", 0)
    const path = `${user.id}/${place.id}-cover.jpg`
    const blob = await (await fetch(place.coverImageUrl)).blob()
    await uploadWithProgress(
      supabaseUrl, jwt, anonKey, "covers", path, blob, "image/jpeg",
      (p) => onProgress?.("uploading the cover image", p)
    )
    row.cover_url = supabase.storage.from("covers").getPublicUrl(path).data.publicUrl
  }

  // Upload splat
  let splatUrl: string | null = null
  if (splatBlob) {
    const ext = place.splatName?.split(".").pop() ?? "ply"
    const path = `${user.id}/${place.id}.${ext}`
    const label = `uploading the capture (${(splatBlob.size / 1024 / 1024).toFixed(1)} MB)`
    onProgress?.(label, 0)
    await uploadWithProgress(
      supabaseUrl, jwt, anonKey, "splats", path, splatBlob,
      ext === "spz" ? "application/octet-stream" : "application/octet-stream",
      (p) => onProgress?.(label, p)
    )
    splatUrl = supabase.storage.from("splats").getPublicUrl(path).data.publicUrl
    row.splat_url = splatUrl
  }

  onProgress?.(existingId ? "saving your changes" : "building the archive", null)

  let cloudId: string
  if (existingId) {
    const { error } = await supabase.from("places").update(row).eq("id", existingId)
    if (error) throw new Error(`sync failed: ${error.message}`)
    cloudId = existingId
  } else {
    const { data: inserted, error } = await supabase
      .from("places")
      .insert(row)
      .select("id")
      .single()
    if (error) throw new Error(`sync failed: ${error.message}`)
    cloudId = inserted.id as string

    // First sync: copy the memories over
    const memoryRows = memories
      .filter((m) => m.mediaType !== "video" || (m.mediaUrl && m.mediaUrl.length < 1_800_000))
      .map((m) => mapMemoryToRow(m, cloudId))
    if (memoryRows.length) {
      const { error: memError } = await supabase.from("memories").insert(memoryRows)
      if (memError) throw new Error(`memories upload failed: ${memError.message}`)
    }
  }

  return { cloudId, splatUrl: splatUrl ?? null }
}

/** Turn the read-only share link on or off (is_public). */
export async function setPlacePublic(cloudId: string, isPublic: boolean): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from("places").update({ is_public: isPublic }).eq("id", cloudId)
  if (error) throw new Error(`update failed: ${error.message}`)
}

/** List in or remove from the public archive (is_listed). Listing implies a readable link. */
export async function setPlaceListed(cloudId: string, isListed: boolean): Promise<void> {
  const supabase = getSupabase()
  const patch = isListed ? { is_public: true, is_listed: true } : { is_listed: false }
  const { error } = await supabase.from("places").update(patch).eq("id", cloudId)
  if (error) throw new Error(`update failed: ${error.message}`)
}

/** Update a cloud place's details (owner only).
 *  Pass coverUrl to replace the cover (a public URL) or clear it (null). Omit to leave it alone. */
export async function updateCloudPlace(
  cloudId: string,
  fields: {
    name: string
    location: string
    description: string
    startYear: number
    endYear: number
    endOpen: boolean
    coverUrl?: string | null
  }
): Promise<void> {
  const supabase = getSupabase()
  const patch: Record<string, unknown> = {
    name: fields.name,
    location: fields.location,
    description: fields.description,
    start_year: fields.startYear,
    end_year: fields.endYear,
    end_open: fields.endOpen,
  }
  if ("coverUrl" in fields) patch.cover_url = fields.coverUrl
  const { error } = await supabase.from("places").update(patch).eq("id", cloudId)
  if (error) throw new Error(`update failed: ${error.message}`)
}

/** Upload a downscaled cover (data URL) to the `covers` bucket; returns its public URL.
 *  Reuses syncPlaceToCloud's object path so a replacement overwrites in place — storage has
 *  no delete policy, so a fresh path would orphan the previous file. */
export async function uploadCloudCover(placeId: string, dataUrl: string): Promise<string> {
  const supabase = getSupabase()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) throw new Error("sign in first")
  const { data: session } = await supabase.auth.getSession()
  const jwt = session.session?.access_token ?? ""
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""

  const blob = await (await fetch(dataUrl)).blob()
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error("the cover image is too large")

  const path = `${user.id}/${placeId}-cover.jpg`
  await uploadWithProgress(supabaseUrl, jwt, anonKey, "covers", path, blob, "image/jpeg", () => {})
  return supabase.storage.from("covers").getPublicUrl(path).data.publicUrl
}

/** Remove a published place from the public archive (local copy stays). */
export async function unpublishPlace(cloudId: string): Promise<void> {
  return setPlacePublic(cloudId, false)
}

/* ---------------- Collaboration ---------------- */

export interface PlaceInvite {
  id: string
  email: string
  role: "contributor" | "viewer"
  status: "pending" | "accepted" | "revoked"
  token: string
  createdAt: number
}

export interface PlaceCollab {
  members: Array<{
    name: string
    email: string
    role: "contributor" | "viewer"
    userId: string
    handle: string | null
  }>
  invites: PlaceInvite[]
  isOwner: boolean
  isPublic: boolean
  isListed: boolean
}

/** Invite someone by email: stores the invite (pending) and sends the email. */
export async function inviteMember(
  cloudId: string,
  email: string,
  role: "contributor" | "viewer",
  placeName: string,
  inviterName: string
): Promise<{ emailed: boolean; acceptUrl: string | null }> {
  const supabase = getSupabase()
  const { data: session } = await supabase.auth.getSession()
  const jwt = session.session?.access_token
  if (!jwt) throw new Error("sign in first")

  const { data: inserted, error } = await supabase
    .from("place_invites")
    .insert({ place_id: cloudId, email, role })
    .select("token")
    .single()
  if (error) throw new Error(`invite failed: ${error.message}`)
  const token = inserted.token as string

  // Send the email via our API (falls back to a manual link if unconfigured)
  const api = await fetch("/api/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ to: email, placeName, inviterName, role, token }),
  }).catch(() => null)

  if (api && api.ok) return { emailed: true, acceptUrl: null }
  const payload = api ? await api.json().catch(() => ({})) : {}
  return { emailed: false, acceptUrl: (payload.acceptUrl as string) ?? `/invite/${token}` }
}

/** Revoke a pending invite. */
export async function revokeInvite(inviteId: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from("place_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId)
  if (error) throw new Error(`revoke failed: ${error.message}`)
}

/** Members + invite states for a cloud place (owner sees invites too). */
export async function fetchCollab(cloudId: string): Promise<PlaceCollab> {
  const supabase = getSupabase()
  const user = (await supabase.auth.getUser()).data.user

  // Members come from an RPC: place_members has no FK to profiles for PostgREST
  // to embed, and profiles is readable only by its owner anyway.
  const { data: members } = await supabase.rpc("get_place_members", { p_place_id: cloudId })

  const { data: place } = await supabase
    .from("places")
    .select("owner_id, is_public, is_listed")
    .eq("id", cloudId)
    .single()

  const isOwner = !!user && place?.owner_id === user.id

  let invites: PlaceInvite[] = []
  if (isOwner) {
    const { data: inv } = await supabase
      .from("place_invites")
      .select("id, email, role, status, token, created_at")
      .eq("place_id", cloudId)
      .order("created_at", { ascending: false })
    invites = (inv ?? []).map((i: Record<string, unknown>) => ({
      id: i.id as string,
      email: i.email as string,
      role: i.role as "contributor" | "viewer",
      status: i.status as PlaceInvite["status"],
      token: i.token as string,
      createdAt: new Date(i.created_at as string).getTime(),
    }))
  }

  return {
    members: (members ?? []).map((m: Record<string, unknown>) => ({
      userId: m.user_id as string,
      role: m.role as "contributor" | "viewer",
      name: (m.display_name as string) || "someone",
      email: "",
      handle: (m.handle as string | null) ?? null,
    })),
    invites,
    isOwner,
    isPublic: (place?.is_public as boolean) ?? false,
    isListed: (place?.is_listed as boolean) ?? false,
  }
}

/** Accept an invite (must be signed in with the invited email). Returns the cloud place id. */
export async function acceptInvite(token: string): Promise<string> {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc("accept_invite", { p_token: token })
  if (error) throw new Error(error.message)
  return data as string
}

export interface InvitePreview {
  email: string
  role: "contributor" | "viewer"
  status: "pending" | "accepted" | "revoked"
  placeName: string
  inviterName: string
}

export async function getInvitePreview(token: string): Promise<InvitePreview | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc("get_invite_preview", { p_token: token })
  if (error) throw new Error(error.message)
  if (!data) return null
  // The RPC builds its json with snake_case keys; the invite page reads camelCase.
  const row = data as Record<string, unknown>
  return {
    email: (row.email as string) ?? "",
    role: row.role as InvitePreview["role"],
    status: row.status as InvitePreview["status"],
    placeName: (row.place_name as string) ?? "",
    inviterName: (row.inviter_name as string) ?? "",
  }
}

/** Signed-in user's cloud places — owned or shared with them (RLS-scoped). */
export async function fetchMyCloudPlaces(): Promise<Array<PublicPlaceCard & { isPublic: boolean; isListed: boolean; ownerId: string }>> {
  if (!isCloudConfigured()) return []
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("places")
    .select("id, owner_id, name, location, description, start_year, end_year, end_open, cover_url, splat_url, is_public, is_listed, created_at, memories(count), place_members(count)")
    .order("created_at", { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    ownerId: r.owner_id as string,
    name: r.name as string,
    location: (r.location as string) ?? "",
    description: (r.description as string) ?? "",
    startYear: r.start_year as number,
    endYear: r.end_year as number,
    endOpen: (r.end_open as boolean) ?? false,
    coverUrl: (r.cover_url as string) ?? null,
    hasCapture: !!r.splat_url,
    memoryCount: ((r.memories as Array<{ count: number }> | null)?.[0]?.count) ?? 0,
    contributorCount: ((r.place_members as Array<{ count: number }> | null)?.[0]?.count) ?? 0,
    createdAt: new Date(r.created_at as string).getTime(),
    isPublic: (r.is_public as boolean) ?? false,
    isListed: (r.is_listed as boolean) ?? false,
  }))
}

/** Add a memory directly to a cloud place (owner or invited contributor). */
export async function addCloudMemory(cloudId: string, memory: Memory): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from("memories").insert(mapMemoryToRow(memory, cloudId))
  if (error) throw new Error(`could not save memory: ${error.message}`)
}

/** Edit a cloud memory's text/date (owner or its contributor). */
export async function updateCloudMemory(cloudId: string, memory: Memory): Promise<void> {
  const supabase = getSupabase()
  const rawId = memory.id.replace(/^cloud[:\-]/, "")
  const { error } = await supabase
    .from("memories")
    .update({
      title: memory.title,
      story: memory.story,
      date: memory.date,
      year: memory.year,
    })
    .eq("id", rawId)
    .eq("place_id", cloudId)
  if (error) throw new Error(`could not update memory: ${error.message}`)
}

/** Delete a cloud memory (owner only). memoryId may carry the "cloud:" prefix. */
export async function deleteCloudMemory(cloudId: string, memoryId: string): Promise<void> {
  const supabase = getSupabase()
  const rawId = memoryId.replace(/^cloud[:\-]/, "")
  const { error } = await supabase.from("memories").delete().eq("id", rawId).eq("place_id", cloudId)
  if (error) throw new Error(`could not remove memory: ${error.message}`)
}

/** Permanently delete a cloud place and everything attached to it (owner only). */
export async function deleteCloudPlace(cloudId: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from("places").delete().eq("id", cloudId)
  if (error) throw new Error(`could not delete the place: ${error.message}`)
}

/* ---------------- Public directory ---------------- */

export interface PublicPlaceCard {
  id: string
  name: string
  location: string
  description: string
  startYear: number
  endYear: number
  endOpen: boolean
  coverUrl: string | null
  hasCapture: boolean
  memoryCount: number
  contributorCount: number
  createdAt: number
}

export async function fetchPublicPlaces(): Promise<PublicPlaceCard[]> {
  if (!isCloudConfigured()) throw new Error("cloud-not-configured")
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("public_places")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    location: (r.location as string) ?? "",
    description: (r.description as string) ?? "",
    startYear: r.start_year as number,
    endYear: r.end_year as number,
    endOpen: (r.end_open as boolean) ?? false,
    coverUrl: (r.cover_url as string) ?? null,
    hasCapture: (r.has_capture as boolean) ?? false,
    memoryCount: (r.memory_count as number) ?? 0,
    contributorCount: (r.contributor_count as number) ?? 0,
    createdAt: new Date(r.created_at as string).getTime(),
  }))
}

export interface PublicProfile {
  handle: string
  displayName: string
  places: PublicPlaceCard[]
}

/** A person's public profile: their name and the places they've listed.
 *  Returns null for an unknown handle. There is no people directory — a
 *  profile is only reachable if someone hands you the link. */
export async function fetchPublicProfile(handle: string): Promise<PublicProfile | null> {
  if (!isCloudConfigured()) return null
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc("get_public_profile", { p_handle: handle })
  if (error) throw new Error(error.message)
  if (!data) return null
  const row = data as Record<string, unknown>
  const raw = (row.places as Array<Record<string, unknown>>) ?? []
  return {
    handle: (row.handle as string) ?? handle,
    displayName: (row.display_name as string) || ((row.handle as string) ?? handle),
    places: raw.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      location: (r.location as string) ?? "",
      description: (r.description as string) ?? "",
      startYear: r.start_year as number,
      endYear: r.end_year as number,
      endOpen: (r.end_open as boolean) ?? false,
      coverUrl: (r.cover_url as string) ?? null,
      hasCapture: (r.has_capture as boolean) ?? false,
      memoryCount: (r.memory_count as number) ?? 0,
      contributorCount: (r.contributor_count as number) ?? 0,
      createdAt: 0,
    })),
  }
}

/** A cloud place, mapped into the local viewer's shape. */
export interface CloudPlace {
  place: Place
  memories: Memory[]
  splatUrl: string | null
}

export async function fetchPublicPlace(cloudId: string): Promise<CloudPlace | null> {
  if (!isCloudConfigured()) return null
  const supabase = getSupabase()
  // RLS scopes visibility: public, owned, or shared with the signed-in member
  const { data: p } = await supabase
    .from("places")
    .select("*")
    .eq("id", cloudId)
    .maybeSingle()
  if (!p) return null
  const { data: mems } = await supabase
    .from("memories")
    .select("*")
    .eq("place_id", cloudId)
    .order("year", { ascending: true })

  const memories: Memory[] = (mems ?? []).map((m: Record<string, unknown>) => ({
    id: `cloud:${m.id}`,
    placeId: cloudId,
    contributorId: (m.contributor_name as string) ?? "someone",
    title: m.title as string,
    story: (m.story as string) ?? "",
    date: (m.date as string) ?? String(m.year),
    year: m.year as number,
    mediaType: (m.media_type as "image" | "video") ?? undefined,
    mediaUrl: (m.media_url as string) ?? undefined,
    audioUrl: (m.audio_url as string) ?? undefined,
    position: {
      x: (m.position_x as number) ?? 0.5,
      y: (m.position_y as number) ?? 0.5,
      z: (m.position_z as number) ?? 0,
    },
    createdAt: new Date(m.created_at as string).getTime(),
  }))

  const place: Place = {
    id: `cloud-${p.id}`,
    ownerId: p.owner_id,
    name: p.name,
    location: p.location ?? "",
    description: p.description ?? "",
    startYear: p.start_year,
    endYear: p.end_year,
    endOpen: p.end_open,
    coverImageUrl: p.cover_url ?? undefined,
    hasSplat: !!p.splat_url,
    splatName: p.splat_name ?? undefined,
    splatFormat: p.splat_format ?? undefined,
    members: [...new Set(memories.map((m) => m.contributorId))].map((name) => ({
      id: name,
      name,
      role: "contributor" as const,
    })),
    createdAt: new Date(p.created_at).getTime(),
  }
  return { place, memories, splatUrl: (p.splat_url as string) ?? null }
}

/** Contributors seen across a published place's memories. */
export function distinctContributors(memories: Memory[]): string[] {
  return [...new Set(memories.map((m) => m.contributorId))]
}
