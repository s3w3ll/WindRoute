export interface LatLng {
  lat: number
  lng: number
}

/** A single step in the decoded route polyline */
export interface RouteSegment {
  start: LatLng
  end: LatLng
  /** Bearing in degrees 0–360, 0=North, 90=East, 180=South, 270=West */
  bearing: number
  /** Distance of this segment in metres */
  distanceMetres: number
}

/** Full decoded route */
export interface Route {
  segments: RouteSegment[]
  /** Total duration in minutes (OSRM estimate) */
  durationMinutes: number
  /** Ordered list of [lat, lng] for polyline rendering */
  polyline: LatLng[]
}

/** One hourly slot of weather at a location */
export interface WeatherSlot {
  /** ISO datetime string e.g. "2026-03-27T08:00" */
  time: string
  /** Wind speed km/h */
  windSpeedKmh: number
  /** Meteorological wind direction: degrees the wind is coming FROM */
  windFromDeg: number
  /** Precipitation mm in this hour */
  precipitationMm: number
}

/** Interpolated weather at a specific minute */
export interface WeatherAtTime {
  windSpeedKmh: number
  windFromDeg: number
  precipitationMm: number
}

/** Score for a single candidate departure time */
export interface DepartureScore {
  /** ISO datetime string */
  departureTime: string
  /** Weighted average headwind component km/h (positive = headwind, negative = tailwind) */
  headwindScore: number
  /** Total precipitation mm experienced during ride */
  rainScore: number
  /** Combined score (lower = better), depends on priority */
  combinedScore: number
  /** Human-readable observations e.g. "Favourable tailwind 7–8am" */
  observations: string[]
}

export type Priority = 'wind' | 'rain'
