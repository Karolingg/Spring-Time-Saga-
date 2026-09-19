'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { getAgentRenderPosition } from '@/src/simulation/autonomous-analytics'
import { loadFloorplanWalls } from '@/src/simulation/floorplan-walls'
import type { Agent } from '@/src/simulation/engine'
import type { FloorModel } from '@/src/simulation/building-model'

const PLAN_W = 1200
const PLAN_H = 675
const AGENT_CAPACITY = 4000
const WALL_HEIGHT = 40
const DETAIL_HEIGHT = 9
const PLINTH_DEPTH = 26
const PLATE_MARGIN = 26

export interface SceneHazard {
  id: string
  type: 'fire' | 'smoke' | 'debris' | 'blocked'
  x: number
  y: number
  radius: number
}

type CameraMode = 'tilt' | 'top'

interface FloorScene3DProps {
  floor: FloorModel
  agents: Agent[]
  hazards: SceneHazard[]
  nodeCounts: Record<string, number>
  accent: string
}

const HAZARD_STYLE: Record<SceneHazard['type'], { color: number; opacity: number; height: number; box: boolean }> = {
  fire: { color: 0xef4444, opacity: 0.3, height: 34, box: false },
  smoke: { color: 0x64748b, opacity: 0.24, height: 42, box: false },
  debris: { color: 0x92400e, opacity: 0.32, height: 28, box: true },
  blocked: { color: 0xf59e0b, opacity: 0.3, height: 28, box: true },
}

function gradientBackground(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, 0, 256)
  gradient.addColorStop(0, '#0a1020')
  gradient.addColorStop(0.55, '#16243a')
  gradient.addColorStop(1, '#2b3f5c')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 4, 256)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function heatColor(intensity: number): number {
  if (intensity >= 0.75) return 0xef4444
  if (intensity >= 0.45) return 0xf97316
  if (intensity >= 0.2) return 0xf59e0b
  return 0x22c55e
}

// Plan space is the SVG's 1200x675 box with y running down; the scene keeps those
// units so node/agent coordinates need no rescaling, mapping y onto world z.
function planToWorldX(x: number) {
  return x - PLAN_W / 2
}

function planToWorldZ(y: number) {
  return y - PLAN_H / 2
}

interface SceneHandles {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  ortho: THREE.OrthographicCamera
  perspective: THREE.PerspectiveCamera
  controls: OrbitControls
  agentMesh: THREE.InstancedMesh
  wallMesh: THREE.InstancedMesh | null
  hazardPool: Map<string, THREE.Mesh>
  columnPool: Map<string, THREE.Mesh>
  disposables: Array<{ dispose: () => void }>
  invalidate: () => void
  setCamera: (mode: CameraMode) => void
  setWallsVisible: (visible: boolean) => void
}

