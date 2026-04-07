import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Search, Calendar, Phone, ChevronRight, AlertTriangle, Star, Users, Zap } from 'lucide-react'
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

  // Rotate detail messages within each active step
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
    <div className="min-h-screen -mt-6 -mx-4 sm:-mx-6">
      {/* ── Full-bleed hero ── */}
      <div
        className="relative min-h-[520px] flex flex-col justify-center items-center px-4 pt-24 pb-32 text-center"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(15,10,30,0.7) 0%, rgba(80,20,80,0.6) 100%), url('https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1600&q=80')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="relative z-10 max-w-2xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-white/80 text-sm font-medium">
            <Shield size={14} className="text-safeher-300" />
            AI-Powered Travel Safety
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-[1.1]">
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg, #f472b6 0%, #c084fc 100%)' }}
            >
              Travel Safe.
            </span>
            <br />
            <span className="text-white">Travel Free.</span>
          </h1>

          <p className="text-white/75 text-lg max-w-md mx-auto leading-relaxed">
            AI-powered safety intelligence designed for women traveling solo
          </p>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-3 pt-1">
            {[
              { icon: '🛡', label: 'Real-time Threat Analysis' },
              { icon: '🏨', label: 'Female-Friendly Hotels' },
              { icon: '👭', label: 'Community Wisdom' },
            ].map(badge => (
              <span
                key={badge.label}
                className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3.5 py-1.5 text-white/90 text-sm font-medium"
              >
                <span>{badge.icon}</span>
                {badge.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Floating form card ── */}
      <div className="relative z-10 max-w-2xl mx-auto px-4 -mt-16">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 sm:p-8">
          {!loading ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <h2 className="text-xl font-bold text-gray-900">Where are you headed?</h2>

              {/* Destination */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Destination</label>
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={destination}
                    onChange={e => setDestination(e.target.value)}
                    placeholder="e.g. Tokyo, Japan"
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-safeher-300 focus:border-transparent placeholder:text-gray-400"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
                  <div className="relative">
                    <Calendar size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      required
                      className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-safeher-300 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date</label>
                  <div className="relative">
                    <Calendar size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      required
                      className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-safeher-300 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Emergency Contact
                  <span className="text-gray-400 font-normal ml-1">(optional)</span>
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={emergencyContact}
                    onChange={e => setEmergencyContact(e.target.value)}
                    placeholder="Name or phone number"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-safeher-300 focus:border-transparent placeholder:text-gray-400"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1 ml-1">We'll create check-in reminders tied to this contact</p>
              </div>

              {/* Preferences */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2.5">Preferences</p>
                <div className="space-y-2.5">
                  {[
                    { label: 'Female-only accommodations', value: femaleOnly, onChange: setFemaleOnly },
                    { label: 'Avoid nightlife areas', value: avoidNightlife, onChange: setAvoidNightlife },
                    { label: 'Budget travel', value: budgetTravel, onChange: setBudgetTravel },
                  ].map(pref => (
                    <label key={pref.label} className="flex items-center gap-3 cursor-pointer group">
                      <div
                        onClick={() => pref.onChange(!pref.value)}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 ${
                          pref.value ? 'bg-safeher-500 border-safeher-500' : 'border-gray-300 group-hover:border-safeher-300'
                        }`}
                      >
                        {pref.value && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm text-gray-600 select-none">{pref.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl p-3">
                  <AlertTriangle size={15} className="text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={!destination || !startDate || !endDate}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-6 bg-gradient-to-r from-rose-500 to-pink-600 text-white font-semibold rounded-xl hover:from-rose-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-pink-200 text-base"
              >
                Plan My Safe Trip →
                <ChevronRight size={18} />
              </button>
            </form>
          ) : (
            <div className="py-10 text-center space-y-6">
              <div className="flex justify-center">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-full border-4 border-safeher-100 border-t-safeher-500 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Shield size={28} className="text-safeher-500" />
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-1">Multi-agent AI analyzing {destination}…</h3>
                <p className="text-sm text-gray-500">This usually takes 15–30 seconds</p>
              </div>

              {/* Active step detail ticker */}
              <div className="bg-safeher-50 border border-safeher-100 rounded-xl px-4 py-3 max-w-sm mx-auto min-h-[56px]">
                <p className="text-xs font-semibold text-safeher-600 uppercase tracking-wide mb-1">
                  {PROGRESS_STEPS[progressStep]?.agent}
                </p>
                <p className="text-sm text-safeher-800 transition-all duration-300">
                  ⚡ {PROGRESS_STEPS[progressStep]?.details[detailIdx]}
                </p>
              </div>

              <div className="space-y-3 text-left max-w-sm mx-auto w-full">
                {PROGRESS_STEPS.map((step, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 text-sm transition-all duration-500 ${
                      idx <= progressStep ? 'opacity-100' : 'opacity-25'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full shrink-0 mt-0.5 flex items-center justify-center ${
                        idx < progressStep
                          ? 'bg-green-500'
                          : idx === progressStep
                          ? 'bg-safeher-500 animate-pulse'
                          : 'bg-gray-200'
                      }`}
                    >
                      {idx < progressStep && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className={`font-medium ${idx <= progressStep ? 'text-gray-800' : 'text-gray-400'}`}>
                        {step.label}
                      </p>
                      {idx < progressStep && (
                        <p className="text-xs text-green-600 mt-0.5">✓ Complete</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── How it works ── */}
      <div className="max-w-4xl mx-auto px-4 py-16 sm:py-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">How Wayfem works</h2>
          <p className="text-gray-500 text-base">Three steps from destination to confident journey</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              icon: <Zap size={22} className="text-safeher-500" />,
              title: 'Safety Intelligence',
              desc: 'We scan travel advisories, crime reports, and real-time alerts specific to women.',
              emoji: '🔍',
            },
            {
              icon: <Star size={22} className="text-safeher-500" />,
              title: 'Curated Hotels',
              desc: 'Hotels scored by our Female Friendliness Index (FFI) — safety first.',
              emoji: '🏨',
            },
            {
              icon: <Users size={22} className="text-safeher-500" />,
              title: 'Smart Itinerary',
              desc: 'Day-by-day schedule that avoids unsafe hours and flags risks in advance.',
              emoji: '📅',
            },
          ].map(card => (
            <div
              key={card.title}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4 hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-xl bg-safeher-50 flex items-center justify-center text-2xl">
                {card.emoji}
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">{card.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{card.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

