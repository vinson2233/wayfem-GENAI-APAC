import { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, Phone, AlertOctagon, CalendarPlus, Sparkles, ArrowRight, Loader, MapPin, Shield, Cross, ArrowUpRight, CalendarDays, Building2, Users } from 'lucide-react'
import type { TripPlanResponse, ItineraryDay, Hotel } from '../api/client'
import { refineItineraryStream } from '../api/client'
import SafetyBadge from '../components/SafetyBadge'
import SafetyScoreRing from '../components/SafetyScoreRing'
import HotelCard from '../components/HotelCard'
import ItineraryCard from '../components/ItineraryCard'
import CommunityTipCard from '../components/CommunityTipCard'
import TripBriefingPanel from '../components/TripBriefingPanel'
import AskWayfemWidget from '../components/AskWayfemWidget'
import { formatCurrency } from '../utils/format'
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

function HotelsByCity({ hotels }: { hotels: Hotel[] }) {
  if (hotels.length === 0) {
    return <p className="text-ink-300 italic font-display text-center py-12">No hotels found.</p>
  }

  // Group by search_city; hotels without it go into "Other"
  const groups: Record<string, Hotel[]> = {}
  const order: string[] = []
  for (const h of hotels) {
    const key = h.search_city || 'Other'
    if (!groups[key]) {
      groups[key] = []
      order.push(key)
    }
    groups[key].push(h)
  }

  // If only one group (single-city trip), skip the headers
  if (order.length === 1) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {hotels.map(h => <HotelCard key={h.place_id} hotel={h} />)}
      </div>
    )
  }

  return (
    <div className="space-y-12">
      {order.map(city => (
        <div key={city}>
          <div className="flex items-baseline gap-3 mb-5 pb-3 border-b border-[var(--hairline)]">
            <MapPin size={14} className="text-rose-400" />
            <h3 className="display text-2xl text-ink-500">{city}</h3>
            <span className="text-xs text-ink-300 font-display italic">
              {groups[city].length} stay{groups[city].length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {groups[city].map(h => <HotelCard key={h.place_id} hotel={h} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function TripResultsPage() {
  useParams<{ tripId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const tripData: TripPlanResponse | null = location.state?.tripData ?? null

  const [activeTab, setActiveTab] = useState<Tab>('itinerary')
  const [itinerary, setItinerary] = useState<ItineraryDay[]>(tripData?.itinerary ?? [])
  const [refinePrompt, setRefinePrompt] = useState('')
  const [refining, setRefining] = useState(false)
  const [refineError, setRefineError] = useState<string | null>(null)

  useEffect(() => {
    if (!tripData) {
      navigate('/', { replace: true })
    }
  }, [tripData, navigate])

  if (!tripData) return null

  const { safety_report: sr } = tripData
  const isCritical = sr.threat_level === 'CRITICAL'
  const isHigh = sr.threat_level === 'HIGH'

  // Build live preview metadata so users can see at-a-glance what each tab holds
  const totalActivities = tripData.itinerary.reduce((acc, d) => acc + d.items.length, 0)
  const hotelCount = tripData.hotels.length
  const topFFI = hotelCount > 0
    ? Math.max(...tripData.hotels.map(h => h.female_friendliness_score))
    : 0
  const tipsCount = tripData.community_tips.length
  const redditCount = tripData.community_tips.filter(t => t.source === 'reddit').length
  const flagCount = sr.flags.length
  const safetyTone =
    sr.threat_level === 'CRITICAL' || sr.threat_level === 'HIGH'
      ? 'rose'
      : sr.threat_level === 'MEDIUM'
        ? 'amber'
        : 'emerald'

  const tabs: {
    key: Tab
    label: string
    Icon: typeof CalendarDays
    preview: string
    accent?: 'rose' | 'amber' | 'emerald'
  }[] = [
    {
      key: 'itinerary',
      label: 'Itinerary',
      Icon: CalendarDays,
      preview: `${tripData.itinerary.length} day${tripData.itinerary.length === 1 ? '' : 's'} · ${totalActivities} activit${totalActivities === 1 ? 'y' : 'ies'}`,
    },
    {
      key: 'hotels',
      label: 'Stays',
      Icon: Building2,
      preview: hotelCount > 0
        ? `${hotelCount} hotel${hotelCount === 1 ? '' : 's'} · top FFI ${topFFI.toFixed(1)}`
        : 'No hotels found',
    },
    {
      key: 'community',
      label: 'Community',
      Icon: Users,
      preview: tipsCount > 0
        ? `${tipsCount} tip${tipsCount === 1 ? '' : 's'}${redditCount > 0 ? ` · ${redditCount} from Reddit` : ''}`
        : 'No tips yet',
    },
    {
      key: 'safety',
      label: 'Safety',
      Icon: Shield,
      preview: `${sr.threat_level} · ${flagCount} flag${flagCount === 1 ? '' : 's'}`,
      accent: safetyTone,
    },
  ]

  const formatDate = (d: string) => {
    try { return format(parseISO(d), 'MMM d') } catch { return d }
  }

  const handleRefine = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!refinePrompt.trim() || refining) return
    setRefining(true)
    setRefineError(null)
    try {
      await refineItineraryStream(
        {
          prompt: refinePrompt,
          destination: tripData.destination,
          start_date: tripData.itinerary[0]?.date ?? '',
          end_date: tripData.itinerary[tripData.itinerary.length - 1]?.date ?? '',
          safety_report: tripData.safety_report,
          current_itinerary: itinerary,
          preferences: {},
        },
        (event) => {
          if (event.type === 'complete') {
            const result = event.result as { itinerary: ItineraryDay[] }
            if (result?.itinerary) setItinerary(result.itinerary)
            setRefinePrompt('')
          } else if (event.type === 'error') {
            setRefineError(event.message)
          }
        },
      )
    } catch (err) {
      setRefineError('Refinement failed. Please try again.')
    } finally {
      setRefining(false)
    }
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
              {tripData.total_cost_estimate != null && tripData.cost_currency && (
                <span className="ml-3 inline-flex items-baseline gap-1 text-rose-700">
                  · ≈ <span className="font-display text-base">{formatCurrency(tripData.total_cost_estimate, tripData.cost_currency)}</span>
                  <span className="text-[10px] text-ink-300 italic">per person</span>
                </span>
              )}
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
          {/* Trip briefing — currency, climate, do's/don'ts */}
          {tripData.briefing && <TripBriefingPanel briefing={tripData.briefing} />}

          {/* Card-style tab navigation — each tab shows an icon + label + live preview
              so Hotels and Safety are unmissable at a glance. */}
          <nav className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {tabs.map((tab, i) => {
              const isActive = activeTab === tab.key
              const accent = tab.accent
              const accentBorder =
                accent === 'rose' ? 'border-rose-300' :
                accent === 'amber' ? 'border-amber-300' :
                accent === 'emerald' ? 'border-emerald-300' :
                'border-[var(--hairline)]'
              const accentLabel =
                accent === 'rose' ? 'text-rose-700' :
                accent === 'amber' ? 'text-amber-700' :
                accent === 'emerald' ? 'text-emerald-700' :
                'text-rose-700'
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`group relative text-left p-4 border transition-all ${
                    isActive
                      ? 'border-rose-500 bg-rose-50/60 shadow-[0_0_0_3px_rgba(244,114,182,0.10)]'
                      : `${accentBorder} bg-cream-50 hover:border-ink-300 hover:bg-rose-50/30`
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <tab.Icon
                      size={18}
                      className={isActive ? 'text-rose-500' : 'text-ink-400 group-hover:text-ink-500 transition-colors'}
                    />
                    <span className="num-tag text-rose-400">{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <p className={`eyebrow mb-1 ${isActive ? 'text-rose-700' : accentLabel}`}>
                    {tab.label}
                  </p>
                  <p className={`text-xs font-display italic leading-snug ${isActive ? 'text-ink-500' : 'text-ink-400'}`}>
                    {tab.preview}
                  </p>
                  {isActive && (
                    <span className="absolute -bottom-px left-4 right-4 h-px bg-rose-500" />
                  )}
                </button>
              )
            })}
          </nav>

          {activeTab === 'itinerary' && (
            <div className="space-y-6">
              {itinerary.length > 0 && (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => downloadItineraryICS(tripData.destination, itinerary)}
                    className="inline-flex items-center gap-2 text-sm font-medium text-ink-500 link-underline"
                  >
                    <CalendarPlus size={14} />
                    Export to calendar (.ics)
                  </button>
                </div>
              )}

              {/* Refine bar */}
              <form onSubmit={handleRefine} className="border border-[var(--hairline)] bg-white px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={13} className="text-rose-400 shrink-0" />
                  <p className="eyebrow text-rose-700">Refine itinerary</p>
                </div>
                <div className="flex gap-3 items-center">
                  <input
                    type="text"
                    value={refinePrompt}
                    onChange={e => setRefinePrompt(e.target.value)}
                    placeholder="e.g. swap the museum for a food market, add a morning walk…"
                    disabled={refining}
                    className="flex-1 bg-transparent border-0 border-b border-[var(--hairline-strong)] py-1.5 font-display text-sm focus:outline-none focus:border-rose-500 placeholder:text-ink-300/60 placeholder:italic disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!refinePrompt.trim() || refining}
                    className="btn-primary px-4 py-2 text-sm inline-flex items-center gap-2 shrink-0"
                  >
                    {refining ? <Loader size={13} className="animate-spin" /> : <ArrowRight size={13} />}
                    {refining ? 'Refining…' : 'Apply'}
                  </button>
                </div>
                {refineError && (
                  <p className="mt-2 text-xs text-rose-700 italic font-display">{refineError}</p>
                )}
              </form>

              {itinerary.length > 0
                ? itinerary.map(day => <ItineraryCard key={day.day_number} day={day} />)
                : <p className="text-ink-300 italic font-display text-center py-12">No itinerary available.</p>}
            </div>
          )}

          {activeTab === 'hotels' && (
            <HotelsByCity hotels={tripData.hotels} />
          )}

          {activeTab === 'community' && (
            <div className="space-y-1">
              {tripData.community_tips.length > 0
                ? tripData.community_tips.map((tip, i) => (
                    <CommunityTipCard key={tip.tip_id ?? i} tip={tip} />
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

              {(sr.nearest_police || sr.nearest_hospital) && (
                <div className="border-t border-[var(--hairline)] pt-6">
                  <p className="num-tag mb-4">Get to safety</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sr.nearest_police && (
                      <a
                        href={
                          sr.nearest_police.place_id
                            ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(sr.nearest_police.name)}&destination_place_id=${sr.nearest_police.place_id}`
                            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sr.nearest_police.name + ' ' + sr.nearest_police.address)}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group bg-rose-50/50 border border-rose-100 hover:border-rose-300 transition-colors p-4 flex items-start gap-3"
                      >
                        <Shield size={16} className="text-rose-500 shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <p className="eyebrow text-rose-700 mb-1">Nearest police</p>
                          <p className="font-display text-base text-ink-500 leading-tight truncate">{sr.nearest_police.name}</p>
                          <p className="text-xs text-ink-400 italic mt-0.5 line-clamp-2">
                            {sr.nearest_police.address}
                            {sr.nearest_police.distance_meters != null && (
                              <span className="text-ink-300"> · {(sr.nearest_police.distance_meters / 1000).toFixed(1)} km</span>
                            )}
                          </p>
                        </div>
                        <ArrowUpRight size={14} className="text-ink-300 group-hover:text-rose-500 shrink-0" />
                      </a>
                    )}
                    {sr.nearest_hospital && (
                      <a
                        href={
                          sr.nearest_hospital.place_id
                            ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(sr.nearest_hospital.name)}&destination_place_id=${sr.nearest_hospital.place_id}`
                            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sr.nearest_hospital.name + ' ' + sr.nearest_hospital.address)}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group bg-emerald-50/50 border border-emerald-100 hover:border-emerald-300 transition-colors p-4 flex items-start gap-3"
                      >
                        <Cross size={16} className="text-emerald-600 shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <p className="eyebrow text-emerald-700 mb-1">Nearest hospital</p>
                          <p className="font-display text-base text-ink-500 leading-tight truncate">{sr.nearest_hospital.name}</p>
                          <p className="text-xs text-ink-400 italic mt-0.5 line-clamp-2">
                            {sr.nearest_hospital.address}
                            {sr.nearest_hospital.distance_meters != null && (
                              <span className="text-ink-300"> · {(sr.nearest_hospital.distance_meters / 1000).toFixed(1)} km</span>
                            )}
                          </p>
                        </div>
                        <ArrowUpRight size={14} className="text-ink-300 group-hover:text-emerald-600 shrink-0" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {sr.recent_incidents && sr.recent_incidents.length > 0 && (
                <div className="border-t border-[var(--hairline)] pt-6">
                  <p className="num-tag mb-4">Recent in {sr.city || 'destination'}</p>
                  <ul className="space-y-3">
                    {sr.recent_incidents.map((inc, i) => {
                      const tone =
                        inc.severity === 'alert' ? 'border-rose-500 bg-rose-50/40 text-rose-700' :
                        inc.severity === 'caution' ? 'border-amber-400 bg-amber-50/40 text-amber-700' :
                        'border-[var(--hairline)] bg-cream-100/40 text-ink-400'
                      return (
                        <li key={i} className={`border-l-2 ${tone} pl-4 py-2`}>
                          <div className="flex items-baseline gap-2 flex-wrap mb-1">
                            <span className="text-[10px] uppercase tracking-[0.16em] font-mono">
                              {inc.severity}
                            </span>
                            <span className="text-rose-300 text-[10px]">·</span>
                            <span className="text-xs italic font-display text-ink-300">{inc.date}</span>
                          </div>
                          <p className="text-sm text-ink-500 leading-snug">{inc.summary}</p>
                          {inc.source_url && (
                            <a
                              href={inc.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-1 text-[11px] text-ink-300 hover:text-rose-500 italic font-display"
                            >
                              source <ArrowUpRight size={9} />
                            </a>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {sr.crisis_contacts && sr.crisis_contacts.length > 0 && (
                <div className="border-t border-[var(--hairline)] pt-6">
                  <p className="num-tag mb-4">Crisis & legal contacts</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sr.crisis_contacts.map((c, i) => (
                      <div key={i} className="border border-[var(--hairline)] hover:border-rose-300 transition-colors p-3">
                        <p className="eyebrow text-rose-700 mb-1">{c.label}</p>
                        {c.phone && (
                          <p className="font-display text-base text-ink-500 leading-tight">
                            <a href={`tel:${c.phone.replace(/\s+/g, '')}`} className="hover:text-rose-500 transition-colors">
                              {c.phone}
                            </a>
                          </p>
                        )}
                        {c.website && (
                          <a
                            href={c.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-rose-500 italic font-display"
                          >
                            visit website <ArrowUpRight size={10} />
                          </a>
                        )}
                        {c.notes && (
                          <p className="text-[11px] text-ink-300 italic font-display mt-1 leading-snug">{c.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sr.cultural_notes && sr.cultural_notes.length > 0 && (
                <div className="border-t border-[var(--hairline)] pt-6">
                  <p className="num-tag mb-4">iv · cultural etiquette</p>
                  <ul className="space-y-3">
                    {sr.cultural_notes.map((note, i) => (
                      <li key={i} className="flex items-baseline gap-3">
                        <span className="text-rose-400 shrink-0 font-display">✦</span>
                        <p className="text-ink-500 leading-snug text-sm">{note}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {sr.local_safe_phrases && Object.keys(sr.local_safe_phrases).length > 0 && (
                <div className="border-t border-[var(--hairline)] pt-6">
                  <p className="num-tag mb-4">v · phrases to know</p>
                  <div className="space-y-3">
                    {Object.entries(sr.local_safe_phrases).map(([phrase, meaning]) => (
                      <div key={phrase} className="flex gap-4 items-baseline border-b border-[var(--hairline)] pb-3">
                        <p className="font-mono text-sm text-ink-500 font-semibold shrink-0 min-w-[140px]">{phrase}</p>
                        <p className="text-ink-400 text-sm leading-snug italic">{meaning}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sr.women_health_notes && (
                <div className="bg-emerald-50/50 border-l-2 border-emerald-500 px-5 py-4">
                  <p className="num-tag text-emerald-700 mb-1">vi · health & essentials</p>
                  <p className="font-display text-base text-ink-500 leading-snug">{sr.women_health_notes}</p>
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

      {/* Floating Ask Wayfem chat — grounded in this trip's safety/briefing/tips */}
      <AskWayfemWidget tripData={tripData} />
    </div>
  )
}
