import { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, Phone, MapPin, Shield, AlertOctagon, CalendarPlus } from 'lucide-react'
import type { TripPlanResponse, ItineraryDay } from '../api/client'
import SafetyBadge from '../components/SafetyBadge'
import SafetyScoreRing from '../components/SafetyScoreRing'
import HotelCard from '../components/HotelCard'
import ItineraryCard from '../components/ItineraryCard'
import { format, parseISO } from 'date-fns'

type Tab = 'itinerary' | 'hotels' | 'community' | 'safety'

/** Generate and download an ICS file for the full itinerary. */
function downloadItineraryICS(destination: string, itinerary: ItineraryDay[]) {
  const esc = (s: string) => s.replace(/[,;\\]/g, c => `\\${c}`).replace(/\n/g, '\\n')
  const pad = (n: number) => String(n).padStart(2, '0')

  const events: string[] = []
  for (const day of itinerary) {
    for (const item of day.items) {
      const dateCompact = day.date.replace(/-/g, '')
      const [h, m] = (item.time || '09:00').split(':').map(Number)
      const startDT = `${dateCompact}T${pad(h)}${pad(m)}00`
      const endDT = `${dateCompact}T${pad(Math.min(h + 1, 23))}${pad(m)}00`
      const details = [item.description, item.safety_note ? `Safety note: ${item.safety_note}` : '']
        .filter(Boolean).join('\n')

      events.push([
        'BEGIN:VEVENT',
        `DTSTART:${startDT}`,
        `DTEND:${endDT}`,
        `SUMMARY:${esc(`Wayfem: ${item.activity}`)}`,
        `LOCATION:${esc(item.location)}`,
        details ? `DESCRIPTION:${esc(details)}` : '',
        `STATUS:CONFIRMED`,
        `END:VEVENT`,
      ].filter(Boolean).join('\r\n'))
    }
  }

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wayfem//Travel Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Wayfem — ${esc(destination)}`,
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `wayfem-${destination.toLowerCase().replace(/\s+/g, '-')}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

export default function TripResultsPage() {
  useParams<{ tripId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('itinerary')

  const tripData: TripPlanResponse | null = location.state?.tripData ?? null

  useEffect(() => {
    if (!tripData) {
      navigate('/', { replace: true })
    }
  }, [tripData, navigate])

  if (!tripData) return null

  const { safety_report: sr } = tripData
  const isCritical = sr.threat_level === 'CRITICAL'
  const isHigh = sr.threat_level === 'HIGH'

  const tabs: { key: Tab; label: string }[] = [
    { key: 'itinerary', label: '📅 Itinerary' },
    { key: 'hotels', label: '🏨 Hotels' },
    { key: 'community', label: '👭 Community Tips' },
    { key: 'safety', label: '🛡 Safety Report' },
  ]

  const formatDate = (d: string) => {
    try { return format(parseISO(d), 'MMM d, yyyy') } catch { return d }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={18} className="text-safeher-500" />
              <h1 className="text-2xl font-bold text-gray-900">{tripData.destination}</h1>
            </div>
            <p className="text-sm text-gray-500">
              {formatDate(tripData.itinerary[0]?.date || '')} — {formatDate(tripData.itinerary[tripData.itinerary.length - 1]?.date || '')}
            </p>
            <div className="mt-2">
              <SafetyBadge threat_level={sr.threat_level} size="md" />
            </div>
          </div>
          <SafetyScoreRing score={tripData.overall_safety_score} size={120} />
        </div>
      </div>

      {/* CRITICAL alert */}
      {isCritical && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-6 animate-pulse">
          <div className="flex items-center gap-3 mb-3">
            <AlertOctagon size={28} className="text-red-600" />
            <h2 className="text-xl font-bold text-red-800">DO NOT TRAVEL — Critical Risk Destination</h2>
          </div>
          <p className="text-red-700 mb-3">
            Our AI safety agents have flagged <strong>{tripData.destination}</strong> as critically unsafe for solo female travelers at this time. We strongly advise against traveling here.
          </p>
          <p className="text-red-600 text-sm">Please consider an alternative destination or consult official government travel advisories before proceeding.</p>
        </div>
      )}

      {/* HIGH warning bar */}
      {isHigh && !isCritical && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-5 py-3 flex items-center gap-3">
          <AlertTriangle size={20} className="text-orange-500 shrink-0" />
          <p className="text-orange-800 font-medium text-sm">
            ⚠ High Risk Destination — Proceed with caution and take all recommended safety precautions
          </p>
        </div>
      )}

      {/* Risk Flags */}
      {tripData.risk_flags.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-1">
            <AlertTriangle size={14} /> Risk Flags
          </h3>
          <ul className="space-y-3">
            {tripData.risk_flags.map((flag, i) => {
              const source = tripData.safety_report?.flag_sources?.[i]
              const isUrl = source?.startsWith('http')
              const searchUrl = source && !isUrl
                ? `https://www.google.com/search?q=${encodeURIComponent(source + ' ' + tripData.destination + ' travel safety')}`
                : null
              const displayUrl = isUrl ? source : searchUrl

              let sourceName = ''
              if (source) {
                if (isUrl) {
                  try {
                    const host = new URL(source).hostname.replace(/^www\./, '')
                    // Convert known domains to friendly names
                    const knownNames: Record<string, string> = {
                      'travel.state.gov': 'US State Department',
                      'gov.uk': 'UK FCDO',
                      'smartraveller.gov.au': 'Australian DFAT',
                      'lonelyplanet.com': 'Lonely Planet',
                      'tripadvisor.com': 'TripAdvisor',
                    }
                    sourceName = Object.entries(knownNames).find(([k]) => host.includes(k))?.[1] ?? host
                  } catch {
                    sourceName = source
                  }
                } else {
                  sourceName = source
                }
              }

              return (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-amber-400 mt-0.5 shrink-0">⚠</span>
                  <div className="leading-relaxed text-amber-800">
                    {sourceName && (
                      <span className="font-semibold">According to {sourceName}, </span>
                    )}
                    <span>{flag}</span>
                    {displayUrl && (
                      <a
                        href={displayUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 ml-2 text-xs text-amber-600 bg-amber-100 hover:bg-amber-200 hover:text-amber-900 px-2 py-0.5 rounded-full border border-amber-200 transition-colors cursor-pointer"
                      >
                        🔗 source
                      </a>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 whitespace-nowrap text-sm font-medium px-3 py-2 rounded-lg transition-all ${
                  activeTab === tab.key
                    ? 'bg-white text-safeher-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'itinerary' && (
            <div className="space-y-4">
              {tripData.itinerary.length > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={() => downloadItineraryICS(tripData.destination, tripData.itinerary)}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-[#1a73e8] hover:bg-[#1558b0] px-4 py-2 rounded-xl transition-colors shadow-sm"
                  >
                    <CalendarPlus size={16} />
                    Export All to Calendar (.ics)
                  </button>
                </div>
              )}
              {tripData.itinerary.length > 0
                ? tripData.itinerary.map(day => <ItineraryCard key={day.day_number} day={day} />)
                : <p className="text-gray-500 text-sm text-center py-8">No itinerary available.</p>}
            </div>
          )}

          {activeTab === 'hotels' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tripData.hotels.length > 0
                ? tripData.hotels.map(hotel => <HotelCard key={hotel.place_id} hotel={hotel} />)
                : <p className="text-gray-500 text-sm text-center py-8 col-span-2">No hotels found.</p>}
            </div>
          )}

          {activeTab === 'community' && (
            <div className="space-y-3">
              {tripData.community_tips.length > 0
                ? tripData.community_tips.map((tip, i) => (
                    <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                      <p className="text-sm text-gray-700">💡 {tip}</p>
                    </div>
                  ))
                : <p className="text-gray-500 text-sm text-center py-8">No community tips available.</p>}
            </div>
          )}

          {activeTab === 'safety' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">Safety Overview</h3>
                  <SafetyBadge threat_level={sr.threat_level} />
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{sr.summary}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className={`flex items-center gap-2 p-3 rounded-lg ${sr.night_safety ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    <span>{sr.night_safety ? '✓' : '✗'}</span>
                    <span className="text-sm font-medium">Night Safety</span>
                  </div>
                  <div className={`flex items-center gap-2 p-3 rounded-lg ${sr.transportation_safe ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    <span>{sr.transportation_safe ? '✓' : '✗'}</span>
                    <span className="text-sm font-medium">Transportation</span>
                  </div>
                </div>
                {sr.flags.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Flags</p>
                    <div className="flex flex-wrap gap-1">
                      {sr.flags.map((f, i) => (
                        <span key={i} className="text-xs bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 rounded-full">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {sr.local_laws_notes && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <p className="text-xs font-semibold text-blue-700 mb-1">Local Laws & Notes</p>
                    <p className="text-sm text-blue-600">{sr.local_laws_notes}</p>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Shield size={14} className="text-safeher-500" />
                  Emergency: <span className="font-semibold text-gray-700">{sr.emergency_number}</span>
                </div>
                {sr.last_updated && (
                  <p className="text-xs text-gray-400">Last updated: {formatDate(sr.last_updated)}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: Emergency Contacts */}
        <div className="lg:w-72 shrink-0">
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 shadow-sm lg:sticky lg:top-24">
            <h3 className="font-semibold text-red-800 flex items-center gap-2 mb-3">
              <Phone size={15} className="text-red-500" />
              Emergency Contacts
            </h3>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-red-500 font-medium">Local Emergency</p>
                <p className="text-sm font-bold text-red-800">{sr.emergency_number}</p>
              </div>
              {Object.entries(tripData.emergency_contacts).map(([key, val]) => (
                <div key={key} className="border-t border-red-100 pt-2">
                  <p className="text-xs text-red-500 font-medium capitalize">{key.replace(/_/g, ' ')}</p>
                  <p className="text-sm text-red-800">{val}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
