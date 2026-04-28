import { useState } from 'react'
import { Search } from 'lucide-react'
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
    <div className="space-y-12">
      <header>
        <p className="eyebrow mb-3">№ 003 · Curated stays</p>
        <h1 className="display text-5xl lg:text-6xl text-ink-500 leading-[0.95] tracking-tight">
          Rooms that
          <br />
          <em className="text-rose-500 font-normal">care</em> who walks in.
        </h1>
        <p className="text-ink-400 mt-4 max-w-xl leading-relaxed">
          Every property scored by our Female Friendliness Index — door security,
          lobby visibility, neighborhood at night, the things that matter at 11pm.
        </p>
      </header>

      <form onSubmit={handleSearch} className="flex items-end gap-4 border-b border-[var(--hairline-strong)] pb-2">
        <div className="flex-1 flex items-center gap-3">
          <Search size={18} className="text-rose-500 shrink-0" />
          <input
            type="text"
            value={destination}
            onChange={e => setDestination(e.target.value)}
            placeholder="Where are you sleeping tonight?"
            className="flex-1 bg-transparent border-0 py-2 text-lg font-display tracking-tight focus:outline-none placeholder:text-ink-300/60"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !destination.trim()}
          className="btn-primary px-6 py-3 text-sm"
        >
          {loading ? 'Searching...' : 'Find'}
        </button>
      </form>

      {error && (
        <p className="text-sm text-rose-700 italic font-display border-l-2 border-rose-500 pl-3">{error}</p>
      )}

      {searched && (
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Filters sidebar */}
          <aside className="lg:w-60 shrink-0">
            <div className="lg:sticky lg:top-32 space-y-8">
              <div>
                <p className="eyebrow mb-4">Filters</p>
                <div className="hairline" />
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-3">
                  <span className="num-tag">Min · FFI</span>
                  <span className="font-display text-xl text-rose-500">{minFFI.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={minFFI}
                  onChange={e => setMinFFI(Number(e.target.value))}
                  className="w-full accent-rose-500"
                />
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-3">
                  <span className="num-tag">Max · per night</span>
                  <span className="font-display text-xl text-rose-500">${maxPrice}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1000"
                  step="10"
                  value={maxPrice}
                  onChange={e => setMaxPrice(Number(e.target.value))}
                  className="w-full accent-rose-500"
                />
              </div>

              <div>
                <p className="num-tag mb-2">Sort by</p>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortKey)}
                  className="w-full bg-transparent border-0 border-b border-[var(--hairline-strong)] py-2 font-display text-lg focus:outline-none focus:border-rose-500"
                >
                  <option value="ffi">FFI score</option>
                  <option value="rating">Star rating</option>
                  <option value="price">Lowest price</option>
                </select>
              </div>
            </div>
          </aside>

          <div className="flex-1">
            {loading ? (
              <div className="text-center py-20">
                <span className="text-rose-300 text-3xl tracking-[0.4em]">✦ ✦ ✦</span>
                <p className="text-sm text-ink-300 italic font-display mt-3">Knocking on doors...</p>
              </div>
            ) : filteredSorted.length > 0 ? (
              <>
                <div className="flex items-baseline justify-between mb-6">
                  <p className="num-tag">{filteredSorted.length} stays found</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredSorted.map(hotel => <HotelCard key={hotel.place_id} hotel={hotel} />)}
                </div>
              </>
            ) : (
              <div className="text-center py-20 text-ink-300">
                <p className="font-display text-3xl italic mb-2">Nothing matches.</p>
                <p className="text-sm">Loosen the filters or try a different destination.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
