import { useState } from 'react'
import { Search, Plus, X } from 'lucide-react'
import { getCommunityTips } from '../api/client'
import type { CommunityTip } from '../api/client'
import CommunityTipCard from '../components/CommunityTipCard'

type Category = CommunityTip['category'] | 'all'

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'transport', label: 'Transport' },
  { key: 'accommodation', label: 'Stay' },
  { key: 'food', label: 'Food' },
  { key: 'nightlife', label: 'Nightlife' },
  { key: 'emergency', label: 'Emergency' },
  { key: 'general', label: 'General' },
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
    <div className="space-y-12">
      <header className="flex items-end justify-between gap-6">
        <div>
          <p className="eyebrow mb-3">№ 004 · Community wisdom</p>
          <h1 className="display text-5xl lg:text-6xl text-ink-500 leading-[0.95] tracking-tight">
            Whispers from
            <br />
            women who've
            <br />
            <em className="text-rose-500 font-normal">been there.</em>
          </h1>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-rose hidden md:inline-flex items-center gap-2 px-5 py-3 text-sm shrink-0"
        >
          <Plus size={15} /> Share a tip
        </button>
      </header>

      <form onSubmit={handleSearch} className="flex items-end gap-4 border-b border-[var(--hairline-strong)] pb-2">
        <div className="flex-1 flex items-center gap-3">
          <Search size={18} className="text-rose-500 shrink-0" />
          <input
            type="text"
            value={destination}
            onChange={e => setDestination(e.target.value)}
            placeholder="Search a destination..."
            className="flex-1 bg-transparent border-0 py-2 text-lg font-display tracking-tight focus:outline-none placeholder:text-ink-300/60"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !destination.trim()}
          className="btn-primary px-6 py-3 text-sm"
        >
          {loading ? '...' : 'Listen'}
        </button>
      </form>

      {error && (
        <p className="text-sm text-rose-700 italic font-display border-l-2 border-rose-500 pl-3">{error}</p>
      )}

      <nav className="flex flex-wrap gap-1 border-b border-[var(--hairline)] pb-1">
        {CATEGORIES.map((cat, i) => (
          <button
            key={cat.key}
            onClick={() => handleCategoryChange(cat.key)}
            className={`relative px-4 py-2 text-sm font-medium transition-colors ${
              activeCategory === cat.key
                ? 'text-ink-500'
                : 'text-ink-300 hover:text-ink-500'
            }`}
          >
            <span className="num-tag mr-1.5 text-rose-400">{String(i + 1).padStart(2, '0')}</span>
            {cat.label}
            {activeCategory === cat.key && (
              <span className="absolute -bottom-[5px] left-0 right-0 h-px bg-rose-500" />
            )}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="text-center py-20">
          <span className="text-rose-300 text-3xl tracking-[0.4em]">✦ ✦ ✦</span>
          <p className="text-sm text-ink-300 italic font-display mt-3">Listening...</p>
        </div>
      ) : searched ? (
        filtered.length > 0 ? (
          <div className="space-y-1 max-w-3xl">
            {filtered.map((tip, i) => <CommunityTipCard key={tip.tip_id ?? i} tip={tip} />)}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="font-display italic text-3xl text-ink-300 mb-2">No tips yet.</p>
            <p className="text-sm text-ink-300">Be the first to share what you've learned.</p>
          </div>
        )
      ) : (
        <div className="text-center py-24">
          <p className="text-rose-300 text-3xl tracking-[0.4em] mb-4">✦</p>
          <p className="font-display italic text-2xl text-ink-300">Where would you like to listen?</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-ink-500/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-bloom" onClick={() => setShowModal(false)}>
          <div className="bg-cream-50 w-full max-w-md p-8 border border-[var(--hairline)]" onClick={e => e.stopPropagation()}>
            <div className="flex items-baseline justify-between mb-6">
              <h3 className="display text-3xl text-ink-500 leading-tight">
                Share a <em className="text-rose-500 font-normal">whisper</em>
              </h3>
              <button onClick={() => setShowModal(false)} className="text-ink-300 hover:text-ink-500">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleModalSubmit} className="space-y-5">
              <label className="block">
                <span className="num-tag block mb-1">01 · destination</span>
                <input
                  type="text"
                  value={modalDest || destination}
                  onChange={e => setModalDest(e.target.value)}
                  placeholder="Tokyo, Japan"
                  className="field"
                  required
                />
              </label>
              <label className="block">
                <span className="num-tag block mb-1">02 · category</span>
                <select
                  value={modalCategory}
                  onChange={e => setModalCategory(e.target.value as CommunityTip['category'])}
                  className="field"
                >
                  {CATEGORIES.filter(c => c.key !== 'all').map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="num-tag block mb-1">03 · your tip</span>
                <textarea
                  value={modalTip}
                  onChange={e => setModalTip(e.target.value)}
                  placeholder="What do you wish you'd known before you went?"
                  rows={4}
                  required
                  className="w-full bg-transparent border-0 border-b border-[var(--hairline-strong)] py-2 font-display text-base focus:outline-none focus:border-rose-500 resize-none placeholder:text-ink-300/60 placeholder:italic"
                />
              </label>
              <label className="block">
                <span className="num-tag block mb-1">04 · alias <span className="text-ink-300/70 italic">(optional)</span></span>
                <input
                  type="text"
                  value={modalAlias}
                  onChange={e => setModalAlias(e.target.value)}
                  placeholder="WanderlustWoman"
                  className="field"
                />
              </label>
              <button
                type="submit"
                disabled={modalSubmitting || !modalTip.trim()}
                className="btn-primary w-full py-3 text-sm"
              >
                {modalSubmitting ? 'Sharing...' : 'Share whisper'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
