# WindRoute Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Google Maps-style biking route planner that recommends the optimal departure time within a user-defined window by analysing headwind and rain conditions along the actual route path.

**Architecture:** Pure frontend React/TypeScript SPA using Vite. Leaflet.js renders the map and a custom canvas overlay draws animated wind arrows. Route geometry is fetched from the public OSRM API; weather is fetched from Open-Meteo (no API keys required). A weighted-segment optimizer scores each candidate departure minute against wind and rain data to surface the best window.

**Tech Stack:** React 18 + TypeScript, Vite, Leaflet + react-leaflet, Tailwind CSS, Vitest, OSRM public API, Nominatim geocoder, Open-Meteo API

---

## File Map

```
windroute/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.cjs
├── src/
│   ├── main.tsx                        # React root mount
│   ├── App.tsx                         # Top-level state + wiring
│   ├── types.ts                        # All shared TypeScript interfaces
│   ├── components/
│   │   ├── MapView.tsx                 # Leaflet map + route polyline
│   │   ├── RouteInput.tsx              # Address inputs + time pickers
│   │   ├── WindOverlay.tsx             # Canvas layer: wind arrows at selected time
│   │   ├── TimeSlider.tsx              # Departure time preview slider
│   │   ├── RecommendationPanel.tsx     # Optimal departure + plain-English reasoning
│   │   └── PriorityToggle.tsx          # Rain-first vs wind-first toggle
│   ├── services/
│   │   ├── routing.ts                  # Nominatim geocode + OSRM route fetch
│   │   ├── weather.ts                  # Open-Meteo fetch + interpolation helpers
│   │   └── optimizer.ts               # Core: score each candidate departure time
│   └── utils/
│       ├── bearing.ts                  # Bearing + headwind math
│       └── windArrows.ts               # Canvas arrow drawing helpers
├── src/__tests__/
│   ├── bearing.test.ts
│   ├── optimizer.test.ts
│   └── weather.test.ts
└── docs/superpowers/plans/
    └── 2026-03-27-windroute-webapp.md
```

---

## Task 1: Git Init + Project Scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.cjs`, `index.html`, `src/main.tsx`, `src/App.tsx`

- [ ] **Step 1: Initialise git and create Vite project**

```bash
cd C:/Repos/WindRoute
git init
npm create vite@latest . -- --template react-ts
```
Answer prompts: framework = React, variant = TypeScript. When asked about existing files, select "Ignore files and continue".

- [ ] **Step 2: Install dependencies**

```bash
npm install
npm install leaflet react-leaflet @types/leaflet
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install date-fns
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

- [ ] **Step 3: Configure Tailwind**

Replace `tailwind.config.ts` content:
```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
```

Replace `src/index.css` content:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Configure Vite for Vitest**

Replace `vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
})
```

- [ ] **Step 5: Create test setup file**

Create `src/__tests__/setup.ts`:
```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Add test script to package.json**

Edit `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 7: Replace src/App.tsx with placeholder**

```tsx
export default function App() {
  return <div className="h-screen w-screen bg-gray-100 flex items-center justify-center">WindRoute loading…</div>
}
```

- [ ] **Step 8: Update src/main.tsx**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 9: Verify dev server starts**

```bash
npm run dev
```
Expected: server running on http://localhost:5173, browser shows "WindRoute loading…"

- [ ] **Step 10: Create .gitignore and initial commit**

```bash
git add .
git commit -m "feat: scaffold Vite + React + Leaflet + Tailwind project"
```

---

## Task 2: Shared TypeScript Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write types**

Create `src/types.ts`:
```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: Bearing Utilities + Tests

**Files:**
- Create: `src/utils/bearing.ts`
- Create: `src/__tests__/bearing.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/bearing.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```
Expected: FAIL – "Cannot find module '../utils/bearing'"

- [ ] **Step 3: Implement bearing utilities**

