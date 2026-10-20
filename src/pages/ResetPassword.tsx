import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KeyRound, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Supabase setzt die Session automatisch aus dem URL-Fragment (#access_token=…)
  // Wir müssen nur warten bis useAuth die Session erkennt — hier reicht der direkte Call
  useEffect(() => {
    // Hash-Fragment auslesen und bei Fehler direkt anzeigen
    const hash = window.location.hash
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.replace('#', ''))
      const desc = params.get('error_description')
      setError(desc ? decodeURIComponent(desc.replace(/\+/g, ' ')) : 'Ungültiger oder abgelaufener Link.')
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.')
      return
    }
    if (password !== passwordConfirm) {
      setError('Die Passwörter stimmen nicht überein.')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      setTimeout(() => navigate('/dashboard'), 3000)
    } catch (err: any) {
      setError(err.message ?? 'Fehler beim Speichern des Passworts.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
            <KeyRound className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-xl">Neues Passwort setzen</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {done ? (
            <div className="text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
              <p className="text-green-700 font-medium">Passwort wurde gespeichert.</p>
              <p className="text-sm text-gray-500">Du wirst gleich weitergeleitet…</p>
            </div>
          ) : error && !password ? (
            // Nur Fehler aus dem Link (abgelaufen etc.), kein Formular zeigen
            <div className="space-y-4">
              <div className="flex items-start gap-2 text-red-700 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              <p className="text-sm text-gray-500">
                Bitte fordere einen neuen Passwort-Reset-Link bei deinem Administrator an.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Neues Passwort</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mindestens 8 Zeichen"
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passwordConfirm">Passwort bestätigen</Label>
                <Input
                  id="passwordConfirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={e => setPasswordConfirm(e.target.value)}
                  placeholder="Passwort wiederholen"
                  required
                />
              </div>
              {error && (
                <div className="flex items-start gap-2 text-red-700 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              <Button type="submit" disabled={saving} className="w-full gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Passwort speichern
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
