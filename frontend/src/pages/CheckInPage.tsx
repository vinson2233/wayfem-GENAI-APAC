import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Shield, CheckCircle, Phone, Clock, AlertTriangle } from 'lucide-react'
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
    <div className="max-w-lg mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center justify-center gap-2">
          <Shield size={24} className="text-safeher-500" />
          Safety Check-In
        </h1>
        <p className="text-gray-500 text-sm">Trip ID: <span className="font-mono text-gray-600">{tripId}</span></p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-4">
        {success ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle size={40} className="text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-green-700">You're Checked In!</h2>
            <p className="text-sm text-gray-500">Stay safe. Next check-in in 24 hours.</p>
          </div>
        ) : (
          <>
            <div className="flex justify-center">
              <button
                onClick={handleCheckIn}
                disabled={loading}
                className="w-40 h-40 rounded-full bg-gradient-to-br from-safeher-500 to-safeher-700 text-white font-bold text-lg shadow-xl hover:from-safeher-600 hover:to-safeher-800 disabled:opacity-50 transition-all hover:scale-105 active:scale-95 flex flex-col items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-8 h-8 rounded-full border-4 border-white/30 border-t-white animate-spin" />
                ) : (
                  <>
                    <Shield size={36} />
                    <span>I'm Safe</span>
                    <span className="text-xs font-normal opacity-80">Check In</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-sm text-gray-500">Tap to confirm you're safe</p>
          </>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg p-3 text-left">
            <AlertTriangle size={15} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <Clock size={16} className="text-safeher-500" />
          Check-In Status
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Last Check-In</span>
            <span className="font-medium text-gray-700">
              {lastCheckIn ? formatDistanceToNow(lastCheckIn, { addSuffix: true }) : 'Not yet checked in'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Next Required</span>
            <span className={`font-medium ${isOverdue ? 'text-red-600' : 'text-gray-700'}`}>
              {nextCheckIn
                ? `${formatDistanceToNow(nextCheckIn, { addSuffix: true })}${isOverdue ? ' — OVERDUE' : ''}`
                : 'Every 24 hours'}
            </span>
          </div>
        </div>
        {isOverdue && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg p-2 mt-1">
            <AlertTriangle size={13} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-700">Your check-in is overdue! Please check in now.</p>
          </div>
        )}
      </div>

      <div className="bg-red-50 border border-red-100 rounded-xl p-4">
        <h3 className="font-semibold text-red-800 flex items-center gap-2 mb-3">
          <Phone size={15} className="text-red-500" />
          Emergency Contacts
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-red-600">Local Emergency</span>
            <span className="font-bold text-red-800">112</span>
          </div>
          <div className="flex justify-between">
            <span className="text-red-600">Police</span>
            <span className="font-bold text-red-800">110</span>
          </div>
          <p className="text-xs text-red-400 mt-2">Save these numbers before you go out</p>
        </div>
      </div>
    </div>
  )
}
