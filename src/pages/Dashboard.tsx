import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useHasRole, useIsAdmin, useIsSuperAdmin, useMyRoleName } from '@/hooks/usePermissions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Info, ShieldCheck, UserCheck, UserX,
  LayoutDashboard, Home, Users, CalendarDays,
  BookOpen, Receipt, CreditCard, FileInput, BookMarked, Tag,
  Contact2, MapPin, Wrench, UsersRound,
} from 'lucide-react'

// ── Menüstruktur (identisch mit Layout) ──────────────────────────────────────
const MAIN_ITEMS = [
  { path: '/dashboard',         label: 'Dashboard',       icon: LayoutDashboard },
  { path: '/properties/units',  label: 'Einheiten',       icon: Home },
  { path: '/properties/usages', label: 'Nutzungen',       icon: Users },
  { path: '/calendar',          label: 'Kalender',        icon: CalendarDays },
]

const ACCOUNTING_ITEMS = [
  { path: '/accounting/buchungssaetze',  label: 'Buchungssätze',    icon: BookOpen },
  { path: '/accounting/buchungen',       label: 'Buchungen',         icon: Receipt },
  { path: '/accounting/transactions',    label: 'Geldkonten',        icon: CreditCard },
  { path: '/accounting/import-patterns', label: 'Importmuster',      icon: FileInput },
  { path: '/accounting/skr03',           label: 'Kontenrahmen SKR03',icon: BookMarked },
  { path: '/accounting/account-types',   label: 'Kontoarten',        icon: Tag },
]

// Sonstige werden aus Props gebaut (Admin-abhängig)
// ─────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: hasRole, isLoading } = useHasRole()
  const isAdmin = useIsAdmin()
  const { data: isSuperAdmin } = useIsSuperAdmin()
  const { data: myRoleName } = useMyRoleName()

  // ── Rolle bestimmen (echter Rollenname aus der Datenbank) ───────────────
  const roleName = myRoleName ?? (isSuperAdmin ? 'Super-Admin' : hasRole ? 'Mitarbeiter' : 'Gast')

  const roleColor =
    isSuperAdmin ? 'bg-purple-100 text-purple-800 border-purple-200' :
    isAdmin       ? 'bg-red-100    text-red-800    border-red-200'    :
    hasRole       ? 'bg-green-100  text-green-700  border-green-200'  :
                    'bg-gray-100   text-gray-600   border-gray-200'

  const RoleIcon = isSuperAdmin ? ShieldCheck : isAdmin ? ShieldCheck : hasRole ? UserCheck : UserX

  // ── Login-Methode ────────────────────────────────────────────────────────
  const provider = user?.app_metadata?.provider
  const providerLabel =
    provider === 'azure'  ? 'Microsoft Account' :
    provider === 'google' ? 'Google Account'    :
    provider === 'email'  ? 'E-Mail / Passwort' :
    provider ?? 'Unbekannt'

  const fullName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    null

  // ── Sonstige Menüpunkte (rollenbezogen) ─────────────────────────────────
  const OTHER_ITEMS = [
    { path: '/contacts',           label: 'Kontakte',        icon: Contact2  },
    { path: '/properties/areas',   label: 'Bereiche',        icon: MapPin    },
    ...(isAdmin || isSuperAdmin
      ? [{ path: '/users',  label: 'Nutzer & Rechte', icon: UsersRound }]
      : []),
    ...(isSuperAdmin
      ? [{ path: '/setup', label: 'Setup',            icon: Wrench }]
      : []),
  ]

  // ── Button-Komponente ────────────────────────────────────────────────────
  const NavBtn = ({
    path, label, icon: Icon, colorClass,
  }: { path: string; label: string; icon: React.ElementType; colorClass: string }) => (
    <button
      onClick={() => navigate(path)}
      className={`flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm font-medium transition-all hover:scale-[1.02] hover:shadow-md border ${colorClass}`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {label}
    </button>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* ── Überschrift ───────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
      </div>

      {/* ── Login-Info + Rolle ────────────────────────────────────────────── */}
      {user && (
        <div className="flex items-end justify-between gap-4">
          <div className="text-gray-600 text-sm space-y-0.5">
            <p>
              <span className="font-medium text-gray-800">{providerLabel}:</span>{' '}
              <span className="font-mono text-gray-700">{user.email}</span>
            </p>
            {fullName && (
              <p className="text-lg font-semibold text-gray-900">
                Herzlich Willkommen, {fullName}!
              </p>
            )}
          </div>

          {/* Rollen-Badge rechts neben dem Willkommensspruch */}
          {!isLoading && (
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold whitespace-nowrap flex-shrink-0 ${roleColor}`}>
              <RoleIcon className="h-4 w-4" />
              Du bist als <span className="font-bold">{roleName}</span> eingeloggt
            </div>
          )}
        </div>
      )}

      {/* ── Hinweis für neue Nutzer ohne Rolle ───────────────────────────── */}
      {!isLoading && hasRole === false && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Dein Zugang wird noch eingerichtet</p>
              <p className="mt-1 text-blue-700">
                Vielen Dank für deine Registrierung! Ein Administrator wurde automatisch
                informiert und wird sich per E-Mail bei dir melden, sobald dein Zugang
                freigeschaltet ist. Bis dahin kannst du nur diese Übersichtsseite sehen.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Navigationsübersicht ─────────────────────────────────────────── */}
      {hasRole && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-gray-700">Schnellnavigation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Hauptbereich */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Hauptbereiche</p>
              <div className="flex flex-wrap gap-2">
                {MAIN_ITEMS.map(item => (
                  <NavBtn
                    key={item.path}
                    {...item}
                    colorClass="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                  />
                ))}
              </div>
            </div>

            {/* Buchhaltung */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Buchhaltung</p>
              <div className="flex flex-wrap gap-2">
                {ACCOUNTING_ITEMS.map(item => (
                  <NavBtn
                    key={item.path}
                    {...item}
                    colorClass="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  />
                ))}
              </div>
            </div>

            {/* Sonstiges */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Sonstiges</p>
              <div className="flex flex-wrap gap-2">
                {OTHER_ITEMS.map(item => (
                  <NavBtn
                    key={item.path}
                    {...item}
                    colorClass="bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100"
                  />
                ))}
              </div>
            </div>

          </CardContent>
        </Card>
      )}
    </div>
  )
}
