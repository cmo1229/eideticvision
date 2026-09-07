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
}

export async function getCloudUser(): Promise<CloudUser | null> {
  if (!isCloudConfigured()) return null
  const supabase = getSupabase()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return null
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", data.user.id)
    .single()
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    displayName: profile?.display_name ?? data.user.email?.split("@")[0] ?? "someone",
  }
}

export async function sendMagicLink(email: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/explore` },
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

/* ---------------- Publishing ---------------- */

export interface PublishResult {
  cloudId: string
  splatUrl: string | null
}

function mapPlaceToRow(place: Place, ownerId: string) {
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
    is_public: true,
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

/** Sync a local place to the cloud (create or update).
 *  makePublic=false → shared privately with invited members only.
 *  makePublic=true  → listed in the public archive.
 *  First sync copies the memories; afterwards the cloud copy is the
 *  source of truth (owner + contributors write to it directly). */
export async function syncPlaceToCloud(
  place: Place,
  memories: Memory[],
  splatBlob: Blob | null,
  makePublic: boolean
): Promise<PublishResult> {
  const supabase = getSupabase()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) throw new Error("sign in first")
  if (place.id.startsWith("cloud-")) throw new Error("cloud places cannot be synced again")

  const existingId = place.cloudId
  const row = mapPlaceToRow(place, user.id)
  row.is_public = makePublic

  // Upload cover
  if (place.coverImageUrl?.startsWith("data:")) {
    const path = `${user.id}/${place.id}-cover.jpg`
    const blob = await (await fetch(place.coverImageUrl)).blob()
    const { error } = await supabase.storage.from("covers").upload(path, blob, {
      contentType: "image/jpeg",
      upsert: true,
    })
    if (error) throw new Error(`cover upload failed: ${error.message}`)
    row.cover_url = supabase.storage.from("covers").getPublicUrl(path).data.publicUrl
  }

  // Upload splat
  let splatUrl: string | null = null
  if (splatBlob) {
    const ext = place.splatName?.split(".").pop() ?? "ply"
    const path = `${user.id}/${place.id}.${ext}`
    const { error } = await supabase.storage.from("splats").upload(path, splatBlob, {
      upsert: true,
    })
    if (error) throw new Error(`capture upload failed: ${error.message}`)
    splatUrl = supabase.storage.from("splats").getPublicUrl(path).data.publicUrl
    row.splat_url = splatUrl
  }

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

/** Publish (list publicly) or unpublish (keep cloud-shared, hide from archive). */
export async function setPlacePublic(cloudId: string, isPublic: boolean): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from("places").update({ is_public: isPublic }).eq("id", cloudId)
  if (error) throw new Error(`update failed: ${error.message}`)
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
  members: Array<{ name: string; email: string; role: "contributor" | "viewer"; userId: string }>
  invites: PlaceInvite[]
  isOwner: boolean
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

  const { data: members } = await supabase
    .from("place_members")
    .select("user_id, role, profiles(display_name)")
    .eq("place_id", cloudId)

  const { data: place } = await supabase
    .from("places")
    .select("owner_id")
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
      name: ((m.profiles as Record<string, unknown> | null)?.display_name as string) || "someone",
      email: "",
    })),
    invites,
    isOwner,
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
  return (data as InvitePreview | null) ?? null
}

/** Signed-in user's cloud places — owned or shared with them (RLS-scoped). */
export async function fetchMyCloudPlaces(): Promise<Array<PublicPlaceCard & { isPublic: boolean; ownerId: string }>> {
  if (!isCloudConfigured()) return []
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("places")
    .select("id, owner_id, name, location, description, start_year, end_year, end_open, cover_url, splat_url, is_public, created_at, memories(count), place_members(count)")
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
  }))
}

/** Add a memory directly to a cloud place (owner or invited contributor). */
export async function addCloudMemory(cloudId: string, memory: Memory): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from("memories").insert(mapMemoryToRow(memory, cloudId))
  if (error) throw new Error(`could not save memory: ${error.message}`)
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
