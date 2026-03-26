import type { LatLng, WeatherSlot, WeatherAtTime } from '../types'

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast'

/** Fetch hourly wind + precipitation for a location and date range */
export async function fetchWeather(
  location: LatLng,
  startDate: string, // 'YYYY-MM-DD'
  endDate: string,
): Promise<WeatherSlot[]> {
  const params = new URLSearchParams({
    latitude: String(location.lat),
    longitude: String(location.lng),
    hourly: 'windspeed_10m,winddirection_10m,precipitation',
    windspeed_unit: 'kmh',
    start_date: startDate,
    end_date: endDate,
    timezone: 'auto',
  })

  const res = await fetch(`${OPEN_METEO}?${params}`)
  if (!res.ok) throw new Error(`Weather fetch failed: ${res.statusText}`)
  const data = await res.json()

  return data.hourly.time.map((time: string, i: number) => ({
    time,
    windSpeedKmh: data.hourly.windspeed_10m[i],
    windFromDeg: data.hourly.winddirection_10m[i],
    precipitationMm: data.hourly.precipitation[i],
  }))
}

/**
 * Linear interpolation of weather at an exact timestamp.
 * Uses the two surrounding hourly slots.
 */
export function interpolateWeather(slots: WeatherSlot[], at: Date): WeatherAtTime {
  if (!slots.length) return { windSpeedKmh: 0, windFromDeg: 0, precipitationMm: 0 }

  const atMs = at.getTime()
  const times = slots.map((s) => new Date(s.time).getTime())

  // Clamp before range
  if (atMs <= times[0]) return { windSpeedKmh: slots[0].windSpeedKmh, windFromDeg: slots[0].windFromDeg, precipitationMm: slots[0].precipitationMm }
  // Clamp after range
  if (atMs >= times[times.length - 1]) {
    const last = slots[slots.length - 1]
    return { windSpeedKmh: last.windSpeedKmh, windFromDeg: last.windFromDeg, precipitationMm: last.precipitationMm }
  }

  // Find surrounding slots
  let i = times.findIndex((t) => t > atMs) - 1
  if (i < 0) i = 0

  const t0 = times[i], t1 = times[i + 1]
  const frac = (atMs - t0) / (t1 - t0)
  const s0 = slots[i], s1 = slots[i + 1]

  return {
    windSpeedKmh: s0.windSpeedKmh + frac * (s1.windSpeedKmh - s0.windSpeedKmh),
    windFromDeg: s0.windFromDeg + frac * (s1.windFromDeg - s0.windFromDeg),
    precipitationMm: s0.precipitationMm + frac * (s1.precipitationMm - s0.precipitationMm),
  }
}
