"use client"

/* ------------------------------------------------------------------ */
/*  Minimal 3DGS PLY parser — reads the properties PLYLoader drops:     */
/*  f_dc_0..2 (SH DC colors), opacity, scale_0..2, rot_0..3            */
/* ------------------------------------------------------------------ */

export interface GsPlyData {
  positions: Float32Array
  colors: Float32Array // 0..1
  alphas: Float32Array // 0..1
  count: number
  hasOpacity: boolean
  hasSH: boolean
}

const SH_C0 = 0.28209479177387814

function invSigmoid(v: number): number {
  return Math.log(v / (1 - v))
}

function sigmoid(v: number): number {
  return 1 / (1 + Math.exp(-v))
}

export function parseGsPly(buffer: ArrayBuffer): GsPlyData {
  const bytes = new Uint8Array(buffer)
  const decoder = new TextDecoder("ascii")

  // Find end of ASCII header
  const headerText = decoder.decode(bytes.slice(0, Math.min(bytes.length, 100000)))
  const headerEnd = headerText.indexOf("end_header\n")
  if (headerEnd < 0) throw new Error("not a PLY (no end_header)")

  const header = headerText.slice(0, headerEnd)
  const isBinaryLE = header.includes("binary_little_endian")
  const isAscii = header.includes("format ascii")

  // Parse element vertex properties
  const lines = header.split("\n")
  let vertexCount = 0
  const props: { name: string; type: string }[] = []
  let inVertex = false
  for (const line of lines) {
    const parts = line.trim().split(/\s+/)
    if (parts[0] === "element" && parts[1] === "vertex") {
      vertexCount = parseInt(parts[2])
      inVertex = true
      continue
    }
    if (parts[0] === "element") inVertex = false
    if (inVertex && parts[0] === "property") {
      props.push({ name: parts[parts.length - 1], type: parts[1] })
    }
  }

  const positions = new Float32Array(vertexCount * 3)
  const colors = new Float32Array(vertexCount * 3)
  const alphas = new Float32Array(vertexCount)

  const propIndex = new Map<string, number>()
  props.forEach((p, i) => propIndex.set(p.name, i))
  const stride = props.length

  const has = (name: string) => propIndex.has(name)

  if (isBinaryLE) {
    // binary: build offsets per property respecting type sizes
    const offsets = new Map<string, number>()
    let o = 0
    const typeSize = (t: string): number => {
      switch (t) {
        case "char": case "uchar": case "int8": case "uint8": return 1
        case "short": case "ushort": case "int16": case "uint16": return 2
        case "double": case "float64": return 8
        default: return 4 // int, uint, float, float32
      }
    }
    for (const p of props) {
      offsets.set(p.name, o)
      o += typeSize(p.type)
    }

    const recSize = o
    const bodyStart = headerEnd + "end_header\n".length
    const dataView = new DataView(buffer, bodyStart)

    for (let i = 0; i < vertexCount; i++) {
      const ro = i * recSize
      positions[i * 3] = dataView.getFloat32(ro + (offsets.get("x") ?? 0), true)
      positions[i * 3 + 1] = dataView.getFloat32(ro + (offsets.get("y") ?? 0), true)
      positions[i * 3 + 2] = dataView.getFloat32(ro + (offsets.get("z") ?? 0), true)

      // Colors: uchar rgb (multiple naming conventions), else SH DC
      const rgbNames = [
        ["red", "green", "blue"],
        ["r", "g", "b"],
        ["diffuse_red", "diffuse_green", "diffuse_blue"],
      ].find((names) => names.every((nm) => has(nm)))

      if (rgbNames) {
        colors[i * 3] = dataView.getUint8(ro + (offsets.get(rgbNames[0]) ?? 0)) / 255
        colors[i * 3 + 1] = dataView.getUint8(ro + (offsets.get(rgbNames[1]) ?? 0)) / 255
        colors[i * 3 + 2] = dataView.getUint8(ro + (offsets.get(rgbNames[2]) ?? 0)) / 255
      } else if (has("f_dc_0")) {
        colors[i * 3] = Math.max(0, Math.min(1, 0.5 + SH_C0 * dataView.getFloat32(ro + (offsets.get("f_dc_0") ?? 0), true)))
        colors[i * 3 + 1] = Math.max(0, Math.min(1, 0.5 + SH_C0 * dataView.getFloat32(ro + (offsets.get("f_dc_1") ?? 0), true)))
        colors[i * 3 + 2] = Math.max(0, Math.min(1, 0.5 + SH_C0 * dataView.getFloat32(ro + (offsets.get("f_dc_2") ?? 0), true)))
      } else {
        colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = 0.6
      }

      // Opacity: sigmoid stored → gate
      if (has("opacity")) {
        const raw = dataView.getFloat32(ro + (offsets.get("opacity") ?? 0), true)
        alphas[i] = sigmoid(raw)
      } else {
        alphas[i] = 1
      }
    }
  } else if (isAscii) {
    // ascii path
    const bodyText = decoder.decode(bytes.slice(headerText.slice(0, headerEnd + 11).length))
    const tokens = bodyText.trim().split(/\s+/)
    let t = 0
    for (let i = 0; i < vertexCount; i++) {
      const row: number[] = []
      for (let k = 0; k < stride; k++) row.push(parseFloat(tokens[t++]))
      positions[i * 3] = row[propIndex.get("x") ?? 0]
      positions[i * 3 + 1] = row[propIndex.get("y") ?? 1]
      positions[i * 3 + 2] = row[propIndex.get("z") ?? 2]
      if (has("f_dc_0")) {
        colors[i * 3] = Math.max(0, Math.min(1, 0.5 + SH_C0 * row[propIndex.get("f_dc_0") ?? 0]))
        colors[i * 3 + 1] = Math.max(0, Math.min(1, 0.5 + SH_C0 * row[propIndex.get("f_dc_1") ?? 0]))
        colors[i * 3 + 2] = Math.max(0, Math.min(1, 0.5 + SH_C0 * row[propIndex.get("f_dc_2") ?? 0]))
      } else if (has("red")) {
        colors[i * 3] = row[propIndex.get("red") ?? 0] / 255
        colors[i * 3 + 1] = row[propIndex.get("green") ?? 0] / 255
        colors[i * 3 + 2] = row[propIndex.get("blue") ?? 0] / 255
      } else if (has("r")) {
        colors[i * 3] = row[propIndex.get("r") ?? 0] / 255
        colors[i * 3 + 1] = row[propIndex.get("g") ?? 0] / 255
        colors[i * 3 + 2] = row[propIndex.get("b") ?? 0] / 255
      }
      alphas[i] = has("opacity") ? sigmoid(row[propIndex.get("opacity") ?? 0]) : 1
    }
  } else {
    throw new Error("unsupported PLY format")
  }

  return {
    positions,
    colors,
    alphas,
    count: vertexCount,
    hasOpacity: has("opacity"),
    hasSH: has("f_dc_0"),
  }
}

