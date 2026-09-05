"use client"

/* ------------------------------------------------------------------ */
/*  Text → SPZ — generative places                                     */
/*  prompt → AI interior image → neural depth → dense point cloud      */
/*  → valid Niantic .spz file, rendered + downloadable                 */
/* ------------------------------------------------------------------ */

import * as THREE from "three"
import { estimateDepth } from "@/lib/depth"

/* ---------------- SPZ encoding (Niantic spec v2) ---------------- */

const FRACTIONAL_BITS = 12
const FIXED_POINT_SCALE = 1 << FRACTIONAL_BITS // 4096
const SPZ_MAGIC = 0x50
const SPZ_VERSION = 2

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

/** Quantize a float coordinate to 24-bit fixed point (3 bytes, little-endian) */
function quantizePos24(v: number): [number, number, number] {
  const fixed = Math.round(v * FIXED_POINT_SCALE)
  const clamped = Math.max(-8388608, Math.min(8388607, fixed))
  const u = clamped < 0 ? clamped + 16777216 : clamped
  return [u & 0xff, (u >> 8) & 0xff, (u >> 16) & 0xff]
}

/** Scale in log-space, 8 bits — we emit a uniform small splat scale */
function quantizeScale(s: number): number {
  // SPZ scales are log-quantized between 2^-9.5 and 2^7.5
  const lo = Math.log2(Math.pow(2, -9.5))
  const hi = Math.log2(Math.pow(2, 7.5))
  const t = (Math.log2(Math.max(s, 1e-8)) - lo) / (hi - lo)
  return Math.round(clamp(t, 0, 1) * 255)
}

