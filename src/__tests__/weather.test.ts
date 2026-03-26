import { describe, it, expect } from 'vitest'
import { interpolateWeather } from '../services/weather'
import type { WeatherSlot } from '../types'

const slot0: WeatherSlot = {
  time: '2026-03-27T07:00',
  windSpeedKmh: 20,
  windFromDeg: 180,
  precipitationMm: 0,
}
const slot1: WeatherSlot = {
  time: '2026-03-27T08:00',
  windSpeedKmh: 10,
  windFromDeg: 180,
  precipitationMm: 2,
}

describe('interpolateWeather', () => {
  it('returns slot0 values at exactly hour 0', () => {
    const result = interpolateWeather([slot0, slot1], new Date('2026-03-27T07:00'))
    expect(result.windSpeedKmh).toBeCloseTo(20, 1)
  })
  it('returns slot1 values at exactly hour 1', () => {
    const result = interpolateWeather([slot0, slot1], new Date('2026-03-27T08:00'))
    expect(result.windSpeedKmh).toBeCloseTo(10, 1)
  })
  it('interpolates halfway between slots', () => {
    const result = interpolateWeather([slot0, slot1], new Date('2026-03-27T07:30'))
    expect(result.windSpeedKmh).toBeCloseTo(15, 1)
    expect(result.precipitationMm).toBeCloseTo(1, 1)
  })
  it('clamps to first slot before range', () => {
    const result = interpolateWeather([slot0, slot1], new Date('2026-03-27T06:00'))
    expect(result.windSpeedKmh).toBe(20)
  })
})
