import { useState, useEffect, useRef, useMemo } from 'react'
import { MessageCircle, X, Send, Loader, Sparkles } from 'lucide-react'
import type { TripPlanResponse, AskMessage } from '../api/client'
import { askWayfem } from '../api/client'

interface Props {
  tripData: TripPlanResponse
}

const STORAGE_KEY_PREFIX = 'wayfem.ask.'

/** Build a compact context blob the backend can reason over without us
 *  shipping the entire trip JSON on every request. */
function buildContext(t: TripPlanResponse) {
  return {
    safety_report: {
      city: t.safety_report.city,
      country: t.safety_report.country,
      threat_level: t.safety_report.threat_level,
      overall_score: t.safety_report.overall_score,
      summary: t.safety_report.summary,
      flags: t.safety_report.flags?.slice(0, 8) ?? [],
      emergency_number: t.safety_report.emergency_number,
      local_laws_notes: t.safety_report.local_laws_notes,
      women_health_notes: t.safety_report.women_health_notes,
      cultural_notes: t.safety_report.cultural_notes?.slice(0, 6) ?? [],
      recent_incidents: t.safety_report.recent_incidents?.slice(0, 4) ?? [],
    },
    briefing: t.briefing ?? null,
    community_tips: (t.community_tips ?? [])
      .slice()
      .sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0))
      .slice(0, 5)
      .map(t => ({
        category: t.category,
        tip: t.tip,
        author_alias: t.author_alias,
        source: t.source,
      })),
    itinerary: (t.itinerary ?? []).slice(0, 1).map(d => ({
      date: d.date,
      items: d.items.slice(0, 6).map(it => ({ time: it.time, activity: it.activity, location: it.location })),
    })),
  }
}

export default function AskWayfemWidget({ tripData }: Props) {
  const storageKey = STORAGE_KEY_PREFIX + tripData.trip_id
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<AskMessage[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Persist conversation per trip
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(history)) } catch {}
  }, [history, storageKey])

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [history, busy])

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  // Generate destination-specific starter questions for first-time travelers
  const starters = useMemo(() => {
    const city = tripData.safety_report?.city || tripData.destination.split(',')[0]
    const briefing = tripData.briefing
    const out: string[] = [
      `Is it safe to walk back to my hotel in ${city} after dark?`,
      `What should I do if a taxi driver in ${city} refuses to use the meter?`,
    ]
    if (briefing?.dress_code) {
      out.push(`What should I wear visiting temples in ${city}?`)
    }
    if (briefing?.cashless_friendly === 'cash_preferred' || briefing?.cashless_friendly === 'mixed') {
      out.push(`How much cash should I bring on day 1?`)
    } else {
      out.push(`Will my card work everywhere in ${city}?`)
    }
    return out.slice(0, 4)
  }, [tripData])

  const send = async (text: string) => {
    if (!text.trim() || busy) return
    setError(null)
    const userMsg: AskMessage = { role: 'user', content: text.trim() }
    const newHistory = [...history, userMsg]
    setHistory(newHistory)
    setQuestion('')
    setBusy(true)
    try {
      const res = await askWayfem({
        question: text.trim(),
        destination: tripData.destination,
        trip_context: buildContext(tripData),
        history: history.slice(-10),
      })
      setHistory([...newHistory, { role: 'assistant', content: res.data.answer }])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {/* Floating launcher button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-3 bg-rose-500 text-cream-50 shadow-lg hover:bg-rose-700 transition-colors group"
        >
          <Sparkles size={14} className="group-hover:rotate-12 transition-transform" />
          <span className="font-display text-sm">Ask Wayfem</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed inset-x-4 bottom-4 md:inset-x-auto md:right-6 md:bottom-6 md:w-[420px] z-50 paper-card border border-rose-200 flex flex-col max-h-[80vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--hairline)]">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-rose-500" />
              <p className="eyebrow text-rose-700">Ask Wayfem</p>
              <span className="text-[10px] text-ink-300 italic font-display">grounded in your trip</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-ink-300 hover:text-ink-500 transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ minHeight: '240px' }}>
            {history.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-ink-400 font-display italic leading-relaxed">
                  First-time solo traveler? Ask anything about your trip — we'll answer using your safety report, briefing, and community tips.
                </p>
                <div className="space-y-1.5">
                  <p className="num-tag text-rose-700 mb-1">Try asking</p>
                  {starters.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="block w-full text-left text-xs italic font-display text-ink-500 border border-[var(--hairline)] hover:border-rose-300 hover:bg-rose-50/30 px-3 py-2 transition-colors"
                    >
                      "{s}"
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              history.map((m, i) => (
                <div
                  key={i}
                  className={`text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-rose-50 border-l-2 border-rose-400 px-3 py-2 ml-6 text-ink-500'
                      : 'bg-cream-100/60 border-l-2 border-[var(--hairline)] px-3 py-2 mr-6 text-ink-500 font-display'
                  }`}
                >
                  {m.content}
                </div>
              ))
            )}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-ink-300 italic font-display mr-6">
                <Loader size={11} className="animate-spin" />
                <span>thinking…</span>
              </div>
            )}
            {error && (
              <p className="text-xs text-rose-700 italic font-display bg-rose-50 px-3 py-2 border-l-2 border-rose-500">
                {error}
              </p>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={e => {
              e.preventDefault()
              send(question)
            }}
            className="border-t border-[var(--hairline)] px-4 py-3 flex items-center gap-2"
          >
            <MessageCircle size={14} className="text-ink-300 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Ask anything about your trip…"
              disabled={busy}
              className="flex-1 bg-transparent text-sm text-ink-500 placeholder:text-ink-300 outline-none"
            />
            <button
              type="submit"
              disabled={!question.trim() || busy}
              className="text-rose-500 hover:text-rose-700 disabled:text-ink-300 transition-colors"
              aria-label="Send"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
