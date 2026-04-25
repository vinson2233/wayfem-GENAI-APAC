import { Heart } from 'lucide-react'
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

export default function CommunityTipCard({ tip }: CommunityTipCardProps) {
  let formattedDate = ''
  if (tip.created_at) {
    try {
      formattedDate = format(parseISO(tip.created_at), 'MMM d, yyyy')
    } catch {
      formattedDate = tip.created_at
    }
  }

  return (
    <article className="group border-l-2 border-[var(--hairline)] hover:border-rose-500 pl-6 py-5 transition-colors">
      <div className="flex items-start gap-5">
        <span className="font-display text-3xl text-rose-400 shrink-0 leading-none mt-1">
          {CATEGORY_GLYPH[tip.category]}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3 mb-2 text-[10px] uppercase tracking-[0.16em] text-ink-300">
            <span className="text-rose-700 font-semibold">{CATEGORY_LABELS[tip.category]}</span>
            {formattedDate && (
              <>
                <span className="text-rose-300">·</span>
                <span className="italic font-display normal-case tracking-normal text-sm">{formattedDate}</span>
              </>
            )}
          </div>

          <p className="font-display text-lg text-ink-500 leading-snug tracking-tight mb-3">
            "{tip.tip}"
          </p>

          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-300 italic font-display">— {tip.author_alias}</span>
            <button className="flex items-center gap-1.5 text-rose-500 hover:text-rose-700 transition-colors">
              <Heart size={12} fill="currentColor" />
              <span className="text-xs font-medium text-ink-400">{tip.upvotes}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
