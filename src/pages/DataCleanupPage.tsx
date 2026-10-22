import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useOrphanedUsages, useCleanupOrphanedUsages } from '@/modules/properties/hooks/useProperties'
import { useIsSuperAdmin } from '@/hooks/usePermissions'
import { useIsAdmin } from '@/hooks/usePermissions'

export default function DataCleanupPage() {
  const { data: isSuperAdmin } = useIsSuperAdmin()
  const isAdmin = useIsAdmin()
  const [confirmCleanup, setConfirmCleanup] = useState(false)
  const [cleaned, setCleaned] = useState(false)

  const { data: orphaned, isLoading, refetch } = useOrphanedUsages()
  const cleanup = useCleanupOrphanedUsages()

  if (!isAdmin && !isSuperAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Kein Zugriff. Nur Administratoren können diese Seite aufrufen.
      </div>
    )
  }

  const count = orphaned?.length ?? 0

  const handleCleanup = async () => {
    if (!orphaned || orphaned.length === 0) return
    const ids = orphaned.map((u: any) => u.id)
    await cleanup.mutateAsync(ids)
    setCleaned(true)
    setConfirmCleanup(false)
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Datenbereinigung</h1>
        <p className="text-muted-foreground mt-1">
          Diagnose und Bereinigung verwaister Datensätze
        </p>
      </div>

      {/* Verwaiste Nutzungen */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {count > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
                Verwaiste Einzel-Nutzungen
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Aktive Nutzungen, deren Gastro-Event bereits gelöscht wurde.
                Diese blockieren fälschlicherweise die Verfügbarkeit von Einheiten.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setCleaned(false); refetch() }}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Wird geprüft…
            </div>
          ) : cleaned ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              {count === 0 ? 'Bereinigung abgeschlossen. Keine verwaisten Nutzungen mehr vorhanden.' : `${count} verbleibende Einträge gefunden.`}
            </div>
          ) : count === 0 ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Keine verwaisten Nutzungen gefunden. Datenbank ist konsistent.
            </div>
          ) : (
            <>
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
                <strong>{count} verwaiste Nutzung{count !== 1 ? 'en' : ''}</strong> gefunden.
                Diese Einträge sind noch aktiv, obwohl das übergeordnete Gastro-Event bereits gelöscht wurde.
                Sie werden als Belegung im Kalender und bei der Verfügbarkeitsprüfung angezeigt.
              </div>

              {/* Tabelle der betroffenen Einträge */}
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Einheit</th>
                      <th className="text-left px-3 py-2 font-medium">Zeitraum</th>
                      <th className="text-left px-3 py-2 font-medium">Gastro-Event</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orphaned?.map((u: any) => (
                      <tr key={u.id} className="border-t">
                        <td className="px-3 py-2">
                          {u.unit?.short_code ?? u.unit?.name ?? u.unit_id ?? '–'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {u.date_from ? new Date(u.date_from).toLocaleDateString('de-DE') : '?'}
                          {' – '}
                          {u.date_to ? new Date(u.date_to).toLocaleDateString('de-DE') : '?'}
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-muted-foreground">
                            {u.group_usage_name ?? u.group_usage_id}
                          </span>
                          <Badge variant="destructive" className="ml-2 text-xs">gelöscht</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bereinigungsbutton */}
              {!confirmCleanup ? (
                <Button
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() => setConfirmCleanup(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {count} Einträge bereinigen
                </Button>
              ) : (
                <div className="flex items-center gap-3">
                  <Button
                    variant="destructive"
                    onClick={handleCleanup}
                    disabled={cleanup.isPending}
                  >
                    {cleanup.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Ja, {count} Einträge deaktivieren
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmCleanup(false)}
                    disabled={cleanup.isPending}
                  >
                    Abbrechen
                  </Button>
                </div>
              )}

              {cleanup.isError && (
                <p className="text-sm text-destructive">
                  Fehler: {(cleanup.error as Error)?.message}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