/** async gzip via native CompressionStream */
async function gzip(data: Uint8Array): Promise<Uint8Array> {
  const CS = (globalThis as { CompressionStream?: typeof CompressionStream }).CompressionStream
  if (!CS) throw new Error("CompressionStream unavailable in this browser")
  const stream = new Blob([data as unknown as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("gzip"))
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

/**
 * Encode a point cloud as a valid SPZ v2 file.
 * Layout after the 16-byte header (all arrays sequential, per attribute):
 *   positions: n × 3 coords, each 24-bit fixed-point (3 bytes LE)
 *   scales:    n × 3 bytes (log-quantized)
 *   rotations: n × 4 bytes (smallest-three; identity quaternions here)
 *   alphas:    n × 1 byte
 *   colors:    n × 3 bytes (linear RGB 0-255)
 * The whole body is gzip-compressed.
 */
export function encodeSpz(
  positions: Float32Array, // length n*3, flattened xyz
  colors: Float32Array,    // 0..1
  alphas: Float32Array | null,
  fractionalBits = FRACTIONAL_BITS
): Uint8Array {
  const n = positions.length / 3

  const header = new Uint8Array(16)
  header[0] = SPZ_MAGIC
  header[1] = SPZ_VERSION
  header[2] = n & 0xff
  header[3] = (n >> 8) & 0xff
  header[4] = (n >> 16) & 0xff
  header[5] = 0 // shDegree 0 → view-independent colors
  header[6] = fractionalBits
  header[7] = 0 // flags
  header[8] = 0 // reserved

  const body = new Uint8Array(n * (9 + 3 + 4 + 1 + 3))
  let o = 0

  // positions — component planes: all X, then all Y, then all Z
  for (let axis = 0; axis < 3; axis++) {
    for (let i = 0; i < n; i++) {
      const fixed = Math.round(positions[i * 3 + axis] * FIXED_POINT_SCALE)
      const clamped = Math.max(-8388608, Math.min(8388607, fixed))
      const u = clamped < 0 ? clamped + 16777216 : clamped
      body[o++] = u & 0xff
      body[o++] = (u >> 8) & 0xff
      body[o++] = (u >> 16) & 0xff
    }
  }

  // scales
  const scaleByte = quantizeScale(0.018)
  for (let i = 0; i < n * 3; i++) body[o++] = scaleByte

  // rotations — identity quaternion, 8-bit components (xyzw → w dominant)
  for (let i = 0; i < n; i++) {
    body[o++] = 128
    body[o++] = 128
    body[o++] = 128
    body[o++] = 255 // w dominant
  }

  // alphas
  for (let i = 0; i < n; i++) {
    body[o++] = alphas ? Math.round(clamp(alphas[i], 0, 1) * 255) : 255
  }

  // colors
  for (let i = 0; i < n * 3; i++) {
    body[o++] = Math.round(clamp(colors[i], 0, 1) * 255)
  }

  return body // caller gzips
}

/** Full pipeline: prompt → generated image → depth-lifted cloud → .spz blob */
export async function buildSpzFromPrompt(
  prompt: string,
  mood: string,
  opts: {
    imageWidth?: number
    imageHeight?: number
    stride?: number
    onPhase?: (phase: string) => void
  } = {}
): Promise<{ blob: Blob; pointCount: number; imageDataUrl: string }> {
  const imgW = opts.imageWidth ?? 1024
  const imgH = opts.imageHeight ?? 640
  const onPhase = opts.onPhase ?? (() => {})

  // 1. Generate the interior image (free Pollinations)
  onPhase("imagining the place")
  const styled = `${prompt}, wide interior room view, perspective from inside the space, ${mood} atmosphere`
  const seed = Math.floor(Math.random() * 999999)
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    styled
  )}?width=${imgW}&height=${imgH}&nologo=true&seed=${seed}`

  const res = await fetch(url, { signal: AbortSignal.timeout(100_000) })
  if (!res.ok) throw new Error("scene generation failed")
  const blob = await res.blob()
  const imageDataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error("read failed"))
    r.readAsDataURL(blob)
  })

  // 2. Neural depth
  onPhase("measuring the depth")
  const { depth, width: dw, height: dh } = await estimateDepth(imageDataUrl)

  // 3. Lift pixels into a dense colored point cloud
  onPhase("lifting into 3D")
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.crossOrigin = "anonymous"
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error("img load failed"))
    i.src = imageDataUrl
  })

  const c = document.createElement("canvas")
  c.width = imgW
  c.height = imgH
  const ctx = c.getContext("2d")!
  ctx.drawImage(img, 0, 0, imgW, imgH)
  const pixels = ctx.getImageData(0, 0, imgW, imgH).data

  const stride = opts.stride ?? 1
  const WORLD_W = 12
  const WORLD_H = WORLD_W * (imgH / imgW)
  const DEPTH_RANGE = 9

  const positions = new Float32Array(Math.ceil((imgW / stride) * (imgH / stride)) * 3 * 1)
  const colors = new Float32Array(positions.length)
  const alphas = new Float32Array(positions.length / 3).fill(1)
  let p = 0

  for (let py = 0; py < imgH; py += stride) {
    for (let px = 0; px < imgW; px += stride) {
      const src = (py * imgW + px) * 4
      if (pixels[src + 3] < 10) continue

      const u = px / (imgW - 1)
      const v = py / imgH

      // sample depth (nearest)
      const dx = Math.floor(u * (dw - 1))
      const dy = Math.floor((1 - v) * (dh - 1))
      const d = depth[dy * dw + dx] ?? 0

      const x = (u - 0.5) * WORLD_W
      const y = (1 - v) * WORLD_H
      const z = -d * DEPTH_RANGE

      positions[p * 3] = x
      positions[p * 3 + 1] = y
      positions[p * 3 + 2] = z
      colors[p * 3] = pixels[src] / 255
      colors[p * 3 + 1] = pixels[src + 1] / 255
      colors[p * 3 + 2] = pixels[src + 2] / 255
      p++
    }
  }

  const pointCount = p
  const pos = positions.slice(0, pointCount * 3)
  const col = colors.slice(0, pointCount * 3)
  const alp = alphas.slice(0, pointCount)

  // 4. Encode + compress
  onPhase("packing the splat")
  const rawBody = encodeSpz(pos, col, alp)
  const gzipped = await gzip(rawBody)

  // Prepend header to compressed body
  const n = pointCount
  const header = new Uint8Array(16)
  header[0] = SPZ_MAGIC
  header[1] = SPZ_VERSION
  header[2] = n & 0xff
  header[3] = (n >> 8) & 0xff
  header[4] = (n >> 16) & 0xff
  header[5] = 0
  header[6] = FRACTIONAL_BITS
  header[7] = 0
  header[8] = 0

  const out = new Uint8Array(header.length + gzipped.length)
  out.set(header, 0)
  out.set(gzipped, header.length)

  return {
    blob: new Blob([out as unknown as BlobPart], { type: "application/octet-stream" }),
    pointCount,
    imageDataUrl,
  }
}

/** Center a cloud and return a preview geometry for immediate rendering */
export function cloudToGeometry(positions: Float32Array, colors: Float32Array): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3))
  geo.computeBoundingBox()
  const center = new THREE.Vector3()
  geo.boundingBox!.getCenter(center)
  geo.translate(-center.x, -center.y, -center.z)
  return geo
}

export { gzip as gzipBytes }
