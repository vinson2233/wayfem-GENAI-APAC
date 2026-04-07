import { Star, Shield, User, DollarSign, ExternalLink } from 'lucide-react'
import type { Hotel } from '../api/client'

interface HotelCardProps {
  hotel: Hotel
}

export default function HotelCard({ hotel }: HotelCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      {hotel.image_url ? (
        <img src={hotel.image_url} alt={hotel.name} className="w-full h-40 object-cover" />
      ) : (
        <div className="w-full h-40 bg-gradient-to-br from-safeher-100 to-purple-100 flex items-center justify-center">
          <Shield size={40} className="text-safeher-300" />
        </div>
      )}

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 leading-tight">{hotel.name}</h3>
          <div className="flex items-center gap-0.5 text-amber-500 shrink-0">
            <Star size={14} fill="currentColor" />
            <span className="text-sm font-medium text-gray-700">{hotel.rating.toFixed(1)}</span>
          </div>
        </div>

        {hotel.owner_female === true && (
          <span className="inline-flex items-center gap-1 text-xs font-medium bg-safeher-100 text-safeher-700 px-2 py-0.5 rounded-full border border-safeher-200">
            <User size={11} />
            Female Owned
          </span>
        )}

        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span className="font-medium">Female Friendliness Index</span>
            <span className="font-bold text-safeher-600">{hotel.female_friendliness_score.toFixed(1)}/10</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-safeher-400 to-safeher-600 h-2 rounded-full transition-all"
              style={{ width: `${(hotel.female_friendliness_score / 10) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Shield size={12} className="text-green-500" />
          <span>Area Safety: <span className="font-semibold text-gray-700">{hotel.area_safety_score.toFixed(1)}/10</span></span>
        </div>

        {hotel.security_features.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {hotel.security_features.slice(0, 4).map(f => (
              <span key={f} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
                {f}
              </span>
            ))}
          </div>
        )}

        {hotel.positive_mentions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {hotel.positive_mentions.slice(0, 3).map(m => (
              <span key={m} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-100">
                ✓ {m}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          {hotel.price_per_night ? (
            <div className="flex items-center gap-1 text-gray-700">
              <DollarSign size={14} className="text-gray-400" />
              <span className="font-semibold">{hotel.price_per_night}</span>
              <span className="text-xs text-gray-400">{hotel.currency}/night</span>
            </div>
          ) : (
            <span className="text-xs text-gray-400">Price on request</span>
          )}
          {hotel.booking_url ? (
            <a
              href={hotel.booking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-safeher-600 hover:text-safeher-800 bg-safeher-50 px-3 py-1.5 rounded-lg border border-safeher-200 hover:bg-safeher-100 transition-colors"
            >
              View Details <ExternalLink size={11} />
            </a>
          ) : (
            <button className="text-xs font-medium text-safeher-600 hover:text-safeher-800 bg-safeher-50 px-3 py-1.5 rounded-lg border border-safeher-200 hover:bg-safeher-100 transition-colors">
              View Details
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
