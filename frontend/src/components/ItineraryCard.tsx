import { Fragment, useState, useEffect } from 'react'
import { AlertTriangle, MapPin, Clock, CalendarPlus, Navigation, Moon, Shuffle, X, ArrowRight, Footprints, Train, Car } from 'lucide-react'
import type { ItineraryDay, ItineraryItem, NightTransportPlan } from '../api/client'
import { format, parseISO } from 'date-fns'
import { RemarkBadge } from './SafetyBadge'
import { formatCurrency } from '../utils/format'

// ─── Photo library ───────────────────────────────────────────────────────────

const KEYWORD_PHOTOS: Record<string, string> = {
  temple: 'photo-1528360983277-13d401cdc186',
  mosque: 'photo-1564769625905-50e93615e769',
  museum: 'photo-1558618666-fcd25c85cd64',
  market: 'photo-1555396273-367ea4eb4db5',
  bazaar: 'photo-1555396273-367ea4eb4db5',
  beach: 'photo-1507525428034-b723cf961d3e',
  food: 'photo-1504674900247-0877df9cc836',
  cafe: 'photo-1501339847302-ac426a4a7cbb',
  coffee: 'photo-1501339847302-ac426a4a7cbb',
  restaurant: 'photo-1414235077428-338989a2e8c0',
  lunch: 'photo-1414235077428-338989a2e8c0',
  dinner: 'photo-1414235077428-338989a2e8c0',
  breakfast: 'photo-1504674900247-0877df9cc836',
  hotel: 'photo-1566073771259-6a8506099945',
  checkin: 'photo-1566073771259-6a8506099945',
  checkout: 'photo-1566073771259-6a8506099945',
  spa: 'photo-1544161515-4ab6ce6db874',
  shopping: 'photo-1483985988355-763728e1935b',
  mall: 'photo-1483985988355-763728e1935b',
  park: 'photo-1501854140801-50d01698950b',
  garden: 'photo-1416879595882-3373a0480b5b',
  street: 'photo-1477959858617-67f85cf4f1df',
  city: 'photo-1477959858617-67f85cf4f1df',
  tour: 'photo-1469854523086-cc02fe5d8800',
  walk: 'photo-1469854523086-cc02fe5d8800',
  walking: 'photo-1469854523086-cc02fe5d8800',
  night: 'photo-1514565131-fce0801e6785',
  evening: 'photo-1514565131-fce0801e6785',
  transport: 'photo-1544620347-c4fd4a3d5957',
  train: 'photo-1544620347-c4fd4a3d5957',
  taxi: 'photo-1544620347-c4fd4a3d5957',
  bus: 'photo-1544620347-c4fd4a3d5957',
  art: 'photo-1536924940846-227afb31e2a5',
  gallery: 'photo-1536924940846-227afb31e2a5',
  historical: 'photo-1552832230-c0197dd311b5',
  heritage: 'photo-1552832230-c0197dd311b5',
  palace: 'photo-1558618047-3c8c76ca4d04',
  castle: 'photo-1558618047-3c8c76ca4d04',
  waterfall: 'photo-1432405972569-7a1975d62e0b',
  river: 'photo-1506929562872-bb421503ef21',
  lake: 'photo-1507525428034-b723cf961d3e',
  mountain: 'photo-1464822759023-fed622ff2c3b',
  island: 'photo-1559128010-7c1ad6e1b6a5',
  sunrise: 'photo-1470252649378-9c29740c9fa8',
  sunset: 'photo-1470252649378-9c29740c9fa8',
  cooking: 'photo-1556909114-f6e7ad7d3136',
  class: 'photo-1556909114-f6e7ad7d3136',
  yoga: 'photo-1544367567-0f2fcb009e0b',
  meditation: 'photo-1544367567-0f2fcb009e0b',
  wildlife: 'photo-1549366021-9f761d450615',
  nature: 'photo-1501854140801-50d01698950b',
  boat: 'photo-1559494007-9f5847c49d94',
  cruise: 'photo-1559494007-9f5847c49d94',
  festival: 'photo-1533174072545-7a4b6ad7a6c3',
  cultural: 'photo-1533174072545-7a4b6ad7a6c3',
}

