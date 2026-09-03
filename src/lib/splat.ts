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
 * After PLYLoader parses a 3DGS PLY, vertex colors may live in
 * f_dc_0..2 (spherical harmonics DC term) instead of r/g/b.
 * Convert: color = 0.5 + SH_C0 * f_dc
 */
export function ensurePlyColors(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  if (geo.attributes.color) return geo

  const dc0 = geo.attributes.f_dc_0
  const dc1 = geo.attributes.f_dc_1
  const dc2 = geo.attributes.f_dc_2
  if (dc0 && dc1 && dc2) {
    const SH_C0 = 0.28209479177387814
    const n = dc0.count
    const colors = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      colors[i * 3] = Math.max(0, Math.min(1, 0.5 + SH_C0 * dc0.getX(i)))
      colors[i * 3 + 1] = Math.max(0, Math.min(1, 0.5 + SH_C0 * dc1.getX(i)))
      colors[i * 3 + 2] = Math.max(0, Math.min(1, 0.5 + SH_C0 * dc2.getX(i)))
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3))
  } else {
    const n = geo.attributes.position.count
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).fill(0.72), 3))
  }
  return geo
}
