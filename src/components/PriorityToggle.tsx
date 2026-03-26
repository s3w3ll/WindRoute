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
