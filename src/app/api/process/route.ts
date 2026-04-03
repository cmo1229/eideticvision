import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { fileUrl, fileName } = body

  if (!fileUrl) return NextResponse.json({ error: "No file URL" }, { status: 400 })

  // The 3D Gaussian Splatting processing is delegated to HuggingFace Spaces
  // via the processWithHuggingFace() helper. The stylization is done client-side
  // via Three.js post-processing effects (bloom, color shift, vignette).
  //
  // TODO: wire up the HuggingFace Space once identified. For now, we return
  // the original upload URL so the viewer can at least render the raw 3D file.
  // The file-uploader already passes the Supabase public URL through.

  try {
    // Placeholder: return the original Supabase upload as the "processed" URL.
    // Once you connect a free Space (see /lib/services/huggingface.ts), uncomment:
    //   const resultUrl = await processWithHuggingFace(fileUrl)
    //   return NextResponse.json({ resultUrl: resultUrl })

    return NextResponse.json({ resultUrl: fileUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Processing failed" }, { status: 500 })
  }
}