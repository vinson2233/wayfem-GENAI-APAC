import { useState } from 'react'
import { Search, SlidersHorizontal, AlertTriangle } from 'lucide-react'
import { getHotels } from '../api/client'
import type { Hotel } from '../api/client'
import HotelCard from '../components/HotelCard'

type SortKey = 'ffi' | 'rating' | 'price'

export default function HotelsPage() {
  const [destination, setDestination] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [minFFI, setMinFFI] = useState(0)
  const [maxPrice, setMaxPrice] = useState(1000)
  const [sortBy, setSortBy] = useState<SortKey>('ffi')
  const [searched, setSearched] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!destination.trim()) return
    setLoading(true)
    setError(null)
    setSearched(true)
    try {
      const res = await getHotels(destination.trim(), minFFI > 0 ? minFFI : undefined)
      setHotels(res.data)
    } catch {
      setError('Could not fetch hotels. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const filteredSorted = hotels
    .filter(h => h.female_friendliness_score >= minFFI)
    .filter(h => !h.price_per_night || h.price_per_night <= maxPrice)
    .sort((a, b) => {
      if (sortBy === 'ffi') return b.female_friendliness_score - a.female_friendliness_score
      if (sortBy === 'rating') return b.rating - a.rating
      if (sortBy === 'price') return (a.price_per_night ?? 9999) - (b.price_per_night ?? 9999)
      return 0
    })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">🏨 Female-Friendly Hotels</h1>
        <p className="text-gray-500 text-sm">Find accommodations vetted for solo female travelers</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={destination}
            onChange={e => setDestination(e.target.value)}
            placeholder="Search hotels by destination"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-safeher-300"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !destination.trim()}
          className="px-5 py-2.5 bg-safeher-600 text-white font-medium rounded-lg text-sm hover:bg-safeher-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg p-3">
          <AlertTriangle size={15} className="text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {searched && !loading && (
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-56 shrink-0">
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2 mb-4">
                <SlidersHorizontal size={15} />
                Filters
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-2">
                    Min FFI Score: <span className="text-safeher-600 font-bold">{minFFI}</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={minFFI}
                    onChange={e => setMinFFI(Number(e.target.value))}
                    className="w-full accent-safeher-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-2">
                    Max Price: <span className="text-safeher-600 font-bold">${maxPrice}</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1000"
                    step="10"
                    value={maxPrice}
                    onChange={e => setMaxPrice(Number(e.target.value))}
                    className="w-full accent-safeher-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-2">Sort by</label>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as SortKey)}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-safeher-300"
                  >
                    <option value="ffi">FFI Score (Best First)</option>
                    <option value="rating">Rating</option>
                    <option value="price">Price (Lowest First)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 rounded-full border-4 border-safeher-100 border-t-safeher-500 animate-spin" />
              </div>
            ) : filteredSorted.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredSorted.map(hotel => <HotelCard key={hotel.place_id} hotel={hotel} />)}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-2">🏨</p>
                <p>No hotels match your filters. Try adjusting them.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
