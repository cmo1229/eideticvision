import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 120

const DEPTH_SPACE = "https://depth-anything-depth-anything-v2.hf.space"

async function estimateDepth(imageUrl: string): Promise<string> {
  // Submit the depth estimation task
  const submitRes = await fetch(`${DEPTH_SPACE}/gradio_api/call/on_submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: [{ url: imageUrl, path: null }],
    }),
  })

  if (!submitRes.ok) {
    throw new Error(`Depth space returned ${submitRes.status}`)
  }

  const { event_id } = await submitRes.json() as { event_id: string }

  // Poll SSE endpoint for result
  const sseRes = await fetch(
    `${DEPTH_SPACE}/gradio_api/call/on_submit/${event_id}`
  )

  if (!sseRes.body) {
    throw new Error("No response body from depth space")
  }

  const reader = sseRes.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  const start = Date.now()
  const timeout = 100000 // 100 seconds

  while (Date.now() - start < timeout) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Parse SSE events from buffer
    const lines = buffer.split("\n")
    buffer = ""

    let eventType = ""
    let eventData = ""

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        eventType = line.slice(7).trim()
      } else if (line.startsWith("data: ")) {
        eventData = line.slice(6).trim()
      } else if (line === "" && eventType && eventData) {
        // Complete event
        if (eventType === "heartbeat") {
          // continue waiting
        } else if (eventType === "complete" || eventType === "generating") {
          if (eventData && eventData !== "null") {
            try {
              const parsed = JSON.parse(eventData)
              // Output array: [imageslider, grayscale_file, raw_file]
              if (Array.isArray(parsed) && parsed.length >= 2) {
                const depthFile = parsed[1]
                if (depthFile && typeof depthFile === "object" && depthFile.url) {
                  return depthFile.url as string
                }
              }
            } catch {
              // Partial data, continue
            }
          }
        } else if (eventType === "error") {
          throw new Error(`Depth estimation failed: ${eventData}`)
        }
        eventType = ""
        eventData = ""
      } else if (line !== "" && !line.startsWith(":")) {
        // Continuation line or unstructured - buffer it
        buffer += line + "\n"
      }
    }
  }

  throw new Error("Depth estimation timed out")
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { imageUrl } = body

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl required" }, { status: 400 })
    }

    const depthUrl = await estimateDepth(imageUrl)

    return NextResponse.json({ depthUrl })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Depth estimation failed"
    console.error("Depth estimation error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
