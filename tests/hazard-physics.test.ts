import { describe, expect, it } from 'vitest'
import { hazardGrowthRate, hazardMaxRadius } from '../src/simulation/hazard-physics'

describe('hazardGrowthRate', () => {
  it('returns the correct growth rate per hazard type', () => {
    expect(hazardGrowthRate('fire')).toBe(5)
    expect(hazardGrowthRate('smoke')).toBe(8)
    expect(hazardGrowthRate('debris')).toBe(0.4)
  })
})

describe('hazardMaxRadius', () => {
  it('respects the minimum radius floor', () => {
    expect(hazardMaxRadius('fire', 20)).toBe(80)
  })

  it('applies type-specific multipliers', () => {
    expect(hazardMaxRadius('smoke', 40)).toBe(120)
    expect(hazardMaxRadius('debris', 100)).toBe(170)
  })
})
