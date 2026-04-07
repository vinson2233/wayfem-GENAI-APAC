import type { ThreatLevel } from '../api/client'
import { CheckCircle, AlertTriangle, AlertOctagon, Info, Lightbulb } from 'lucide-react'

interface SafetyBadgeProps {
  threat_level: ThreatLevel
  size?: 'sm' | 'md' | 'lg'
}

export default function SafetyBadge({ threat_level, size = 'md' }: SafetyBadgeProps) {
  const iconSize = size === 'lg' ? 18 : size === 'md' ? 15 : 12

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-3 py-1 gap-1.5',
    lg: 'text-base px-4 py-2 gap-2',
  }

  if (threat_level === 'LOW') {
    return (
      <span className={`inline-flex items-center font-bold rounded-full bg-green-500 text-white ${sizeClasses[size]}`}>
        <CheckCircle size={iconSize} />
        ✓ LOW RISK
      </span>
    )
  }

  if (threat_level === 'MEDIUM') {
    return (
      <span className={`inline-flex items-center font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300 ${sizeClasses[size]}`}>
        <AlertTriangle size={iconSize} />
        <span>
          MEDIUM RISK
          <span className="font-normal text-amber-600 ml-1">(Use caution)</span>
        </span>
      </span>
    )
  }

  if (threat_level === 'HIGH') {
    return (
      <span className={`inline-flex items-center font-bold rounded-full bg-orange-100 text-orange-800 border border-orange-300 ring-2 ring-orange-400 ring-offset-1 ${sizeClasses[size]}`}>
        <AlertTriangle size={iconSize} />
        HIGH RISK
      </span>
    )
  }

  // CRITICAL
  return (
    <span className={`relative inline-flex items-center font-bold rounded-full bg-red-600 text-white border border-red-700 ${sizeClasses[size]}`}>
      <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-40" />
      <AlertOctagon size={iconSize} className="relative" />
      <span className="relative">🚨 DO NOT TRAVEL</span>
    </span>
  )
}

type RemarkType = 'warning' | 'tip' | 'info' | 'danger' | 'success'

export function RemarkBadge({ type, children }: { type: RemarkType; children: React.ReactNode }) {
  const configs: Record<RemarkType, { wrapper: string; icon: React.ReactNode; label: string }> = {
    warning: {
      wrapper: 'bg-amber-50 border border-amber-200 text-amber-800',
      icon: <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />,
      label: '⚠ Warning',
    },
    tip: {
      wrapper: 'bg-blue-50 border border-blue-200 text-blue-800',
      icon: <Lightbulb size={13} className="text-blue-500 shrink-0 mt-0.5" />,
      label: '💡 Tip',
    },
    info: {
      wrapper: 'bg-indigo-50 border border-indigo-200 text-indigo-800',
      icon: <Info size={13} className="text-indigo-500 shrink-0 mt-0.5" />,
      label: 'ℹ Info',
    },
    danger: {
      wrapper: 'bg-red-50 border border-red-200 text-red-800',
      icon: <AlertOctagon size={13} className="text-red-500 shrink-0 mt-0.5" />,
      label: '🚨 Alert',
    },
    success: {
      wrapper: 'bg-green-50 border border-green-200 text-green-800',
      icon: <CheckCircle size={13} className="text-green-500 shrink-0 mt-0.5" />,
      label: '✓ Safe',
    },
  }

  const { wrapper, icon, label } = configs[type]

  return (
    <div className={`flex gap-2 rounded-lg px-3 py-2 text-xs ${wrapper}`}>
      {icon}
      <span>
        <span className="font-semibold mr-1">{label}:</span>
        {children}
      </span>
    </div>
  )
}