const FALLBACK_PHOTOS = [
  'photo-1476514525535-07fb3b4ae5f1',
  'photo-1469854523086-cc02fe5d8800',
  'photo-1488085061387-422e29b40080',
  'photo-1452421822248-d4c2b47f0c81',
  'photo-1507608616759-54f48f0af0ee',
  'photo-1501854140801-50d01698950b',
]

function findPhoto(text: string): string | null {
  const lower = text.toLowerCase()
  for (const [keyword, photoId] of Object.entries(KEYWORD_PHOTOS)) {
    if (lower.includes(keyword)) return photoId
  }
  return null
}

function getItemPhoto(item: ItineraryItem, fallbackSeed: number): string {
  const query = `${item.image_query ?? ''} ${item.activity} ${item.location}`
  const photoId = findPhoto(query) ?? FALLBACK_PHOTOS[fallbackSeed % FALLBACK_PHOTOS.length]
  return `https://images.unsplash.com/${photoId}?w=600&h=400&fit=crop&q=80`
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSafetyNoteType(note: string, isFlagged: boolean): 'warning' | 'info' | 'tip' {
  if (isFlagged) return 'warning'
  const lower = note.toLowerCase()
  const warningWords = ['avoid', 'danger', 'unsafe', 'risk', 'caution', 'beware', 'do not', "don't", 'never', 'scam', 'harass', 'threat', 'crime', 'attack', 'robbery']
  if (warningWords.some(w => lower.includes(w))) return 'warning'
  return 'info'
}

function buildGCalUrl(item: { activity: string; location: string; description?: string; safety_note?: string }, date: string, time: string): string {
  const [h, m] = time.split(':').map(Number)
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateCompact = date.replace(/-/g, '')
  const startTime = `${pad(h)}${pad(m)}00`
  const endH = (h + 1) % 24
  const endTime = `${pad(endH)}${pad(m)}00`
  const details = [item.description, item.safety_note ? `Safety note: ${item.safety_note}` : '']
    .filter(Boolean).join('\n\n')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Wayfem: ${item.activity}`,
    dates: `${dateCompact}T${startTime}/${dateCompact}T${endTime}`,
    details,
    location: item.location,
    trp: 'false',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

// ─── Real photo fetching ──────────────────────────────────────────────────────

// Module-level cache so repeated renders / multiple days don't re-fetch
const _photoCache: Record<string, string> = {}

async function fetchPlacePhoto(query: string, fallback: string): Promise<string> {
  if (_photoCache[query]) return _photoCache[query]
  try {
    const res = await fetch(`/api/v1/place-photo?q=${encodeURIComponent(query)}`)
    if (!res.ok) return fallback
    const data = await res.json()
    if (data.url) {
      _photoCache[query] = data.url
      return data.url
    }
  } catch { /* network error */ }
  return fallback
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ItineraryCardProps {
  day: ItineraryDay
}

export default function ItineraryCard({ day }: ItineraryCardProps) {
  let formattedDate = day.date
  let dayName = ''
  try {
    const parsed = parseISO(day.date)
    formattedDate = format(parsed, 'MMMM d, yyyy')
    dayName = format(parsed, 'EEEE')
  } catch { /* keep original */ }

  const [swappedItems, setSwappedItems] = useState<Record<number, ItineraryItem>>({})
  const [openAlt, setOpenAlt] = useState<number | null>(null)

  // realPhotos: idx → fetched URL (replaces Unsplash fallback once loaded)
  const [realPhotos, setRealPhotos] = useState<Record<number, string>>({})

  useEffect(() => {
    day.items.forEach((item, idx) => {
      const query = item.image_query
        ? `${item.image_query}`
        : `${item.activity} ${item.location}`
      const fallback = getItemPhoto(item, idx)
      fetchPlacePhoto(query, fallback).then(url => {
        if (url !== fallback) {
          setRealPhotos(prev => ({ ...prev, [idx]: url }))
        }
      })
    })
  }, [day.items])

  function handleSwap(idx: number, target: ItineraryItem) {
    setSwappedItems(prev => ({ ...prev, [idx]: target }))
    setOpenAlt(null)
  }

  return (
    <article className="border-t border-[var(--hairline-strong)] pt-8 pb-12">

      {/* ── Day header ── */}
      <header className="grid md:grid-cols-12 gap-6 mb-6 items-end">
        <div className="md:col-span-3">
          <p className="num-tag mb-1">Day</p>
          <p className="display text-7xl text-rose-500 leading-none">
            {String(day.day_number).padStart(2, '0')}
          </p>
        </div>
        <div className="md:col-span-9">
          <p className="eyebrow text-rose-700 mb-1">{dayName}</p>
          <p className="font-display text-2xl text-ink-500 italic">{formattedDate}</p>
        </div>
      </header>

      {/* ── AI day summary (replaces hero image) ── */}
      <div className="mb-8 pl-0 md:pl-[calc(25%+1.5rem)]">
        {day.day_summary ? (
          <p className="font-display text-lg text-ink-400 italic leading-relaxed border-l-2 border-rose-300 pl-4">
            {day.day_summary}
          </p>
        ) : (
          <div className="h-px bg-[var(--hairline)]" />
        )}
      </div>

      {/* ── Daily tip ── */}
      <div className="mb-8">
        <RemarkBadge type="tip">{day.daily_safety_tip}</RemarkBadge>
      </div>

      {/* ── Timeline ── */}
      <ol className="space-y-px">
        {day.items.map((originalItem, idx) => {
          const hasSwapped = !!swappedItems[idx]
          const displayItem = swappedItems[idx] ?? originalItem
          const swapTarget = hasSwapped ? originalItem : originalItem.alternatives?.[0]
          const isAltOpen = openAlt === idx
          const fallbackPhoto = getItemPhoto(displayItem, idx)
          const photoUrl = realPhotos[idx] ?? fallbackPhoto

          // Pull transport details from the previous item's transport_to_next
          const prevItem = idx > 0 ? day.items[idx - 1] : null
          const transport = prevItem?.transport_to_next ?? null

          // Map mode → icon + label
          const modeMeta = transport
            ? {
                walking:   { Icon: Footprints,  label: 'Walk' },
                transit:   { Icon: Train,       label: 'Transit' },
                driving:   { Icon: Car,         label: 'Car' },
                rideshare: { Icon: Car,         label: transport.app_name ?? 'Rideshare' },
              }[transport.mode]
            : null

          return (
            <Fragment key={idx}>
              {/* Transit divider — uses transport_to_next from previous item if present */}
              {idx > 0 && (transport || displayItem.travel_time_minutes != null) && (
                <li className="grid grid-cols-[80px_1fr] gap-4 py-2">
                  <div />
                  <div className="flex items-center gap-2 text-ink-300 flex-wrap">
                    {modeMeta ? (
                      <>
                        <modeMeta.Icon size={11} className="shrink-0 text-rose-400" />
                        <span className="text-[10px] uppercase tracking-[0.14em] font-mono text-ink-400">
                          {modeMeta.label} · {transport!.duration_min} min
                          {transport!.cost_estimate ? ` · ${transport!.cost_estimate}` : ''}
                        </span>
                      </>
                    ) : (
                      <>
                        <Navigation size={10} className="shrink-0" />
                        <span className="text-[10px] uppercase tracking-[0.14em] font-mono">
                          {displayItem.travel_time_minutes} min transit
                        </span>
                      </>
                    )}
                    <span className="flex-1 h-px bg-[var(--hairline)]" />
                  </div>
                  {transport?.safety_note && (
                    <>
                      <div />
                      <p className="text-[10px] italic font-display text-ink-300 leading-snug pl-4 -mt-1">
                        {transport.safety_note}
                      </p>
                    </>
                  )}
                </li>
              )}

              {/* Activity row */}
              <li className={`group border-b border-[var(--hairline)] py-6 ${displayItem.is_flagged ? 'bg-rose-50/30' : ''}`}>
                <div className="grid grid-cols-[80px_1fr] gap-4">

                  {/* Time column */}
                  <div className="text-right pt-1">
                    <p className="font-mono text-sm font-medium text-ink-500 tabular-nums">{displayItem.time}</p>
                    <div className="flex justify-end items-center gap-1 mt-1">
                      <Clock size={9} className="text-ink-300" />
                      <span className="text-[9px] uppercase tracking-[0.18em] text-ink-300">slot</span>
                    </div>
                  </div>

                  {/* Content + image */}
                  <div className="min-w-0">
                    <div className="flex gap-4 items-start">

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                          {displayItem.is_flagged && <AlertTriangle size={13} className="text-rose-700 shrink-0" />}
                          <h4 className={`font-display text-2xl leading-tight tracking-tight ${displayItem.is_flagged ? 'text-rose-700' : 'text-ink-500'}`}>
                            {displayItem.activity}
                          </h4>
                          {hasSwapped && (
                            <span className="text-[9px] uppercase tracking-[0.14em] text-rose-500 font-mono border border-rose-300 px-1.5 py-0.5 leading-none">
                              swapped
                            </span>
                          )}
                          {displayItem.estimated_cost != null && displayItem.cost_currency && (
                            <span className="text-[10px] tracking-[0.06em] text-ink-400 font-mono border border-[var(--hairline)] bg-cream-100/60 px-1.5 py-0.5 leading-none">
                              {displayItem.estimated_cost === 0
                                ? 'free'
                                : `≈ ${formatCurrency(displayItem.estimated_cost, displayItem.cost_currency)}`}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-ink-300 mb-3">
                          <MapPin size={11} />
                          <a
                            href={
                              displayItem.place_id
                                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayItem.location)}&query_place_id=${displayItem.place_id}`
                                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayItem.location)}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-rose-500 hover:underline transition-colors"
                            title="Open in Google Maps"
                          >
                            {displayItem.location}
                          </a>
                        </div>
                        {displayItem.description && (
                          <p className="text-sm text-ink-400 leading-relaxed mb-3">{displayItem.description}</p>
                        )}
                        {displayItem.safety_note && (
                          <div className="mt-2">
                            <RemarkBadge type={getSafetyNoteType(displayItem.safety_note, displayItem.is_flagged)}>
                              {displayItem.safety_note}
                            </RemarkBadge>
                          </div>
                        )}
                      </div>

                      {/* Activity photo */}
                      <div className="shrink-0 w-32 md:w-44 relative overflow-hidden" style={{ aspectRatio: '4/3' }}>
                        <img
                          src={photoUrl}
                          alt={displayItem.activity}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={e => { (e.currentTarget as HTMLImageElement).src = fallbackPhoto }}
                        />
                        {displayItem.is_flagged && (
                          <div className="absolute inset-0 bg-rose-900/20" />
                        )}
                      </div>
                    </div>

                    {/* Action row */}
                    <div className="flex items-center gap-3 mt-3">
                      {swapTarget && (
                        <button
                          type="button"
                          onClick={() => setOpenAlt(isAltOpen ? null : idx)}
                          className={`flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] font-mono transition-colors ${
                            isAltOpen
                              ? 'text-rose-600'
                              : 'text-ink-300 hover:text-rose-500'
                          }`}
                        >
                          <Shuffle size={11} />
                          <span>{hasSwapped ? 'Swap back' : 'See alternative'}</span>
                        </button>
                      )}
                      <a
                        href={buildGCalUrl(displayItem, day.date, displayItem.time)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] font-mono text-ink-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                        title="Add to Google Calendar"
                      >
                        <CalendarPlus size={11} />
                        <span>Add to calendar</span>
                      </a>
                    </div>
                  </div>
                </div>
              </li>

              {/* Swap alternative panel */}
              {isAltOpen && swapTarget && (
                <li className="grid grid-cols-[80px_1fr] gap-4">
                  <div />
                  <div className="border border-rose-200 bg-rose-50/40 px-5 py-4 mb-1">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-rose-600 font-mono">
                        {hasSwapped ? 'Original activity' : 'Alternative'}
                      </p>
                      <button type="button" onClick={() => setOpenAlt(null)} className="text-ink-300 hover:text-ink-500">
                        <X size={13} />
                      </button>
                    </div>
                    <div className="flex gap-4 items-start">
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-xl text-ink-500 leading-tight mb-1">{swapTarget.activity}</p>
                        <div className="flex items-center gap-1.5 text-xs text-ink-300 mb-2">
                          <MapPin size={10} />
                          <span>{swapTarget.location}</span>
                        </div>
                        {swapTarget.description && (
                          <p className="text-sm text-ink-400 leading-relaxed mb-3">{swapTarget.description}</p>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSwap(idx, swapTarget)}
                          className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.12em] text-rose-600 hover:text-rose-700 border border-rose-300 hover:border-rose-400 px-3 py-1.5 transition-colors"
                        >
                          <span>Use this instead</span>
                          <ArrowRight size={11} />
                        </button>
                      </div>
                      <div className="shrink-0 w-28 md:w-36 overflow-hidden" style={{ aspectRatio: '4/3' }}>
                        <img
                          src={getItemPhoto(swapTarget, idx + 100)}
                          alt={swapTarget.activity}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  </div>
                </li>
              )}
            </Fragment>
          )
        })}
      </ol>

      {/* ── Night transport ── */}
      {day.night_transport && <NightTransportCard plan={day.night_transport} />}

      {/* ── Safe return + daily cost ── */}
      <div className="mt-4 flex items-center justify-between bg-cream-200/50 border-l-2 border-rose-400 px-5 py-3">
        <div className="flex items-baseline gap-3">
          <span className="num-tag">Safe return by</span>
          <span className="font-display text-2xl text-ink-500 italic">{day.safe_return_time}</span>
        </div>
        {day.daily_cost_estimate != null && day.items[0]?.cost_currency && (
          <div className="flex items-baseline gap-2">
            <span className="num-tag text-rose-700">Day total</span>
            <span className="font-display text-lg text-ink-500 italic">
              ≈ {formatCurrency(day.daily_cost_estimate, day.items[0].cost_currency)}
            </span>
          </div>
        )}
        <span className="text-rose-400 text-lg">✦</span>
      </div>
    </article>
  )
}

