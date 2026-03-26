import type { LatLng, Route, RouteSegment } from '../types'
import { calcBearing } from '../utils/bearing'

const NOMINATIM = 'https://nominatim.openstreetmap.org'
const OSRM = 'https://router.project-osrm.org'

/** Convert address string to lat/lng via Nominatim */
export async function geocode(address: string): Promise<LatLng> {
  const url = `${NOMINATIM}/search?q=${encodeURIComponent(address)}&format=json&limit=1`
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
  if (!res.ok) throw new Error(`Geocode failed: ${res.statusText}`)
  const data = await res.json()
  if (!data.length) throw new Error(`No results for: ${address}`)
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

/** Decode Google-encoded polyline (used by OSRM) */
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

/** Fetch a bike route from OSRM and return decoded segments */
export async function fetchRoute(origin: LatLng, destination: LatLng): Promise<Route> {
  const url =
    `${OSRM}/route/v1/bike/${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
    `?overview=full&geometries=polyline`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`OSRM request failed: ${res.statusText}`)
  const data = await res.json()
  if (data.code !== 'Ok') throw new Error(`OSRM error: ${data.message}`)

  const route = data.routes[0]
  const polyline = decodePolyline(route.geometry)
  const durationMinutes = route.duration / 60

  const segments: RouteSegment[] = []
  for (let i = 0; i < polyline.length - 1; i++) {
    const start = polyline[i]
    const end = polyline[i + 1]
    const dLat = end.lat - start.lat
    const dLng = end.lng - start.lng
    // Approximate distance in metres (equirectangular)
    const distanceMetres =
      Math.sqrt(dLat * dLat + dLng * dLng) * 111_000
    segments.push({
      start,
      end,
      bearing: calcBearing(start, end),
      distanceMetres,
    })
  }

  return { segments, durationMinutes, polyline }
}
