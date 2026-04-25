import { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, Phone, AlertOctagon, CalendarPlus } from 'lucide-react'
import type { TripPlanResponse, ItineraryDay } from '../api/client'
import SafetyBadge from '../components/SafetyBadge'
import SafetyScoreRing from '../components/SafetyScoreRing'
import HotelCard from '../components/HotelCard'
import ItineraryCard from '../components/ItineraryCard'
import { format, parseISO } from 'date-fns'

type Tab = 'itinerary' | 'hotels' | 'community' | 'safety'

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
    { key: 'itinerary', label: 'Itinerary' },
    { key: 'hotels', label: 'Stays' },
    { key: 'community', label: 'Community' },
    { key: 'safety', label: 'Safety' },
  ]

  const formatDate = (d: string) => {
    try { return format(parseISO(d), 'MMM d') } catch { return d }
  }

  return (
    <div className="space-y-12">
      {/* ════════════════════════════════════════════════
            EDITORIAL TITLE BLOCK
         ════════════════════════════════════════════════ */}
      <header className="grid lg:grid-cols-12 gap-8 items-end pb-12 border-b border-[var(--hairline)]">
        <div className="lg:col-span-8 space-y-5">
          <div className="flex items-baseline gap-4">
            <p className="eyebrow">Your trip ·</p>
            <p className="num-tag">
              {formatDate(tripData.itinerary[0]?.date || '')}
              {' → '}
              {formatDate(tripData.itinerary[tripData.itinerary.length - 1]?.date || '')}
            </p>
          </div>
          <h1 className="display text-6xl lg:text-8xl text-ink-500 leading-[0.9] tracking-tight">
            {tripData.destination.split(',')[0]},
            {tripData.destination.includes(',') && (
              <>
                <br />
                <em className="text-rose-500 font-normal">{tripData.destination.split(',').slice(1).join(',').trim()}</em>
              </>
            )}
          </h1>
          <SafetyBadge threat_level={sr.threat_level} size="lg" />
        </div>
        <div className="lg:col-span-4 flex lg:justify-end">
          <SafetyScoreRing score={tripData.overall_safety_score} size={150} />
        </div>
      </header>

      {/* CRITICAL alert */}
      {isCritical && (
        <div className="bg-rose-700 text-cream-50 px-8 py-6 -mx-2 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-rose-700 via-rose-700 to-rose-800" />
          <div className="relative flex items-start gap-4">
            <AlertOctagon size={28} className="shrink-0 mt-1 animate-pulse" />
            <div>
              <p className="eyebrow text-rose-200 mb-2">Highest alert</p>
              <h2 className="display text-3xl mb-2 leading-tight">
                Do not travel to <em className="font-normal">{tripData.destination}</em>.
              </h2>
              <p className="text-cream-50/90 text-sm leading-relaxed">
                Our agents have flagged this destination as critically unsafe for solo female travelers right now.
                Please reconsider, and consult official advisories.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* HIGH warning bar */}
      {isHigh && !isCritical && (
        <div className="bg-orange-50/70 border-l-2 border-orange-500 px-5 py-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-orange-500 shrink-0" />
          <p className="text-orange-900 text-sm leading-relaxed">
            <span className="eyebrow text-orange-800 mr-2">High risk</span>
            Proceed with care and follow every safety recommendation in this brief.
          </p>
        </div>
      )}

      {/* Risk Flags */}
      {tripData.risk_flags.length > 0 && (
        <section>
          <p className="num-tag mb-4">i · what we flagged</p>
          <ul className="space-y-4">
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
                <li key={i} className="flex items-baseline gap-4 border-b border-[var(--hairline)] pb-4">
                  <span className="num-tag text-rose-500 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <div className="flex-1">
                    <p className="font-display text-lg text-ink-500 leading-snug tracking-tight">
                      {sourceName && (
                        <span className="italic text-ink-300 mr-1">According to {sourceName},</span>
                      )}
                      {flag}
                    </p>
                    {displayUrl && (
                      <a
                        href={displayUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-underline inline-block mt-1.5 text-xs text-rose-700"
                      >
                        Read source →
                      </a>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="grid lg:grid-cols-12 gap-12">
        {/* Main content */}
        <div className="lg:col-span-8 min-w-0">
          {/* Tabs */}
          <nav className="flex gap-1 border-b border-[var(--hairline-strong)] mb-8 overflow-x-auto">
            {tabs.map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative whitespace-nowrap px-5 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'text-ink-500'
                    : 'text-ink-300 hover:text-ink-500'
                }`}
              >
                <span className="num-tag mr-2 text-rose-400">{String(i + 1).padStart(2, '0')}</span>
                {tab.label}
                {activeTab === tab.key && (
                  <span className="absolute -bottom-[1px] left-0 right-0 h-px bg-rose-500" />
                )}
              </button>
            ))}
          </nav>

          {activeTab === 'itinerary' && (
            <div className="space-y-6">
              {tripData.itinerary.length > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={() => downloadItineraryICS(tripData.destination, tripData.itinerary)}
                    className="inline-flex items-center gap-2 text-sm font-medium text-ink-500 link-underline"
                  >
                    <CalendarPlus size={14} />
                    Export to calendar (.ics)
                  </button>
                </div>
              )}
              {tripData.itinerary.length > 0
                ? tripData.itinerary.map(day => <ItineraryCard key={day.day_number} day={day} />)
                : <p className="text-ink-300 italic font-display text-center py-12">No itinerary available.</p>}
            </div>
          )}

          {activeTab === 'hotels' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {tripData.hotels.length > 0
                ? tripData.hotels.map(hotel => <HotelCard key={hotel.place_id} hotel={hotel} />)
                : <p className="text-ink-300 italic font-display text-center py-12 col-span-2">No hotels found.</p>}
            </div>
          )}

          {activeTab === 'community' && (
            <div className="space-y-1">
              {tripData.community_tips.length > 0
                ? tripData.community_tips.map((tip, i) => (
                    <div key={i} className="border-l-2 border-rose-200 pl-6 py-4">
                      <p className="font-display text-lg text-ink-500 leading-snug italic">"{tip}"</p>
                    </div>
                  ))
                : <p className="text-ink-300 italic font-display text-center py-12">No community tips available.</p>}
            </div>
          )}

          {activeTab === 'safety' && (
            <div className="space-y-8">
              <div>
                <p className="num-tag mb-3">i · the briefing</p>
                <p className="font-display text-xl text-ink-500 leading-relaxed tracking-tight">{sr.summary}</p>
              </div>

              <div className="grid grid-cols-2 gap-px bg-[var(--hairline)] border border-[var(--hairline)]">
                {[
                  { label: 'Night', ok: sr.night_safety, sub: sr.night_safety ? 'safe' : 'use caution' },
                  { label: 'Transit', ok: sr.transportation_safe, sub: sr.transportation_safe ? 'safe' : 'careful' },
                ].map(item => (
                  <div key={item.label} className="bg-cream-50 p-5">
                    <div className="flex items-baseline justify-between mb-1">
                      <p className="num-tag">{item.label}</p>
                      <span className={`w-2 h-2 rounded-full ${item.ok ? 'bg-green-500' : 'bg-rose-500'}`} />
                    </div>
                    <p className="font-display text-2xl text-ink-500 leading-tight">
                      {item.ok ? 'Yes,' : 'No,'} <em className={item.ok ? 'text-green-700' : 'text-rose-500'}>{item.sub}</em>
                    </p>
                  </div>
                ))}
              </div>

              {sr.flags.length > 0 && (
                <div>
                  <p className="num-tag mb-3">ii · flags</p>
                  <ul className="space-y-2">
                    {sr.flags.map((f, i) => (
                      <li key={i} className="font-display text-base text-ink-500 italic">— {f}</li>
                    ))}
                  </ul>
                </div>
              )}

              {sr.local_laws_notes && (
                <div className="bg-rose-50/50 border-l-2 border-rose-500 px-5 py-4">
                  <p className="num-tag text-rose-700 mb-1">iii · local notes</p>
                  <p className="font-display text-base text-ink-500 italic leading-snug">{sr.local_laws_notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar: Emergency Contacts */}
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-32 space-y-8">
            <div className="bg-rose-50/40 border-l-2 border-rose-500 px-6 py-6">
              <div className="flex items-baseline justify-between mb-5">
                <p className="num-tag text-rose-700">Emergency · keep close</p>
                <Phone size={14} className="text-rose-500" />
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-ink-300 uppercase tracking-wider mb-1">Local emergency</p>
                  <p className="font-display text-3xl text-ink-500 tabular-nums">{sr.emergency_number}</p>
                </div>
                {Object.entries(tripData.emergency_contacts).map(([key, val]) => (
                  <div key={key} className="border-t border-rose-100 pt-3">
                    <p className="text-xs text-ink-300 uppercase tracking-wider mb-1">{key.replace(/_/g, ' ')}</p>
                    <p className="font-display text-lg text-ink-500">{val}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
