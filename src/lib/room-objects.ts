"use client"

/* ------------------------------------------------------------------ */
/*  Procedural room objects — real 3D geometry built in the browser     */
/*  Keyword-driven from the prompt, deterministic per prompt            */
/* ------------------------------------------------------------------ */

import * as THREE from "three"

export interface PlannedObject {
  kind: string
  label: string
  pos: [number, number, number]
  rotY: number
  scale: number
}

/* Deterministic RNG from prompt so the same prompt = same room */
function seededRandom(seedStr: string) {
  let h = 2166136261
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    return ((h >>> 0) % 100000) / 100000
  }
}

/* Keyword → object kind mapping */
const KEYWORD_MAP: [RegExp, string][] = [
  [/bookshelf|books|library|study|shelf/i, "bookshelf"],
  [/lamp|light|candle|bulb/i, "lamp"],
  [/table|desk/i, "table"],
  [/chair|stool|seat/i, "chair"],
  [/bed|sleep|bedroom/i, "bed"],
  [/rug|carpet/i, "rug"],
  [/tree|forest|woods|woodland|grove|jungle/i, "tree"],
  [/plant|flower|garden/i, "plant"],
  [/rock|stone|mountain|cliff|canyon|boulder/i, "rock"],
  [/cabinet|dresser|drawer|wardrobe/i, "dresser"],
  [/window/i, "window"],
  [/fireplace|fire|hearth|cabin/i, "fireplace"],
  [/crate|box|barrel|storage/i, "crate"],
  [/kitchen|counter|stove/i, "counter"],
  [/bathtub|bath|shower/i, "bathtub"],
  [/piano|music/i, "piano"],
]

const OUTDOOR_RE = /forest|woods|woodland|grove|jungle|field|meadow|mountain|cliff|canyon|beach|ocean|sea|lake|river|garden|desert|snow|tundra|valley|hill|outdoor|outside|sky|storm|rain/i

export function planRoom(prompt: string, objectCount = 9): PlannedObject[] {
  const rand = seededRandom(prompt.toLowerCase())
  const outdoor = OUTDOOR_RE.test(prompt)

  // Prompt-driven only: kinds come strictly from keywords
  const kinds: string[] = []
  for (const [re, kind] of KEYWORD_MAP) {
    if (re.test(prompt) && !kinds.includes(kind)) kinds.push(kind)
  }

  const objects: PlannedObject[] = []
  const halfW = 9.5
  const halfD = 10.5

  const place = (kind: string, i: number, count: number) => {
    const angle = (i / count) * Math.PI * 2 + rand() * 0.8
    const radius = 4.5 + rand() * 5
    let x = Math.cos(angle) * radius
    let z = Math.sin(angle) * radius
    x = Math.max(-halfW, Math.min(halfW, x))
    z = Math.max(-halfD, Math.min(halfD, z))
    objects.push({
      kind,
      label: kind,
      pos: [x, 0, z],
      rotY: rand() * Math.PI * 2,
      scale: 0.9 + rand() * 0.5,
    })
  }

  if (kinds.length === 0) {
    // Nothing matched — minimal, mood-neutral dressing so the room isn't empty
    if (outdoor) {
      for (let i = 0; i < 7; i++) place("tree", i, 7)
      place("rock", 7, 8)
    } else {
      place("lamp", 0, 9)
      place("rug", 1, 9)
      place("crate", 2, 9)
    }
    return objects
  }

  // Spawn only what the prompt asked for; multiply counts for scene-scale kinds
  const spread: string[] = []
  if (outdoor && (kinds.includes("tree") || kinds.includes("rock"))) {
    // Nature scenes read better with scattered multiples
    const bulk = kinds.includes("tree") ? "tree" : "rock"
    for (let i = 0; i < 8; i++) spread.push(bulk)
    for (const k of kinds) if (k !== bulk && k !== "plant") spread.push(k)
  } else {
    for (const k of kinds) spread.push(k)
  }

  spread.slice(0, objectCount).forEach((kind, i) => place(kind, i, Math.min(spread.length, objectCount)))

  // Windows live on the walls
  const windows = objects.filter((o) => o.kind === "window")
  windows.forEach((w, i) => {
    const side = i % 2
    w.pos = side === 0 ? [-halfW + 0.15, 0, -2 + i * 4] : [0, 0, -halfD + 0.15]
    w.rotY = side === 0 ? Math.PI / 2 : 0
  })

  return objects
}

