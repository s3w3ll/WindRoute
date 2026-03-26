import type { LatLng, Route, RouteSegment } from '../types'
import { calcBearing } from '../utils/bearing'

const NOMINATIM = 'https://nominatim.openstreetmap.org'
const ORS = 'https://api.openrouteservice.org/v2/directions/cycling-regular'

/** Convert address string to lat/lng via Nominatim */
export async function geocode(address: string): Promise<LatLng> {
  const url = `${NOMINATIM}/search?q=${encodeURIComponent(address)}&format=json&limit=1`
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
  if (!res.ok) throw new Error(`Geocode failed: ${res.statusText}`)
  const data = await res.json()
  if (!data.length) throw new Error(`No results for: ${address}`)
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

/** Decode standard Google/ORS encoded polyline (5-decimal precision) */
function decodePolyline(encoded: string): LatLng[] {
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

    coords.push({ lat: lat / 1e5, lng: lng / 1e5 })
  }
  return coords
}

/** Fetch a bike route from OpenRouteService and return decoded segments */
export async function fetchRoute(origin: LatLng, destination: LatLng): Promise<Route> {
  const apiKey = import.meta.env.VITE_ORS_API_KEY as string | undefined
  if (!apiKey) throw new Error('No routing API key — add VITE_ORS_API_KEY to your .env file (get a free key at openrouteservice.org)')

  const res = await fetch(ORS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiKey,
    },
    body: JSON.stringify({
      coordinates: [
        [origin.lng, origin.lat],
        [destination.lng, destination.lat],
      ],
    }),
  })

  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    throw new Error(`Routing failed: ${msg}`)
  }

  const data = await res.json()
  const route = data.routes?.[0]
  if (!route) throw new Error('No route found')

  const polyline = decodePolyline(route.geometry)
  const durationMinutes = route.summary.duration / 60

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
