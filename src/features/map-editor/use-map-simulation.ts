import { useCallback, useEffect, useRef, useState } from 'react'
import type { MapLayout } from './map-types'
import type { SimulationState } from './simulation-types'
import { buildSimulationContext, createSimulationState, stepSimulation, type SimulationContext } from './simulation-runner'

const MAX_AGENTS = 360

export function useMapSimulation(mapLayout: MapLayout | null) {
  const [state, setState] = useState<SimulationState | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const frameRef = useRef<number | null>(null)
  const lastFrameRef = useRef<number | null>(null)
  const contextRef = useRef<SimulationContext | null>(null)
  const stateRef = useRef<SimulationState | null>(null)

  const stopSimulation = useCallback(() => {
    setIsRunning(false)
  }, [])

  const resetSimulation = useCallback(() => {
    setIsRunning(false)
    setState(null)
    contextRef.current = null
    stateRef.current = null
  }, [])

  const startSimulation = useCallback(() => {
    if (!mapLayout) return
    const context = buildSimulationContext(mapLayout.image.width, mapLayout.image.height, mapLayout.zones)
    const nextState = createSimulationState(mapLayout.zones, MAX_AGENTS, context)
    nextState.running = true
    contextRef.current = context
    stateRef.current = nextState
    setState(nextState)
    setIsRunning(true)
  }, [mapLayout])

  useEffect(() => {
    if (!isRunning) return

    const step = (timestamp: number) => {
      if (lastFrameRef.current === null) lastFrameRef.current = timestamp
      const dt = timestamp - lastFrameRef.current
      lastFrameRef.current = timestamp
      if (stateRef.current && contextRef.current) {
        const next = stepSimulation(stateRef.current, contextRef.current, dt)
        stateRef.current = next
        setState(next)
      }
      frameRef.current = window.requestAnimationFrame(step)
    }

    frameRef.current = window.requestAnimationFrame(step)
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
      lastFrameRef.current = null
    }
  }, [isRunning])

  useEffect(() => {
    if (!mapLayout) return
    resetSimulation()
  }, [mapLayout?.id, resetSimulation])

  return {
    simulationState: state,
    isRunning,
    startSimulation,
    stopSimulation,
    resetSimulation,
  }
}
