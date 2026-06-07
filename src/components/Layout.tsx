import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Users, LogOut, Menu, X, Home, CalendarDays } from 'lucide-react'
import { useState } from 'react'

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const navItems = [
    { path: '/contacts', label: 'Kontakte', icon: Users },
    { path: '/properties/areas', label: 'Bereiche', icon: Home },
    { path: '/properties/units', label: 'Einheiten', icon: Home },
    { path: '/properties/usages', label: 'Nutzungen', icon: CalendarDays },
    { path: '/calendar', label: 'Kalender', icon: CalendarDays },
  ]

  const isActive = (path: string) => location.pathname.startsWith(path)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo + Firmenname */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Users className="h-4 w-4 text-white" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-gray-900 text-lg leading-none">FLOX</span>
              <span className="text-xs text-gray-400 leading-none mt-0.5">
                natureandfriends am Üdersee GmbH
              </span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
                  ${isActive(item.path)
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                  }
                `}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>

          {/* User + Logout */}
          <div className="flex items-center gap-3">
            <span className="hidden md:block text-sm text-gray-500 truncate max-w-48">
              {user?.email}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              title="Abmelden"
            >
              <LogOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {menuOpen && (
          <div className="md:hidden border-t bg-white px-4 py-3 space-y-1">
            {navItems.map(item => (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setMenuOpen(false) }}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium
                  ${isActive(item.path)
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                  }
                `}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Seiteninhalt */}
      <main>
        <Outlet />
      </main>
    </div>
  )
}