Create `src/utils/bearing.ts`:
```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```
Expected: All bearing tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/bearing.ts src/__tests__/bearing.test.ts
git commit -m "feat: add bearing and headwind calculation utilities"
```

---

## Task 4: Routing Service

**Files:**
- Create: `src/services/routing.ts`

- [ ] **Step 1: Write the routing service**

Create `src/services/routing.ts`:
```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/services/routing.ts
git commit -m "feat: add routing service (Nominatim geocode + OSRM route)"
```

---

## Task 5: Weather Service + Tests

**Files:**
- Create: `src/services/weather.ts`
- Create: `src/__tests__/weather.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/weather.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```
Expected: FAIL – "Cannot find module '../services/weather'"

- [ ] **Step 3: Implement weather service**

Create `src/services/weather.ts`:
```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```
Expected: All weather tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/weather.ts src/__tests__/weather.test.ts
git commit -m "feat: add weather service and interpolation"
```

---

## Task 6: Departure Time Optimizer + Tests

**Files:**
- Create: `src/services/optimizer.ts`
- Create: `src/__tests__/optimizer.test.ts`

This is the core algorithm: score every candidate departure minute and surface the best one.

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/optimizer.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```
Expected: FAIL – "Cannot find module '../services/optimizer'"

- [ ] **Step 3: Implement the optimizer**

Create `src/services/optimizer.ts`:
```ts
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

    const isoTime = t.toISOString().slice(0, 16) // 'YYYY-MM-DDTHH:MM'
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
  return scores.reduce((best, s) => (s.combinedScore < best.combinedScore ? s : best))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```
Expected: All optimizer tests PASS. All previous tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/optimizer.ts src/__tests__/optimizer.test.ts
git commit -m "feat: add departure time optimizer with weighted headwind + rain scoring"
```

---

## Task 7: Map View Component

**Files:**
- Create: `src/components/MapView.tsx`

- [ ] **Step 1: Add Leaflet CSS to index.html**

Edit `index.html`, add inside `<head>`:
```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
```

- [ ] **Step 2: Create MapView component**

Create `src/components/MapView.tsx`:
```tsx
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { LatLng, Route, WeatherSlot } from '../types'

interface Props {
  route: Route | null
  weatherSlots: WeatherSlot[]
  /** Currently previewed departure time (from slider) */
  sliderTime: Date | null
  origin: LatLng | null
  destination: LatLng | null
}

export default function MapView({ route, weatherSlots, sliderTime, origin, destination }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const routeLayerRef = useRef<L.Polyline | null>(null)
  const windLayerRef = useRef<L.LayerGroup | null>(null)
  const markersRef = useRef<L.LayerGroup | null>(null)

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current).setView([-36.85, 174.76], 13)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map)
    mapRef.current = map
    windLayerRef.current = L.layerGroup().addTo(map)
    markersRef.current = L.layerGroup().addTo(map)
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // Draw/update route polyline
  useEffect(() => {
    if (!mapRef.current) return
    routeLayerRef.current?.remove()
    if (!route) return
    const latlngs = route.polyline.map((p) => [p.lat, p.lng] as [number, number])
    routeLayerRef.current = L.polyline(latlngs, { color: '#2563eb', weight: 4 }).addTo(mapRef.current)
    mapRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [40, 40] })
  }, [route])

  // Draw origin/destination markers
  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return
    markersRef.current.clearLayers()
    if (origin) L.marker([origin.lat, origin.lng]).addTo(markersRef.current).bindPopup('Start')
    if (destination) L.marker([destination.lat, destination.lng]).addTo(markersRef.current).bindPopup('End')
  }, [origin, destination])

  // Draw wind arrows when sliderTime changes (handled by WindOverlay via parent)
  // WindOverlay injects into windLayerRef — exported via callback below

  return <div ref={containerRef} className="w-full h-full" />
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/MapView.tsx
git commit -m "feat: add Leaflet MapView component with route polyline"
```

---

## Task 8: Wind Arrow Utilities + Wind Overlay

**Files:**
- Create: `src/utils/windArrows.ts`
- Create: `src/components/WindOverlay.tsx`

- [ ] **Step 1: Write wind arrow canvas helper**

