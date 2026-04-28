import { Coins, CloudSun, Shirt, Sun, Building, Check, X, MessageCircleQuestion } from 'lucide-react'
import type { TripBriefing } from '../api/client'

const CASHLESS_LABEL: Record<TripBriefing['cashless_friendly'], string> = {
  yes: 'Cashless friendly',
  mixed: 'Mixed — bring some cash',
  cash_preferred: 'Cash preferred',
}

const CASHLESS_TONE: Record<TripBriefing['cashless_friendly'], string> = {
  yes: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  mixed: 'text-amber-700 bg-amber-50 border-amber-200',
  cash_preferred: 'text-rose-700 bg-rose-50 border-rose-200',
}

const MIX_LABEL: Record<TripBriefing['indoor_outdoor_mix'], { label: string; Icon: typeof Sun }> = {
  mostly_outdoor: { label: 'Mostly outdoors', Icon: Sun },
  balanced: { label: 'Balanced indoor/outdoor', Icon: CloudSun },
  mostly_indoor: { label: 'Mostly indoors', Icon: Building },
}

export default function TripBriefingPanel({ briefing }: { briefing: TripBriefing }) {
  const Mix = MIX_LABEL[briefing.indoor_outdoor_mix]

  return (
    <section className="paper-card p-6 lg:p-8 mb-10 space-y-6">
      <div>
        <p className="eyebrow text-rose-700 mb-1">Trip briefing</p>
        <h3 className="display text-2xl text-ink-500 leading-tight">
          What to know before you go
        </h3>
      </div>

      {/* Top facts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex items-start gap-3 border border-[var(--hairline)] px-4 py-3">
          <Coins size={14} className="text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="num-tag mb-1">Currency</p>
            <p className="font-display text-base text-ink-500 leading-tight">{briefing.currency}</p>
            <span className={`inline-block mt-1.5 text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 border ${CASHLESS_TONE[briefing.cashless_friendly]}`}>
              {CASHLESS_LABEL[briefing.cashless_friendly]}
            </span>
            <p className="text-xs text-ink-400 italic mt-1.5 leading-snug">{briefing.payment_notes}</p>
          </div>
        </div>

        <div className="flex items-start gap-3 border border-[var(--hairline)] px-4 py-3">
          <Mix.Icon size={14} className="text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="num-tag mb-1">Climate · {Mix.label}</p>
            <p className="text-sm text-ink-500 leading-snug">{briefing.climate_summary}</p>
            <div className="flex items-start gap-1.5 mt-2 text-xs text-ink-400 italic">
              <Shirt size={11} className="mt-0.5 shrink-0 text-ink-300" />
              <span>{briefing.dress_code}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Do / Don't lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border border-emerald-200 bg-emerald-50/40 px-4 py-3">
          <p className="eyebrow text-emerald-700 mb-2 flex items-center gap-1.5">
            <Check size={11} /> Do
          </p>
          <ul className="space-y-1.5">
            {briefing.dos.map((line, i) => (
              <li key={i} className="text-sm text-ink-500 leading-snug flex items-baseline gap-2">
                <span className="text-emerald-500 shrink-0">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border border-rose-200 bg-rose-50/40 px-4 py-3">
          <p className="eyebrow text-rose-700 mb-2 flex items-center gap-1.5">
            <X size={11} /> Don't
          </p>
          <ul className="space-y-1.5">
            {briefing.donts.map((line, i) => (
              <li key={i} className="text-sm text-ink-500 leading-snug flex items-baseline gap-2">
                <span className="text-rose-500 shrink-0">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* What if… scenarios — pre-trip rehearsal for first-time solo travelers */}
      {briefing.scenarios && briefing.scenarios.length > 0 && (
        <div>
          <div className="flex items-baseline gap-2 mb-3">
            <MessageCircleQuestion size={14} className="text-rose-400" />
            <p className="eyebrow text-rose-700">What if…</p>
            <span className="text-[10px] text-ink-300 italic font-display">
              rehearse before you go
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {briefing.scenarios.map((s, i) => (
              <div key={i} className="border border-[var(--hairline)] bg-cream-100/40 p-4 hover:border-rose-200 transition-colors">
                <p className="font-display text-base text-ink-500 leading-snug mb-2">
                  <span className="text-rose-400 italic">What if</span> {s.situation.replace(/^What if\s*/i, '')}
                </p>
                <p className="text-sm text-ink-400 leading-relaxed mb-2">{s.response}</p>
                {s.local_phrase && (
                  <div className="border-l-2 border-rose-300 pl-3 mt-2">
                    <p className="font-mono text-xs text-ink-500 font-semibold">{s.local_phrase}</p>
                    {s.local_phrase_translation && (
                      <p className="text-[11px] text-ink-300 italic font-display">
                        {s.local_phrase_translation}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
