import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAllUsers, useAllRoles, useSetNotifyNewUsers, useSetUserRole, useDeleteUser } from '@/hooks/useUsers'
import { useIsSuperAdmin } from '@/hooks/usePermissions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users, Mail, ShieldCheck, Clock, Bell, Plus, Pencil, Trash2, Loader2 } from 'lucide-react'

const ROLE_COLORS: Record<string, string> = {
  'Super-Admin': '#991b1b',
  Admin: '#dc2626',
  Manager: '#2563eb',
  Buchhaltung: '#7c3aed',
  Mitarbeiter: '#16a34a',
  Extern: '#6b7280',
}

const NO_ROLE = '__none__'

export default function UserList() {
  const navigate = useNavigate()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const { data: users, isLoading, error } = useAllUsers()
  const { data: roles } = useAllRoles()
  const { data: isSuperAdmin } = useIsSuperAdmin()
  const setNotify = useSetNotifyNewUsers()
  const setRole = useSetUserRole()
  const deleteUser = useDeleteUser()

  const formatDate = (date: string | null) =>
    date ? new Date(date).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : '–'

  const getDisplayName = (u: { display_name: string | null; first_name: string | null; last_name: string | null; email: string | null }) =>
    u.display_name
    || [u.first_name, u.last_name].filter(Boolean).join(' ')
    || u.email
    || 'Unbekannt'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Nutzer & Rechte</h1>
          <p className="text-gray-500 mt-1">{users?.length ?? 0} Nutzer</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => navigate('/users/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Neuer Nutzer
          </Button>
        )}
      </div>

      {error && (
        <Card className="border-destructive mb-4">
          <CardContent className="pt-4 text-destructive">
            Fehler beim Laden der Nutzer: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="grid gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && !error && (
        <div className="grid gap-3">
          {users?.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-gray-400">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Keine Nutzer gefunden</p>
              </CardContent>
            </Card>
          )}

          {users?.map(u => (
            <Card key={u.user_id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 text-white font-semibold text-lg">
                    {getDisplayName(u)[0]?.toUpperCase() ?? '?'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 truncate">
                        {getDisplayName(u)}
                      </span>
                      {u.role_name && !isSuperAdmin && (
                        <Badge
                          style={{ backgroundColor: ROLE_COLORS[u.role_name] ?? '#6b7280' }}
                          className="text-white border-0 text-xs"
                        >
                          <ShieldCheck className="h-3 w-3 mr-1" />
                          {u.role_name}
                        </Badge>
                      )}
                      {!u.role_name && !isSuperAdmin && (
                        <Badge className="bg-gray-300 text-gray-700 border-0 text-xs">
                          Keine Rolle
                        </Badge>
                      )}
                      {u.is_active === false && (
                        <Badge className="bg-red-100 text-red-700 border-0 text-xs">
                          Inaktiv
                        </Badge>
                      )}
                      {u.expires_at && (
                        <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">
                          läuft ab: {formatDate(u.expires_at)}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-400 flex-wrap">
                      {u.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {u.email}
                        </span>
                      )}
                      {u.last_login && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Letzter Login: {formatDate(u.last_login)}
                        </span>
                      )}
                    </div>

                    {u.role_description && !isSuperAdmin && (
                      <p className="text-xs text-gray-400 mt-1">{u.role_description}</p>
                    )}
                  </div>

                  {/* Super-Admin Steuerung: Rolle + Benachrichtigung + Bearbeiten */}
                  {isSuperAdmin && (
                    <div className="flex flex-col gap-2 flex-shrink-0 items-end">
                      <div className="flex items-center gap-2">
                        <Select
                          value={u.role_id ?? NO_ROLE}
                          onValueChange={v => setRole.mutate({
                            userId: u.user_id,
                            roleId: v === NO_ROLE ? null : v,
                          })}
                        >
                          <SelectTrigger className="w-40 h-9">
                            <SelectValue placeholder="Rolle wählen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_ROLE}>Keine Rolle</SelectItem>
                            {roles?.map(r => (
                              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/users/${u.user_id}/edit`)}
                          title="Nutzer bearbeiten"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {confirmDeleteId === u.user_id ? (
                          <>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="gap-1 text-xs h-8"
                              disabled={deleteUser.isPending}
                              onClick={async () => {
                                await deleteUser.mutateAsync(u.user_id)
                                setConfirmDeleteId(null)
                              }}
                            >
                              {deleteUser.isPending
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Trash2 className="h-3 w-3" />
                              }
                              Ja, löschen
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-8"
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              Abbrechen
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setConfirmDeleteId(u.user_id)}
                            title="Nutzer löschen"
                            className="text-destructive hover:text-destructive hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <label
                        className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer whitespace-nowrap"
                        title="Über neue Nutzer informieren"
                      >
                        <input
                          type="checkbox"
                          checked={u.notify_new_users}
                          onChange={e => setNotify.mutate({ userId: u.user_id, value: e.target.checked })}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Bell className="h-3.5 w-3.5" />
                        <span>Bei neuen Nutzern benachrichtigen</span>
                      </label>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
