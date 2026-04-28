import { Heart, MapPin, ArrowUpRight } from 'lucide-react'
import type { CommunityTip } from '../api/client'
import { format, parseISO } from 'date-fns'

interface CommunityTipCardProps {
  tip: CommunityTip
}

const CATEGORY_GLYPH: Record<CommunityTip['category'], string> = {
  transport: '✦',
  accommodation: '❋',
  food: '❍',
  nightlife: '☾',
  emergency: '⚠',
  general: '✶',
}

const CATEGORY_LABELS: Record<CommunityTip['category'], string> = {
  transport: 'Transport',
  accommodation: 'Stay',
  food: 'Food',
  nightlife: 'Nightlife',
  emergency: 'Emergency',
  general: 'General',
}

const COUNTRY_FLAGS: Record<string, string> = {
  japan: '🇯🇵', france: '🇫🇷', indonesia: '🇮🇩', turkey: '🇹🇷', egypt: '🇪🇬',
  italy: '🇮🇹', spain: '🇪🇸', thailand: '🇹🇭', netherlands: '🇳🇱', usa: '🇺🇸',
  uk: '🇬🇧', germany: '🇩🇪', india: '🇮🇳', mexico: '🇲🇽', brazil: '🇧🇷',
  australia: '🇦🇺', canada: '🇨🇦', portugal: '🇵🇹', greece: '🇬🇷', vietnam: '🇻🇳',
  morocco: '🇲🇦', jordan: '🇯🇴', peru: '🇵🇪', colombia: '🇨🇴', argentina: '🇦🇷',
  kenya: '🇰🇪', southafrica: '🇿🇦', singapore: '🇸🇬', malaysia: '🇲🇾',
}

function parseDestination(destination_id: string): { flag: string; city: string } {
  const parts = destination_id.split('_')
  // try matching last word, then last two words as country
  const last1 = parts[parts.length - 1]
  const last2 = parts.slice(-2).join('')
  const countryKey = COUNTRY_FLAGS[last2] ? last2 : COUNTRY_FLAGS[last1] ? last1 : null
  const flag = countryKey ? COUNTRY_FLAGS[countryKey] : '🌍'
  const cityParts = countryKey === last2 ? parts.slice(0, -2) : countryKey === last1 ? parts.slice(0, -1) : parts
  const city = cityParts.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  return { flag, city }
}

export default function CommunityTipCard({ tip }: CommunityTipCardProps) {
  let formattedDate = ''
  if (tip.created_at) {
    try {
      formattedDate = format(parseISO(tip.created_at), 'MMM d, yyyy')
    } catch {
      formattedDate = tip.created_at
    }
  }

  const { flag, city } = parseDestination(tip.destination_id)
  const placeLabel = tip.location ? `${city} · ${tip.location}` : city

  return (
    <article className="group border-l-2 border-[var(--hairline)] hover:border-rose-500 pl-6 py-5 transition-colors">
      <div className="flex items-start gap-5">
        <span className="font-display text-3xl text-rose-400 shrink-0 leading-none mt-1">
          {CATEGORY_GLYPH[tip.category]}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-[0.16em] text-rose-700 font-semibold">
              {CATEGORY_LABELS[tip.category]}
            </span>
            <span className="text-rose-300 text-[10px]">·</span>
            <span className="flex items-center gap-1 text-xs text-ink-400">
              <span>{flag}</span>
              <MapPin size={10} className="text-ink-300" />
              <span className="font-display italic">{placeLabel}</span>
            </span>
            {formattedDate && (
              <>
                <span className="text-rose-300 text-[10px]">·</span>
                <span className="text-xs text-ink-300 italic font-display">{formattedDate}</span>
              </>
            )}
          </div>

          <p className="font-display text-lg text-ink-500 leading-snug tracking-tight mb-3">
            "{tip.tip}"
          </p>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-ink-300 italic font-display">— {tip.author_alias}</span>
              {tip.source === 'reddit' && tip.source_subreddit && (
                tip.source_url ? (
                  <a
                    href={tip.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] font-mono text-orange-700 bg-orange-50 border border-orange-200 hover:border-orange-400 px-2 py-0.5 transition-colors"
                    title="Open original Reddit post"
                  >
                    <span>r/{tip.source_subreddit}</span>
                    <ArrowUpRight size={9} />
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] font-mono text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5">
                    r/{tip.source_subreddit}
                  </span>
                )
              )}
            </div>
            <div className="flex items-center gap-1.5 text-rose-500">
              <Heart size={12} fill="currentColor" />
              <span className="text-xs font-medium text-ink-400">{tip.upvotes}</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
