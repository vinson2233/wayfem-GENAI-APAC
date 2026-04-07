import { useState, useCallback } from 'react'
import { planTrip } from '../api/client'
import type { TripPlanRequest, TripPlanResponse } from '../api/client'

export const PROGRESS_STEPS = [
  {
    label: '🔍 Safety Intelligence Agent',
    agent: 'Safety Intelligence Agent',
    details: [
      'Querying travel.state.gov advisories...',
      'Scanning solo female traveler safety reports...',
      'Checking crime statistics & harassment incidents...',
      'Reviewing local laws affecting women...',
    ],
  },
  {
    label: '🏨 Accommodation Agent',
    agent: 'Accommodation Agent',
    details: [
      'Searching hotels via Google Maps...',
      'Analyzing solo female traveler reviews...',
      'Computing Female Friendliness Index scores...',
      'Checking area safety & emergency proximity...',
    ],
  },
  {
    label: '👭 Community Agent',
    agent: 'Community Agent',
    details: [
      'Querying community tips database...',
      'Surfacing trusted transport recommendations...',
      'Finding female-friendly cafes & workspaces...',
      'Gathering neighborhood safety wisdom...',
    ],
  },
  {
    label: '📅 Schedule Agent',
    agent: 'Schedule Agent',
    details: [
      'Mapping safe activity windows by threat level...',
      'Building day-by-day itinerary...',
      'Flagging high-risk activities...',
      'Creating Google Calendar check-in events...',
    ],
  },
]

interface UseTripPlanState {
  loading: boolean
  error: string | null
  data: TripPlanResponse | null
  progressStep: number
}

export function useTripPlan() {
  const [state, setState] = useState<UseTripPlanState>({
    loading: false,
    error: null,
    data: null,
    progressStep: 0,
  })

  const execute = useCallback(async (req: TripPlanRequest): Promise<TripPlanResponse | null> => {
    setState({ loading: true, error: null, data: null, progressStep: 0 })

    const intervalId = setInterval(() => {
      setState(prev => ({
        ...prev,
        progressStep: Math.min(prev.progressStep + 1, PROGRESS_STEPS.length - 1),
      }))
    }, 2000)

    try {
      const response = await planTrip(req)
      clearInterval(intervalId)
      setState({ loading: false, error: null, data: response.data, progressStep: PROGRESS_STEPS.length - 1 })
      return response.data
    } catch (err: unknown) {
      clearInterval(intervalId)
      const message = err instanceof Error ? err.message : 'Failed to plan trip. Please try again.'
      setState({ loading: false, error: message, data: null, progressStep: 0 })
      return null
    }
  }, [])

  const reset = useCallback(() => {
    setState({ loading: false, error: null, data: null, progressStep: 0 })
  }, [])

  return { ...state, execute, reset }
}
