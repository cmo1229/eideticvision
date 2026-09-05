"use client"

/* ------------------------------------------------------------------ */
/*  Splat file support                                                 */
/*  .splat — the 32-bytes-per-splat format (Scaniverse export)         */
/*  3DGS .ply — Gaussian splat PLYs with f_dc_0..2 color properties    */
/* ------------------------------------------------------------------ */

import * as THREE from "three"

/**
 * Parse a .splat file (AntiSplat 32-byte format):
 *   float32 x,y,z      (12 bytes, position)
 *   float32 sx,sy,sz   (12 bytes, scale — unused for point rendering)
 *   uint8   r,g,b,a    (4 bytes, color)
 *   uint8   rot[4]     (4 bytes, quaternion — unused)
 */
export function parseSplatFile(buffer: ArrayBuffer): THREE.BufferGeometry {
  const SPLAT_BYTES = 32
  const count = Math.floor(buffer.byteLength / SPLAT_BYTES)
  const data = new DataView(buffer)

  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const o = i * SPLAT_BYTES
    positions[i * 3] = data.getFloat32(o, true)
    positions[i * 3 + 1] = data.getFloat32(o + 4, true)
    positions[i * 3 + 2] = data.getFloat32(o + 8, true)
    colors[i * 3] = data.getUint8(o + 24) / 255
    colors[i * 3 + 1] = data.getUint8(o + 25) / 255
    colors[i * 3 + 2] = data.getUint8(o + 26) / 255
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3))
  geo.computeBoundingBox()
  const center = new THREE.Vector3()
  geo.boundingBox!.getCenter(center)
  geo.translate(-center.x, -center.y, -center.z)
  return geo
}

/**
 * Normalize any PLY into a colored, right-side-up point cloud.
 * Handles: SH DC colors (f_dc_*), uchar r/g/b, alternate property names,
 * opacity gating, and 3DGS coordinate convention (Y-down → Y-up).
 */
export function ensurePlyColors(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = geo.attributes.position.count
  const notes: string[] = []

  if (!geo.attributes.color) {
    const SH_C0 = 0.28209479177387814
    const dc0 = geo.attributes.f_dc_0
    const dc1 = geo.attributes.f_dc_1
    const dc2 = geo.attributes.f_dc_2

    if (dc0 && dc1 && dc2) {
      // 3DGS SH DC term
      const colors = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        colors[i * 3] = Math.max(0, Math.min(1, 0.5 + SH_C0 * dc0.getX(i)))
        colors[i * 3 + 1] = Math.max(0, Math.min(1, 0.5 + SH_C0 * dc1.getX(i)))
        colors[i * 3 + 2] = Math.max(0, Math.min(1, 0.5 + SH_C0 * dc2.getX(i)))
      }
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3))
    } else {
      // Some exporters: uchar red/green/blue or similar already mapped
      // by PLYLoader to 'color'; anything else → check scale_ / color_*
      geo.setAttribute(
        "color",
        new THREE.BufferAttribute(new Float32Array(n * 3).fill(0.72), 3)
      )
    }
  }

  // Opacity gating: 3DGS stores sigmoid(opacity); very low opacity splats
  // are invisible — darken them out rather than showing white ghosts.
  const opacity = geo.attributes.opacity
  const colors = geo.attributes.color as THREE.BufferAttribute | undefined
  if (opacity && colors) {
    const arr = colors.array as Float32Array
    for (let i = 0; i < n; i++) {
      const o = 1 / (1 + Math.exp(-opacity.getX(i)))
      if (o < 0.25) {
        // push invisible splats toward black so they don't read as white
        arr[i * 3] *= 0.06
        arr[i * 3 + 1] *= 0.06
        arr[i * 3 + 2] *= 0.06
      }
    }
    colors.needsUpdate = true
  }

  orientCloud(geo)
  return geo
}

/**
 * 3DGS PLYs from Scaniverse/Luma are commonly Y-down (or Z-up).
 * Detect orientation from the mass distribution: in a room scan the
 * floor (dense horizontal surface) sits below the ceiling. If the
 * histogram of Y is top-heavy relative to XZ spread, flip.
 */
export function orientCloud(geo: THREE.BufferGeometry): void {
  const pos = geo.attributes.position as THREE.BufferAttribute
  const n = pos.count

  // Sample for speed
  const sample = Math.min(n, 40000)
  const step = Math.max(1, Math.floor(n / 40000))

  // Gather extent
  let yMin = Infinity, yMax = -Infinity
  for (let i = 0; i < n; i += step) {
    const y = pos.getY(i)
    if (y < yMin) yMin = y
    if (y > yMax) yMax = y
  }

  // The floor of a room scan is usually the denser extreme surface
  // (furniture + floor). In 3DGS exports (Y-down convention), the floor
  // ends up at max-Y. If the top band is denser → the cloud is Y-down
  // and must be flipped so the floor lands at the bottom.
  let bottomBand = 0, topBand = 0
  const band = (yMax - yMin) * 0.08
  for (let i = 0; i < n; i += step) {
    const y = pos.getY(i)
    if (y < yMin + band) bottomBand++
    else if (y > yMax - band) topBand++
  }
  if (bottomBand < topBand * 0.75) {
    geo.scale(1, -1, 1)
  }
  // Recenter after flip
  geo.computeBoundingBox()
  const center = new THREE.Vector3()
  geo.boundingBox!.getCenter(center)
  geo.translate(-center.x, -center.y, -center.z)
}

/**
 * Decode Niantic SPZ (Scaniverse default export) via WASM.
 * Returns a colored point-cloud geometry.
 */
export async function parseSpzFile(buffer: ArrayBuffer): Promise<THREE.BufferGeometry> {
  const { loadSpz } = await import("@spz-loader/core")
  const cloud = await loadSpz(new Uint8Array(buffer))

  const n = cloud.numPoints
  const positions = new Float32Array(n * 3)
  const colors = new Float32Array(n * 3)

  for (let i = 0; i < n; i++) {
    positions[i * 3] = cloud.positions[i * 3]
    positions[i * 3 + 1] = cloud.positions[i * 3 + 1]
    positions[i * 3 + 2] = cloud.positions[i * 3 + 2]

    const alpha = cloud.alphas[i] / 255
    // fade nearly-transparent splats toward the background
    const a = Math.max(0.05, Math.min(1, alpha))
    colors[i * 3] = cloud.colors[i * 3] * a
    colors[i * 3 + 1] = cloud.colors[i * 3 + 1] * a
    colors[i * 3 + 2] = cloud.colors[i * 3 + 2] * a
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3))
  geo.computeBoundingBox()
  const center = new THREE.Vector3()
  geo.boundingBox!.getCenter(center)
  geo.translate(-center.x, -center.y, -center.z)
  return geo
}

export function splatKind(fileName?: string): "spz" | "splat" | "ply" | "unknown" {
  const name = fileName?.toLowerCase() ?? ""
  if (name.endsWith(".spz")) return "spz"
  if (name.endsWith(".splat")) return "splat"
  if (name.endsWith(".ply")) return "ply"
  return "unknown"
}
