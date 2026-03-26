import { useState, useCallback } from 'react'
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
  const [arriveBy, setArriveBy] = useState<Date | null>(null)
  const [scores, setScores] = useState<DepartureScore[]>([])
  const [best, setBest] = useState<DepartureScore | null>(null)
  const [priority, setPriority] = useState<Priority>('wind')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [origin, setOrigin] = useState<LatLng | null>(null)
  const [destination, setDestination] = useState<LatLng | null>(null)
  const [earliest, setEarliest] = useState<Date | null>(null)
  const [latest, setLatest] = useState<Date | null>(null)
  const [sliderTime, setSliderTime] = useState<Date | null>(null)
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null)

  const handlePriorityChange = useCallback((newPriority: Priority) => {
    setPriority(newPriority)
    if (!route || !weatherSlots.length || !earliest || !arriveBy) return
    const newScores = scoreDepartures(route, weatherSlots, earliest, arriveBy, newPriority)
    const newBest = findBestDeparture(route, weatherSlots, earliest, arriveBy, newPriority)
    setScores(newScores)
    setBest(newBest)
  }, [route, weatherSlots, earliest, arriveBy])

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

      const midIdx = Math.floor(fetchedRoute.polyline.length / 2)
      const midpoint = fetchedRoute.polyline[midIdx]

      const slots = await fetchWeather(midpoint, form.date, form.date)
      setWeatherSlots(slots)

      const earliestDate = new Date(`${form.date}T${form.earliestLeaveTime}`)
      const arriveByDate = new Date(`${form.date}T${form.arriveByTime}`)
      const latestDate = new Date(arriveByDate.getTime() - fetchedRoute.durationMinutes * 60 * 1000)

      setEarliest(earliestDate)
      setLatest(latestDate)
      setArriveBy(arriveByDate)
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
      <div className="w-80 flex-shrink-0 flex flex-col gap-3 p-3 overflow-y-auto bg-gray-50 z-10 shadow-lg">
        <RouteInput onSubmit={handleSubmit} loading={loading} />
        <PriorityToggle value={priority} onChange={handlePriorityChange} />

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