// ─── Night transport sub-component ───────────────────────────────────────────

const MODE_LABELS: Record<string, string> = {
  rideshare_app: 'Rideshare app',
  metro: 'Metro',
  taxi: 'Taxi',
  walking: 'Walk',
  tuk_tuk: 'Tuk-tuk',
  bus: 'Bus',
  ferry: 'Ferry',
  tram: 'Tram',
}

function NightTransportCard({ plan }: { plan: NightTransportPlan }) {
  const modeLabel = MODE_LABELS[plan.mode] ?? plan.mode
  const displayLabel = plan.app_name ? `${modeLabel} · ${plan.app_name}` : modeLabel

  return (
    <div className="mt-6 border border-ink-500/10 bg-ink-500/[0.03] px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <Moon size={13} className="text-ink-400 shrink-0" />
        <p className="eyebrow text-ink-400">Night return</p>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
        <div className="space-y-1.5">
          <p className="font-display text-lg text-ink-500 leading-tight">{displayLabel}</p>
          <p className="text-sm text-ink-400 leading-relaxed">{plan.safety_tip}</p>
          {plan.avoid && (
            <p className="text-xs text-rose-700 italic">
              <span className="font-semibold not-italic">Avoid: </span>{plan.avoid}
            </p>
          )}
        </div>
        {plan.estimated_cost && (
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-[0.14em] text-ink-300 mb-0.5">est. cost</p>
            <p className="font-mono text-base font-semibold text-ink-500">{plan.estimated_cost}</p>
          </div>
        )}
      </div>
    </div>
  )
}
