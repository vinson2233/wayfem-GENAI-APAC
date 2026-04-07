import { AlertTriangle, Home, MapPin, Clock, CalendarPlus } from 'lucide-react'
import type { ItineraryDay, ItineraryItem } from '../api/client'
import { format, parseISO } from 'date-fns'
import { RemarkBadge } from './SafetyBadge'

// Keyword → curated Unsplash photo ID (stable URLs, not source.unsplash.com which is deprecated)
const KEYWORD_PHOTOS: Record<string, string> = {
  temple: 'photo-1528360983277-13d401cdc186',
  mosque: 'photo-1564769625905-50e93615e769',
  mosque2: 'photo-1519817650390-64a93db51149',
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
  return `https://images.unsplash.com/${photoId}?w=800&h=320&fit=crop&q=80`
}

function getImageForItem(item: ItineraryItem, fallbackIndex: number): string {
  const text = `${item.activity} ${item.location} ${item.description ?? ''}`
  const photoId = findPhoto(text) ?? FALLBACK_PHOTOS[fallbackIndex % FALLBACK_PHOTOS.length]
  return `https://images.unsplash.com/${photoId}?w=600&h=220&fit=crop&q=80`
}

function getSafetyNoteType(note: string, isFlagged: boolean): 'warning' | 'info' | 'tip' {
  if (isFlagged) return 'warning'
  const lower = note.toLowerCase()
  const warningWords = ['avoid', 'danger', 'unsafe', 'risk', 'caution', 'beware', 'do not', "don't", 'never', 'scam', 'harass', 'threat', 'crime', 'attack', 'robbery']
  if (warningWords.some(w => lower.includes(w))) return 'warning'
  return 'info'
}

/** Build a Google Calendar "Add Event" URL for a single activity. */
function buildGCalUrl(item: { activity: string; location: string; description?: string; safety_note?: string }, date: string, time: string): string {
  // Parse time like "09:00" → start and +1h end
  const [h, m] = time.split(':').map(Number)
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateCompact = date.replace(/-/g, '')
  const startTime = `${pad(h)}${pad(m)}00`
  const endH = (h + 1) % 24
  const endTime = `${pad(endH)}${pad(m)}00`

  const details = [item.description, item.safety_note ? `🛡 Safety note: ${item.safety_note}` : '']
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

/** Build a single Google Calendar URL for the entire day (all activities). */
function buildDayGCalUrl(day: ItineraryDay): string {
  if (day.items.length === 0) return ''
  const first = day.items[0]
  const last = day.items[day.items.length - 1]
  const dateCompact = day.date.replace(/-/g, '')
  const [fh, fm] = (first.time || '08:00').split(':').map(Number)
  const [lh, lm] = (last.time || '20:00').split(':').map(Number)
  const pad = (n: number) => String(n).padStart(2, '0')
  const startTime = `${pad(fh)}${pad(fm)}00`
  const endTime = `${pad(Math.min(lh + 1, 23))}${pad(lm)}00`

  const details = [
    `📅 Wayfem itinerary for Day ${day.day_number}`,
    '',
    day.items.map(i => `• ${i.time} — ${i.activity} @ ${i.location}`).join('\n'),
    '',
    `🏠 Safe return by ${day.safe_return_time}`,
    `🛡 ${day.daily_safety_tip}`,
  ].join('\n')

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Wayfem Day ${day.day_number} — ${day.items.map(i => i.activity).slice(0, 2).join(', ')}`,
    dates: `${dateCompact}T${startTime}/${dateCompact}T${endTime}`,
    details,
    location: day.items[0]?.location ?? '',
    trp: 'false',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

interface ItineraryCardProps {
  day: ItineraryDay
}

export default function ItineraryCard({ day }: ItineraryCardProps) {
  let formattedDate = day.date
  try {
    formattedDate = format(parseISO(day.date), 'MMM d, yyyy')
  } catch {
    // keep original if parse fails
  }

  const imageUrl = getImageForDay(day)

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
      {/* Banner image with overlay */}
      <div className="relative h-40 overflow-hidden">
        <img
          src={imageUrl}
          alt={`Day ${day.day_number} highlight`}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-5 py-3">
          <h3 className="font-bold text-white text-xl drop-shadow">
            Day {day.day_number}
            <span className="font-normal text-white/80 ml-2 text-base">— {formattedDate}</span>
          </h3>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Daily tip */}
        <RemarkBadge type="tip">{day.daily_safety_tip}</RemarkBadge>

        {/* Timeline */}
        <div className="space-y-4">
          {day.items.map((item, idx) => {
            const itemImageUrl = getImageForItem(item, idx)

            return (
              <div key={idx} className="flex gap-3">
                {/* Dot + line column */}
                <div className="flex flex-col items-center shrink-0 pt-1">
                  <div className={`w-3 h-3 rounded-full border-2 shrink-0 ${item.is_flagged ? 'bg-red-500 border-red-600' : 'bg-safeher-400 border-safeher-500'}`} />
                  {idx < day.items.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1 min-h-[20px]" />}
                </div>

                {/* Activity card */}
                <div className={`flex-1 pb-3 rounded-xl overflow-hidden border ${item.is_flagged ? 'border-red-200' : 'border-gray-100'}`}>
                  {/* Activity image */}
                  <div className="relative h-28 overflow-hidden bg-gray-200">
                    <img
                      src={itemImageUrl}
                      alt={item.activity}
                      className="w-full h-full object-cover"
                    />
                    <div className={`absolute inset-0 ${item.is_flagged ? 'bg-red-900/40' : 'bg-black/20'}`} />
                    {/* Time + location overlay */}
                    <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-sm">
                        <Clock size={9} /> {item.time}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-white/90 bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-sm">
                        <MapPin size={9} /> {item.location}
                      </span>
                    </div>
                  </div>

                  {/* Activity content */}
                  <div className={`px-3 pt-2 pb-3 ${item.is_flagged ? 'bg-red-50' : 'bg-white'}`}>
                    <div className="flex items-start gap-1.5 mb-1">
                      {item.is_flagged && <AlertTriangle size={13} className="text-red-500 shrink-0 mt-0.5" />}
                      <p className={`flex-1 text-sm font-semibold leading-snug ${item.is_flagged ? 'text-red-700' : 'text-gray-800'}`}>
                        {item.activity}
                      </p>
                      <a
                        href={buildGCalUrl(item, day.date, item.time)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 ml-1 text-gray-400 hover:text-[#1a73e8] transition-colors"
                        title="Add to Google Calendar"
                      >
                        <CalendarPlus size={14} />
                      </a>
                    </div>
                    {item.description && (
                      <p className="text-xs text-gray-500 leading-relaxed mb-2">{item.description}</p>
                    )}
                    {item.safety_note && (
                      <RemarkBadge type={getSafetyNoteType(item.safety_note, item.is_flagged)}>
                        {item.safety_note}
                      </RemarkBadge>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Safe return + Add to Calendar */}
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
          <Home size={15} className="text-green-600 shrink-0" />
          <span className="flex-1 text-sm text-green-700 font-semibold">🏠 Safe Return by {day.safe_return_time}</span>
          {buildDayGCalUrl(day) && (
            <a
              href={buildDayGCalUrl(day)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#1a73e8] hover:bg-[#1558b0] px-3 py-1.5 rounded-lg transition-colors shrink-0"
              title="Add this day's itinerary to Google Calendar"
            >
              <CalendarPlus size={13} />
              Add to Calendar
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

