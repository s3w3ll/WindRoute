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
  const overlayRef = useRef<L.Layer | null>(null)

  useEffect(() => {
    if (!map || !sliderTime || !weatherSlots.length) return

    overlayRef.current?.remove()

    const weather = interpolateWeather(weatherSlots, sliderTime)

    // Custom Leaflet Layer that draws wind arrows on a canvas
    const WindCanvasLayer = (L.Layer as any).extend({
      onAdd(m: L.Map) {
        const pane = m.getPane('overlayPane')!
        const canvas = document.createElement('canvas')
        canvas.style.position = 'absolute'
        canvas.style.top = '0'
        canvas.style.left = '0'
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
        const m: L.Map = map!
        if (!m || !this._canvas) return
        const size = m.getSize()
        this._canvas.width = size.x
        this._canvas.height = size.y
        const ctx: CanvasRenderingContext2D = this._canvas.getContext('2d')!
        ctx.clearRect(0, 0, size.x, size.y)

        const GRID = 60 // pixels between arrows
        for (let px = GRID / 2; px < size.x; px += GRID) {
          for (let py = GRID / 2; py < size.y; py += GRID) {
            drawWindArrow(ctx, px, py, weather.windFromDeg, weather.windSpeedKmh)
          }
        }
      },
    })

    const layer = new (WindCanvasLayer as any)()
    layer.addTo(map)
    overlayRef.current = layer

    return () => {
      layer.remove()
    }
  }, [map, weatherSlots, sliderTime])

  return null
}
