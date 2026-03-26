import type { Route, WeatherSlot, DepartureScore, Priority } from '../types'
import { interpolateWeather } from './weather'
import { headwindComponent } from '../utils/bearing'

const CANDIDATE_INTERVAL_MIN = 10

/**
 * For a given departure time, simulate the ride and calculate weighted headwind + rain.
 * We split the ride proportionally by segment distance and sample weather at that sub-time.
 */
function scoreOneDeparture(
  route: Route,
  slots: WeatherSlot[],
  departureTime: Date,
): { headwindScore: number; rainScore: number; observations: string[] } {
  const totalDistance = route.segments.reduce((sum, s) => sum + s.distanceMetres, 0)
  const durationMs = route.durationMinutes * 60 * 1000

  let weightedHeadwind = 0
  let totalRain = 0
  const observations: string[] = []
  let distanceSoFar = 0

  for (const segment of route.segments) {
    const segFrac = segment.distanceMetres / totalDistance
    const segMidFrac = (distanceSoFar + segment.distanceMetres / 2) / totalDistance
    const timeAtSeg = new Date(departureTime.getTime() + segMidFrac * durationMs)
    const weather = interpolateWeather(slots, timeAtSeg)

    const hw = headwindComponent(segment.bearing, weather.windFromDeg, weather.windSpeedKmh)
    weightedHeadwind += hw * segFrac
    totalRain += weather.precipitationMm * segFrac
    distanceSoFar += segment.distanceMetres

    // Tailwind observation
    if (hw < -3) {
      observations.push(`Favourable tailwind on this segment (${weather.windSpeedKmh.toFixed(0)} km/h behind you)`)
    }
  }

  return { headwindScore: weightedHeadwind, rainScore: totalRain, observations: [...new Set(observations)] }
}

/**
 * Score all valid departure times in 10-minute increments between earliest and arriveBy - duration.
 */
export function scoreDepartures(
  route: Route,
  slots: WeatherSlot[],
  earliest: Date,
  arriveBy: Date,
  priority: Priority,
): DepartureScore[] {
  const latestDepartureMs = arriveBy.getTime() - route.durationMinutes * 60 * 1000
  const results: DepartureScore[] = []

  let t = new Date(earliest)
  while (t.getTime() <= latestDepartureMs) {
    const { headwindScore, rainScore, observations } = scoreOneDeparture(route, slots, t)
    const combinedScore =
      priority === 'wind'
        ? headwindScore * 1.0 + rainScore * 0.3
        : headwindScore * 0.3 + rainScore * 10.0

    // Format as local time to match WeatherSlot time strings (no timezone offset)
    const pad = (n: number) => String(n).padStart(2, '0')
    const isoTime = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`
    results.push({ departureTime: isoTime, headwindScore, rainScore, combinedScore, observations })
    t = new Date(t.getTime() + CANDIDATE_INTERVAL_MIN * 60 * 1000)
  }

  return results
}

/** Return the departure time with the lowest combined score */
export function findBestDeparture(
  route: Route,
  slots: WeatherSlot[],
  earliest: Date,
  arriveBy: Date,
  priority: Priority,
): DepartureScore {
  const scores = scoreDepartures(route, slots, earliest, arriveBy, priority)
  if (!scores.length) throw new Error('No valid departure windows')
  return scores.reduce((best, s) => (s.combinedScore <= best.combinedScore ? s : best))
}
