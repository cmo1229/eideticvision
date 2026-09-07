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

export async function parseSpzFile(buffer: ArrayBuffer): Promise<THREE.BufferGeometry> {
  const createSpzModule = (await import("@adobe/spz")).default
  const mod = await createSpzModule()
  const cloud = mod.loadSpzFromBuffer(
    buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer),
    { to: mod.CoordinateSystem.RDF }
  )

  const n = cloud.numPoints
  const positions = new Float32Array(n * 3)
  const colors = new Float32Array(n * 3)

  for (let i = 0; i < n; i++) {
    positions[i * 3] = cloud.positions[i * 3]
    positions[i * 3 + 1] = cloud.positions[i * 3 + 1]
    positions[i * 3 + 2] = cloud.positions[i * 3 + 2]

    // Adobe returns colors mapped around 0.5 (0.5 + factor * c);
    // renormalize into 0..1 for point rendering
    const r = Math.max(0, Math.min(1, cloud.colors[i * 3] * 0.282 + 0.5))
    const g = Math.max(0, Math.min(1, cloud.colors[i * 3 + 1] * 0.282 + 0.5))
    const b = Math.max(0, Math.min(1, cloud.colors[i * 3 + 2] * 0.282 + 0.5))
    const alpha = Math.max(0.05, Math.min(1, 1 / (1 + Math.exp(-cloud.alphas[i]))))
    colors[i * 3] = r * alpha
    colors[i * 3 + 1] = g * alpha
    colors[i * 3 + 2] = b * alpha
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
