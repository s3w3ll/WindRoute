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

export default function RecommendationPanel({ scores, best, priority: _priority, durationMinutes }: Props) {
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
