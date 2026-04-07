import { useState } from 'react'
import { Search, Plus, X, AlertTriangle } from 'lucide-react'
import { getCommunityTips } from '../api/client'
import type { CommunityTip } from '../api/client'
import CommunityTipCard from '../components/CommunityTipCard'

type Category = CommunityTip['category'] | 'all'

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: '🌟' },
  { key: 'transport', label: 'Transport', icon: '🚗' },
  { key: 'accommodation', label: 'Stay', icon: '🏨' },
  { key: 'food', label: 'Food', icon: '🍽' },
  { key: 'nightlife', label: 'Nightlife', icon: '🌙' },
  { key: 'emergency', label: 'Emergency', icon: '🚨' },
  { key: 'general', label: 'General', icon: '💡' },
]

export default function CommunityPage() {
  const [destination, setDestination] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tips, setTips] = useState<CommunityTip[]>([])
  const [activeCategory, setActiveCategory] = useState<Category>('all')
  const [searched, setSearched] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const [modalDest, setModalDest] = useState('')
  const [modalCategory, setModalCategory] = useState<CommunityTip['category']>('general')
  const [modalTip, setModalTip] = useState('')
  const [modalAlias, setModalAlias] = useState('')
  const [modalSubmitting, setModalSubmitting] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!destination.trim()) return
    setLoading(true)
    setError(null)
    setSearched(true)
    try {
      const res = await getCommunityTips(destination.trim(), activeCategory !== 'all' ? activeCategory : undefined)
      setTips(res.data)
    } catch {
      setError('Could not load community tips. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCategoryChange = async (cat: Category) => {
    setActiveCategory(cat)
    if (!destination.trim() || !searched) return
    setLoading(true)
    try {
      const res = await getCommunityTips(destination.trim(), cat !== 'all' ? cat : undefined)
      setTips(res.data)
    } catch {
      setError('Could not load tips.')
    } finally {
      setLoading(false)
    }
  }

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setModalSubmitting(true)
    const newTip: CommunityTip = {
      destination_id: modalDest || destination,
      author_alias: modalAlias || `Traveler_${Math.random().toString(36).slice(2, 6)}`,
      tip: modalTip,
      category: modalCategory,
      upvotes: 0,
      created_at: new Date().toISOString(),
    }
    setTips(prev => [newTip, ...prev])
    setShowModal(false)
    setModalTip('')
    setModalAlias('')
    setModalSubmitting(false)
  }

  const filtered = activeCategory === 'all' ? tips : tips.filter(t => t.category === activeCategory)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">👭 Community Wisdom</h1>
          <p className="text-gray-500 text-sm">Safety tips from women who've been there</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-safeher-600 text-white text-sm font-medium rounded-lg hover:bg-safeher-700 transition-colors"
        >
          <Plus size={16} /> Share a Tip
        </button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={destination}
            onChange={e => setDestination(e.target.value)}
            placeholder="Search tips for a destination"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-safeher-300"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !destination.trim()}
          className="px-5 py-2.5 bg-safeher-600 text-white font-medium rounded-lg text-sm hover:bg-safeher-700 disabled:opacity-50"
        >
          {loading ? '...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg p-3">
          <AlertTriangle size={15} className="text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto pb-1">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => handleCategoryChange(cat.key)}
            className={`flex items-center gap-1 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeCategory === cat.key
                ? 'bg-safeher-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full border-4 border-safeher-100 border-t-safeher-500 animate-spin" />
        </div>
      ) : searched ? (
        filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((tip, i) => <CommunityTipCard key={tip.tip_id ?? i} tip={tip} />)}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-2">👭</p>
            <p>No tips found. Be the first to share!</p>
          </div>
        )
      ) : (
        <div className="text-center py-12 text-gray-300">
          <p className="text-5xl mb-3">💬</p>
          <p className="text-gray-400">Search a destination to see community tips</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Share a Safety Tip</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleModalSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Destination</label>
                <input
                  type="text"
                  value={modalDest || destination}
                  onChange={e => setModalDest(e.target.value)}
                  placeholder="e.g. Tokyo, Japan"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-safeher-300"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Category</label>
                <select
                  value={modalCategory}
                  onChange={e => setModalCategory(e.target.value as CommunityTip['category'])}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-safeher-300"
                >
                  {CATEGORIES.filter(c => c.key !== 'all').map(c => (
                    <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Your Tip</label>
                <textarea
                  value={modalTip}
                  onChange={e => setModalTip(e.target.value)}
                  placeholder="Share your safety tip or experience..."
                  rows={3}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-safeher-300 resize-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Anonymous Alias <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={modalAlias}
                  onChange={e => setModalAlias(e.target.value)}
                  placeholder="e.g. WanderlustWoman"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-safeher-300"
                />
              </div>
              <button
                type="submit"
                disabled={modalSubmitting || !modalTip.trim()}
                className="w-full py-2.5 bg-safeher-600 text-white font-medium rounded-lg text-sm hover:bg-safeher-700 disabled:opacity-50 transition-colors"
              >
                {modalSubmitting ? 'Submitting...' : 'Share Tip'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
