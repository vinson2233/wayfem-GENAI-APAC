import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { Shield, Menu, X, MapPin, Hotel, Users, Calendar, Home } from 'lucide-react'

const navLinks = [
  { to: '/', label: 'Plan Trip', icon: <Home size={16} />, end: true },
  { to: '/safety', label: 'Safety Map', icon: <MapPin size={16} /> },
  { to: '/hotels', label: 'Hotels', icon: <Hotel size={16} /> },
  { to: '/community', label: 'Community', icon: <Users size={16} /> },
]

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="sticky top-0 z-50 bg-white border-b border-safeher-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <NavLink to="/" className="flex items-center gap-2 group">
              <div className="bg-gradient-to-br from-safeher-500 to-safeher-700 p-2 rounded-lg shadow-md group-hover:shadow-safeher-200 transition-shadow">
                <Shield size={20} className="text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-safeher-600 to-purple-600 bg-clip-text text-transparent">
                Wayfem
              </span>
            </NavLink>

            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(link => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-safeher-50 text-safeher-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  {link.icon}
                  {link.label}
                </NavLink>
              ))}
            </div>

            <button
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
            {navLinks.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-safeher-50 text-safeher-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`
                }
              >
                {link.icon}
                {link.label}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-gray-100 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-safeher-500" />
            <span className="text-sm font-semibold text-gray-700">Wayfem</span>
          </div>
          <p className="text-sm text-gray-500 text-center">
            Travel Safer, Travel Freer — AI-powered safety intelligence for women
          </p>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Calendar size={12} />
            <span>{new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
