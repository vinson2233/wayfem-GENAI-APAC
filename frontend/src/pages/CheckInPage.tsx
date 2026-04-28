import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Phone, AlertTriangle } from 'lucide-react'
import { checkIn } from '../api/client'
import { formatDistanceToNow, addHours } from 'date-fns'

export default function CheckInPage() {
  const { tripId } = useParams<{ tripId: string }>()
  const [lastCheckIn, setLastCheckIn] = useState<Date | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  const handleCheckIn = async () => {
    if (!tripId) return
    setLoading(true)
    setError(null)
    setSuccess(false)
    try {
      await checkIn(tripId)
      const checkInTime = new Date()
      setLastCheckIn(checkInTime)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
    } catch {
      setError('Check-in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const nextCheckIn = lastCheckIn ? addHours(lastCheckIn, 24) : null
  const isOverdue = nextCheckIn ? now > nextCheckIn : false

  return (
    <div className="max-w-xl mx-auto space-y-12">
      <header className="text-center">
        <p className="eyebrow mb-3">Daily ritual</p>
        <h1 className="display text-5xl lg:text-6xl text-ink-500 leading-[0.95] tracking-tight">
          Tell us
          <br />
          you're <em className="text-rose-500 font-normal">safe</em>.
        </h1>
        <p className="num-tag mt-4">Trip · {tripId}</p>
      </header>

      <div className="text-center">
        {success ? (
          <div className="space-y-4 animate-bloom">
            <span className="text-rose-300 text-4xl tracking-[0.5em]">✦ ✦ ✦</span>
            <h2 className="display text-4xl text-ink-500">
              You're <em className="text-green-700 font-normal">safe</em>.
            </h2>
            <p className="text-sm text-ink-300 italic font-display">Next check-in in 24 hours. Travel beautifully.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <button
              onClick={handleCheckIn}
              disabled={loading}
              className="group relative w-56 h-56 rounded-full bg-rose-500 hover:bg-rose-700 disabled:opacity-60 transition-all duration-500 hover:scale-[1.03] active:scale-95 mx-auto"
              style={{ boxShadow: '0 30px 60px -20px rgba(207, 111, 104, 0.4)' }}
            >
              {/* Concentric pulse rings */}
              <span className="absolute inset-0 rounded-full bg-rose-500/30 animate-ping" />
              <span className="absolute inset-3 rounded-full border border-cream-50/30" />
              <span className="absolute inset-7 rounded-full border border-cream-50/20" />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-cream-50">
                {loading ? (
                  <div className="w-10 h-10 rounded-full border-2 border-cream-50/30 border-t-cream-50 animate-spin" />
                ) : (
                  <>
                    <span className="font-display text-5xl italic leading-none">I'm</span>
                    <span className="font-display text-6xl leading-none mt-1">safe.</span>
                    <span className="text-[10px] uppercase tracking-[0.3em] mt-3 opacity-80">Tap to confirm</span>
                  </>
                )}
              </div>
            </button>
            <p className="text-sm text-ink-300 italic font-display">Check in once a day · we'll alert your contact if you don't</p>
          </div>
        )}

        {error && (
          <p className="text-sm text-rose-700 italic font-display border-l-2 border-rose-500 pl-3 mt-6 text-left">{error}</p>
        )}
      </div>

      <div className="border-t border-[var(--hairline)] pt-8">
        <p className="num-tag mb-5">Status</p>
        <dl className="space-y-3">
          <div className="flex items-baseline justify-between border-b border-[var(--hairline)] pb-3">
            <dt className="text-sm text-ink-300">Last check-in</dt>
            <dd className="font-display text-lg text-ink-500">
              {lastCheckIn ? formatDistanceToNow(lastCheckIn, { addSuffix: true }) : 'Not yet'}
            </dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-sm text-ink-300">Next required</dt>
            <dd className={`font-display text-lg ${isOverdue ? 'text-rose-700' : 'text-ink-500'}`}>
              {nextCheckIn
                ? `${formatDistanceToNow(nextCheckIn, { addSuffix: true })}${isOverdue ? ' · overdue' : ''}`
                : 'Every 24 hours'}
            </dd>
          </div>
        </dl>
        {isOverdue && (
          <div className="flex items-center gap-2 bg-rose-50 border-l-2 border-rose-700 px-3 py-2.5 mt-4">
            <AlertTriangle size={14} className="text-rose-700 shrink-0" />
            <p className="text-sm text-rose-800 italic font-display">Overdue. Check in now or message your contact.</p>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--hairline)] pt-8">
        <div className="flex items-baseline justify-between mb-5">
          <p className="num-tag">Emergency · keep close</p>
          <Phone size={14} className="text-rose-500" />
        </div>
        <dl className="space-y-3">
          {[
            { label: 'Local emergency', value: '112' },
            { label: 'Police', value: '110' },
          ].map(item => (
            <div key={item.label} className="flex items-baseline justify-between">
              <dt className="text-sm text-ink-300">{item.label}</dt>
              <dd className="font-display text-2xl text-ink-500 tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
