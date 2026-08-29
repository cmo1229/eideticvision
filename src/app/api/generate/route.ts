import { NextRequest, NextResponse } from "next/server"
import { generateImageToVideo, generateTextToVideo } from "@/lib/services/runway"
import { getMood } from "@/lib/moods"

export const maxDuration = 300

// Base Eidetic aesthetic — matches the homepage video: dark, atmospheric,
// cinematic haze with subtle violet/cyan glow and drifting particles
const EIDETIC_STYLE =
  "dark moody atmosphere, cinematic, volumetric haze, low-key lighting, floating dust particles, subtle violet and cyan glow, filmic grain, slow subtle camera drift"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { imageUrl, promptText, prompt, style, mood, duration } = body

    const selectedMood = getMood(mood as string)

    // Text-to-video: generate a world from a text description
    if (promptText) {
      // Mood wraps the user prompt, then the base Eidetic aesthetic
      const styledPrompt = `${promptText}, ${selectedMood.prompt}, ${EIDETIC_STYLE}`

      const output = await generateTextToVideo(styledPrompt, duration ?? 5)
      return NextResponse.json({ videoUrls: output, type: "text", mood: selectedMood.id })
    }

    // Image-to-video: generate from an uploaded image
    if (imageUrl) {
      // Style suffix from the selected mood + base aesthetic
      const resolvedPrompt = prompt ?? `${selectedMood.prompt}, ${EIDETIC_STYLE}`

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
