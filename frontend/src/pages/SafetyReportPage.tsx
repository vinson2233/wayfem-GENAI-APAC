import { useState } from 'react'
import { Search, Phone, Clock } from 'lucide-react'
import { getSafetyReport } from '../api/client'
import type { SafetyReport } from '../api/client'
import SafetyBadge from '../components/SafetyBadge'
import SafetyScoreRing from '../components/SafetyScoreRing'
import { format, parseISO } from 'date-fns'

export default function SafetyReportPage() {
  const [destination, setDestination] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<SafetyReport | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!destination.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await getSafetyReport(destination.trim())
      setReport(res.data)
    } catch {
      setError('Unable to fetch safety report. Try a different destination.')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (d: string) => {
    try { return format(parseISO(d), 'MMM d, yyyy') } catch { return d }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <header>
        <p className="eyebrow mb-3">№ 002 · Threat assessment</p>
        <h1 className="display text-5xl lg:text-6xl text-ink-500 leading-[0.95] tracking-tight">
          Read what
          <br />
          <em className="text-rose-500 font-normal">the world</em> says.
        </h1>
        <p className="text-ink-400 mt-4 max-w-xl leading-relaxed">
          We pull from government advisories, recent incident reports, and women-specific
          sources. Every flag is traced back to where we read it.
        </p>
      </header>

      <form onSubmit={handleSearch} className="flex items-end gap-4 border-b border-[var(--hairline-strong)] pb-2">
        <div className="flex-1 flex items-center gap-3">
          <Search size={18} className="text-rose-500 shrink-0" />
          <input
            type="text"
            value={destination}
            onChange={e => setDestination(e.target.value)}
            placeholder="Bangkok, Thailand"
            className="flex-1 bg-transparent border-0 py-2 text-lg font-display tracking-tight focus:outline-none placeholder:text-ink-300/60"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !destination.trim()}
          className="btn-primary px-6 py-3 text-sm"
        >
          {loading ? 'Reading...' : 'Read'}
        </button>
      </form>

      {error && (
        <p className="text-sm text-rose-700 italic font-display border-l-2 border-rose-500 pl-3">{error}</p>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <span className="text-rose-300 text-3xl tracking-[0.4em]">✦ ✦ ✦</span>
            <p className="text-sm text-ink-300 italic font-display mt-3">Listening to the wires...</p>
          </div>
        </div>
      )}

      {report && !loading && (
        <article className="space-y-12">
          {/* Header */}
          <div className="grid md:grid-cols-12 gap-8 items-start">
            <div className="md:col-span-8 space-y-5">
              <p className="eyebrow text-rose-700">Destination</p>
              <h2 className="display text-5xl lg:text-7xl text-ink-500 leading-[0.92] tracking-tight">
                {report.city},
                <br />
                <em className="text-rose-500 font-normal">{report.country}</em>.
              </h2>
              <SafetyBadge threat_level={report.threat_level} size="lg" />
            </div>
            <div className="md:col-span-4 flex md:justify-end">
              <SafetyScoreRing score={report.overall_score} size={140} />
            </div>
          </div>

          {/* Summary */}
          <div className="border-t border-[var(--hairline)] pt-8">
            <p className="num-tag mb-3">i · the briefing</p>
            <p className="font-display text-xl text-ink-500 leading-relaxed tracking-tight">
              {report.summary}
            </p>
          </div>

          {/* Conditions grid */}
          <div className="grid md:grid-cols-2 gap-px bg-[var(--hairline)] border border-[var(--hairline)]">
            {[
              { label: 'Night safety', ok: report.night_safety, sub: report.night_safety ? 'Generally safe' : 'Use caution' },
              { label: 'Transit', ok: report.transportation_safe, sub: report.transportation_safe ? 'Safe to use' : 'Exercise care' },
            ].map(item => (
              <div key={item.label} className="bg-cream-50 p-6">
                <div className="flex items-baseline justify-between mb-2">
                  <p className="num-tag">{item.label}</p>
                  <span className={`w-2 h-2 rounded-full ${item.ok ? 'bg-green-500' : 'bg-rose-500'}`} />
                </div>
                <p className="font-display text-2xl text-ink-500 leading-tight">
                  {item.ok ? 'Yes,' : 'No,'} <em className={item.ok ? 'text-green-700' : 'text-rose-500'}>{item.sub.toLowerCase()}</em>
                </p>
              </div>
            ))}
          </div>

          {/* Flags */}
          {report.flags.length > 0 && (
            <div className="border-t border-[var(--hairline)] pt-8">
              <p className="num-tag mb-4">ii · what to watch</p>
              <ul className="space-y-3">
                {report.flags.map((f, i) => (
                  <li key={i} className="flex items-baseline gap-4 font-display text-lg text-ink-500 leading-snug">
                    <span className="num-tag text-rose-500 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.local_laws_notes && (
            <div className="bg-rose-50/50 border-l-2 border-rose-500 px-6 py-5">
              <p className="num-tag text-rose-700 mb-2">iii · local notes</p>
              <p className="font-display text-lg text-ink-500 leading-snug italic">{report.local_laws_notes}</p>
            </div>
          )}

          <div className="flex items-center gap-5 border-t border-[var(--hairline)] pt-6">
            <Phone size={18} className="text-rose-500" />
            <div>
              <p className="num-tag">Emergency number</p>
              <p className="font-display text-3xl text-ink-500">{report.emergency_number}</p>
            </div>
            {report.last_updated && (
              <p className="ml-auto text-xs text-ink-300 italic font-display flex items-center gap-1.5">
                <Clock size={11} />
                Updated {formatDate(report.last_updated)}
              </p>
            )}
          </div>
        </article>
      )}
    </div>
  )
}
