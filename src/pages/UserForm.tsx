import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAllUsers, useAllRoles, useUpdateUser, useInviteUser } from '@/hooks/useUsers'
import { useIsSuperAdmin } from '@/hooks/usePermissions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Save, UserPlus, Loader2, AlertCircle } from 'lucide-react'

const NO_ROLE = '__none__'

export default function UserForm() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()

  const { data: isSuperAdmin, isLoading: loadingPerm } = useIsSuperAdmin()
  const { data: allUsers, isLoading: loadingUsers } = useAllUsers()
  const { data: roles } = useAllRoles()
  const updateUser = useUpdateUser()
  const inviteUser = useInviteUser()

  const existingUser = allUsers?.find(u => u.user_id === id) ?? null

  // Form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState<string>(NO_ROLE)
  const [isActive, setIsActive] = useState(true)
  const [expiresAt, setExpiresAt] = useState('')
  const [notifyNewUsers, setNotifyNewUsers] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Populate form when editing
  useEffect(() => {
    if (existingUser) {
      setFirstName(existingUser.first_name ?? '')
      setLastName(existingUser.last_name ?? '')
      setDisplayName(existingUser.display_name ?? '')
      setEmail(existingUser.email ?? '')
      setRoleId(existingUser.role_id ?? NO_ROLE)
      setIsActive(existingUser.is_active ?? true)
      setExpiresAt(
        existingUser.expires_at
          ? new Date(existingUser.expires_at).toISOString().slice(0, 16)
          : ''
      )
      setNotifyNewUsers(existingUser.notify_new_users ?? false)
    }
  }, [existingUser])

  // Guard: only SuperAdmin may access
  if (!loadingPerm && !isSuperAdmin) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 flex items-center gap-3 text-red-700">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            Nur Super-Admins können Nutzer verwalten.
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isNew && !loadingUsers && !existingUser) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 flex items-center gap-3 text-red-700">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            Nutzer nicht gefunden.
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    try {
      if (isNew) {
        if (!email.trim()) { setError('E-Mail ist erforderlich.'); return }
        await inviteUser.mutateAsync({
          email: email.trim(),
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
          roleId: roleId === NO_ROLE ? null : roleId,
        })
        setSuccess(true)
        setTimeout(() => navigate('/users'), 1500)
      } else {
        await updateUser.mutateAsync({
          userId: id!,
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
          displayName: displayName.trim() || null,
          isActive,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          roleId: roleId === NO_ROLE ? null : roleId,
          notifyNewUsers,
        })
        setSuccess(true)
        setTimeout(() => navigate('/users'), 1000)
      }
    } catch (err: any) {
      setError(err.message ?? 'Unbekannter Fehler')
    }
  }

  const isSaving = updateUser.isPending || inviteUser.isPending

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/users')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isNew ? 'Neuer Nutzer' : 'Nutzer bearbeiten'}
          </h1>
          {!isNew && existingUser && (
            <p className="text-gray-500 mt-1">{existingUser.email}</p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Persönliche Daten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isNew && (
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail-Adresse *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nutzer@beispiel.de"
                  required
                />
                <p className="text-xs text-gray-400">
                  Der Nutzer erhält eine Einladungs-E-Mail und kann sich damit registrieren.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Vorname</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Max"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nachname</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Mustermann"
                />
              </div>
            </div>

            {!isNew && (
              <div className="space-y-2">
                <Label htmlFor="displayName">Anzeigename</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Wird in der App angezeigt"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rolle & Zugang</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Rolle</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Rolle wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ROLE}>Keine Rolle</SelectItem>
                  {roles?.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!isNew && (
              <>
                <div className="flex items-center gap-3">
                  <input
                    id="isActive"
                    type="checkbox"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="isActive" className="cursor-pointer">
                    Nutzer ist aktiv
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expiresAt">Zugang läuft ab am (optional)</Label>
                  <Input
                    id="expiresAt"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={e => setExpiresAt(e.target.value)}
                  />
                  <p className="text-xs text-gray-400">
                    Leer lassen für unbegrenzten Zugang.
                  </p>
                </div>
              </>
            )}

            {!isNew && (
              <div className="flex items-center gap-3 pt-1">
                <input
                  id="notifyNewUsers"
                  type="checkbox"
                  checked={notifyNewUsers}
                  onChange={e => setNotifyNewUsers(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="notifyNewUsers" className="cursor-pointer">
                  Bei neuen Nutzer-Registrierungen benachrichtigen
                </Label>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fehler / Erfolg */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-4 flex items-start gap-3 text-red-700 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              {error}
            </CardContent>
          </Card>
        )}
        {success && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-4 text-green-700 text-sm font-medium">
              {isNew ? 'Einladung wurde versendet.' : 'Nutzer wurde gespeichert.'}
            </CardContent>
          </Card>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <Button type="submit" disabled={isSaving} className="gap-2">
            {isSaving
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : isNew
                ? <UserPlus className="h-4 w-4" />
                : <Save className="h-4 w-4" />
            }
            {isNew ? 'Einladung senden' : 'Speichern'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/users')}>
            Abbrechen
          </Button>
        </div>
      </form>
    </div>
  )
}
