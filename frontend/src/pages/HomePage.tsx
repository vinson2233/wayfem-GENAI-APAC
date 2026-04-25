import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Check } from 'lucide-react'
import { useTripPlan, PROGRESS_STEPS } from '../hooks/useTripPlan'

export default function HomePage() {
  const navigate = useNavigate()
  const { loading, error, execute } = useTripPlan()

  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [emergencyContact, setEmergencyContact] = useState('')
  const [femaleOnly, setFemaleOnly] = useState(false)
  const [avoidNightlife, setAvoidNightlife] = useState(false)
  const [budgetTravel, setBudgetTravel] = useState(false)
  const [progressStep, setProgressStep] = useState(0)
  const [detailIdx, setDetailIdx] = useState(0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!destination || !startDate || !endDate) return

    let step = 0
    setProgressStep(0)
    setDetailIdx(0)
    const interval = setInterval(() => {
      step = Math.min(step + 1, PROGRESS_STEPS.length - 1)
      setProgressStep(step)
      setDetailIdx(0)
    }, 4000)

    const result = await execute({
      destination,
      start_date: startDate,
      end_date: endDate,
      emergency_contact: emergencyContact || undefined,
      preferences: {
        female_only_accommodations: femaleOnly,
        avoid_nightlife: avoidNightlife,
        budget_travel: budgetTravel,
      },
    })

    clearInterval(interval)

    if (result) {
      navigate(`/trip/${result.trip_id}`, { state: { tripData: result } })
    }
  }

  useEffect(() => {
    if (!loading) return
    const currentDetails = PROGRESS_STEPS[progressStep]?.details ?? []
    if (currentDetails.length === 0) return
    const t = setInterval(() => {
      setDetailIdx(i => (i + 1) % currentDetails.length)
    }, 900)
    return () => clearInterval(t)
  }, [loading, progressStep])

  return (
    <div className="bg-cream-50">
      {/* ════════════════════════════════════════════════════════
            HERO — Editorial split with massive serif type
         ════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden">
        {/* Soft pink atmosphere */}
        <div className="blossom w-[520px] h-[520px] bg-rose-100 -top-40 -left-32 animate-drift" />
        <div className="blossom w-[420px] h-[420px] bg-rose-200 top-32 right-0 opacity-40" />
        <div className="noise" />

        <div className="relative max-w-[1320px] mx-auto px-6 lg:px-12 pt-16 pb-24">
          {/* Top meta strip */}
          <div className="flex items-baseline justify-between mb-12 reveal reveal-1">
            <span className="eyebrow">№ 001 · Issue One</span>
            <span className="text-xs font-display italic text-ink-300">
              Tuesday, {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </span>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 items-start">
            {/* Left column — headline */}
            <div className="lg:col-span-7 space-y-8">
              <h1 className="reveal reveal-2 display text-[14vw] sm:text-[10vw] lg:text-[8.5rem] xl:text-[10rem] leading-[0.85] text-ink-500">
                <span className="block">Travel</span>
                <span className="block">
                  <em className="font-normal text-rose-500" style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100' }}>
                    safer,
                  </em>
                </span>
                <span className="block">travel</span>
                <span className="block flex items-baseline gap-4">
                  <em className="font-normal text-rose-500" style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100' }}>
                    freer.
                  </em>
                  <span className="text-rose-300 text-3xl lg:text-5xl">✦</span>
                </span>
              </h1>

              <div className="reveal reveal-3 flex items-start gap-6 max-w-2xl">
                <span className="hidden sm:block w-12 h-px bg-rose-400 mt-3 shrink-0" />
                <p className="text-lg lg:text-xl text-ink-400 leading-relaxed">
                  An <em className="font-display text-ink-500">opinionated</em> travel
                  companion that scans threats, vets accommodations, and pairs you with
                  women who've walked the same streets — so you can wander without flinching.
                </p>
              </div>

              {/* Stat strip */}
              <div className="reveal reveal-4 grid grid-cols-3 gap-6 max-w-2xl pt-6 border-t border-[var(--hairline)]">
                {[
                  { num: '4', label: 'AI agents', sub: 'in concert' },
                  { num: '120+', label: 'Cities', sub: 'mapped' },
                  { num: '24/7', label: 'Check-ins', sub: 'always on' },
                ].map(stat => (
                  <div key={stat.label}>
                    <p className="display text-4xl lg:text-5xl text-ink-500 mb-1">{stat.num}</p>
                    <p className="eyebrow">{stat.label}</p>
                    <p className="text-xs text-ink-300 italic font-display mt-0.5">{stat.sub}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right column — Form (or progress) */}
            <div className="lg:col-span-5 reveal reveal-5">
              <div className="paper-card p-8 lg:p-10 lg:sticky lg:top-32">
                {!loading ? (
                  <form onSubmit={handleSubmit} className="space-y-7">
                    <div className="flex items-baseline justify-between">
                      <p className="section-number">i.</p>
                      <p className="eyebrow">Begin</p>
                    </div>

                    <h2 className="display text-3xl text-ink-500 leading-tight">
                      Where shall we
                      <em className="text-rose-500 font-normal"> wander</em>?
                    </h2>

                    <div className="space-y-6">
                      <label className="block">
                        <span className="num-tag block mb-1">01 · destination</span>
                        <input
                          type="text"
                          value={destination}
                          onChange={e => setDestination(e.target.value)}
                          placeholder="Tokyo, Japan"
                          required
                          className="field"
                          autoFocus
                        />
                      </label>

                      <div className="grid grid-cols-2 gap-6">
                        <label className="block">
                          <span className="num-tag block mb-1">02 · departing</span>
                          <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            required
                            className="field"
                          />
                        </label>
                        <label className="block">
                          <span className="num-tag block mb-1">03 · returning</span>
                          <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            required
                            className="field"
                          />
                        </label>
                      </div>

                      <label className="block">
                        <span className="num-tag block mb-1">04 · emergency contact <span className="text-ink-300/70 italic">(optional)</span></span>
                        <input
                          type="text"
                          value={emergencyContact}
                          onChange={e => setEmergencyContact(e.target.value)}
                          placeholder="A name or phone number we can lean on"
                          className="field"
                        />
                      </label>
                    </div>

                    <div className="pt-2">
                      <p className="num-tag mb-3">05 · preferences</p>
                      <div className="space-y-2">
                        {[
                          { label: 'Female-only accommodations', value: femaleOnly, onChange: setFemaleOnly },
                          { label: 'Avoid nightlife districts', value: avoidNightlife, onChange: setAvoidNightlife },
                          { label: 'Budget conscious', value: budgetTravel, onChange: setBudgetTravel },
                        ].map(pref => (
                          <button
                            key={pref.label}
                            type="button"
                            onClick={() => pref.onChange(!pref.value)}
                            className="w-full flex items-center gap-3 py-2 group text-left"
                          >
                            <span className={`pretty-check ${pref.value ? 'checked' : ''}`}>
                              {pref.value && <Check size={11} className="text-cream-50" strokeWidth={3} />}
                            </span>
                            <span className={`text-sm transition-colors ${pref.value ? 'text-ink-500 font-medium' : 'text-ink-400 group-hover:text-ink-500'}`}>
                              {pref.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {error && (
                      <p className="text-sm text-rose-700 bg-rose-50 border-l-2 border-rose-500 px-3 py-2 italic font-display">
                        {error}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={!destination || !startDate || !endDate}
                      className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-base"
                    >
                      <span>Plan my trip</span>
                      <ArrowUpRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                    </button>

                    <p className="text-[11px] text-ink-300 text-center italic font-display">
                      Takes ~25 seconds · four agents in concert
                    </p>
                  </form>
                ) : (
                  <div className="py-6 space-y-7">
                    <div className="flex items-baseline justify-between">
                      <p className="section-number">ii.</p>
                      <p className="eyebrow">Mapping</p>
                    </div>

                    <div>
                      <h3 className="display text-3xl text-ink-500 leading-tight">
                        Listening to
                        <em className="text-rose-500 font-normal"> {destination || 'your destination'}</em>…
                      </h3>
                      <p className="text-sm text-ink-300 italic font-display mt-2">
                        Four agents are reading advisories, scoring stays, and gathering whispers from the community.
                      </p>
                    </div>

                    {/* Active step ticker */}
                    <div className="bg-rose-50 border-l-2 border-rose-500 px-5 py-4 min-h-[72px]">
                      <p className="num-tag text-rose-700 mb-1">
                        {String(progressStep + 1).padStart(2, '0')} · {PROGRESS_STEPS[progressStep]?.agent}
                      </p>
                      <p className="text-sm text-ink-500 italic font-display transition-all duration-300">
                        {PROGRESS_STEPS[progressStep]?.details[detailIdx]}
                      </p>
                    </div>

                    <div className="space-y-4">
                      {PROGRESS_STEPS.map((step, idx) => (
                        <div
                          key={idx}
                          className={`flex items-baseline gap-4 transition-all duration-500 ${
                            idx <= progressStep ? 'opacity-100' : 'opacity-30'
                          }`}
                        >
                          <span className={`num-tag w-8 shrink-0 ${idx <= progressStep ? 'text-rose-500' : ''}`}>
                            {idx < progressStep ? '✓' : String(idx + 1).padStart(2, '0')}
                          </span>
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${idx <= progressStep ? 'text-ink-500' : 'text-ink-300'}`}>
                              {step.label}
                            </p>
                            {idx === progressStep && (
                              <div className="mt-1 h-px bg-gradient-to-r from-rose-500 via-rose-300 to-transparent" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
            EDITORIAL DIVIDER — pull quote
         ════════════════════════════════════════════════════════ */}
      <section className="border-y border-[var(--hairline)] bg-rose-50/40 py-20 lg:py-28">
        <div className="max-w-[1100px] mx-auto px-6 lg:px-12 text-center">
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

      {/* ════════════════════════════════════════════════════════
            HOW IT WORKS — three column editorial
         ════════════════════════════════════════════════════════ */}
      <section className="max-w-[1320px] mx-auto px-6 lg:px-12 py-24 lg:py-32">
        <div className="grid lg:grid-cols-12 gap-12 mb-16">
          <div className="lg:col-span-4">
            <p className="eyebrow mb-3">№ 002 · The method</p>
            <h2 className="display text-5xl lg:text-6xl text-ink-500 leading-[0.95]">
              Four agents,
              <br />
              <em className="text-rose-500 font-normal">one</em> verdict.
            </h2>
          </div>
          <div className="lg:col-span-7 lg:col-start-6 self-end">
            <p className="text-lg text-ink-400 leading-relaxed">
              Behind every itinerary is a coordinated dance of specialized agents.
              Each one scrutinizes a different layer — threats, stays, schedules,
              community wisdom — then they confer. What you receive is the consensus,
              with every flag traced back to its source.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {[
            {
              num: '01',
              label: 'Safety Agent',
              title: 'Reads what the world says',
              body: 'Pulls travel advisories, recent incidents, and women-specific reports. Sources every flag.',
              accent: '🛡',
            },
            {
              num: '02',
              label: 'Stays Agent',
              title: 'Vets every doorway',
              body: 'Scores hotels by our Female Friendliness Index — door security, lobby visibility, the things that matter.',
              accent: '🏛',
            },
            {
              num: '03',
              label: 'Schedule Agent',
              title: 'Keeps a curfew you set',
              body: 'Builds a day-by-day plan that respects safe-return times. Critical hours flagged in red.',
              accent: '◷',
            },
          ].map((card, i) => (
            <article key={card.num} className={`group ${i === 1 ? 'md:translate-y-8' : ''}`}>
              <div className="flex items-start justify-between mb-8 pb-4 border-b border-[var(--hairline-strong)]">
                <span className="num-tag">{card.num}</span>
                <span className="text-3xl text-rose-400 transition-transform group-hover:rotate-12">{card.accent}</span>
              </div>
              <p className="eyebrow text-rose-700 mb-3">{card.label}</p>
              <h3 className="display text-3xl text-ink-500 mb-4 leading-tight">{card.title}</h3>
              <p className="text-ink-400 leading-relaxed">{card.body}</p>
            </article>
          ))}
        </div>

        {/* Fourth, full-width card — community */}
        <article className="mt-12 group relative overflow-hidden">
          <div className="paper-card p-10 lg:p-14 grid md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-2">
              <span className="num-tag block mb-2">04</span>
              <span className="text-5xl text-rose-400">❀</span>
            </div>
            <div className="md:col-span-7">
              <p className="eyebrow text-rose-700 mb-3">Community Agent</p>
              <h3 className="display text-3xl lg:text-4xl text-ink-500 mb-3 leading-tight">
                Listens to the women who've already been there.
              </h3>
              <p className="text-ink-400 leading-relaxed">
                Real tips from real travelers — categorized by transport, lodging, nightlife, food, and emergencies.
                When the dataset is thin, the agent generates context-aware starters and invites the community to refine them.
              </p>
            </div>
            <div className="md:col-span-3 md:text-right">
              <a className="link-underline text-ink-500 font-medium">Browse community →</a>
            </div>
          </div>
        </article>
      </section>

      {/* ════════════════════════════════════════════════════════
            CALL — closing
         ════════════════════════════════════════════════════════ */}
      <section className="bg-ink-500 text-cream-50 py-24 lg:py-32 relative overflow-hidden">
        <div className="blossom w-[400px] h-[400px] bg-rose-500 -bottom-32 -right-20 opacity-30" />
        <div className="max-w-[1100px] mx-auto px-6 lg:px-12 text-center relative">
          <p className="eyebrow text-rose-300 mb-6">№ 003 · The invitation</p>
          <h2 className="display text-5xl sm:text-6xl lg:text-7xl text-cream-50 leading-[0.95] tracking-tight">
            Pack lighter.
            <br />
            Worry <em className="font-normal text-rose-300">less</em>.
          </h2>
          <p className="text-cream-50/70 text-lg mt-8 max-w-xl mx-auto leading-relaxed">
            The world has more rooms with safe locks than you've been told.
            We'll help you find them.
          </p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="mt-12 inline-flex items-center gap-3 px-8 py-4 bg-cream-50 text-ink-500 rounded-full font-medium hover:bg-rose-100 transition-colors"
          >
            Plan a trip
            <ArrowUpRight size={18} />
          </button>
        </div>
      </section>
    </div>
  )
}
