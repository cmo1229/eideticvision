import { NextRequest, NextResponse } from "next/server"
import { getMood } from "@/lib/moods"

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { prompt, mood, width, height } = body

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "prompt required" }, { status: 400 })
    }

    const selectedMood = getMood(mood as string)
    const styledPrompt = `${prompt.trim()}, ${selectedMood.prompt}`

    const w = Math.min(2048, Math.max(256, Number(width) || 1280))
    const h = Math.min(2048, Math.max(256, Number(height) || 960))
    const seed = Math.floor(Math.random() * 999999)

    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(styledPrompt)}?width=${w}&height=${h}&nologo=true&seed=${seed}`

    const upstream = await fetch(url, {
      headers: { "User-Agent": "EideticVision/0.1" },
      signal: AbortSignal.timeout(110_000),
    })

    if (!upstream.ok) {
      throw new Error(`Image generation upstream failed (${upstream.status})`)
    }

    const buffer = await upstream.arrayBuffer()
    const contentType = upstream.headers.get("content-type") ?? "image/jpeg"

    if (!contentType.startsWith("image/")) {
      throw new Error("Upstream did not return an image")
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Image generation failed"
    console.error("Pollinations generation error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
