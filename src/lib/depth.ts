"use client"

/* ------------------------------------------------------------------ */
/*  Neural depth — Depth Anything v2 running in the browser             */
/*  via transformers.js (WASM, WebGPU when available). Falls back       */
/*  to the heuristic depth estimator if the model can't load.           */
/* ------------------------------------------------------------------ */

let pipelinePromise: Promise<any> | null = null

async function getDepthPipeline(): Promise<any> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers")
      // Models are fetched from the HF CDN and cached by the browser
      env.allowLocalModels = false
      return pipeline("depth-estimation", "Xenova/depth-anything-small-hf", {
        dtype: "fp32",
      })
    })()
    pipelinePromise.catch(() => {
      // Allow retry on next call if load failed
      pipelinePromise = null
    })
  }
  return pipelinePromise
}

export type DepthResult = {
  depth: Float32Array
  width: number
  height: number
  source: "neural" | "heuristic"
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("image load failed"))
    img.src = src
  })
}

/* Heuristic fallback — the original luminance/edge/height estimator */
export function heuristicDepth(img: HTMLImageElement): DepthResult {
  const w = Math.min(img.width, 256)
  const h = Math.min(img.height, Math.floor(w * (img.height / img.width)))

  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(img, 0, 0, w, h)
  const src = ctx.getImageData(0, 0, w, h)

  const depth = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const lum = (src.data[i] * 0.299 + src.data[i + 1] * 0.587 + src.data[i + 2] * 0.114) / 255
      const vertFactor = 1 - y / h
      let contrast = 0
      if (x > 0 && x < w - 1 && y > 0 && y < h - 1) {
        const center = (src.data[i] + src.data[i + 1] + src.data[i + 2]) / 3
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const ni = ((y + dy) * w + (x + dx)) * 4
            const n = (src.data[ni] + src.data[ni + 1] + src.data[ni + 2]) / 3
            contrast += Math.abs(center - n)
          }
        }
        contrast /= 9 * 255
      }
      let d = vertFactor * 0.5 + lum * 0.25 + contrast * 0.25
      if (contrast > 0.08) d += contrast * 0.3
      depth[y * w + x] = Math.max(0, Math.min(1, d))
    }
  }
  return { depth, width: w, height: h, source: "heuristic" }
}

/* Neural depth — Depth Anything v2 small, in-browser */
export async function estimateDepth(
  imageUrl: string
): Promise<DepthResult> {
  const img = await loadHtmlImage(imageUrl)

  try {
    const depthPipe = await getDepthPipeline()
    const output = await depthPipe(img)

    // output.depth is a RawImage (grayscale, 0-255)
    const raw = output.depth as {
      data: Uint8Array | Uint8ClampedArray
      width: number
      height: number
      channels: number
    }

    const w = raw.width
    const h = raw.height
    const depth = new Float32Array(w * h)

    // Depth Anything outputs near=0, far=1 for some variants.
    // Normalize: we want near objects = high value (close to viewer).
    // Heuristic: correlate with vertical position (sky = far).
    let min = Infinity
    let max = -Infinity
    const channels = raw.channels ?? 1
    for (let i = 0; i < w * h; i++) {
      const v = raw.data[i * channels]
      if (v < min) min = v
      if (v > max) max = v
    }
    const range = max - min || 1

    // Sample vertical luminance bias to detect inversion:
    // in most photos, the top of the frame is farther than the bottom.
    let topMean = 0
    let bottomMean = 0
    const sampleRows = Math.max(1, Math.floor(h * 0.1))
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < sampleRows; y++) {
        topMean += raw.data[(y * w + x) * channels]
      }
      for (let y = h - sampleRows; y < h; y++) {
        bottomMean += raw.data[(y * w + x) * channels]
      }
    }
    topMean /= w * sampleRows
    bottomMean /= w * sampleRows
    const invert = topMean > bottomMean // raw says top is "brighter" (nearer in raw space) → needs flip

    for (let i = 0; i < w * h; i++) {
      const v = (raw.data[i * channels] - min) / range
      depth[i] = invert ? 1 - v : v
    }

    return { depth, width: w, height: h, source: "neural" }
  } catch {
    return heuristicDepth(img)
  }
}

/* Preload the model so the first world doesn't wait for it */
export function preloadDepthModel() {
  getDepthPipeline().catch(() => {})
}
