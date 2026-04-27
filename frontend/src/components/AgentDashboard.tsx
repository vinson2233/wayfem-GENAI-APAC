import { useEffect, useRef, useState } from 'react'
import { Shield, Building2, Users, CalendarDays, Check, Loader, Sparkles } from 'lucide-react'
import type { AgentMap, AgentState } from '../hooks/useTripPlan'
import type { AgentId } from '../api/client'

const DID_YOU_KNOW = [
  {
    title: 'What is FFI?',
    body: 'The Female Friendliness Index scores stays from 0–10 using women-specific reviews, door/lock quality, lobby visibility, area safety, and female-staff signals.',
  },
  {
    title: 'Why a curfew?',
    body: 'For HIGH/CRITICAL safety zones the schedule agent caps your last activity at 21:00, and pads earlier returns into your itinerary so you’re never out alone after dusk.',
  },
  {
    title: 'Where do flags come from?',
    body: 'Every safety flag is sourced from a live web search — travel advisories, recent incidents, women-specific reports — and the source URL is stored alongside it.',
  },
  {
    title: 'Community wisdom',
    body: 'Real tips from women who’ve been to your destination — categorised by transport, food, nightlife, and emergencies — surface alongside AI-generated starters.',
  },
]

interface AgentMeta {
  id: AgentId
  label: string
  sub: string
  Icon: React.FC<{ size?: number; className?: string }>
}

const AGENTS: AgentMeta[] = [
  { id: 'safety',        label: 'Safety',        sub: 'Intelligence',  Icon: Shield },
  { id: 'accommodation', label: 'Accommodation', sub: 'Scoring',       Icon: Building2 },
  { id: 'community',     label: 'Community',     sub: 'Wisdom',        Icon: Users },
  { id: 'schedule',      label: 'Schedule',      sub: 'Builder',       Icon: CalendarDays },
]

function AgentLog({ logs }: { logs: string[] }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight
    }
  }, [logs])

  return (
    <div
      ref={ref}
      className="flex-1 overflow-y-auto space-y-1 pr-1"
      style={{ scrollbarWidth: 'none' }}
    >
      {logs.length === 0 ? (
        <p className="text-[10px] font-mono text-ink-200 italic">Waiting to start…</p>
      ) : (
        logs.map((line, i) => (
          <p key={i} className="text-[10px] font-mono text-ink-400 leading-snug break-words">
            <span className="text-rose-300 mr-1">›</span>{line}
          </p>
        ))
      )}
    </div>
  )
}

function StatusDot({ status }: { status: AgentState['status'] }) {
  if (status === 'idle') {
    return <span className="w-2 h-2 rounded-full bg-ink-200 inline-block" />
  }
  if (status === 'running') {
    return (
      <span className="relative inline-flex w-2 h-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
        <span className="relative inline-flex rounded-full w-2 h-2 bg-rose-500" />
      </span>
    )
  }
  if (status === 'complete') {
    return (
      <span className="w-4 h-4 rounded-full bg-emerald-100 inline-flex items-center justify-center">
        <Check size={9} className="text-emerald-600" strokeWidth={3} />
      </span>
    )
  }
  return <span className="w-2 h-2 rounded-full bg-rose-700 inline-block" />
}

interface AgentCardProps {
  meta: AgentMeta
  state: AgentState
}

function AgentCard({ meta, state }: AgentCardProps) {
  const { Icon, label, sub } = meta
  const isRunning = state.status === 'running'
  const isDone = state.status === 'complete'

  return (
    <div
      className={`flex flex-col border transition-all duration-500 ${
        isRunning
          ? 'border-rose-300 bg-white shadow-[0_0_0_3px_rgba(244,114,182,0.08)]'
          : isDone
          ? 'border-emerald-200 bg-emerald-50/30'
          : 'border-[var(--hairline)] bg-white'
      }`}
      style={{ minHeight: '200px' }}
    >
      {/* Card header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-[var(--hairline)]">
        <div className="flex items-center gap-2.5">
          <Icon
            size={16}
            className={
              isRunning ? 'text-rose-500' : isDone ? 'text-emerald-600' : 'text-ink-200'
            }
          />
          <div>
            <p className={`font-display text-base leading-none tracking-tight ${
              isRunning ? 'text-ink-500' : isDone ? 'text-ink-500' : 'text-ink-300'
            }`}>
              {label}
            </p>
            <p className="text-[9px] uppercase tracking-[0.18em] text-ink-300 mt-0.5">{sub}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <StatusDot status={state.status} />
          {isRunning && (
            <Loader size={10} className="text-rose-400 animate-spin" />
          )}
        </div>
      </div>

      {/* Log area */}
      <div className="flex flex-col flex-1 px-4 py-3" style={{ minHeight: '120px' }}>
        <AgentLog logs={state.logs} />
      </div>

      {/* Summary bar on complete */}
      {isDone && state.summary && (
        <div className="px-4 py-2 border-t border-emerald-200 bg-emerald-50/50">
          <p className="text-[10px] font-mono text-emerald-700 font-medium">
            <Check size={9} className="inline mr-1" strokeWidth={3} />
            {state.summary}
          </p>
        </div>
      )}
    </div>
  )
}

interface AgentDashboardProps {
  agents: AgentMap
  parseLog: string[]
  destination: string
}

function DidYouKnowCard() {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % DID_YOU_KNOW.length), 5500)
    return () => clearInterval(t)
  }, [])
  const fact = DID_YOU_KNOW[idx]
  return (
    <div className="bg-rose-50/60 border border-rose-100 px-4 py-3 flex items-start gap-3">
      <Sparkles size={14} className="text-rose-400 shrink-0 mt-0.5" />
      <div key={idx} className="flex-1 animate-bloom">
        <p className="eyebrow text-rose-700 mb-1">Did you know · {fact.title}</p>
        <p className="text-sm text-ink-400 font-display italic leading-relaxed">{fact.body}</p>
      </div>
      <div className="flex gap-1 shrink-0 mt-1">
        {DID_YOU_KNOW.map((_, i) => (
          <span key={i} className={`w-1 h-1 rounded-full transition-colors ${i === idx ? 'bg-rose-500' : 'bg-rose-200'}`} />
        ))}
      </div>
    </div>
  )
}

export function AgentDashboard({ agents, parseLog, destination }: AgentDashboardProps) {
  return (
    <div className="w-full space-y-5">
      {/* Parse / geocode status strip */}
      <div className="border-l-2 border-rose-400 pl-4 py-2">
        <p className="eyebrow text-rose-700 mb-1">Orchestrating</p>
        {parseLog.length > 0 ? (
          <p className="text-sm font-mono text-ink-400">
            {parseLog[parseLog.length - 1]}
          </p>
        ) : (
          <p className="text-sm font-mono text-ink-300 italic">
            Planning trip to <span className="text-ink-500 not-italic">{destination}</span>…
          </p>
        )}
      </div>

      {/* Educational rotating card — fills the wait time meaningfully */}
      <DidYouKnowCard />

      {/* 4 agent cards — 1 col mobile, 2 col sm, 4 col md */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {AGENTS.map(meta => (
          <AgentCard key={meta.id} meta={meta} state={agents[meta.id]} />
        ))}
      </div>
    </div>
  )
}
