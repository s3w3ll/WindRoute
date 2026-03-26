import { useState, useEffect, useRef, useCallback } from 'react'

interface Suggestion {
  place_id: number
  display_name: string
}

interface Props {
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}

export default function AddressInput({ label, value, placeholder, onChange }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const search = useCallback((query: string) => {
    if (query.length < 3) { setSuggestions([]); return }
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`
    fetch(url, { headers: { 'Accept-Language': 'en' } })
      .then(r => r.json())
      .then((data: Suggestion[]) => { setSuggestions(data); setOpen(true) })
      .catch(() => setSuggestions([]))
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    onChange(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(v), 350)
  }

  const handleSelect = (name: string) => {
    onChange(name)
    setSuggestions([])
    setOpen(false)
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={containerRef} className="flex flex-col text-sm font-medium text-gray-700 relative">
      {label}
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        required
        autoComplete="off"
        className="mt-1 border rounded px-2 py-1 text-sm"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute top-full left-0 right-0 z-50 mt-0.5 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map(s => (
            <li
              key={s.place_id}
              onMouseDown={() => handleSelect(s.display_name)}
              className="px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0 leading-snug"
            >
              {s.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
