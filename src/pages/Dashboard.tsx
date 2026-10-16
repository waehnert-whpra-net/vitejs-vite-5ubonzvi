import { useHasRole } from '@/hooks/usePermissions'
import { Card, CardContent } from '@/components/ui/card'
import { Info } from 'lucide-react'

export default function Dashboard() {
  const { data: hasRole, isLoading } = useHasRole()

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {!isLoading && hasRole === false && (
        <Card className="border-blue-200 bg-blue-50 mb-6">
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

      <div className="text-gray-500">
        Hier entsteht in Kürze eine Übersicht.
      </div>
    </div>
  )
}
