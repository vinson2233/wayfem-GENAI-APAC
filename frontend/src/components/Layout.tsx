import { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'

const navLinks = [
  { to: '/', label: 'Plan', end: true },
  { to: '/community', label: 'Community' },
]

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <div className="min-h-screen flex flex-col bg-cream-50">
      {/* Top edge marquee — only on non-home pages it's quieter */}
      <div className="border-b border-[var(--hairline)] overflow-hidden bg-cream-50">
        <div className="marquee-track py-2 text-[10px] uppercase tracking-[0.3em] text-rose-700/80">
          {Array.from({ length: 2 }).map((_, i) => (
            <span key={i} className="flex items-center gap-12">
              <span>Travel safer, travel freer</span>
              <span className="text-rose-300">✦</span>
              <span>AI safety intelligence</span>
              <span className="text-rose-300">✦</span>
              <span>For women, by design</span>
              <span className="text-rose-300">✦</span>
              <span>Real-time advisories · Female-friendly stays</span>
              <span className="text-rose-300">✦</span>
              <span>Community wisdom</span>
              <span className="text-rose-300">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* Main nav */}
      <nav className="sticky top-0 z-50 bg-cream-50/85 backdrop-blur-md border-b border-[var(--hairline)]">
        <div className="max-w-[1320px] mx-auto px-6 lg:px-12">
          <div className="flex items-center justify-between h-20">
            <NavLink to="/" className="flex items-baseline gap-2 group">
              <span className="wordmark text-[2.2rem] text-ink-500">w</span>
              <span className="wordmark text-[2.2rem] text-ink-500">a</span>
              <span className="wordmark text-[2.2rem] text-ink-500">y</span>
              <span className="wordmark-italic text-[2.2rem] text-rose-500">f</span>
              <span className="wordmark text-[2.2rem] text-ink-500">e</span>
              <span className="wordmark text-[2.2rem] text-ink-500">m</span>
              <span className="text-rose-400 text-xs ml-1 group-hover:rotate-45 transition-transform duration-500">✦</span>
            </NavLink>

            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link, i) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `relative px-5 py-2 text-[0.92rem] font-medium tracking-tight transition-colors ${
                      isActive ? 'text-ink-500' : 'text-ink-300 hover:text-ink-500'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className="num-tag mr-1.5 text-rose-400">0{i + 1}</span>
                      {link.label}
                      {isActive && (
                        <span className="absolute -bottom-[1px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-rose-500" />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>

            <div className="hidden md:block">
              <NavLink
                to="/"
                className="text-[0.85rem] font-medium tracking-tight text-ink-500 link-underline"
              >
                Plan a trip →
              </NavLink>
            </div>

            <button
              className="md:hidden p-2 text-ink-500"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Menu"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-[var(--hairline)] bg-cream-50 px-6 py-4 space-y-1">
            {navLinks.map((link, i) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-baseline gap-3 py-3 text-lg font-display tracking-tight transition-colors ${
                    isActive ? 'text-ink-500' : 'text-ink-300'
                  }`
                }
              >
                <span className="num-tag text-rose-400">0{i + 1}</span>
                {link.label}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      <main className={`flex-1 w-full ${isHome ? '' : 'max-w-[1280px] mx-auto px-6 lg:px-12 py-12'}`}>
        <Outlet />
      </main>

      <footer className="border-t border-[var(--hairline)] bg-cream-50 mt-24">
        <div className="max-w-[1320px] mx-auto px-6 lg:px-12 py-16">
          <div className="grid md:grid-cols-12 gap-10 items-end">
            <div className="md:col-span-7">
              <p className="eyebrow mb-4">Manifesto · 2026</p>
              <h3 className="display text-5xl md:text-6xl text-ink-500 max-w-2xl">
                Every woman deserves the
                {' '}
                <em className="text-rose-500 font-normal">freedom</em>
                {' '}
                to wander without fear.
              </h3>
            </div>
            <div className="md:col-span-5 md:text-right space-y-3">
              <p className="text-sm text-ink-300 leading-relaxed max-w-xs md:ml-auto">
                Wayfem is an open project that pairs four AI agents with the wisdom of women who've been there.
              </p>
              <div className="flex md:justify-end gap-4 text-sm text-ink-400">
                <a className="link-underline" href="#">GitHub</a>
                <a className="link-underline" href="#">Manifesto</a>
                <a className="link-underline" href="#">Privacy</a>
              </div>
            </div>
          </div>

          <div className="hairline my-12" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <span className="wordmark text-2xl text-ink-500">wayfem</span>
              <span className="wordmark-italic text-2xl text-rose-500">✦</span>
              <span className="num-tag">© {new Date().getFullYear()}</span>
            </div>
            <p className="text-xs text-ink-300 italic font-display">
              "She believed she could, so she went." — built with care
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