/* ------------------------------------------------------------------ */
/*  Geometry builders — each kind is real 3D you can orbit around       */
/* ------------------------------------------------------------------ */

function mat(color: string, rough = 0.7, emissive?: string, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rough,
    emissive: emissive ? new THREE.Color(emissive) : undefined,
    emissiveIntensity,
  })
}

export function buildObjectMesh(
  obj: PlannedObject,
  mood: string
): { group: THREE.Group; light?: THREE.PointLight } {
  const group = new THREE.Group()
  let light: THREE.PointLight | undefined

  // Mood-tinted wood/palette
  const wood = mood === "noir" ? "#2a2a2e" : mood === "warm" ? "#5a4632" : "#3d3450"
  const dark = mood === "noir" ? "#1a1a1e" : mood === "warm" ? "#3a2e20" : "#251f38"
  const glow = mood === "noir" ? "#8899bb" : mood === "warm" ? "#ffb46a" : "#c4b5fd"

  switch (obj.kind) {
    case "bookshelf": {
      const h = 2.6
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, h, 0.5),
        mat(wood)
      )
      frame.position.y = h / 2
      group.add(frame)
      for (let i = 0; i < 4; i++) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.42), mat(dark))
        shelf.position.y = 0.5 + i * 0.6
        group.add(shelf)
        // books
        for (let b = 0; b < 5; b++) {
          const book = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 0.4, 0.3),
            mat(["#7c5cbf", "#5b8bd0", "#b05cb0", "#4e7a68", "#a04848"][b % 5], 0.85)
          )
          book.position.set(-0.65 + b * 0.32, 0.75 + i * 0.6, 0.05)
          group.add(book)
        }
      }
      break
    }
    case "table": {
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 1.3), mat(wood))
      top.position.y = 0.95
      group.add(top)
      for (const [lx, lz] of [[-0.95, -0.5], [0.95, -0.5], [-0.95, 0.5], [0.95, 0.5]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.95, 0.12), mat(dark))
        leg.position.set(lx, 0.475, lz)
        group.add(leg)
      }
      break
    }
    case "chair": {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.09, 0.7), mat(wood))
      seat.position.y = 0.62
      group.add(seat)
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.08), mat(wood))
      back.position.set(0, 1.05, -0.31)
      group.add(back)
      for (const [lx, lz] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.62, 0.07), mat(dark))
        leg.position.set(lx, 0.31, lz)
        group.add(leg)
      }
      break
    }
    case "bed": {
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 3.2), mat(dark))
      base.position.y = 0.2
      group.add(base)
      const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.3, 3.0), mat(mood === "warm" ? "#8a6f52" : "#5a5478", 0.9))
      mattress.position.y = 0.55
      group.add(mattress)
      const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.6), mat("#c8c2d8", 0.9))
      pillow.position.set(0, 0.75, -1.1)
      group.add(pillow)
      break
    }
    case "lamp": {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.7, 8), mat(dark))
      pole.position.y = 0.85
      group.add(pole)
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.08, 12), mat(dark))
      base.position.y = 0.04
      group.add(base)
      const shade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.42, 0.5, 12, 1, true),
        mat(glow, 0.8, glow, 0.9)
      )
      shade.position.y = 1.85
      group.add(shade)
      light = new THREE.PointLight(new THREE.Color(glow), 8, 9, 2)
      light.position.y = 1.8
      break
    }
    case "rug": {
      const rug = new THREE.Mesh(
        new THREE.CylinderGeometry(1.6, 1.6, 0.04, 24),
        mat(mood === "warm" ? "#6a4a34" : "#4a3d6a", 0.95)
      )
      rug.position.y = 0.02
      group.add(rug)
      break
    }
    case "plant": {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.45, 10), mat("#4a3b2f"))
      pot.position.y = 0.225
      group.add(pot)
      for (let i = 0; i < 4; i++) {
        const blob = new THREE.Mesh(
          new THREE.SphereGeometry(0.28 - i * 0.04, 8, 8),
          mat(mood === "noir" ? "#2f4436" : "#3e6b4a", 0.9)
        )
        blob.position.set((Math.random() - 0.5) * 0.3, 0.65 + i * 0.28, (Math.random() - 0.5) * 0.3)
        group.add(blob)
      }
      break
    }
    case "dresser": {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 0.6), mat(wood))
      body.position.y = 0.6
      group.add(body)
      for (let i = 0; i < 3; i++) {
        const drawer = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.28, 0.04), mat(dark))
        drawer.position.set(0, 0.28 + i * 0.36, 0.31)
        group.add(drawer)
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), mat(glow, 0.4, glow, 0.25))
        knob.position.set(0, 0.28 + i * 0.36, 0.34)
        group.add(knob)
      }
      break
    }
    case "window": {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.0, 0.12), mat(dark))
      frame.position.y = 2.4
      group.add(frame)
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(1.36, 1.76, 0.05),
        mat(mood === "noir" ? "#22303e" : "#3a4a68", 0.3, mood === "warm" ? "#9db8d8" : "#8ea8d0", 0.5)
      )
      glass.position.y = 2.4
      glass.position.z = 0.02
      group.add(glass)
      light = new THREE.PointLight(new THREE.Color("#8ea8d0"), 3, 7, 2)
      light.position.set(0, 2.4, 0.6)
      break
    }
    case "fireplace": {
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 0.8), mat("#4a4448", 0.9))
      body.position.y = 0.8
      group.add(body)
      const fire = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.7, 0.3),
        mat("#ff8a3a", 0.6, "#ff7a2a", 2.2)
      )
      fire.position.set(0, 0.55, 0.26)
      group.add(fire)
      light = new THREE.PointLight(new THREE.Color("#ff9a4a"), 12, 10, 2)
      light.position.set(0, 0.7, 0.8)
      break
    }
    case "crate": {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), mat(wood, 0.85))
      box.position.y = 0.45
      group.add(box)
      const box2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), mat(dark, 0.85))
      box2.position.set(0.2, 1.2, 0.1)
      box2.rotation.y = 0.4
      group.add(box2)
      break
    }
    case "counter": {
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.0, 0.8), mat(dark))
      body.position.y = 0.5
      group.add(body)
      const top = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.08, 0.9), mat(mood === "warm" ? "#8a7458" : "#6a6280", 0.5))
      top.position.y = 1.04
      group.add(top)
      break
    }
    case "bathtub": {
      const outer = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 1.2), mat("#c0c4cc", 0.4))
      outer.position.y = 0.4
      group.add(outer)
      const inner = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 0.9), mat(mood === "noir" ? "#1a2028" : "#2a3a50", 0.3))
      inner.position.y = 0.55
      group.add(inner)
      break
    }
    case "piano": {
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 1.0), mat(mood === "noir" ? "#141418" : "#1e1a2a", 0.35))
      body.position.y = 0.9
      group.add(body)
      const keys = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.06, 0.32), mat("#d8d4e0", 0.5))
      keys.position.set(0, 1.45, 0.55)
      group.add(keys)
      break
    }
    case "tree": {
      const trunkH = 2.4 + Math.random() * 1.4
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.24, trunkH, 8),
        mat(mood === "noir" ? "#241f1c" : "#3d2f22", 0.9)
      )
      trunk.position.y = trunkH / 2
      group.add(trunk)
      const foliageColor = mood === "noir" ? "#1d2a22" : mood === "warm" ? "#44583a" : "#2c4438"
      for (let i = 0; i < 3; i++) {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(1.3 - i * 0.3, 1.6, 8),
          mat(foliageColor, 0.95)
        )
        cone.position.y = trunkH * 0.8 + i * 0.85
        group.add(cone)
      }
      break
    }
    case "rock": {
      const geo = new THREE.DodecahedronGeometry(0.9 + Math.random() * 0.7, 0)
      const rock = new THREE.Mesh(
        geo,
        mat(mood === "noir" ? "#232326" : mood === "warm" ? "#4a4238" : "#37344a", 0.95)
      )
      rock.position.y = 0.45
      rock.rotation.set(Math.random(), Math.random(), Math.random())
      group.add(rock)
      break
    }
    default: {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat(wood))
      box.position.y = 0.5
      group.add(box)
    }
  }

  group.position.set(obj.pos[0], obj.pos[1], obj.pos[2])
  group.rotation.y = obj.rotY
  group.scale.setScalar(obj.scale)

  return { group, light }
}
