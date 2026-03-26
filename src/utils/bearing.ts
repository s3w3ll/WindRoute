import type { LatLng } from '../types'

const toRad = (deg: number) => (deg * Math.PI) / 180
const toDeg = (rad: number) => (rad * 180) / Math.PI

/**
 * Calculates the initial bearing from point A to point B.
 * Returns degrees 0–360 (0=North, 90=East, 180=South, 270=West).
 */
export function calcBearing(from: LatLng, to: LatLng): number {
  const lat1 = toRad(from.lat)
  const lat2 = toRad(to.lat)
  const dLng = toRad(to.lng - from.lng)

  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)

  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

/**
 * Returns the absolute angular difference between two bearings (0–180).
 */
export function degreeDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

/**
 * Headwind component in km/h for a given bike bearing and meteorological wind.
 * Positive = headwind, negative = tailwind, zero = pure crosswind.
 *
 * windFromDeg: the direction the wind is coming FROM (meteorological convention).
 * bikeBearing: the direction the cyclist is travelling.
 */
export function headwindComponent(bikeBearing: number, windFromDeg: number, windSpeedKmh: number): number {
  // Wind travel direction is opposite to where it comes from
  const angleDiff = toRad(windFromDeg - bikeBearing)
  return windSpeedKmh * Math.cos(angleDiff)
}
