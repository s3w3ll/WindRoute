import { describe, it, expect } from 'vitest'
import { calcBearing, headwindComponent, degreeDiff } from '../utils/bearing'

describe('calcBearing', () => {
  it('returns ~180 heading south', () => {
    const b = calcBearing({ lat: -36.8, lng: 174.7 }, { lat: -36.9, lng: 174.7 })
    expect(b).toBeCloseTo(180, 0)
  })
  it('returns ~0 heading north', () => {
    const b = calcBearing({ lat: -36.9, lng: 174.7 }, { lat: -36.8, lng: 174.7 })
    expect(b).toBeCloseTo(0, 0)
  })
  it('returns ~90 heading east', () => {
    const b = calcBearing({ lat: -36.85, lng: 174.7 }, { lat: -36.85, lng: 174.8 })
    expect(b).toBeCloseTo(90, 0)
  })
})

describe('headwindComponent', () => {
  it('full headwind when wind from same direction as travel', () => {
    // Cycling south (bearing 180), wind from south (windFrom 180) → full headwind
    expect(headwindComponent(180, 180, 10)).toBeCloseTo(10, 1)
  })
  it('full tailwind when wind from opposite direction', () => {
    // Cycling south (bearing 180), wind from north (windFrom 0) → full tailwind
    expect(headwindComponent(180, 0, 10)).toBeCloseTo(-10, 1)
  })
  it('zero crosswind component', () => {
    // Cycling south (bearing 180), wind from east (windFrom 90)
    expect(headwindComponent(180, 90, 10)).toBeCloseTo(0, 1)
  })
  it('partial headwind at 45 degrees', () => {
    // cos(45°) ≈ 0.707
    expect(headwindComponent(180, 135, 10)).toBeCloseTo(7.07, 1)
  })
})

describe('degreeDiff', () => {
  it('handles wrap-around at 360', () => {
    expect(degreeDiff(350, 10)).toBeCloseTo(20, 1)
  })
  it('returns 0 for same angle', () => {
    expect(degreeDiff(45, 45)).toBe(0)
  })
})
