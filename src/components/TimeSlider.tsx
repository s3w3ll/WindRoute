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
