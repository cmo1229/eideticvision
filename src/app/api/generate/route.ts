import { NextRequest, NextResponse } from "next/server"
import { generateImageToVideo, generateTextToVideo } from "@/lib/services/runway"

export const maxDuration = 300

const STYLE_PROMPTS: Record<string, string> = {
  dream: "dreamlike, soft focus, ethereal glow, floating particles, cinematic slow motion",
  noir: "film noir, high contrast, black and white, dramatic shadows, 1940s cinema aesthetic",
  neon: "cyberpunk, neon lights, synthwave, electric colors, Blade Runner aesthetic",
  natural: "natural lighting, golden hour, photorealistic, warm sunlight, serene atmosphere",
  ethereal: "otherworldly, misty, celestial, soft pastels, heavenly atmosphere, floating dust motes",
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { imageUrl, promptText, prompt, style, duration } = body

    // Text-to-video: generate a world from a text description
    if (promptText) {
      const output = await generateTextToVideo(promptText, duration ?? 5)
      return NextResponse.json({ videoUrls: output, type: "text" })
    }

    // Image-to-video: generate from an uploaded image
    if (imageUrl) {
      const resolvedPrompt =
        prompt ?? STYLE_PROMPTS[style as string] ?? STYLE_PROMPTS.ethereal

      const output = await generateImageToVideo(
        imageUrl,
        resolvedPrompt,
        duration ?? 5
      )

      return NextResponse.json({ videoUrls: output, type: "image" })
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