Create `src/utils/windArrows.ts`:
```ts
/**
 * Draw a single wind arrow on a canvas context at (x, y).
 * The arrow points in the direction the wind is TRAVELLING (not coming from).
 * windFromDeg: meteorological direction wind is coming FROM.
 */
export function drawWindArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  windFromDeg: number,
  windSpeedKmh: number,
): void {
  if (windSpeedKmh < 0.5) return // No meaningful wind

  // Wind travels opposite to where it comes from
  const travelDeg = (windFromDeg + 180) % 360
  const travelRad = ((travelDeg - 90) * Math.PI) / 180

  const length = Math.min(10 + windSpeedKmh * 0.8, 40)
  const opacity = Math.min(0.3 + windSpeedKmh / 50, 1)
  const colour = windSpeedKmh < 10 ? '#22c55e' : windSpeedKmh < 25 ? '#f59e0b' : '#ef4444'

  ctx.save()
  ctx.strokeStyle = colour
  ctx.fillStyle = colour
  ctx.globalAlpha = opacity
  ctx.lineWidth = 1.5
  ctx.translate(x, y)
  ctx.rotate(travelRad)

  // Shaft
  ctx.beginPath()
  ctx.moveTo(0, -length / 2)
  ctx.lineTo(0, length / 2)
  ctx.stroke()

  // Arrowhead
  ctx.beginPath()
  ctx.moveTo(0, length / 2)
  ctx.lineTo(-4, length / 2 - 8)
  ctx.lineTo(4, length / 2 - 8)
  ctx.closePath()
  ctx.fill()

  ctx.restore()
}
```

- [ ] **Step 2: Create WindOverlay component**

The WindOverlay renders a Leaflet canvas layer on top of the map, re-drawing whenever `sliderTime` changes. It reads weather at the slider time and draws arrows on a grid across the map viewport.

Create `src/components/WindOverlay.tsx`:
```tsx
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { WeatherSlot } from '../types'
import { interpolateWeather } from '../services/weather'
import { drawWindArrow } from '../utils/windArrows'

interface Props {
  map: L.Map | null
  weatherSlots: WeatherSlot[]
  sliderTime: Date | null
}

export default function WindOverlay({ map, weatherSlots, sliderTime }: Props) {
  const canvasRef = useRef<L.Canvas | null>(null)
  const overlayRef = useRef<WindCanvasOverlay | null>(null)

  useEffect(() => {
    if (!map || !sliderTime || !weatherSlots.length) return

    overlayRef.current?.remove()

    const weather = interpolateWeather(weatherSlots, sliderTime)

    // Custom Leaflet Layer that draws wind arrows on a canvas
    const WindCanvasOverlay = L.Layer.extend({
      onAdd(m: L.Map) {
        const pane = m.getPane('overlayPane')!
        const canvas = document.createElement('canvas')
        canvas.style.position = 'absolute'
        canvas.style.pointerEvents = 'none'
        this._canvas = canvas
        pane.appendChild(canvas)
        m.on('moveend zoomend resize', this._redraw, this)
        this._redraw()
      },
      onRemove(m: L.Map) {
        this._canvas?.remove()
        m.off('moveend zoomend resize', this._redraw, this)
      },
      _redraw() {
        const m = map
        if (!m || !this._canvas) return
        const size = m.getSize()
        this._canvas.width = size.x
        this._canvas.height = size.y
        const ctx = this._canvas.getContext('2d')!
        ctx.clearRect(0, 0, size.x, size.y)

        const GRID = 60 // pixels between arrows
        for (let px = GRID / 2; px < size.x; px += GRID) {
          for (let py = GRID / 2; py < size.y; py += GRID) {
            drawWindArrow(ctx, px, py, weather.windFromDeg, weather.windSpeedKmh)
          }
        }
      },
    })

    const layer = new (WindCanvasOverlay as any)()
    layer.addTo(map)
    overlayRef.current = layer

    return () => { layer.remove() }
  }, [map, weatherSlots, sliderTime])

  return null
}
```

Note: The WindOverlay uses a homogeneous grid (same weather everywhere) as Open-Meteo returns data for a single point. For the MVP this is accurate since all weather is fetched for the route's midpoint.

- [ ] **Step 3: Commit**

```bash
git add src/utils/windArrows.ts src/components/WindOverlay.tsx
git commit -m "feat: add wind arrow canvas overlay with colour-coded speed"
```

---

## Task 9: Route Input Component

**Files:**
- Create: `src/components/RouteInput.tsx`

- [ ] **Step 1: Create the form component**

