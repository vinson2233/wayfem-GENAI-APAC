import { AlertTriangle, MapPin, Clock, CalendarPlus } from 'lucide-react'
import type { ItineraryDay } from '../api/client'
import { format, parseISO } from 'date-fns'
import { RemarkBadge } from './SafetyBadge'

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
    if (lower.includes(keyword)) {
      return photoId
    }
  }
  return null
}

function getImageForDay(day: ItineraryDay): string {
  const allText = day.items.map(i => `${i.activity} ${i.location}`).join(' ')
  const photoId = findPhoto(allText) ?? FALLBACK_PHOTOS[(day.day_number - 1) % FALLBACK_PHOTOS.length]
  return `https://images.unsplash.com/${photoId}?w=1400&h=500&fit=crop&q=85`
}

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
  } catch {
    // keep original
  }

  const imageUrl = getImageForDay(day)

  return (
    <article className="border-t border-[var(--hairline-strong)] pt-8 pb-12">
      {/* Day header — editorial */}
      <header className="grid md:grid-cols-12 gap-6 mb-8 items-end">
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

      {/* Hero image */}
      <div className="relative overflow-hidden mb-8 group" style={{ aspectRatio: '21/9' }}>
        <img
          src={imageUrl}
          alt={`Day ${day.day_number}`}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-500/30 via-transparent to-transparent" />
      </div>

      {/* Daily tip */}
      <div className="mb-8">
        <RemarkBadge type="tip">{day.daily_safety_tip}</RemarkBadge>
      </div>

      {/* Timeline */}
      <ol className="space-y-px">
        {day.items.map((item, idx) => (
          <li
            key={idx}
            className={`group grid grid-cols-[80px_1fr_auto] gap-4 items-baseline py-5 border-b border-[var(--hairline)] ${
              item.is_flagged ? 'bg-rose-50/30' : ''
            }`}
          >
            {/* Time column */}
            <div className="text-right">
              <p className="font-mono text-sm font-medium text-ink-500 tabular-nums">{item.time}</p>
              <div className="flex justify-end items-center gap-1 mt-1">
                <Clock size={9} className="text-ink-300" />
                <span className="text-[9px] uppercase tracking-[0.18em] text-ink-300">slot</span>
              </div>
            </div>

            {/* Content */}
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                {item.is_flagged && <AlertTriangle size={13} className="text-rose-700 shrink-0" />}
                <h4 className={`font-display text-2xl leading-tight tracking-tight ${item.is_flagged ? 'text-rose-700' : 'text-ink-500'}`}>
                  {item.activity}
                </h4>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-ink-300 mb-2">
                <MapPin size={11} />
                <span>{item.location}</span>
              </div>
              {item.description && (
                <p className="text-sm text-ink-400 leading-relaxed mb-3">{item.description}</p>
              )}
              {item.safety_note && (
                <div className="mt-2">
                  <RemarkBadge type={getSafetyNoteType(item.safety_note, item.is_flagged)}>
                    {item.safety_note}
                  </RemarkBadge>
                </div>
              )}
            </div>

            {/* Add to calendar */}
            <a
              href={buildGCalUrl(item, day.date, item.time)}
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-400 hover:text-rose-500"
              title="Add to Google Calendar"
            >
              <CalendarPlus size={16} />
            </a>
          </li>
        ))}
      </ol>

      {/* Safe return */}
      <div className="mt-6 flex items-center justify-between bg-cream-200/50 border-l-2 border-rose-400 px-5 py-3">
        <div className="flex items-baseline gap-3">
          <span className="num-tag">Safe return by</span>
          <span className="font-display text-2xl text-ink-500 italic">{day.safe_return_time}</span>
        </div>
        <span className="text-rose-400 text-lg">✦</span>
      </div>
    </article>
  )
}
