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
  cities?: string[]
}

export type ThreatLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface NearbyPlace {
  name: string
  address: string
  place_id?: string | null
  distance_meters?: number | null
  phone?: string | null
}

export interface RecentIncident {
  date: string
  summary: string
  source_url: string
  severity: 'info' | 'caution' | 'alert'
}

export interface CrisisContact {
  label: string
  kind: 'women_crisis' | 'sexual_assault' | 'tourist_police' | 'embassy' | 'other'
  phone?: string | null
  website?: string | null
  notes?: string | null
}

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
  cultural_notes?: string[]
  local_safe_phrases?: Record<string, string>
  women_health_notes?: string
  nearest_police?: NearbyPlace | null
  nearest_hospital?: NearbyPlace | null
  recent_incidents?: RecentIncident[]
  crisis_contacts?: CrisisContact[]
}

export interface Hotel {
  place_id: string
  name: string
  destination_id: string
  search_city?: string | null
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

export interface TransportOption {
  mode: 'walking' | 'transit' | 'driving' | 'rideshare'
  duration_min: number
  cost_estimate?: string | null
  app_name?: string | null
  safety_note?: string | null
}

export interface ItineraryItem {
  time: string
  activity: string
  location: string
  place_id?: string | null
  description?: string
  image_query?: string
  safety_note?: string
  is_flagged: boolean
  travel_time_minutes?: number | null
  transport_to_next?: TransportOption | null
  estimated_cost?: number | null
  cost_currency?: string | null
  alternatives?: ItineraryItem[] | null
}

export interface NightTransportPlan {
  mode: string
  app_name?: string | null
  estimated_cost?: string | null
  safety_tip: string
  avoid?: string | null
}

export interface ItineraryDay {
  date: string
  day_number: number
  items: ItineraryItem[]
  safe_return_time: string
  daily_safety_tip: string
  day_summary?: string | null
  night_transport?: NightTransportPlan | null
  daily_cost_estimate?: number | null
}

export interface CommunityTip {
  tip_id?: string
  destination_id: string
  author_alias: string
  tip: string
  category: 'transport' | 'accommodation' | 'food' | 'nightlife' | 'emergency' | 'general'
  upvotes: number
  created_at?: string
  location?: string | null
  source?: 'reddit' | 'ai' | null
  source_url?: string | null
  source_subreddit?: string | null
}

export interface TripPlanResponse {
  trip_id: string
  destination: string
  overall_safety_score: number
  risk_flags: string[]
  hotels: Hotel[]
  itinerary: ItineraryDay[]
  emergency_contacts: Record<string, string>
  community_tips: CommunityTip[]
  safety_report: SafetyReport
  briefing?: TripBriefing | null
  total_cost_estimate?: number | null
  cost_currency?: string | null
  created_at: string
}

export type AgentId = 'safety' | 'accommodation' | 'community' | 'schedule' | 'briefing' | 'parse'

export interface WhatIfScenario {
  situation: string
  response: string
  local_phrase?: string | null
  local_phrase_translation?: string | null
}

export interface TripBriefing {
  currency: string
  cashless_friendly: 'yes' | 'mixed' | 'cash_preferred'
  payment_notes: string
  climate_summary: string
  dress_code: string
  indoor_outdoor_mix: 'mostly_outdoor' | 'balanced' | 'mostly_indoor'
  dos: string[]
  donts: string[]
  scenarios?: WhatIfScenario[]
}

export type PlanEvent =
  | { type: 'agent_start'; agent: AgentId }
  | { type: 'agent_event'; agent: AgentId; message: string }
  | { type: 'agent_complete'; agent: AgentId; summary: string }
  | { type: 'complete'; result: TripPlanResponse }
  | { type: 'error'; message: string }

export async function planTripStream(
  req: TripPlanRequest,
  onEvent: (event: PlanEvent) => void,
): Promise<void> {
  const response = await fetch(`${BASE_URL}/api/v1/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`HTTP ${response.status}: ${text}`)
  }
  if (!response.body) throw new Error('No response body')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const event = JSON.parse(line.slice(6)) as PlanEvent
        onEvent(event)
      } catch {
        // ignore malformed lines
      }
    }
  }
}

export const getSafetyReport = (destination: string) => api.get<SafetyReport>(`/api/v1/safety/${encodeURIComponent(destination)}`)
export const getHotels = (destination: string, minScore?: number) => api.get<Hotel[]>(`/api/v1/hotels/${encodeURIComponent(destination)}`, { params: { min_score: minScore } })
export interface ClarifyQuestion {
  id: string
  label: string
  type: 'choice' | 'text'
  multiple?: boolean
  options: string[]
  placeholder?: string | null
}

export interface ClarifyResponse {
  feasibility_issue?: string | null
  feasibility_suggestion?: string | null
  destination_refined: string
  destination_was_vague: boolean
  city_options: string[]
  cities: string[]
  understood_summary: string
  extracted_preferences: Record<string, unknown>
  trip_questions: ClarifyQuestion[]
}

export const clarifyTrip = (description: string, start_date: string, end_date: string) =>
  api.post<ClarifyResponse>('/api/v1/plan/clarify', { description, start_date, end_date })

export const getAllCommunityTips = (category?: string) => api.get<CommunityTip[]>(`/api/v1/community-tips`, { params: { category } })
export const getCommunityTips = (destination: string, category?: string) => api.get<CommunityTip[]>(`/api/v1/community-tips/${encodeURIComponent(destination)}`, { params: { category } })
export async function refineItineraryStream(
  req: {
    prompt: string
    destination: string
    start_date: string
    end_date: string
    safety_report: SafetyReport
    current_itinerary: ItineraryDay[]
    preferences?: Record<string, unknown>
  },
  onEvent: (event: PlanEvent) => void,
): Promise<void> {
  const response = await fetch(`${BASE_URL}/api/v1/plan/refine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  if (!response.body) throw new Error('No response body')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try { onEvent(JSON.parse(line.slice(6)) as PlanEvent) } catch { /* ignore */ }
    }
  }
}

export const checkIn = (tripId: string) => api.post(`/api/v1/checkin/${tripId}`)
export const submitFeedback = (data: { trip_id: string; tips: string[]; hotel_rating?: number; overall_rating?: number }) => api.post('/api/v1/feedback', data)

export interface AskMessage { role: 'user' | 'assistant'; content: string }

export interface AskRequest {
  question: string
  destination: string
  trip_context: Record<string, unknown>
  history?: AskMessage[]
}

export const askWayfem = (req: AskRequest) =>
  api.post<{ answer: string }>('/api/v1/ask', req)
