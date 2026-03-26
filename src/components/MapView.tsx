import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { LatLng, Route, WeatherSlot } from '../types'

interface Props {
  route: Route | null
  weatherSlots: WeatherSlot[]
  sliderTime: Date | null
  origin: LatLng | null
  destination: LatLng | null
  onMapReady: (map: L.Map) => void
}

export default function MapView({ route, weatherSlots: _weatherSlots, sliderTime: _sliderTime, origin, destination, onMapReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const routeLayerRef = useRef<L.Polyline | null>(null)
  const markersRef = useRef<L.LayerGroup | null>(null)

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current).setView([-36.85, 174.76], 13)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map)
    mapRef.current = map
    markersRef.current = L.layerGroup().addTo(map)
    onMapReady(map)
    return () => { map.remove(); mapRef.current = null }
  }, [onMapReady])

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

  return <div ref={containerRef} className="w-full h-full" />
}