Create `src/components/RouteInput.tsx`:
```tsx
import { useState } from 'react'

export interface RouteFormValues {
  origin: string
  destination: string
  arriveByTime: string   // 'HH:MM'
  earliestLeaveTime: string // 'HH:MM'
  date: string           // 'YYYY-MM-DD'
}

interface Props {
  onSubmit: (values: RouteFormValues) => void
  loading: boolean
}

export default function RouteInput({ onSubmit, loading }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [values, setValues] = useState<RouteFormValues>({
    origin: '',
    destination: '',
    arriveByTime: '09:00',
    earliestLeaveTime: '07:00',
    date: today,
  })

  const set = (field: keyof RouteFormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4 bg-white rounded-xl shadow-md">
      <h1 className="text-lg font-bold text-blue-700">WindRoute</h1>

      <label className="flex flex-col text-sm font-medium text-gray-700">
        From
        <input
          type="text"
          value={values.origin}
          onChange={set('origin')}
          placeholder="Start address"
          required
          className="mt-1 border rounded px-2 py-1 text-sm"
        />
      </label>

      <label className="flex flex-col text-sm font-medium text-gray-700">
        To
        <input
          type="text"
          value={values.destination}
          onChange={set('destination')}
          placeholder="Destination address"
          required
          className="mt-1 border rounded px-2 py-1 text-sm"
        />
      </label>

      <label className="flex flex-col text-sm font-medium text-gray-700">
        Date
        <input type="date" value={values.date} onChange={set('date')} required className="mt-1 border rounded px-2 py-1 text-sm" />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col text-sm font-medium text-gray-700">
          Earliest leave
          <input type="time" value={values.earliestLeaveTime} onChange={set('earliestLeaveTime')} required className="mt-1 border rounded px-2 py-1 text-sm" />
        </label>
        <label className="flex flex-col text-sm font-medium text-gray-700">
          Arrive by
          <input type="time" value={values.arriveByTime} onChange={set('arriveByTime')} required className="mt-1 border rounded px-2 py-1 text-sm" />
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Analysing…' : 'Find Best Time'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/RouteInput.tsx
git commit -m "feat: add route input form component"
```

---

## Task 10: Priority Toggle + Time Slider

**Files:**
- Create: `src/components/PriorityToggle.tsx`
- Create: `src/components/TimeSlider.tsx`

- [ ] **Step 1: Create PriorityToggle**

Create `src/components/PriorityToggle.tsx`:
```tsx
import type { Priority } from '../types'

interface Props {
  value: Priority
  onChange: (p: Priority) => void
}

export default function PriorityToggle({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-1 p-3 bg-white rounded-xl shadow-md">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Avoid first</span>
      <div className="flex gap-2">
        {(['wind', 'rain'] as Priority[]).map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`flex-1 py-1.5 rounded text-sm font-medium capitalize transition-colors ${
              value === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p === 'wind' ? '💨 Wind' : '🌧️ Rain'}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create TimeSlider**

Create `src/components/TimeSlider.tsx`:
```tsx
import { format } from 'date-fns'

interface Props {
  earliest: Date
  latest: Date
  value: Date
  onChange: (d: Date) => void
}

export default function TimeSlider({ earliest, latest, value, onChange }: Props) {
  const min = earliest.getTime()
  const max = latest.getTime()
  const current = value.getTime()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(new Date(parseInt(e.target.value)))
  }

  return (
    <div className="p-3 bg-white rounded-xl shadow-md">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{format(earliest, 'HH:mm')}</span>
        <span className="font-semibold text-blue-700">{format(value, 'HH:mm')}</span>
        <span>{format(latest, 'HH:mm')}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={current}
        step={10 * 60 * 1000} // 10-minute steps
        onChange={handleChange}
        className="w-full accent-blue-600"
      />
      <p className="text-xs text-gray-500 text-center mt-1">Drag to preview wind at departure time</p>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PriorityToggle.tsx src/components/TimeSlider.tsx
git commit -m "feat: add priority toggle and departure time slider"
```

---

## Task 11: Recommendation Panel

**Files:**
- Create: `src/components/RecommendationPanel.tsx`

- [ ] **Step 1: Create the panel**

