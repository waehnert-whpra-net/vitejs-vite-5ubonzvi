import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, Lock, User as UserIcon, AlertCircle, CheckCircle } from 'lucide-react'

type Mode = 'login' | 'register'

export default function Login() {
  const { signInWithMicrosoft, signInWithEmail, signUpWithEmail } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      if (mode === 'login') {
        await signInWithEmail(email, password)
      } else {
        await signUpWithEmail(email, password, fullName)
        setSuccess('Registrierung erfolgreich! Bitte bestätige deine E-Mail-Adresse über den Link, den wir dir geschickt haben. Danach kannst du dich anmelden.')
      }
    } catch (err: any) {
      setError(err.message ?? 'Ein Fehler ist aufgetreten')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-2">
            <UserIcon className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl">FLOX</CardTitle>
          <p className="text-sm text-gray-500">natureandfriends am Üdersee GmbH</p>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Microsoft Login */}
          <Button
            onClick={signInWithMicrosoft}
            variant="outline"
            className="w-full gap-2 h-11"
          >
            <svg className="h-4 w-4" viewBox="0 0 23 23" fill="none">
              <path fill="#f25022" d="M1 1h10v10H1z" />
              <path fill="#00a4ef" d="M1 12h10v10H1z" />
              <path fill="#7fba00" d="M12 1h10v10H12z" />
              <path fill="#ffb900" d="M12 12h10v10H12z" />
            </svg>
            Mit Microsoft anmelden
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-gray-400">oder</span>
            </div>
          </div>

          {/* Mode Switch */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); setSuccess(null) }}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === 'login' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
              }`}
            >
              Anmelden
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); setSuccess(null) }}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === 'register' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
              }`}
            >
              Registrieren
            </button>
          </div>

          {/* E-Mail/Passwort Formular */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <div>
                <Label>Name</Label>
                <div className="relative mt-1">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    className="pl-10"
                    placeholder="Vor- und Nachname"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div>
              <Label>E-Mail</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  className="pl-10"
                  type="email"
                  placeholder="name@beispiel.de"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <Label>Passwort</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  className="pl-10"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
                <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {success}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading
                ? 'Bitte warten...'
                : mode === 'login' ? 'Anmelden' : 'Registrieren'}
            </Button>
          </form>

          {mode === 'register' && (
            <p className="text-xs text-gray-400 text-center">
              Nach der Registrierung hast du zunächst nur Zugriff auf das Dashboard.
              Ein Administrator wird benachrichtigt und schaltet weitere Bereiche frei.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
