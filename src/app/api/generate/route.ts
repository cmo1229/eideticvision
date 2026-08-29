import { NextRequest, NextResponse } from "next/server"
import { generateImageToVideo, generateTextToVideo } from "@/lib/services/runway"
import { getMood } from "@/lib/moods"

export const maxDuration = 300

// Base Eidetic aesthetic — matches the homepage video: dark, atmospheric,
// cinematic haze with subtle violet/cyan glow and drifting particles
const EIDETIC_STYLE =
  "dark moody atmosphere, cinematic, volumetric haze, low-key lighting, floating dust particles, subtle violet and cyan glow, filmic grain, slow subtle camera drift"

/* ------------------------------------------------------------------ */
/*  Credit guardrails                                                   */
/* ------------------------------------------------------------------ */
// Each Runway generation costs ~60 credits. These caps stop runaway
// usage (refresh loops, bots, crowds) from draining the account.
// Note: counters are per serverless instance — imperfect, but catches
// bursts, which is where the real risk lives. Client silently falls
// back to the free image pipeline on 429.

const DAILY_LIMIT = Number(process.env.RUNWAY_DAILY_LIMIT ?? 15)
const HOURLY_PER_IP = Number(process.env.RUNWAY_HOURLY_PER_IP ?? 3)

const dailyCount = { date: "", count: 0 }
const ipCounts = new Map<string, { hour: number; count: number }>()

function currentHour() {
  return Math.floor(Date.now() / 3_600_000)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function checkBudget(ip: string): { ok: true } | { ok: false; reason: string } {
  // Daily global cap
  const d = today()
  if (dailyCount.date !== d) {
    dailyCount.date = d
    dailyCount.count = 0
  }
  if (dailyCount.count >= DAILY_LIMIT) {
    return { ok: false, reason: "Daily video budget reached — memories still work in image mode" }
  }

  // Per-IP hourly cap
  const h = currentHour()
  const rec = ipCounts.get(ip)
  if (!rec || rec.hour !== h) {
    ipCounts.set(ip, { hour: h, count: 1 })
  } else if (rec.count >= HOURLY_PER_IP) {
    return { ok: false, reason: "Hourly limit reached for this connection — memories still work in image mode" }
  } else {
    rec.count += 1
  }

  // Only count against daily budget once all checks pass
  dailyCount.count += 1
  return { ok: true }
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  )
}

/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { imageUrl, promptText, prompt, style, mood, duration } = body

    const selectedMood = getMood(mood as string)

    // Text-to-video: generate a world from a text description
    if (promptText) {
      // Mood wraps the user prompt, then the base Eidetic aesthetic
      const styledPrompt = `${promptText}, ${selectedMood.prompt}, ${EIDETIC_STYLE}`

      const budget = checkBudget(clientIp(req))
      if (!budget.ok) {
        return NextResponse.json(
          { error: budget.reason, videoSkipped: true },
          { status: 429 }
        )
      }

      const output = await generateTextToVideo(styledPrompt, duration ?? 5)
      return NextResponse.json({ videoUrls: output, type: "text", mood: selectedMood.id })
    }

    // Image-to-video: generate from an uploaded image
    if (imageUrl) {
      // Style suffix from the selected mood + base aesthetic
      const resolvedPrompt = prompt ?? `${selectedMood.prompt}, ${EIDETIC_STYLE}`

      const budget = checkBudget(clientIp(req))
      if (!budget.ok) {
        return NextResponse.json(
          { error: budget.reason, videoSkipped: true },
          { status: 429 }
        )
      }

      const output = await generateImageToVideo(
        imageUrl,
        resolvedPrompt,
        duration ?? 5
      )

      return NextResponse.json({ videoUrls: output, type: "image", mood: selectedMood.id })
    }

    return NextResponse.json(
      { error: "imageUrl or promptText required" },
      { status: 400 }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Generation failed"
    console.error("RunwayML generation error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
