"use client"

import { useRef, useState, useMemo, useEffect } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, useProgress, Environment, useGLTF } from "@react-three/drei"
import { EffectComposer, Bloom, ColorAverage, Vignette } from "@react-three/postprocessing"
import { GLTFLoader, PLYLoader } from "three-stdlib"
import * as THREE from "three"
import { BlendFunction } from "postprocessing"

function LoadingOverlay() {
  const { progress } = useProgress()
  return (
    <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-10">
      <p className="text-lg text-zinc-200">Loading your Eidetic memory…</p>
      <div className="w-64 h-1 rounded-full bg-zinc-800 overflow-hidden mt-4">
        <div
          className="h-full bg-accent transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-zinc-500 mt-2">{Math.round(progress)}%</p>
    </div>
  )
}

function ViewerModel({ url, type }: { url: string; type: string }) {
  const groupRef = useRef<THREE.Group>(null!)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (type === "ply") {
    return <PlyModel url={url} />
  }

  useEffect(() => {
    const loader = new GLTFLoader()
    loader.load(
      url,
      (gltf) => {
        if (groupRef.current) {
          groupRef.current.add(gltf.scene)
          setLoaded(true)
        }
      },
      undefined,
      (err) => setError(err?.message ?? "Failed to load 3D scene.")
    )
  }, [url])

  if (error) {
    return <p className="text-red-400">{error}</p>
  }

  return (
    <>
      {!loaded && <LoadingOverlay />}
      <group ref={groupRef} />
    </>
  )
}

function PlyModel({ url }: { url: string }) {
  const groupRef = useRef<THREE.Group>(null!)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loader = new PLYLoader()
    loader.load(
      url,
      (geometry) => {
        geometry.computeVertexNormals()

        const material = new THREE.PointsMaterial({
          size: 0.02,
          vertexColors: true,
          sizeAttenuation: true,
        })

        const points = new THREE.Points(geometry, material)
        groupRef.current.add(points)
        setLoaded(true)
      },
      undefined,
      (err) => setError(err?.message ?? "Failed to load PLY scene.")
    )
  }, [url])

  if (error) {
    return <p className="text-red-400">{error}</p>
  }

  return (
    <>
      {!loaded && <LoadingOverlay />}
      <group ref={groupRef} />
    </>
  )
}

// Lucid dream post-processing: bloom + subtle color shift + vignette
function LucidDreamEffects() {
  return (
    <EffectComposer enableNormalPass={false} multisampling={0}>
      <Bloom
        luminanceThreshold={0.6}
        luminanceSmoothing={0.95}
        height={400}
        intensity={1.2}
      />
      <ColorAverage
        blendFunction={BlendFunction.SCREEN}
      />
      <Vignette
        offset={0.15}
      />
    </EffectComposer>
  )
}

interface SceneProps {
  assetUrl: string
  assetType: string
}

export function Scene({ assetUrl, assetType }: SceneProps) {
  return (
    <div className="relative w-full h-[80vh] rounded-xl overflow-hidden border border-zinc-800">
      <Canvas
        camera={{ position: [0, 2, 5], fov: 50 }}
        style={{ background: "#0a0a0a" }}
      >
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <ViewerModel url={assetUrl} type={assetType} />
        <Environment preset="night" />
        <LucidDreamEffects />
        <OrbitControls
          makeDefault
          enablePan={true}
          enableZoom={true}
          minDistance={1}
          maxDistance={50}
        />
      </Canvas>
    </div>
  )
}
