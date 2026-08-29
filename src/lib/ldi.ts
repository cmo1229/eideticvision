"use client"

/* ------------------------------------------------------------------ */
/*  Layered Depth Images (LDI)                                          */
/*  Slice an image + depth into feathered cutout layers, each living    */
/*  at its true depth inside the room. Walking separates the layers.    */
/* ------------------------------------------------------------------ */

import { estimateDepth } from "@/lib/depth"

export interface LdiLayer {
  /** RGBA cutout (feathered alpha mask over the original pixels) */
  texture: string
  /** 0 = far, 1 = near — normalized center depth of this layer */
  depth: number
}

export interface LdiResult {
  /** The full original image — drawn on the back of the room */
  backdrop: string
  layers: LdiLayer[]
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("image failed"))
    img.src = src
  })
}

/** Extract an RGBA cutout for one depth band with feathered edges */
function cutLayer(
  src: HTMLImageElement,
  depth: Float32Array,
  dw: number,
  dh: number,
  lo: number,
  hi: number,
  outW: number,
  outH: number
): string {
  // Depth mask at full depth resolution
  const m = document.createElement("canvas")
  m.width = dw
  m.height = dh
  const mctx = m.getContext("2d")!
  const md = mctx.createImageData(dw, dh)
  for (let i = 0; i < dw * dh; i++) {
    const v = depth[i]
    // soft band membership: 1 inside, feather at edges
    let a = 0
    if (v >= lo && v <= hi) {
      a = 1
    } else if (v > hi && v < hi + 0.06) {
      a = 1 - (v - hi) / 0.06
    } else if (v < lo && v > lo - 0.06) {
      a = 1 - (lo - v) / 0.06
    }
    md.data[i * 4] = 255
    md.data[i * 4 + 1] = 255
    md.data[i * 4 + 2] = 255
    md.data[i * 4 + 3] = Math.floor(a * 255)
  }
  mctx.putImageData(md, 0, 0)

  // Feather the mask
  const f = document.createElement("canvas")
  f.width = dw
  f.height = dh
  const fctx = f.getContext("2d")!
  fctx.filter = "blur(3px)"
  fctx.drawImage(m, 0, 0)
  fctx.filter = "none"

  // Composite: original image scaled to output size, masked by feathered alpha
  const out = document.createElement("canvas")
  out.width = outW
  out.height = outH
  const octx = out.getContext("2d")!
  octx.drawImage(src, 0, 0, outW, outH)
  octx.globalCompositeOperation = "destination-in"
  octx.drawImage(f, 0, 0, outW, outH)
  octx.globalCompositeOperation = "source-over"

  return out.toDataURL("image/png")
}

export async function buildLdi(
  imageUrl: string,
  layerCount = 5
): Promise<LdiResult> {
  const img = await loadImage(imageUrl)
  const { depth, width: dw, height: dh } = await estimateDepth(imageUrl)

  const layers: LdiLayer[] = []
  const outW = Math.min(1024, img.width)
  const outH = Math.round(outW * (img.height / img.width))

  // Skip the deepest band — it stays as the flat backdrop.
  // Slice [0 .. 0.85] into layerCount bands, far to near.
  for (let i = 0; i < layerCount; i++) {
    const hi = 0.85 - (i * 0.85) / layerCount
    const lo = 0.85 - ((i + 1) * 0.85) / layerCount
    const texture = cutLayer(img, depth, dw, dh, lo, hi, outW, outH)
    layers.push({ texture, depth: (lo + hi) / 2 })
  }

  // Near→far ordering (render order)
  layers.reverse()

  return { backdrop: imageUrl, layers }
}