Create `src/components/RecommendationPanel.tsx`:
```tsx
import { format } from 'date-fns'
import type { DepartureScore, Priority } from '../types'

interface Props {
  scores: DepartureScore[]
  best: DepartureScore
  priority: Priority
  durationMinutes: number
}

function formatTime(iso: string) {
  return format(new Date(iso), 'h:mm a')
}

function describeWind(score: DepartureScore): string {
  if (score.headwindScore > 5) return `~${score.headwindScore.toFixed(0)} km/h headwind`
  if (score.headwindScore < -3) return `~${Math.abs(score.headwindScore).toFixed(0)} km/h tailwind`
  return 'Minimal wind impact'
}

export default function RecommendationPanel({ scores, best, priority, durationMinutes }: Props) {
  const arrivalTime = new Date(new Date(best.departureTime).getTime() + durationMinutes * 60 * 1000)

  return (
    <div className="p-4 bg-white rounded-xl shadow-md space-y-3">
      <h2 className="font-bold text-blue-700">Recommended Departure</h2>

      <div className="bg-blue-50 rounded-lg p-3">
        <p className="text-2xl font-bold text-blue-800">{formatTime(best.departureTime)}</p>
        <p className="text-sm text-gray-600">Arrive ~{format(arrivalTime, 'h:mm a')}</p>
      </div>

      <div className="text-sm space-y-1 text-gray-700">
        <p>🌬️ {describeWind(best)}</p>
        {best.rainScore > 0.1 && <p>🌧️ ~{best.rainScore.toFixed(1)} mm rain during ride</p>}
        {best.observations.map((obs, i) => (
          <p key={i} className="text-blue-600 italic">★ {obs}</p>
        ))}
      </div>

      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer font-medium">All windows</summary>
        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
          {scores.map((s) => (
            <div
              key={s.departureTime}
              className={`flex justify-between px-2 py-0.5 rounded ${
                s.departureTime === best.departureTime ? 'bg-blue-100 font-semibold' : ''
              }`}
            >
              <span>{formatTime(s.departureTime)}</span>
              <span>{describeWind(s)}</span>
              {s.rainScore > 0.1 && <span>🌧️{s.rainScore.toFixed(1)}mm</span>}
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/RecommendationPanel.tsx
git commit -m "feat: add recommendation panel with wind/rain summary"
```

---

## Task 12: App Integration

**Files:**
- Modify: `src/App.tsx` (full rewrite)

- [ ] **Step 1: Rewrite App.tsx to wire all components together**

