import { describe, it, expect } from 'vitest'
import { scoreDepartures, findBestDeparture } from '../services/optimizer'
import type { Route, RouteSegment, WeatherSlot } from '../types'

// Minimal route: single segment heading south (bearing 180), 1km
const southSegment: RouteSegment = {
  start: { lat: -36.8, lng: 174.7 },
  end: { lat: -36.9, lng: 174.7 },
  bearing: 180,
  distanceMetres: 1000,
}
const route: Route = {
  segments: [southSegment],
  durationMinutes: 20,
  polyline: [southSegment.start, southSegment.end],
}

// Wind: 20 km/h southerly (from 180) at 7am, 10 km/h at 8am
const slots: WeatherSlot[] = [
  { time: '2026-03-27T07:00', windSpeedKmh: 20, windFromDeg: 180, precipitationMm: 0 },
  { time: '2026-03-27T08:00', windSpeedKmh: 10, windFromDeg: 180, precipitationMm: 0 },
  { time: '2026-03-27T09:00', windSpeedKmh: 10, windFromDeg: 180, precipitationMm: 0 },
]

describe('scoreDepartures', () => {
  it('produces a score for each 10-minute candidate', () => {
    const earliest = new Date('2026-03-27T07:00')
    const arriveBy = new Date('2026-03-27T09:00')
    const scores = scoreDepartures(route, slots, earliest, arriveBy, 'wind')
    expect(scores.length).toBeGreaterThan(0)
    // Latest departure: arriveBy - duration = 08:40
    const times = scores.map((s) => s.departureTime)
    expect(times).toContain('2026-03-27T08:40')
    expect(times).not.toContain('2026-03-27T08:50') // would arrive 09:10, too late
  })

  it('gives lower headwind score to 8:40 departure (less wind) vs 7:00', () => {
    const earliest = new Date('2026-03-27T07:00')
    const arriveBy = new Date('2026-03-27T09:00')
    const scores = scoreDepartures(route, slots, earliest, arriveBy, 'wind')
    const score700 = scores.find((s) => s.departureTime === '2026-03-27T07:00')!
    const score840 = scores.find((s) => s.departureTime === '2026-03-27T08:40')!
    expect(score840.headwindScore).toBeLessThan(score700.headwindScore)
  })
})

describe('findBestDeparture', () => {
  it('recommends 8:40 when wind drops at 8am (wind priority)', () => {
    const earliest = new Date('2026-03-27T07:00')
    const arriveBy = new Date('2026-03-27T09:00')
    const best = findBestDeparture(route, slots, earliest, arriveBy, 'wind')
    // Best window is when wind is lowest: should be 8:xx
    expect(best.departureTime).toMatch(/T08:/)
  })

  it('recommends 7:00 departure when wind is better early', () => {
    const earlyLowSlots: WeatherSlot[] = [
      { time: '2026-03-27T07:00', windSpeedKmh: 5, windFromDeg: 180, precipitationMm: 0 },
      { time: '2026-03-27T08:00', windSpeedKmh: 20, windFromDeg: 180, precipitationMm: 0 },
      { time: '2026-03-27T09:00', windSpeedKmh: 20, windFromDeg: 180, precipitationMm: 0 },
    ]
    const earliest = new Date('2026-03-27T07:00')
    const arriveBy = new Date('2026-03-27T09:00')
    const best = findBestDeparture(route, earlyLowSlots, earliest, arriveBy, 'wind')
    expect(best.departureTime).toMatch(/T07:/)
  })
})
