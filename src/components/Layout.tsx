import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Users, LogOut, KeyRound, Menu, X, Home, CalendarDays, LayoutDashboard, MoreHorizontal, ChevronDown, ChevronRight, ShieldCheck, Wrench, BookOpen } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useIsAdmin, useIsSuperAdmin, useHasRole } from '@/hooks/usePermissions'
import nafLogo from '@/assets/naf-logo.png'

const ACCOUNTING_ITEMS = [
  { path: '/accounting/buchungssaetze', label: 'Buchungssätze' },
  { path: '/accounting/buchungen',      label: 'Buchungen' },
  { path: '/accounting/transactions',   label: 'Geldkonten' },
  { path: '/accounting/import-patterns',label: 'Importmuster' },
  { path: '/accounting/skr03',          label: 'Kontenrahmen SKR03' },
  { path: '/accounting/account-types',  label: 'Kontoarten' },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = useIsAdmin()
  const { data: isSuperAdmin } = useIsSuperAdmin()
  const { data: hasRole } = useHasRole()
  const [menuOpen, setMenuOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [buchOpen, setBuchOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  const navItems = [
    { path: '/dashboard',           label: 'Dashboard',  icon: LayoutDashboard },
    { path: '/properties/units',    label: 'Einheiten',  icon: Home },
    { path: '/properties/usages',   label: 'Nutzungen',  icon: Users },
    { path: '/calendar',            label: 'Kalender',   icon: CalendarDays },
  ]

  const moreItems = [
    { path: '/contacts',            label: 'Kontakte',     icon: Users },
    { path: '/properties/areas',    label: 'Bereiche',     icon: Home },
    ...((isAdmin || isSuperAdmin) ? [{ path: '/users',              label: 'Nutzer & Rechte', icon: ShieldCheck }] : []),
    ...((isAdmin || isSuperAdmin) ? [{ path: '/admin/data-cleanup', label: 'Datenbereinigung', icon: Wrench }] : []),
    ...(isSuperAdmin              ? [{ path: '/setup',              label: 'Setup',            icon: Wrench }] : []),
  ]

  const isActive = (path: string) => location.pathname.startsWith(path)
  const isAccountingActive = ACCOUNTING_ITEMS.some(i => isActive(i.path))
  const isMoreActive = moreItems.some(i => isActive(i.path)) || isAccountingActive

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
        setBuchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-gray-100">
              <img src={nafLogo} alt="natureandfriends" className="w-9 h-9 object-contain" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-gray-900 text-lg leading-none">FLOX</span>
              <span className="text-xs text-gray-400 leading-none mt-0.5">natureandfriends am Üdersee GmbH</span>
            </div>
          </div>

          {hasRole && (
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(item => (
                <button key={item.path} onClick={() => navigate(item.path)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(item.path) ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}>
                  <item.icon className="h-4 w-4" />{item.label}
                </button>
              ))}

              {/* Mehr... Dropdown */}
              <div className="relative" ref={moreRef}>
                <button onClick={() => { setMoreOpen(!moreOpen); setBuchOpen(false) }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    isMoreActive || moreOpen ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}>
                  <MoreHorizontal className="h-4 w-4" />
                  Mehr...
                  <ChevronDown className={`h-3 w-3 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
                </button>

                {moreOpen && (
                  <div className="absolute right-0 mt-1 w-52 bg-white border rounded-md shadow-lg py-1 z-50">

                    {/* Buchhaltung mit Untermenü */}
                    <div className="relative">
                      <button
                        onClick={() => setBuchOpen(!buchOpen)}
                        className={`w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-left ${
                          isAccountingActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                        }`}>
                        <BookOpen className="h-4 w-4" />
                        <span className="flex-1">Buchhaltung</span>
                        <ChevronRight className={`h-3 w-3 transition-transform ${buchOpen ? 'rotate-90' : ''}`} />
                      </button>

                      {buchOpen && (
                        <div className="border-t bg-gray-50">
                          {ACCOUNTING_ITEMS.map(item => (
                            <button key={item.path}
                              onClick={() => { navigate(item.path); setMoreOpen(false); setBuchOpen(false) }}
                              className={`w-full flex items-center gap-2 pl-8 pr-4 py-2 text-sm text-left ${
                                isActive(item.path) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
                              }`}>
                              {item.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Trennlinie */}
                    <div className="border-t my-1" />

                    {/* Restliche Menüpunkte */}
                    {moreItems.map(item => (
                      <button key={item.path}
                        onClick={() => { navigate(item.path); setMoreOpen(false) }}
                        className={`w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-left ${
                          isActive(item.path) ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                        }`}>
                        <item.icon className="h-4 w-4" />{item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </nav>
          )}

          <div className="flex items-center gap-3">
            <span className="hidden md:block text-sm text-gray-500 truncate max-w-48">{user?.email}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.location.assign('/reset-password')}
              title="Passwort ändern"
            >
              <KeyRound className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} title="Abmelden">
              <LogOut className="h-4 w-4" />
            </Button>
            {hasRole && (
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
                {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Menü */}
        {hasRole && menuOpen && (
          <div className="md:hidden border-t bg-white px-4 py-3 space-y-1">
            {navItems.map(item => (
              <button key={item.path} onClick={() => { navigate(item.path); setMenuOpen(false) }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
                  isActive(item.path) ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                }`}>
                <item.icon className="h-4 w-4" />{item.label}
              </button>
            ))}
            <div className="border-t pt-1">
              <p className="px-3 py-1 text-xs font-medium text-gray-400 uppercase tracking-wide">Buchhaltung</p>
              {ACCOUNTING_ITEMS.map(item => (
                <button key={item.path} onClick={() => { navigate(item.path); setMenuOpen(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
                    isActive(item.path) ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}>
                  {item.label}
                </button>
              ))}
            </div>
            <div className="border-t pt-1">
              {moreItems.map(item => (
                <button key={item.path} onClick={() => { navigate(item.path); setMenuOpen(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
                    isActive(item.path) ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}>
                  <item.icon className="h-4 w-4" />{item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>
      <main><Outlet /></main>
    </div>
  )
}