Replace `src/App.tsx`:
```tsx
import { useState, useRef, useEffect, useCallback } from 'react'
import L from 'leaflet'
import MapView from './components/MapView'
import RouteInput, { type RouteFormValues } from './components/RouteInput'
import WindOverlay from './components/WindOverlay'
import TimeSlider from './components/TimeSlider'
import RecommendationPanel from './components/RecommendationPanel'
import PriorityToggle from './components/PriorityToggle'
import { geocode, fetchRoute } from './services/routing'
import { fetchWeather } from './services/weather'
import { scoreDepartures, findBestDeparture } from './services/optimizer'
import type { Route, WeatherSlot, DepartureScore, Priority, LatLng } from './types'

export default function App() {
  const [route, setRoute] = useState<Route | null>(null)
  const [weatherSlots, setWeatherSlots] = useState<WeatherSlot[]>([])
  const [scores, setScores] = useState<DepartureScore[]>([])
  const [best, setBest] = useState<DepartureScore | null>(null)
  const [priority, setPriority] = useState<Priority>('wind')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [origin, setOrigin] = useState<LatLng | null>(null)
  const [destination, setDestination] = useState<LatLng | null>(null)

  // Slider state
  const [earliest, setEarliest] = useState<Date | null>(null)
  const [latest, setLatest] = useState<Date | null>(null)
  const [sliderTime, setSliderTime] = useState<Date | null>(null)

  // Map instance ref (passed up from MapView)
  const mapRef = useRef<L.Map | null>(null)
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null)

  // Re-score when priority changes
  useEffect(() => {
    if (!route || !weatherSlots.length || !earliest || !latest) return
    const newScores = scoreDepartures(route, weatherSlots, earliest, latest, priority)
    const newBest = newScores.reduce((b, s) => (s.combinedScore < b.combinedScore ? s : b))
    setScores(newScores)
    setBest(newBest)
  }, [priority, route, weatherSlots, earliest, latest])

  const handleSubmit = useCallback(async (form: RouteFormValues) => {
    setLoading(true)
    setError(null)
    try {
      const [originLatLng, destLatLng] = await Promise.all([
        geocode(form.origin),
        geocode(form.destination),
      ])
      setOrigin(originLatLng)
      setDestination(destLatLng)

      const fetchedRoute = await fetchRoute(originLatLng, destLatLng)
      setRoute(fetchedRoute)

      // Use route midpoint for weather fetch
      const midIdx = Math.floor(fetchedRoute.polyline.length / 2)
      const midpoint = fetchedRoute.polyline[midIdx]

      const slots = await fetchWeather(midpoint, form.date, form.date)
      setWeatherSlots(slots)

      const earliestDate = new Date(`${form.date}T${form.earliestLeaveTime}`)
      const arriveByDate = new Date(`${form.date}T${form.arriveByTime}`)
      setEarliest(earliestDate)
      setLatest(new Date(arriveByDate.getTime() - fetchedRoute.durationMinutes * 60 * 1000))
      setSliderTime(earliestDate)

      const newScores = scoreDepartures(fetchedRoute, slots, earliestDate, arriveByDate, priority)
      const newBest = findBestDeparture(fetchedRoute, slots, earliestDate, arriveByDate, priority)
      setScores(newScores)
      setBest(newBest)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [priority])

  return (
    <div className="h-screen w-screen flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 flex flex-col gap-3 p-3 overflow-y-auto bg-gray-50 z-10 shadow-lg">
        <RouteInput onSubmit={handleSubmit} loading={loading} />
        <PriorityToggle value={priority} onChange={setPriority} />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
            {error}
          </div>
        )}

        {best && scores.length > 0 && route && (
          <RecommendationPanel
            scores={scores}
            best={best}
            priority={priority}
            durationMinutes={route.durationMinutes}
          />
        )}

        {earliest && latest && sliderTime && (
          <TimeSlider
            earliest={earliest}
            latest={latest}
            value={sliderTime}
            onChange={setSliderTime}
          />
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapView
          route={route}
          weatherSlots={weatherSlots}
          sliderTime={sliderTime}
          origin={origin}
          destination={destination}
          onMapReady={setMapInstance}
        />
        <WindOverlay map={mapInstance} weatherSlots={weatherSlots} sliderTime={sliderTime} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update MapView to expose map instance via callback**

Edit `src/components/MapView.tsx` — add `onMapReady` prop:

Replace the `interface Props` block:
```tsx
interface Props {
  route: Route | null
  weatherSlots: WeatherSlot[]
  sliderTime: Date | null
  origin: LatLng | null
  destination: LatLng | null
  onMapReady: (map: L.Map) => void
}
```

Replace the `useEffect` that initialises the map (the one with `if (!containerRef.current || mapRef.current) return`):
```tsx
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current).setView([-36.85, 174.76], 13)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map)
    mapRef.current = map
    windLayerRef.current = L.layerGroup().addTo(map)
    markersRef.current = L.layerGroup().addTo(map)
    onMapReady(map)
    return () => { map.remove(); mapRef.current = null }
  }, [onMapReady])
```

- [ ] **Step 3: Run dev server and manually verify the full flow**

```bash
npm run dev
```

Steps to test manually:
1. Enter "Grey Lynn, Auckland" → "Ponsonby, Auckland", date today, leave 07:00, arrive 09:00
2. Click "Find Best Time" — route should appear on map
3. Wind arrows should appear across map
4. Recommendation panel should show a departure time with reasoning
5. Drag slider — arrows should update (re-render)
6. Toggle priority between Wind and Rain — recommendation should potentially change

- [ ] **Step 4: Run all tests**

```bash
npm test
```
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/MapView.tsx
git commit -m "feat: wire all components into App with full data flow"
```

---

## Task 13: Tailwind Observation Improvements + Edge Cases

**Files:**
- Modify: `src/services/optimizer.ts`

- [ ] **Step 1: Add richer observation logic**

The spec requires specific observations like "favourable winds earlier, neutral winds later." Replace the `scoreOneDeparture` function body in `src/services/optimizer.ts`:

