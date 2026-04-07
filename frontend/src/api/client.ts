import axios from 'axios'

// In combined single-service mode, VITE_API_BASE_URL is empty → use relative paths (same origin)
const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' }
})

export interface TripPlanRequest {
  destination: string
  start_date: string
  end_date: string
  preferences?: Record<string, unknown>
  emergency_contact?: string
  user_id?: string
}

export type ThreatLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface SafetyReport {
  destination_id: string
  country: string
  city: string
  threat_level: ThreatLevel
  last_updated?: string
  flags: string[]
  flag_sources?: string[]
  night_safety: boolean
  transportation_safe: boolean
  local_laws_notes: string
  emergency_number: string
  overall_score: number
  summary: string
}

export interface Hotel {
  place_id: string
  name: string
  destination_id: string
  female_friendliness_score: number
  solo_female_reviews_count: number
  positive_mentions: string[]
  negative_mentions: string[]
  owner_female?: boolean | null
  area_safety_score: number
  security_features: string[]
  price_per_night?: number
  currency: string
  address: string
  rating: number
  image_url?: string
  booking_url?: string
}

export interface ItineraryItem {
  time: string
  activity: string
  location: string
  description?: string
  image_query?: string
  safety_note?: string
  is_flagged: boolean
}

export interface ItineraryDay {
  date: string
  day_number: number
  items: ItineraryItem[]
  safe_return_time: string
  daily_safety_tip: string
}

export interface CommunityTip {
  tip_id?: string
  destination_id: string
  author_alias: string
  tip: string
  category: 'transport' | 'accommodation' | 'food' | 'nightlife' | 'emergency' | 'general'
  upvotes: number
  created_at?: string
}

export interface TripPlanResponse {
  trip_id: string
  destination: string
  overall_safety_score: number
  risk_flags: string[]
  hotels: Hotel[]
  itinerary: ItineraryDay[]
  emergency_contacts: Record<string, string>
  community_tips: string[]
  safety_report: SafetyReport
  created_at: string
}

export const planTrip = (req: TripPlanRequest) => api.post<TripPlanResponse>('/api/v1/plan', req)
export const getSafetyReport = (destination: string) => api.get<SafetyReport>(`/api/v1/safety/${encodeURIComponent(destination)}`)
export const getHotels = (destination: string, minScore?: number) => api.get<Hotel[]>(`/api/v1/hotels/${encodeURIComponent(destination)}`, { params: { min_score: minScore } })
export const getCommunityTips = (destination: string, category?: string) => api.get<CommunityTip[]>(`/api/v1/community-tips/${encodeURIComponent(destination)}`, { params: { category } })
export const checkIn = (tripId: string) => api.post(`/api/v1/checkin/${tripId}`)
export const submitFeedback = (data: { trip_id: string; tips: string[]; hotel_rating?: number; overall_rating?: number }) => api.post('/api/v1/feedback', data)
