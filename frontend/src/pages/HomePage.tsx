import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Loader, Shield, Building2, Clock, Users } from 'lucide-react'
import { useTripPlan } from '../hooks/useTripPlan'
import { AgentDashboard } from '../components/AgentDashboard'
import { ClarificationStep } from '../components/ClarificationStep'
import { clarifyTrip } from '../api/client'
import type { ClarifyResponse } from '../api/client'

export default function HomePage() {
  const navigate = useNavigate()
  const { loading, error, agents, parseLog, execute } = useTripPlan()

  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [emergencyContact, setEmergencyContact] = useState('')

  const [clarifying, setClarifying] = useState(false)
  const [clarifyData, setClarifyData] = useState<ClarifyResponse | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)

  const heroRef = useRef<HTMLDivElement>(null)
  const today = new Date().toISOString().split('T')[0]

  // Scroll back to the top of the hero whenever agents start running
  useEffect(() => {
    if (loading) {
      heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [loading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description || !startDate || !endDate) return
    if (endDate < startDate) {
      setDateError('Return date must be on or after departure date.')
      return
    }
    if (startDate < today) {
      setDateError('Departure date can’t be in the past.')
      return
    }
    setDateError(null)
    setClarifying(true)
    try {
      const res = await clarifyTrip(description, startDate, endDate)
      setClarifyData(res.data)
    } catch {
      setClarifyData({
        destination_refined: '',
        destination_was_vague: false,
        city_options: [],
        cities: [],
        understood_summary: '',
        extracted_preferences: {},
        trip_questions: [],
      })
    } finally {
      setClarifying(false)
    }
  }

  const handleClarifyConfirm = async (
    refinedDestination: string,
    answers: Record<string, string>,
    extractedPrefs: Record<string, unknown>,
    cities: string[],
  ) => {
    setClarifyData(null)
    const prefs = mergePreferences(extractedPrefs, answers)
    await runPlan(refinedDestination, prefs, cities)
  }

  const runPlan = async (dest: string, prefs: Record<string, unknown>, cities: string[] = []) => {
    const result = await execute({
      destination: dest,
      start_date: startDate,
      end_date: endDate,
      emergency_contact: emergencyContact || undefined,
      preferences: prefs,
      cities: cities.length > 0 ? cities : undefined,
    })
    if (result) {
      navigate(`/trip/${result.trip_id}`, { state: { tripData: result } })
    }
  }

  const showingForm = !clarifyData && !loading

  return (
    <div className="bg-cream-50">

      {/* ══════════════════════════════════════════════════════════
            HERO — Centered, form-first
         ══════════════════════════════════════════════════════════ */}
      <section ref={heroRef} className="relative overflow-hidden min-h-screen flex flex-col">
        {/* Background blobs */}
        <div className="blossom w-[600px] h-[600px] bg-rose-100 -top-48 -left-48 animate-drift opacity-70" />
        <div className="blossom w-[500px] h-[500px] bg-rose-200 -bottom-32 -right-32 opacity-40" />
        <div className="noise" />

        <div className="relative flex-1 flex flex-col items-center justify-center px-6 pt-28 pb-20">

          {/* Eyebrow */}
          <p className="eyebrow text-rose-700 mb-8 reveal reveal-1">
            AI-powered · Solo female travel · Safety-first
          </p>

          {/* Headline */}
          <h1 className="reveal reveal-2 display text-center leading-[0.88] text-ink-500 mb-6"
              style={{ fontSize: 'clamp(3.5rem, 10vw, 8rem)' }}>
            Travel <em className="text-rose-500 font-normal">safer</em>,<br />
            travel <em className="text-rose-500 font-normal">freer</em>.
          </h1>

          {/* Subtext */}
          <p className="reveal reveal-3 text-center text-ink-400 text-lg max-w-md mx-auto mb-10 leading-relaxed">
            Describe your trip in plain words. Four AI agents handle safety,
            hotels, scheduling, and local wisdom — in about 25 seconds.
          </p>

          {/* ── Form / Clarify / Agents ── */}
          <div className={`reveal reveal-4 w-full transition-all duration-300 ${loading ? 'max-w-4xl' : 'max-w-2xl'}`}>
            {clarifyData ? (
              <ClarificationStep
                data={clarifyData}
                onConfirm={handleClarifyConfirm}
                onBack={() => setClarifyData(null)}
              />
            ) : loading ? (
              <AgentDashboard
                agents={agents}
                parseLog={parseLog}
                destination={description}
              />
            ) : (
              <form onSubmit={handleSubmit} className="paper-card p-8 lg:p-10 space-y-6">

                {/* Trip description */}
                <div>
                  <span className="num-tag block mb-2">01 · describe your trip</span>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="e.g. A week in Bali — temples, beaches, and good food. Mid-range budget, no rush."
                    required
                    rows={3}
                    className="field resize-none w-full leading-relaxed"
                    autoFocus
                  />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="num-tag block mb-1">02 · departing</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => { setStartDate(e.target.value); setDateError(null) }}
                      min={today}
                      required
                      className="field w-full"
                    />
                  </label>
                  <label className="block">
                    <span className="num-tag block mb-1">03 · returning</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => { setEndDate(e.target.value); setDateError(null) }}
                      min={startDate || today}
                      required
                      className="field w-full"
                    />
                  </label>
                </div>
                {dateError && (
                  <p className="text-sm text-rose-700 bg-rose-50 border-l-2 border-rose-500 px-3 py-2 italic font-display">
                    {dateError}
                  </p>
                )}

                {/* Emergency contact */}
                <label className="block">
                  <span className="num-tag block mb-1">
                    04 · emergency contact{' '}
                    <span className="text-ink-300/70 italic">(optional)</span>
                  </span>
                  <input
                    type="text"
                    value={emergencyContact}
                    onChange={e => setEmergencyContact(e.target.value)}
                    placeholder="A name or number we can reach if you miss check-in"
                    className="field w-full"
                  />
                </label>

                {error && (
                  <p className="text-sm text-rose-700 bg-rose-50 border-l-2 border-rose-500 px-3 py-2 italic font-display">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!description || !startDate || !endDate || clarifying}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-base"
                >
                  {clarifying ? (
                    <>
                      <Loader size={16} className="animate-spin" />
                      <span>Reading your trip…</span>
                    </>
                  ) : (
                    <>
                      <span>Plan my trip</span>
                      <ArrowUpRight size={18} />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Trust chips — only when form is showing */}
          {showingForm && (
            <div className="reveal reveal-5 mt-8 flex flex-wrap items-center justify-center gap-4">
              {[
                { icon: Shield, label: 'Live safety reports' },
                { icon: Building2, label: 'Female-vetted stays' },
                { icon: Clock, label: '~25 sec to your plan' },
                { icon: Users, label: 'Community wisdom' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-ink-300 text-xs font-display">
                  <Icon size={12} className="text-rose-400" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
            HOW IT WORKS
         ══════════════════════════════════════════════════════════ */}
      <section className="max-w-[1200px] mx-auto px-6 lg:px-12 py-24 lg:py-32">
        <div className="text-center mb-16">
          <p className="eyebrow text-rose-700 mb-4">№ 001 · The method</p>
          <h2 className="display text-5xl lg:text-6xl text-ink-500 leading-[0.95]">
            Four agents,{' '}
            <em className="text-rose-500 font-normal">one</em> verdict.
          </h2>
          <p className="text-ink-400 text-lg mt-6 max-w-xl mx-auto leading-relaxed">
            Each agent scrutinizes a different layer — threats, stays, schedules,
            community wisdom — then they confer.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {[
            { num: '01', label: 'Safety Agent', title: 'Reads what the world says', body: 'Travel advisories, recent incidents, and women-specific reports. Every flag sourced.', accent: '🛡' },
            { num: '02', label: 'Stays Agent', title: 'Vets every doorway', body: 'Scores hotels by our Female Friendliness Index — door locks, lobby visibility, area safety.', accent: '🏛' },
            { num: '03', label: 'Schedule Agent', title: 'Respects your curfew', body: 'Builds day-by-day plans with safe-return times. Critical hours flagged in red.', accent: '◷' },
            { num: '04', label: 'Community Agent', title: "Listens to women who've been there", body: 'Real tips on transport, food, nightlife, and emergencies — from travelers like you.', accent: '❀' },
          ].map(card => (
            <article key={card.num} className="group paper-card p-7">
              <div className="flex items-start justify-between mb-6">
                <span className="num-tag">{card.num}</span>
                <span className="text-2xl text-rose-400 transition-transform group-hover:rotate-12">{card.accent}</span>
              </div>
              <p className="eyebrow text-rose-700 mb-2">{card.label}</p>
              <h3 className="display text-2xl text-ink-500 mb-3 leading-tight">{card.title}</h3>
              <p className="text-sm text-ink-400 leading-relaxed">{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
            PULL QUOTE
         ══════════════════════════════════════════════════════════ */}
      <section className="border-y border-[var(--hairline)] bg-rose-50/40 py-20 lg:py-28">
        <div className="max-w-[900px] mx-auto px-6 lg:px-12 text-center">
          <p className="asterism mb-8" />
          <blockquote className="display text-3xl sm:text-4xl lg:text-5xl text-ink-500 leading-[1.1] tracking-tight">
            "Travel is the only thing you buy that makes you{' '}
            <em className="font-normal text-rose-500">richer</em>.
            Safety is the only thing that lets you{' '}
            <em className="font-normal text-rose-500">go</em>."
          </blockquote>
          <p className="num-tag mt-8">— editor's note</p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
            CLOSING CTA
         ══════════════════════════════════════════════════════════ */}
      <section className="bg-ink-500 text-cream-50 py-24 lg:py-32 relative overflow-hidden">
        <div className="blossom w-[400px] h-[400px] bg-rose-500 -bottom-32 -right-20 opacity-30" />
        <div className="max-w-[900px] mx-auto px-6 lg:px-12 text-center relative">
          <p className="eyebrow text-rose-300 mb-6">№ 002 · The invitation</p>
          <h2 className="display text-5xl sm:text-6xl lg:text-7xl text-cream-50 leading-[0.95] tracking-tight">
            Pack lighter.<br />
            Worry <em className="font-normal text-rose-300">less</em>.
          </h2>
          <p className="text-cream-50/70 text-lg mt-8 max-w-md mx-auto leading-relaxed">
            The world has more rooms with safe locks than you've been told.
            We'll help you find them.
          </p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="mt-10 inline-flex items-center gap-3 px-8 py-4 bg-cream-50 text-ink-500 font-medium hover:bg-rose-100 transition-colors"
          >
            Plan a trip
            <ArrowUpRight size={18} />
          </button>
        </div>
      </section>

    </div>
  )
}

function mergePreferences(
  extracted: Record<string, unknown>,
  answers: Record<string, string>,
): Record<string, unknown> {
  const prefs: Record<string, unknown> = { ...extracted }
  for (const [id, value] of Object.entries(answers)) {
    if (id === 'pace') {
      prefs.pace = value.toLowerCase().split(' ')[0]
    } else {
      prefs[`clarify_${id}`] = value
    }
  }
  return prefs
}
