import { Star, ExternalLink } from 'lucide-react'
import type { Hotel } from '../api/client'

interface HotelCardProps {
  hotel: Hotel
}

export default function HotelCard({ hotel }: HotelCardProps) {
  return (
    <article className="group bg-cream-50 border border-[var(--hairline)] hover:border-[var(--hairline-strong)] transition-colors overflow-hidden flex flex-col">
      <div className="relative overflow-hidden aspect-[4/3]">
        {hotel.image_url ? (
          <img
            src={hotel.image_url}
            alt={hotel.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-rose-50 to-cream-200 flex items-center justify-center">
            <span className="text-6xl text-rose-300 font-display italic">w</span>
          </div>
        )}
        {/* FFI floating badge */}
        <div className="absolute top-3 left-3 bg-cream-50/95 backdrop-blur-sm px-3 py-1.5 rounded-full border border-[var(--hairline)]">
          <p className="text-[9px] uppercase tracking-[0.18em] text-ink-300">FFI</p>
          <p className="font-display text-base text-ink-500 leading-none">
            {hotel.female_friendliness_score.toFixed(1)}
            <span className="text-[10px] text-ink-300 ml-0.5">/10</span>
          </p>
        </div>
        {hotel.owner_female === true && (
          <span className="absolute top-3 right-3 text-[10px] uppercase tracking-[0.16em] font-semibold bg-rose-500 text-cream-50 px-2.5 py-1 rounded-full">
            Female owned
          </span>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-xl text-ink-500 leading-tight tracking-tight flex-1">
            {hotel.name}
          </h3>
          <div className="flex items-center gap-1 shrink-0 text-amber-500">
            <Star size={13} fill="currentColor" />
            <span className="text-sm font-semibold text-ink-500">{hotel.rating.toFixed(1)}</span>
          </div>
        </div>

        {/* FFI bar */}
        <div>
          <div className="flex justify-between text-[10px] uppercase tracking-[0.16em] text-ink-300 mb-1.5">
            <span>Friendliness</span>
            <span>Area · {hotel.area_safety_score.toFixed(1)}</span>
          </div>
          <div className="w-full h-px bg-[var(--hairline)] relative">
            <div
              className="absolute inset-y-0 left-0 bg-rose-500 -translate-y-px h-[3px]"
              style={{ width: `${(hotel.female_friendliness_score / 10) * 100}%` }}
            />
          </div>
        </div>

        {hotel.security_features.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {hotel.security_features.slice(0, 3).map(f => (
              <span key={f} className="text-[10px] uppercase tracking-[0.12em] text-ink-400 bg-cream-200/70 px-2 py-1 rounded-full">
                {f}
              </span>
            ))}
          </div>
        )}

        {hotel.positive_mentions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {hotel.positive_mentions.slice(0, 2).map(m => (
              <span key={m} className="text-[10px] italic font-display text-rose-700 border-b border-rose-200">
                {m}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-3 border-t border-[var(--hairline)] flex items-baseline justify-between">
          {hotel.price_per_night ? (
            <div>
              <span className="font-display text-2xl text-ink-500">${hotel.price_per_night}</span>
              <span className="text-xs text-ink-300 italic ml-1">/ night</span>
            </div>
          ) : (
            <span className="text-xs text-ink-300 italic font-display">Price on request</span>
          )}
          {hotel.booking_url ? (
            <a
              href={hotel.booking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline inline-flex items-center gap-1 text-sm font-medium text-ink-500"
            >
              View
              <ExternalLink size={11} />
            </a>
          ) : (
            <button className="link-underline text-sm font-medium text-ink-500">View</button>
          )}
        </div>
      </div>
    </article>
  )
}
