import { describe, expect, it } from 'vitest'
import { distributeAgentsByCapacity } from '../src/simulation/autonomous-analytics'
import type { FloorModel } from '../src/simulation/building-model'

const hazards: FloorModel['hazards'] = { fire: [], smoke: [], debris: [] }

const floor: FloorModel = {
  id: 'test-floor',
  label: 'Test Floor',
  floorplanSrc: '',
  nodes: [
    { id: 'room-a', label: 'Room A', x: 0, y: 0, type: 'room', capacity: 10 },
    { id: 'room-b', label: 'Room B', x: 10, y: 0, type: 'room', capacity: 30 },
  ],
  edges: [],
  hazards,
}

describe('distributeAgentsByCapacity', () => {
  it('splits agents proportionally to room capacity', () => {
    const allocations = distributeAgentsByCapacity(floor, 20)
    expect(allocations['room-a']).toBe(5)
    expect(allocations['room-b']).toBe(15)
    expect(allocations['room-a'] + allocations['room-b']).toBe(20)
  })

  it('caps allocations at total capacity', () => {
    const allocations = distributeAgentsByCapacity(floor, 45)
    expect(allocations['room-a']).toBe(10)
    expect(allocations['room-b']).toBe(30)
    expect(allocations['room-a'] + allocations['room-b']).toBe(40)
  })
})
