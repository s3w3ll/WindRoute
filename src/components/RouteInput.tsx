import { useState } from 'react'
import AddressInput from './AddressInput'

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

  const setField = (field: keyof RouteFormValues) => (value: string) =>
    setValues(v => ({ ...v, [field]: value }))

  const setInput = (field: keyof RouteFormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues(v => ({ ...v, [field]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4 bg-white rounded-xl shadow-md">
      <h1 className="text-lg font-bold text-blue-700">WindRoute</h1>

      <AddressInput
        label="From"
        value={values.origin}
        placeholder="Start address"
        onChange={setField('origin')}
      />

      <AddressInput
        label="To"
        value={values.destination}
        placeholder="Destination address"
        onChange={setField('destination')}
      />

      <label className="flex flex-col text-sm font-medium text-gray-700">
        Date
        <input type="date" value={values.date} onChange={setInput('date')} required className="mt-1 border rounded px-2 py-1 text-sm" />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col text-sm font-medium text-gray-700">
          Earliest leave
          <input type="time" value={values.earliestLeaveTime} onChange={setInput('earliestLeaveTime')} required className="mt-1 border rounded px-2 py-1 text-sm" />
        </label>
        <label className="flex flex-col text-sm font-medium text-gray-700">
          Arrive by
          <input type="time" value={values.arriveByTime} onChange={setInput('arriveByTime')} required className="mt-1 border rounded px-2 py-1 text-sm" />
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
