/**
 * Draw a single wind arrow on a canvas context at (x, y).
 * Arrow points in the direction the wind is TRAVELLING (not coming from).
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
