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
const NGSP_MAGIC = 0x5053474e // "NGSP"
const SPZ_VERSION = 2

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

/** Quantize scale to 8-bit log space (2^-9.5 .. 2^7.5) */
function quantizeScale8(s: number): number {
  const lo = -9.5
  const hi = 7.5
  const t = (Math.log2(Math.max(s, 1e-8)) - lo) / (hi - lo)
  return Math.round(Math.max(0, Math.min(1, t)) * 255)
}

/**
 * Build the raw (pre-gzip) SPZ v2 body: 16-byte header + attributes
 * in spec order: positions → alphas → colors → scales → rotations → (sh)
 * Positions: 24-bit signed fixed-point, fractionalBits after the point.
 * Rotations v2: xyz of normalized quaternion as 8-bit SIGNED ints, w omitted.
 * The ENTIRE buffer (header + body) is gzipped as one stream.
 */
function buildSpzBuffer(
  positions: Float32Array,
  colors: Float32Array,
  alphas: Float32Array | null,
  fractionalBits = 12
): Uint8Array {
  const n = positions.length / 3

  const header = new DataView(new ArrayBuffer(16))
  header.setUint32(0, NGSP_MAGIC, true)
  header.setUint32(4, 2, true) // version 2
  header.setUint32(8, n, true)
  header.setUint8(12, 0) // shDegree 0 → view-independent colors
  header.setUint8(13, fractionalBits)
  header.setUint8(14, 0) // flags
  header.setUint8(15, 0) // reserved

  const fixedScale = 1 << fractionalBits
  const posBytes = n * 3 * 3
  const body = new Uint8Array(posBytes + n + n * 3 + n * 3 + n * 4)
  let o = 0

  // positions — 24-bit fixed point, interleaved xyz per point
  for (let i = 0; i < n; i++) {
    for (let axis = 0; axis < 3; axis++) {
      const v = positions[i * 3 + axis] * fixedScale
      const fixed = Math.max(-8388608, Math.min(8388607, Math.round(v)))
      const u = fixed < 0 ? fixed + 16777216 : fixed
      body[o++] = u & 0xff
      body[o++] = (u >> 8) & 0xff
      body[o++] = (u >> 16) & 0xff
    }
  }

  // alphas
  for (let i = 0; i < n; i++) {
    body[o++] = alphas ? Math.round(Math.max(0, Math.min(1, alphas[i])) * 255) : 255
  }

  // colors
  for (let i = 0; i < n * 3; i++) {
    body[o++] = Math.round(Math.max(0, Math.min(1, colors[i])) * 255)
  }

  // scales — small uniform log-quantized
  const scaleByte = quantizeScale8(0.015)
  for (let i = 0; i < n * 3; i++) body[o++] = scaleByte

  // rotations v2 — identity quaternion: xyz = 0 (signed 8-bit), w implied
  for (let i = 0; i < n * 4; i++) body[o++] = 128 // 128 = 0 in signed 8-bit offset encoding

  const out = new Uint8Array(16 + body.length)
  out.set(new Uint8Array(header.buffer), 0)
  out.set(body, 16)
  return out
}

async function gzipAll(data: Uint8Array): Promise<Uint8Array> {
  const CS = (globalThis as { CompressionStream?: typeof CompressionStream }).CompressionStream
  if (!CS) throw new Error("CompressionStream unavailable")
  const stream = new Blob([data as unknown as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("gzip"))
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

/** Full pipeline: prompt → 4 wall images → depth-lifted clouds → merged into one full-room .spz */
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
  const stride = opts.stride ?? 2

  const VIEW_DIRS = [
    { dir: "frontal wide view of the room, facing the scene head-on", yaw: 0 },
    { dir: "wide view of the same room from the right side, ninety degrees turned", yaw: -Math.PI / 2 },
    { dir: "wide view of the same room seen from directly behind, opposite side", yaw: Math.PI },
    { dir: "wide view of the same room from the left side, ninety degrees turned", yaw: Math.PI / 2 },
  ]

  const WORLD_W = 12
  const WORLD_R = 7 // radius of room volume
  const DEPTH_RANGE = 5

  const allPositions: number[] = []
  const allColors: number[] = []
  let coverImage = ""

  for (let vi = 0; vi < VIEW_DIRS.length; vi++) {
    const { dir, yaw } = VIEW_DIRS[vi]
    onPhase(`imagining the place · wall ${vi + 1}/4`)

    const styled = `${prompt}, wide interior room view, perspective from inside the space, ${dir}, ${mood} atmosphere`
    const seed = Math.floor(Math.random() * 999999)
    const u2 = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      styled
    )}?width=1024&height=640&nologo=true&seed=${Math.floor(Math.random() * 999999)}`

    const res = await fetch(u2, { signal: AbortSignal.timeout(100_000) })
    if (!res.ok) continue
    const blob = await res.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = () => reject(new Error("read failed"))
      r.readAsDataURL(blob)
    })
    if (vi === 0) coverImage = dataUrl

    onPhase(`measuring the depth · wall ${vi + 1}/4`)
    const { depth, width: dw, height: dh } = await estimateDepth(dataUrl)

    onPhase(`lifting into 3D · wall ${vi + 1}/4`)
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.crossOrigin = "anonymous"
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error("img load failed"))
      i.src = dataUrl
    })
    const c = document.createElement("canvas")
    c.width = 1024
    c.height = 640
    const ctx = c.getContext("2d")!
    ctx.drawImage(img, 0, 0, 1024, 640)
    const pixels = ctx.getImageData(0, 0, 1024, 640).data

    for (let py = 0; py < 640; py += stride) {
      for (let px = 0; px < 1024; px += stride) {
        const src = (py * 1024 + px) * 4
        if (pixels[src + 3] < 10) continue

        const u = px / 1023
        const yNorm = 1 - py / 639

        const dx = Math.floor(u * (dw - 1))
        const dy = Math.floor((1 - py / 639) * (dh - 1))
        const d = depth[dy * dw + dx] ?? 0

        // Place each wall's pixels on the corresponding side of the room volume
        const localX = (u - 0.5) * 2 * WORLD_W * 0.8
        const localY = yNorm * 10 - 1.5
        const dist = WORLD_R - (1 - d) * DEPTH_RANGE * 0.6

        // Rotate local wall plane into the room by yaw
        const x = localX * Math.cos(yaw) + dist * Math.sin(yaw) * -1
        const z = -localX * Math.sin(yaw) + dist * Math.cos(yaw) * -1

        const rC = pixels[(py * 1024 + px) * 4] / 255
        const gC = pixels[(py * 1024 + px) * 4 + 1] / 255
        const bC = pixels[(py * 1024 + px) * 4 + 2] / 255

        allPositions.push(x, localY, z)
        allColors.push(rC, gC, bC)
      }
    }
  }

  const pointCount = allPositions.length / 3
  const pos = new Float32Array(allPositions)
  const col = new Float32Array(allColors)
  const alphaArr = new Float32Array(pointCount).fill(1)

  onPhase("packing the splat")
  const spzBuf = buildSpzBuffer(pos, col, alphaArr)
  const gzipped = await gzipAll(spzBuf)

  return {
    blob: new Blob([gzipped as unknown as BlobPart], { type: "application/octet-stream" }),
    pointCount,
    imageDataUrl: coverImage,
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

export { gzipAll as gzipBytes }