export function FloorScene3D({ floor, agents, hazards, nodeCounts, accent }: FloorScene3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const handlesRef = useRef<SceneHandles | null>(null)
  const [cameraMode, setCameraMode] = useState<CameraMode>('tilt')
  const [showWalls, setShowWalls] = useState(true)
  const showWallsRef = useRef(true)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    const backdrop = gradientBackground()
    scene.background = backdrop

    // 'low-power' keeps this on integrated graphics, and frames are drawn on
    // demand rather than in a continuous loop — the scene is static between ticks.
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'

    const ortho = new THREE.OrthographicCamera(-PLAN_W / 2, PLAN_W / 2, PLAN_H / 2, -PLAN_H / 2, 1, 4000)
    ortho.position.set(0, 900, 0)
    ortho.up.set(0, 0, -1)
    ortho.lookAt(0, 0, 0)

    const perspective = new THREE.PerspectiveCamera(42, 1, 1, 6000)
    perspective.position.set(0, 620, 780)
    perspective.lookAt(0, 0, 0)

    const activeCamera = { current: perspective as THREE.Camera }

    let frame: number | null = null
    const invalidate = () => {
      if (frame !== null) return
      frame = requestAnimationFrame(() => {
        frame = null
        renderer.render(scene, activeCamera.current)
      })
    }

    const controls = new OrbitControls(perspective, renderer.domElement)
    controls.target.set(0, 0, 0)
    controls.enableDamping = false
    controls.minDistance = 220
    controls.maxDistance = 2200
    controls.maxPolarAngle = Math.PI * 0.48
    controls.addEventListener('change', invalidate)

    const disposables: Array<{ dispose: () => void }> = []

    scene.add(new THREE.AmbientLight(0xffffff, 1.5))
    const sun = new THREE.DirectionalLight(0xffffff, 1.1)
    sun.position.set(-400, 700, -300)
    scene.add(sun)

    disposables.push(backdrop)

    const plinthGeo = new THREE.BoxGeometry(1, 1, 1)
    const plinthMat = new THREE.MeshLambertMaterial({ color: 0x27354a })
    disposables.push(plinthGeo, plinthMat)
    const plinth = new THREE.Mesh(plinthGeo, plinthMat)
    plinth.scale.set(PLAN_W, PLINTH_DEPTH, PLAN_H)
    plinth.position.set(0, -PLINTH_DEPTH / 2 - 0.5, 0)
    scene.add(plinth)

    const planeGeo = new THREE.PlaneGeometry(PLAN_W, PLAN_H)
    const planeMat = new THREE.MeshBasicMaterial({ color: 0xdfe6ef })
    disposables.push(planeGeo, planeMat)
    const plane = new THREE.Mesh(planeGeo, planeMat)
    plane.rotation.x = -Math.PI / 2
    scene.add(plane)

    if (floor.floorplanSrc) {
      const loader = new THREE.TextureLoader()
      loader.load(floor.floorplanSrc, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        planeMat.map = texture
        planeMat.color.set(0xffffff)
        planeMat.needsUpdate = true
        disposables.push(texture)
        invalidate()
      })
    }

    const agentGeo = new THREE.CylinderGeometry(3.4, 3.4, 11, 8)
    const agentMat = new THREE.MeshLambertMaterial()
    disposables.push(agentGeo, agentMat)
    const agentMesh = new THREE.InstancedMesh(agentGeo, agentMat, AGENT_CAPACITY)
    agentMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    agentMesh.count = 0
    agentMesh.frustumCulled = false
    scene.add(agentMesh)

    let wallMesh: THREE.InstancedMesh | null = null
    let cancelled = false
    if (floor.floorplanSrc) {
      loadFloorplanWalls(floor.floorplanSrc).then((walls) => {
        if (cancelled || walls.length === 0) return
        const wallGeo = new THREE.BoxGeometry(1, 1, 1)
        const wallMat = new THREE.MeshLambertMaterial({ color: 0xeef2f7 })
        disposables.push(wallGeo, wallMat)
        const mesh = new THREE.InstancedMesh(wallGeo, wallMat, walls.length)
        const matrix = new THREE.Matrix4()
        const quaternion = new THREE.Quaternion()
        const axis = new THREE.Vector3(0, 1, 0)
        const position = new THREE.Vector3()
        const scale = new THREE.Vector3()
        let minX = PLAN_W
        let maxX = 0
        let minY = PLAN_H
        let maxY = 0
        walls.forEach((wall, i) => {
          const height = wall.detail ? DETAIL_HEIGHT : WALL_HEIGHT
          // Plan angles run clockwise in a y-down space, so the world rotation negates them.
          quaternion.setFromAxisAngle(axis, -wall.angle)
          position.set(planToWorldX(wall.cx), height / 2, planToWorldZ(wall.cy))
          scale.set(wall.length, height, wall.thickness)
          mesh.setMatrixAt(i, matrix.compose(position, quaternion, scale))

          const halfX = Math.abs(Math.cos(wall.angle)) * wall.length / 2
          const halfY = Math.abs(Math.sin(wall.angle)) * wall.length / 2
          minX = Math.min(minX, wall.cx - halfX)
          maxX = Math.max(maxX, wall.cx + halfX)
          minY = Math.min(minY, wall.cy - halfY)
          maxY = Math.max(maxY, wall.cy + halfY)
        })
        mesh.instanceMatrix.needsUpdate = true
        mesh.visible = showWallsRef.current
        wallMesh = mesh
        if (handlesRef.current) handlesRef.current.wallMesh = mesh
        scene.add(mesh)

        // Trim the plate to the building's own footprint so the plan's blank
        // margin stops reading as a white sheet around the model.
        minX = Math.max(0, minX - PLATE_MARGIN)
        maxX = Math.min(PLAN_W, maxX + PLATE_MARGIN)
        minY = Math.max(0, minY - PLATE_MARGIN)
        maxY = Math.min(PLAN_H, maxY + PLATE_MARGIN)
        const plateW = maxX - minX
        const plateH = maxY - minY
        if (plateW > 50 && plateH > 50) {
          const cropped = new THREE.PlaneGeometry(plateW, plateH)
          const uv = cropped.attributes.uv
          const u0 = minX / PLAN_W
          const u1 = maxX / PLAN_W
          const v0 = 1 - maxY / PLAN_H
          const v1 = 1 - minY / PLAN_H
          for (let i = 0; i < uv.count; i += 1) {
            uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0))
          }
          uv.needsUpdate = true
          plane.geometry.dispose()
          plane.geometry = cropped
          disposables.push(cropped)
          const centerX = planToWorldX((minX + maxX) / 2)
          const centerZ = planToWorldZ((minY + maxY) / 2)
          plane.position.set(centerX, 0, centerZ)
          plinth.scale.set(plateW + 18, PLINTH_DEPTH, plateH + 18)
          plinth.position.set(centerX, -PLINTH_DEPTH / 2 - 0.5, centerZ)
        }
        invalidate()
      })
    }

    const exitGeo = new THREE.ConeGeometry(10, 26, 10)
    const exitMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(accent) })
    disposables.push(exitGeo, exitMat)
    for (const node of floor.nodes) {
      if (node.type !== 'exit') continue
      const marker = new THREE.Mesh(exitGeo, exitMat)
      marker.position.set(planToWorldX(node.x), 13, planToWorldZ(node.y))
      scene.add(marker)
    }

    const resize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      if (!width || !height) return
      const aspect = width / height
      renderer.setSize(width, height, false)

      const halfHeight = Math.max(PLAN_H / 2, PLAN_W / 2 / aspect)
      ortho.top = halfHeight
      ortho.bottom = -halfHeight
      ortho.left = -halfHeight * aspect
      ortho.right = halfHeight * aspect
      ortho.updateProjectionMatrix()

      perspective.aspect = aspect
      perspective.updateProjectionMatrix()
      invalidate()
    }

    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()

    handlesRef.current = {
      renderer,
      scene,
      ortho,
      perspective,
      controls,
      agentMesh,
      wallMesh,
      hazardPool: new Map(),
      columnPool: new Map(),
      disposables,
      invalidate,
      setCamera: (mode) => {
        activeCamera.current = mode === 'top' ? ortho : perspective
        controls.enabled = mode === 'tilt'
        invalidate()
      },
      setWallsVisible: (visible) => {
        const mesh = handlesRef.current?.wallMesh
        if (!mesh) return
        mesh.visible = visible
        invalidate()
      },
    }

    return () => {
      cancelled = true
      if (frame !== null) cancelAnimationFrame(frame)
      if (wallMesh) scene.remove(wallMesh)
      observer.disconnect()
      controls.removeEventListener('change', invalidate)
      controls.dispose()
      for (const mesh of handlesRef.current?.hazardPool.values() ?? []) {
        mesh.geometry.dispose()
        ;(mesh.material as THREE.Material).dispose()
      }
      for (const mesh of handlesRef.current?.columnPool.values() ?? []) {
        mesh.geometry.dispose()
        ;(mesh.material as THREE.Material).dispose()
      }
      for (const item of disposables) item.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      handlesRef.current = null
    }
  }, [floor, accent])

  useEffect(() => {
    handlesRef.current?.setCamera(cameraMode)
  }, [cameraMode])

  useEffect(() => {
    showWallsRef.current = showWalls
    handlesRef.current?.setWallsVisible(showWalls)
  }, [showWalls])

  useEffect(() => {
    const handles = handlesRef.current
    if (!handles) return

    const matrix = new THREE.Matrix4()
    const color = new THREE.Color()
    let index = 0
    for (const agent of agents) {
      if (agent.state === 'evacuated') continue
      if (index >= AGENT_CAPACITY) break
      const position = getAgentRenderPosition(agent, floor)
      matrix.makeTranslation(planToWorldX(position.x), 6, planToWorldZ(position.y))
      handles.agentMesh.setMatrixAt(index, matrix)
      handles.agentMesh.setColorAt(index, color.setHex(agent.state === 'trapped' ? 0xef4444 : 0x2db8b0))
      index += 1
    }
    handles.agentMesh.count = index
    handles.agentMesh.instanceMatrix.needsUpdate = true
    if (handles.agentMesh.instanceColor) handles.agentMesh.instanceColor.needsUpdate = true

    const seenHazards = new Set<string>()
    for (const hazard of hazards) {
      seenHazards.add(hazard.id)
      const style = HAZARD_STYLE[hazard.type]
      let mesh = handles.hazardPool.get(hazard.id)
      if (!mesh) {
        const geometry = style.box
          ? new THREE.BoxGeometry(2, 1, 2)
          : new THREE.CylinderGeometry(1, 1, 1, 24)
        const material = new THREE.MeshLambertMaterial({
          color: style.color,
          transparent: true,
          opacity: style.opacity,
          depthWrite: false,
        })
        mesh = new THREE.Mesh(geometry, material)
        handles.scene.add(mesh)
        handles.hazardPool.set(hazard.id, mesh)
      }
      mesh.scale.set(hazard.radius, style.height, hazard.radius)
      mesh.position.set(planToWorldX(hazard.x), style.height / 2, planToWorldZ(hazard.y))
    }
    for (const [id, mesh] of handles.hazardPool) {
      if (seenHazards.has(id)) continue
      handles.scene.remove(mesh)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
      handles.hazardPool.delete(id)
    }

    const seenColumns = new Set<string>()
    for (const node of floor.nodes) {
      const count = nodeCounts[node.id] ?? 0
      if (count <= 0) continue
      seenColumns.add(node.id)
      let mesh = handles.columnPool.get(node.id)
      if (!mesh) {
        const geometry = new THREE.CylinderGeometry(1, 1, 1, 12)
        const material = new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.8 })
        mesh = new THREE.Mesh(geometry, material)
        handles.scene.add(mesh)
        handles.columnPool.set(node.id, mesh)
      }
      const height = Math.min(110, count * 7)
      const intensity = Math.min(1, count / Math.max(1, node.capacity))
      mesh.scale.set(8, height, 8)
      mesh.position.set(planToWorldX(node.x), height / 2, planToWorldZ(node.y))
      ;(mesh.material as THREE.MeshLambertMaterial).color.setHex(heatColor(intensity))
    }
    for (const [id, mesh] of handles.columnPool) {
      if (seenColumns.has(id)) continue
      handles.scene.remove(mesh)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
      handles.columnPool.delete(id)
    }

    handles.invalidate()
  }, [floor, agents, hazards, nodeCounts])

  return (
    <div className="floor-scene-3d" ref={containerRef}>
      <div className="floor-scene-3d__cameras" role="group" aria-label="Camera angle">
        <button
          type="button"
          onClick={() => setCameraMode('tilt')}
          aria-pressed={cameraMode === 'tilt'}
          data-active={cameraMode === 'tilt'}
        >
          Tilted
        </button>
        <button
          type="button"
          onClick={() => setCameraMode('top')}
          aria-pressed={cameraMode === 'top'}
          data-active={cameraMode === 'top'}
        >
          Top-down
        </button>
        <span className="floor-scene-3d__divider" />
        <button
          type="button"
          onClick={() => setShowWalls((previous) => !previous)}
          aria-pressed={showWalls}
          data-active={showWalls}
        >
          Walls
        </button>
      </div>
      <style jsx>{`
        .floor-scene-3d {
          position: absolute;
          inset: 0;
        }

        .floor-scene-3d__cameras {
          position: absolute;
          top: 10px;
          right: 10px;
          z-index: 2;
          display: flex;
          gap: 2px;
          padding: 3px;
          border-radius: 9px;
          background: rgba(15, 23, 42, 0.72);
          border: 1px solid rgba(226, 232, 240, 0.28);
        }

        .floor-scene-3d__cameras button {
          appearance: none;
          border: none;
          border-radius: 6px;
          padding: 5px 11px;
          font-size: 11px;
          font-weight: 700;
          color: #cbd5e1;
          background: transparent;
          cursor: pointer;
        }

        .floor-scene-3d__divider {
          width: 1px;
          align-self: stretch;
          margin: 2px 3px;
          background: rgba(226, 232, 240, 0.3);
        }

        .floor-scene-3d__cameras button[data-active='true'] {
          background: ${accent};
          color: #06231f;
        }
      `}</style>
    </div>
  )
}