/**
 * 3DGS scans (Scaniverse/Luma/PostShot) are authored in the COLMAP/OpenCV
 * convention: +X right, +Y DOWN, +Z forward. Three.js is +Y up, -Z forward.
 * The standard, deterministic conversion is a 180° rotation around X
 * (y → -y, z → -z) — same transform every serious gaussian viewer applies.
 * For plain (non-3DGS) clouds, fall back to the floor-density heuristic.
 */
export function gsOrient(positions: Float32Array, is3dgs: boolean): void {
  const n = positions.length / 3

  if (is3dgs) {
    // Rotate 180° around X: fixes both the Y-down flip and the Z-forward axis
    for (let i = 0; i < n; i++) {
      positions[i * 3 + 1] = -positions[i * 3 + 1]
      positions[i * 3 + 2] = -positions[i * 3 + 2]
    }
    return
  }

  // Heuristic fallback for plain point clouds: the floor of an interior scan
  // is the denser extreme surface. If the top band is denser → flip Y.
  const step = Math.max(1, Math.floor(n / 30000))
  let yMin = Infinity, yMax = -Infinity
  for (let i = 0; i < n; i += step) {
    const y = positions[i * 3 + 1]
    if (y < yMin) yMin = y
    if (y > yMax) yMax = y
  }
  const band = (yMax - yMin) * 0.08
  let bottom = 0, top = 0
  for (let i = 0; i < n; i += step) {
    const y = positions[i * 3 + 1]
    if (y < yMin + band) bottom++
    else if (y > yMax - band) top++
  }
  if (bottom < top * 0.75) {
    for (let i = 0; i < n; i++) positions[i * 3 + 1] = -positions[i * 3 + 1]
  }
}
