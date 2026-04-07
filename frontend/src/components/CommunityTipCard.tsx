import { Heart } from 'lucide-react'
import type { CommunityTip } from '../api/client'
import { format, parseISO } from 'date-fns'

interface CommunityTipCardProps {
  tip: CommunityTip
}

const CATEGORY_ICONS: Record<CommunityTip['category'], string> = {
  transport: '🚗',
  accommodation: '🏨',
  food: '🍽',
  nightlife: '🌙',
  emergency: '🚨',
  general: '💡',
}

const CATEGORY_LABELS: Record<CommunityTip['category'], string> = {
  transport: 'Transport',
  accommodation: 'Accommodation',
  food: 'Food',
  nightlife: 'Nightlife',
  emergency: 'Emergency',
  general: 'General',
}

const CATEGORY_COLORS: Record<CommunityTip['category'], string> = {
  transport: 'bg-blue-50 text-blue-700 border-blue-100',
  accommodation: 'bg-purple-50 text-purple-700 border-purple-100',
  food: 'bg-orange-50 text-orange-700 border-orange-100',
  nightlife: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  emergency: 'bg-red-50 text-red-700 border-red-100',
  general: 'bg-yellow-50 text-yellow-700 border-yellow-100',
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0">{CATEGORY_ICONS[tip.category]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[tip.category]}`}>
              {CATEGORY_LABELS[tip.category]}
            </span>
            {formattedDate && (
              <span className="text-xs text-gray-400">{formattedDate}</span>
            )}
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{tip.tip}</p>
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-gray-400 italic">— {tip.author_alias}</span>
            <div className="flex items-center gap-1 text-safeher-500">
              <Heart size={13} fill="currentColor" />
              <span className="text-xs font-medium text-gray-600">{tip.upvotes}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
