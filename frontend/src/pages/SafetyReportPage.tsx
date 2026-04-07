import { useState } from 'react'
import { Search, Shield, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react'
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          <Shield size={24} className="text-safeher-500" />
          Safety Report Lookup
        </h1>
        <p className="text-gray-500 text-sm">Get a detailed safety assessment for any destination</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={destination}
            onChange={e => setDestination(e.target.value)}
            placeholder="Enter destination (e.g. Bangkok, Thailand)"
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

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-4 border-safeher-100 border-t-safeher-500 animate-spin" />
            <p className="text-sm text-gray-500">Analyzing safety data...</p>
          </div>
        </div>
      )}

      {report && !loading && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-safeher-50 to-purple-50 px-6 py-5 border-b border-gray-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{report.city}, {report.country}</h2>
                <div className="mt-2">
                  <SafetyBadge threat_level={report.threat_level} size="lg" />
                </div>
              </div>
              <SafetyScoreRing score={report.overall_score} size={110} />
            </div>
          </div>

          <div className="p-5 space-y-5">
            <p className="text-sm text-gray-600 leading-relaxed">{report.summary}</p>

            <div className="grid grid-cols-2 gap-3">
              <div className={`flex items-center gap-2 p-3 rounded-lg ${report.night_safety ? 'bg-green-50' : 'bg-red-50'}`}>
                {report.night_safety
                  ? <CheckCircle size={18} className="text-green-500" />
                  : <XCircle size={18} className="text-red-500" />}
                <div>
                  <p className="text-xs font-semibold text-gray-700">Night Safety</p>
                  <p className="text-xs text-gray-500">{report.night_safety ? 'Generally safe' : 'Use caution'}</p>
                </div>
              </div>
              <div className={`flex items-center gap-2 p-3 rounded-lg ${report.transportation_safe ? 'bg-green-50' : 'bg-red-50'}`}>
                {report.transportation_safe
                  ? <CheckCircle size={18} className="text-green-500" />
                  : <XCircle size={18} className="text-red-500" />}
                <div>
                  <p className="text-xs font-semibold text-gray-700">Transportation</p>
                  <p className="text-xs text-gray-500">{report.transportation_safe ? 'Safe to use' : 'Exercise caution'}</p>
                </div>
              </div>
            </div>

            {report.flags.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Safety Flags</p>
                <div className="flex flex-wrap gap-1.5">
                  {report.flags.map((f, i) => (
                    <span key={i} className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full">
                      <AlertTriangle size={10} /> {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {report.local_laws_notes && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-700 mb-1">⚖ Local Laws & Notes</p>
                <p className="text-sm text-blue-600">{report.local_laws_notes}</p>
              </div>
            )}

            <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-lg p-3">
              <Shield size={18} className="text-red-500 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-red-600">Emergency Number</p>
                <p className="text-lg font-bold text-red-800">{report.emergency_number}</p>
              </div>
            </div>

            {report.last_updated && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Clock size={11} />
                Last updated: {formatDate(report.last_updated)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