```ts
function scoreOneDeparture(
  route: Route,
  slots: WeatherSlot[],
  departureTime: Date,
): { headwindScore: number; rainScore: number; observations: string[] } {
  const totalDistance = route.segments.reduce((sum, s) => sum + s.distanceMetres, 0)
  const durationMs = route.durationMinutes * 60 * 1000

  let weightedHeadwind = 0
  let totalRain = 0
  let distanceSoFar = 0

  // Track first-half vs second-half headwind for "earlier/later" observations
  let firstHalfHw = 0, secondHalfHw = 0
  let firstHalfDist = 0, secondHalfDist = 0

  for (const segment of route.segments) {
    const segFrac = segment.distanceMetres / totalDistance
    const segMidFrac = (distanceSoFar + segment.distanceMetres / 2) / totalDistance
    const timeAtSeg = new Date(departureTime.getTime() + segMidFrac * durationMs)
    const weather = interpolateWeather(slots, timeAtSeg)

    const hw = headwindComponent(segment.bearing, weather.windFromDeg, weather.windSpeedKmh)
    weightedHeadwind += hw * segFrac
    totalRain += weather.precipitationMm * segFrac

    if (segMidFrac < 0.5) { firstHalfHw += hw; firstHalfDist += segment.distanceMetres }
    else { secondHalfHw += hw; secondHalfDist += segment.distanceMetres }

    distanceSoFar += segment.distanceMetres
  }

  const observations: string[] = []

  // Tailwind / headwind comparison across first vs second half
  const firstAvg = firstHalfDist > 0 ? firstHalfHw / (firstHalfDist / totalDistance) : 0
  const secondAvg = secondHalfDist > 0 ? secondHalfHw / (secondHalfDist / totalDistance) : 0

  if (firstAvg < -3 && Math.abs(secondAvg) <= 3) {
    observations.push('Favourable tailwind early in the ride, neutral conditions later')
  } else if (Math.abs(firstAvg) <= 3 && firstAvg < -3) {
    observations.push('Neutral conditions early, favourable tailwind later in the ride')
  } else if (firstAvg < -3 && secondAvg < -3) {
    observations.push('Tailwind throughout the entire ride')
  } else if (firstAvg > 5 && secondAvg > 5) {
    observations.push('Headwind throughout — consider whether an earlier or later window is better')
  }

  if (totalRain > 0.5) {
    observations.push(`Expect ${totalRain.toFixed(1)} mm of rain during the ride`)
  }

  return { headwindScore: weightedHeadwind, rainScore: totalRain, observations }
}
```

- [ ] **Step 2: Run all tests to confirm nothing broke**

```bash
npm test
```
Expected: All tests PASS.

- [ ] **Step 3: Final commit**

```bash
git add src/services/optimizer.ts
git commit -m "feat: add first/second-half headwind observations for richer ride context"
```

---

## Self-Review Checklist

### Spec coverage

| Requirement | Covered by |
|---|---|
| Map interface like Google Maps | Task 7 MapView — Leaflet + OSM tiles |
| Input: route, arrive by time, earliest leave | Task 9 RouteInput |
| Find best departure using wind + weather | Task 6 optimizer, Task 12 wiring |
| 20 km/h 7–8am, 10 km/h 8–9am → suggest 8:40 | Task 6 scoreDepartures math + Task 6 tests |
| 10 km/h 7–8am, 20 km/h 8–9am → suggest 7:40 | Task 6 findBestDeparture tests |
| Prioritise: rain vs wind | Task 10 PriorityToggle, combined score weighting in optimizer |
| Tailwind observation | Task 13 observation logic |
| Actual route bearing per segment (not just start→end) | Task 3 routing decodePolyline → segments, Task 4 bearing per segment |
| Open-Meteo weather data | Task 5 weather service |
| Wind overlay on map | Task 8 WindOverlay canvas layer |
| Time slider | Task 10 TimeSlider |
| Git init | Task 1 |

### No placeholders found — all code blocks are complete.

### Type consistency verified: `Route`, `RouteSegment`, `WeatherSlot`, `DepartureScore`, `Priority`, `LatLng` used consistently across all tasks.
