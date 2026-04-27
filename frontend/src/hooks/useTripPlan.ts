import { useState, useCallback } from 'react'
import { planTripStream } from '../api/client'
import type { TripPlanRequest, TripPlanResponse, AgentId } from '../api/client'

export interface AgentState {
  status: 'idle' | 'running' | 'complete' | 'error'
  logs: string[]
  summary: string
}

export type AgentMap = Record<AgentId, AgentState>

const AGENT_IDS: AgentId[] = ['safety', 'accommodation', 'community', 'schedule']

const makeIdle = (): AgentState => ({ status: 'idle', logs: [], summary: '' })

export const initialAgentMap: AgentMap = {
  safety: makeIdle(),
  accommodation: makeIdle(),
  community: makeIdle(),
  schedule: makeIdle(),
  briefing: makeIdle(),
  parse: makeIdle(),
}

export function useTripPlan() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [agents, setAgents] = useState<AgentMap>(initialAgentMap)
  const [parseLog, setParseLog] = useState<string[]>([])

  const execute = useCallback(async (req: TripPlanRequest): Promise<TripPlanResponse | null> => {
    setLoading(true)
    setError(null)
    setAgents(initialAgentMap)
    setParseLog([])

    return new Promise<TripPlanResponse | null>((resolve) => {
      planTripStream(req, (event) => {
        if (event.type === 'agent_start') {
          const id = event.agent
          if (!AGENT_IDS.includes(id as any)) return
          setAgents(prev => ({
            ...prev,
            [id]: { ...prev[id], status: 'running' },
          }))
        } else if (event.type === 'agent_event') {
          const id = event.agent
          if (id === 'parse') {
            setParseLog(prev => [...prev, event.message].slice(-6))
            return
          }
          if (!AGENT_IDS.includes(id as any)) return
          setAgents(prev => ({
            ...prev,
            [id]: {
              ...prev[id],
              logs: [...prev[id].logs, event.message].slice(-20),
            },
          }))
        } else if (event.type === 'agent_complete') {
          const id = event.agent
          if (!AGENT_IDS.includes(id as any)) return
          setAgents(prev => ({
            ...prev,
            [id]: { ...prev[id], status: 'complete', summary: event.summary },
          }))
        } else if (event.type === 'complete') {
          setLoading(false)
          resolve(event.result)
        } else if (event.type === 'error') {
          setLoading(false)
          setError(event.message)
          resolve(null)
        }
      }).catch((err: unknown) => {
        setLoading(false)
        setError(err instanceof Error ? err.message : 'Failed to plan trip. Please try again.')
        resolve(null)
      })
    })
  }, [])

  const reset = useCallback(() => {
    setLoading(false)
    setError(null)
    setAgents(initialAgentMap)
    setParseLog([])
  }, [])

  return { loading, error, agents, parseLog, execute, reset }
}
