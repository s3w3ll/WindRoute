import type { LatLng, Route, RouteSegment } from '../types'
import { calcBearing } from '../utils/bearing'

const NOMINATIM = 'https://nominatim.openstreetmap.org'
// Valhalla public instance — proper bicycle routing, no API key required
const VALHALLA = 'https://valhalla.openstreetmap.de'

/** Convert address string to lat/lng via Nominatim */
export async function geocode(address: string): Promise<LatLng> {
  const url = `${NOMINATIM}/search?q=${encodeURIComponent(address)}&format=json&limit=1`
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
  if (!res.ok) throw new Error(`Geocode failed: ${res.statusText}`)
  const data = await res.json()
  if (!data.length) throw new Error(`No results for: ${address}`)
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

/**
 * Decode Valhalla's encoded polyline.
 * Valhalla uses 6-decimal precision (1e6) unlike Google's 5-decimal (1e5).
 */
function decodePolyline6(encoded: string): LatLng[] {
  const coords: LatLng[] = []
  let index = 0, lat = 0, lng = 0

  while (index < encoded.length) {
    let shift = 0, result = 0, b: number
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1

    shift = 0; result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lng += result & 1 ? ~(result >> 1) : result >> 1

    coords.push({ lat: lat / 1e6, lng: lng / 1e6 })
  }
  return coords
}

/** Fetch a bike route from Valhalla and return decoded segments */
export async function fetchRoute(origin: LatLng, destination: LatLng): Promise<Route> {
  const body = {
    locations: [
      { lon: origin.lng, lat: origin.lat },
      { lon: destination.lng, lat: destination.lat },
    ],
    costing: 'bicycle',
    costing_options: {
      bicycle: { bicycle_type: 'hybrid', use_roads: 0.5, use_hills: 0.3 },
    },
  }

  const res = await fetch(`${VALHALLA}/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    throw new Error(`Routing failed: ${msg}`)
  }
  const data = await res.json()
  if (!data.trip?.legs?.[0]) throw new Error('No route found')

  const leg = data.trip.legs[0]
  const polyline = decodePolyline6(leg.shape)
  const durationMinutes = data.trip.summary.time / 60

  const segments: RouteSegment[] = []
  for (let i = 0; i < polyline.length - 1; i++) {
    const start = polyline[i]
    const end = polyline[i + 1]
    const dLat = end.lat - start.lat
    const dLng = end.lng - start.lng
    const distanceMetres = Math.sqrt(dLat * dLat + dLng * dLng) * 111_000
    segments.push({
      start,
      end,
      bearing: calcBearing(start, end),
      distanceMetres,
    })
  }

  return { segments, durationMinutes, polyline }
}
