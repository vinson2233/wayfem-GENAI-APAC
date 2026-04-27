import { useState } from 'react'
import { ArrowUpRight, Sparkles, MapPin, Check, AlertTriangle, ArrowLeft } from 'lucide-react'
import type { ClarifyResponse } from '../api/client'

type AnswerValue = string | string[]

interface Props {
  data: ClarifyResponse
  onConfirm: (
    refinedDestination: string,
    answers: Record<string, string>,
    extractedPrefs: Record<string, unknown>,
    cities: string[],
  ) => void
  onBack: () => void
}

export function ClarificationStep({ data, onConfirm, onBack }: Props) {
  const [destination, setDestination] = useState(data.destination_refined)
  const [selectedCities, setSelectedCities] = useState<string[]>([])
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})

  // ── Feasibility gate ──────────────────────────────────────────────────────
  if (data.feasibility_issue) {
    return (
      <div className="paper-card p-8 lg:p-10 space-y-6 animate-bloom">
        <div className="flex gap-3 items-start">
          <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="eyebrow text-rose-700 mb-1">We can't quite plan this one</p>
            <p className="text-ink-400 leading-relaxed">{data.feasibility_issue}</p>
          </div>
        </div>

        {data.feasibility_suggestion && (
          <div className="bg-rose-50/60 border border-rose-100 px-4 py-3">
            <p className="text-xs text-ink-300 font-display uppercase tracking-widest mb-1">suggestion</p>
            <p className="text-sm text-ink-400 font-display italic leading-relaxed">
              {data.feasibility_suggestion}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onBack}
          className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-base"
        >
          <ArrowLeft size={16} />
          <span>Refine my search</span>
        </button>
      </div>
    )
  }

  // ── Normal clarification flow ─────────────────────────────────────────────
  const toggleCity = (city: string) =>
    setSelectedCities(prev =>
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    )

  const finalDestination = (() => {
    if (data.destination_was_vague && selectedCities.length > 0) {
      const country = data.destination_refined.split(',').slice(-1)[0]?.trim()
      if (selectedCities.length === 1) {
        return country && country !== selectedCities[0]
          ? `${selectedCities[0]}, ${country}`
          : selectedCities[0]
      }
      return selectedCities.join(' · ')
    }
    return destination.trim()
  })()

  const isSelected = (id: string, opt: string) => {
    const val = answers[id]
    return Array.isArray(val) ? val.includes(opt) : val === opt
  }

  const toggleOption = (id: string, opt: string, multiple: boolean) => {
    setAnswers(prev => {
      if (!multiple) return { ...prev, [id]: opt }
      const cur = (prev[id] as string[] | undefined) ?? []
      const next = cur.includes(opt) ? cur.filter(o => o !== opt) : [...cur, opt]
      return { ...prev, [id]: next }
    })
  }

  const isAnswered = (id: string, type: string, multiple: boolean) => {
    if (type === 'text') return true
    const val = answers[id]
    if (multiple) return Array.isArray(val) && val.length > 0
    return Boolean(val)
  }

  const allAnswered = data.trip_questions.every(q =>
    isAnswered(q.id, q.type, q.multiple ?? false)
  )
  const cityPicked = !data.destination_was_vague || selectedCities.length > 0
  const destinationFilled = finalDestination.length > 0
  const canConfirm = destinationFilled && cityPicked && allAnswered

  const resolvedCities = (() => {
    if (selectedCities.length > 0) return selectedCities
    if (data.cities && data.cities.length > 0) return data.cities
    const dest = finalDestination.split(',')[0].trim()
    return dest ? [dest] : []
  })()

  const flatAnswers = Object.fromEntries(
    Object.entries(answers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v])
  )

  let qOffset = 1
  if (data.destination_was_vague && data.city_options.length > 0) qOffset = 2

  return (
    <div className="paper-card p-8 lg:p-10 space-y-8 animate-bloom">

      {/* Header */}
      <div>
        <p className="eyebrow text-rose-700 mb-2">Almost there</p>
        <h2 className="display text-3xl text-ink-500 leading-tight">
          Let's make this trip{' '}
          <em className="text-rose-500 font-normal">yours</em>.
        </h2>
        <p className="text-xs text-ink-300 font-display italic mt-2">
          Correct anything we got wrong, then answer a few quick questions.
        </p>
      </div>

      {/* LLM summary */}
      {data.understood_summary && (
        <div className="flex gap-3 items-start bg-rose-50/60 border border-rose-100 px-4 py-3">
          <Sparkles size={14} className="text-rose-400 shrink-0 mt-0.5" />
          <p className="text-sm text-ink-400 font-display italic leading-relaxed">
            {data.understood_summary}
          </p>
        </div>
      )}

      {/* Editable destination */}
      {!data.destination_was_vague && (
        <div>
          <p className="num-tag mb-2">01 · destination</p>
          <div className="relative">
            <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300 pointer-events-none" />
            <input
              type="text"
              value={destination}
              onChange={e => setDestination(e.target.value)}
              placeholder="e.g. Bali, Indonesia"
              className="field pl-8 w-full"
            />
          </div>
          {destination !== data.destination_refined && data.destination_refined && (
            <p className="text-[10px] text-ink-300 italic font-display mt-1">
              Originally parsed as: {data.destination_refined}
            </p>
          )}
        </div>
      )}

      {/* City picker — multi-select */}
      {data.destination_was_vague && data.city_options.length > 0 && (
        <div>
          <div className="flex items-baseline gap-2 mb-3">
            <p className="num-tag">01 · which cities?</p>
            <span className="text-[10px] text-ink-300 italic font-display">pick all you'd like to visit</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.city_options.map(city => {
              const sel = selectedCities.includes(city)
              return (
                <button
                  key={city}
                  type="button"
                  onClick={() => toggleCity(city)}
                  className={`px-4 py-2 border font-display text-base transition-all flex items-center gap-1.5 ${
                    sel
                      ? 'border-rose-500 bg-rose-50 text-rose-700'
                      : 'border-[var(--hairline)] text-ink-400 hover:border-ink-300 hover:text-ink-500'
                  }`}
                >
                  {sel && <Check size={11} className="shrink-0" />}
                  {city}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Trip questions */}
      {data.trip_questions.map((q, i) => {
        const multiple = q.multiple ?? false
        return (
          <div key={q.id}>
            <div className="flex items-baseline gap-2 mb-3">
              <p className="num-tag">
                {String(i + qOffset).padStart(2, '0')} · {q.label}
              </p>
              {multiple && (
                <span className="text-[10px] text-ink-300 italic font-display">pick all that apply</span>
              )}
            </div>
            {q.type === 'text' ? (
              <input
                type="text"
                value={(answers[q.id] as string) ?? ''}
                onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                placeholder={q.placeholder ?? ''}
                className="field w-full"
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {q.options.map(opt => {
                  const selected = isSelected(q.id, opt)
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleOption(q.id, opt, multiple)}
                      className={`px-4 py-2 border font-display text-sm transition-all flex items-center gap-1.5 ${
                        selected
                          ? 'border-rose-500 bg-rose-50 text-rose-700'
                          : 'border-[var(--hairline)] text-ink-400 hover:border-ink-300 hover:text-ink-500'
                      }`}
                    >
                      {multiple && selected && <Check size={11} className="shrink-0" />}
                      {opt}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Destination preview */}
      <div className="border-t border-[var(--hairline)] pt-4 flex items-baseline gap-3">
        <p className="num-tag text-ink-300">Planning for</p>
        <p className={`font-display text-lg italic ${finalDestination ? 'text-ink-500' : 'text-ink-300'}`}>
          {finalDestination || 'enter a destination above'}
        </p>
      </div>

      <button
        type="button"
        disabled={!canConfirm}
        onClick={() => onConfirm(finalDestination, flatAnswers, data.extracted_preferences, resolvedCities)}
        className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-base"
      >
        <span>Let's plan this trip</span>
        <ArrowUpRight size={18} />
      </button>
    </div>
  )
}
