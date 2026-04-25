import type { ThreatLevel } from '../api/client'
import { AlertTriangle, AlertOctagon, Info, Lightbulb, Check } from 'lucide-react'

interface SafetyBadgeProps {
  threat_level: ThreatLevel
  size?: 'sm' | 'md' | 'lg'
}

export default function SafetyBadge({ threat_level, size = 'md' }: SafetyBadgeProps) {
  const sizeClasses = {
    sm: 'text-[10px] px-2.5 py-1',
    md: 'text-[11px] px-3 py-1.5',
    lg: 'text-xs px-4 py-2',
  }

  const config: Record<ThreatLevel, { dot: string; label: string; sub: string; cls: string }> = {
    LOW: {
      dot: 'bg-green-500',
      label: 'Low',
      sub: '· generally safe',
      cls: 'border-green-200 bg-green-50/50 text-green-900',
    },
    MEDIUM: {
      dot: 'bg-amber-500',
      label: 'Medium',
      sub: '· stay aware',
      cls: 'border-amber-200 bg-amber-50/50 text-amber-900',
    },
    HIGH: {
      dot: 'bg-orange-500',
      label: 'High',
      sub: '· proceed with care',
      cls: 'border-orange-300 bg-orange-50/60 text-orange-900',
    },
    CRITICAL: {
      dot: 'bg-rose-700',
      label: 'Critical',
      sub: '· do not travel',
      cls: 'border-rose-700 bg-rose-700 text-white',
    },
  }

  const c = config[threat_level]

  return (
    <span className={`inline-flex items-center gap-2 uppercase tracking-[0.18em] font-semibold rounded-full border ${c.cls} ${sizeClasses[size]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${threat_level === 'CRITICAL' ? 'animate-pulse bg-white' : ''}`} />
      <span>{c.label} <span className="font-normal italic font-display normal-case tracking-normal opacity-80">{c.sub}</span></span>
    </span>
  )
}

type RemarkType = 'warning' | 'tip' | 'info' | 'danger' | 'success'

export function RemarkBadge({ type, children }: { type: RemarkType; children: React.ReactNode }) {
  const configs: Record<RemarkType, { wrapper: string; icon: React.ReactNode; label: string }> = {
    warning: {
      wrapper: 'bg-amber-50/70 border-l-2 border-amber-400 text-amber-900',
      icon: <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />,
      label: 'Warning',
    },
    tip: {
      wrapper: 'bg-rose-50/60 border-l-2 border-rose-400 text-rose-800',
      icon: <Lightbulb size={13} className="text-rose-500 shrink-0 mt-0.5" />,
      label: 'Tip',
    },
    info: {
      wrapper: 'bg-cream-200/60 border-l-2 border-ink-300 text-ink-500',
      icon: <Info size={13} className="text-ink-300 shrink-0 mt-0.5" />,
      label: 'Note',
    },
    danger: {
      wrapper: 'bg-rose-100 border-l-2 border-rose-700 text-rose-800',
      icon: <AlertOctagon size={13} className="text-rose-700 shrink-0 mt-0.5" />,
      label: 'Alert',
    },
    success: {
      wrapper: 'bg-green-50/70 border-l-2 border-green-500 text-green-900',
      icon: <Check size={13} className="text-green-600 shrink-0 mt-0.5" />,
      label: 'Safe',
    },
  }

  const { wrapper, icon, label } = configs[type]

  return (
    <div className={`flex gap-2.5 px-4 py-2.5 text-xs leading-relaxed ${wrapper}`}>
      {icon}
      <span>
        <span className="font-semibold uppercase tracking-[0.14em] text-[10px] mr-2">{label}</span>
        {children}
      </span>
    </div>
  )
}
