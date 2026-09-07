import { NextRequest, NextResponse } from "next/server"

/* ------------------------------------------------------------------ */
/*  POST /api/invite — sends the collaborator invite email via Resend. */
/*  Requires the caller's Supabase JWT (verified against Supabase).    */
/*  If RESEND_API_KEY is not configured, returns the manual invite     */
/*  link so the owner can share it directly — no fake delivery.        */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const jwt = auth.replace(/^Bearer\s+/i, "")

  if (!jwt) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  // Verify the caller's session with Supabase
  const verify = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
        Authorization: `Bearer ${jwt}`,
      },
    }
  )
  if (!verify.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const to = body?.to as string | undefined
  const placeName = body?.placeName as string | undefined
  const inviterName = (body?.inviterName as string | undefined) ?? "Someone"
  const role = (body?.role as string | undefined) ?? "contributor"
  const token = body?.token as string | undefined

  if (!to || !placeName || !token || !to.includes("@")) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 })
  }

  const acceptUrl = `${req.nextUrl.origin}/invite/${token}`

  // Email delivery not configured — return the manual link honestly
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "email-not-configured", acceptUrl },
      { status: 503 }
    )
  }

  const from = process.env.INVITE_FROM ?? "Eidetic Vision <onboarding@resend.dev>"
  const roleText = role === "viewer" ? "view" : "contribute to"

  const send = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `${inviterName} invited you to ${placeName} — Eidetic Vision`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #060607; color: #e8e2d4;">
          <p style="font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase; color: #8a8066; margin: 0 0 24px;">Eidetic Vision</p>
          <p style="font-size: 18px; font-weight: 300; line-height: 1.6; color: #f5efe2; margin: 0 0 16px;">
            ${inviterName} invited you to ${roleText} <strong style="font-weight: 500;">${placeName}</strong> — a place kept as a spatial archive, with its memories and the people who remember it.
          </p>
          <p style="margin: 32px 0;">
            <a href="${acceptUrl}" style="display: inline-block; padding: 14px 28px; border: 1px solid #c9bda4; color: #f5efe2; text-decoration: none; font-size: 12px; letter-spacing: 0.25em; text-transform: uppercase;">
              Open the invitation
            </a>
          </p>
          <p style="font-size: 12px; color: #6a655a; line-height: 1.6;">
            Or paste this link into your browser:<br />
            <span style="color: #c9bda4;">${acceptUrl}</span>
          </p>
          <p style="font-size: 11px; color: #4a463e; margin-top: 32px;">
            If you weren't expecting this, you can ignore it — nothing happens unless you open the link.
          </p>
        </div>
      `,
    }),
  })

  if (!send.ok) {
    const detail = await send.text().catch(() => "")
    return NextResponse.json(
      { error: `email failed: ${send.status}`, detail: detail.slice(0, 200), acceptUrl },
      { status: 502 }
    )
  }

  return NextResponse.json({ sent: true })
}
