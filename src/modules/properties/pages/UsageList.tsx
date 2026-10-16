import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePropertyUsages, useDeletePropertyUsage } from '@/modules/properties/hooks/useProperties'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Pencil, Trash2, Search, CalendarDays, Users, Infinity, UsersRound } from 'lucide-react'

export default function UsageList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'current' | 'future'>('all')
  const [hideUnlimited, setHideUnlimited] = useState(false)
  const { data: usages, isLoading } = usePropertyUsages()
  const deleteUsage = useDeletePropertyUsage()

  const getUsageState = (usage: { date_from: string | null; date_to: string | null }): 'current' | 'future' | 'past' => {
    const now = new Date()
    const from = usage.date_from ? new Date(usage.date_from) : null
    const to = usage.date_to ? new Date(usage.date_to) : null

    if (from && from > now) return 'future'
    if (to && to < now) return 'past'
    return 'current'
  }

  const filtered = usages?.filter(u => {
    const contactName = u.contact
      ? u.contact.is_company
        ? u.contact.company_name
        : [u.contact.first_name, u.contact.last_name].filter(Boolean).join(' ')
      : ''
    const matchesSearch = (
      contactName?.toLowerCase().includes(search.toLowerCase()) ||
      u.unit?.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.unit?.short_code?.toLowerCase().includes(search.toLowerCase()) ||
      u.notes?.toLowerCase().includes(search.toLowerCase())
    )

    if (!matchesSearch) return false

    if (hideUnlimited && u.is_unlimited) return false

    if (filter === 'current') return getUsageState(u) === 'current'
    if (filter === 'future') return getUsageState(u) === 'future'
    return true
  }) ?? []

  const handleDelete = async (id: string) => {
    if (confirm('Nutzung wirklich deaktivieren?')) {
      await deleteUsage.mutateAsync(id)
    }
  }

  const formatDate = (date: string | null) =>
    date ? new Date(date).toLocaleDateString('de-DE') : '–'

  const formatCurrency = (val: number | null) =>
    val != null ? `${val.toLocaleString('de')} €` : '–'

  const getContactName = (usage: typeof filtered[0]) => {
    if (!usage.contact) return 'Unbekannt'
    if (usage.contact.is_company) return usage.contact.company_name ?? '–'
    return [usage.contact.first_name, usage.contact.last_name].filter(Boolean).join(' ') || '–'
  }

  const getStatusBadge = (usage: typeof filtered[0]) => {
    const now = new Date()
    const from = usage.date_from ? new Date(usage.date_from) : null
    const to = usage.date_to ? new Date(usage.date_to) : null

    if (usage.is_unlimited || !to) {
      return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Unbefristet</span>
    }
    if (from && from > now) {
      return <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Zukünftig</span>
    }
    if (to < now) {
      return <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Beendet</span>
    }
    return <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Aktiv</span>
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Nutzungen</h1>
          <p className="text-gray-500 mt-1">{filtered.length} Nutzungen</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={filter === 'current' ? 'default' : 'outline'}
            onClick={() => setFilter(filter === 'current' ? 'all' : 'current')}
          >
            Derzeit genutzt
          </Button>
          <Button
            variant={filter === 'future' ? 'default' : 'outline'}
            onClick={() => setFilter(filter === 'future' ? 'all' : 'future')}
          >
            Zukünftig genutzt
          </Button>
          <Button
            variant={hideUnlimited ? 'default' : 'outline'}
            onClick={() => setHideUnlimited(v => !v)}
            className={hideUnlimited ? 'bg-gray-600 hover:bg-gray-700' : ''}
            title="Unbefristete Nutzungen ausblenden"
          >
            <Infinity className="h-4 w-4 mr-1.5" />
            Unbefristet {hideUnlimited ? 'ausgeblendet' : 'anzeigen'}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/properties/group-usages/new')}
            className="gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
          >
            <UsersRound className="h-4 w-4" />
            Neue Gruppennutzung
          </Button>
          <Button onClick={() => navigate('/properties/usages/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Neue Nutzung
          </Button>
        </div>
      </div>

      {/* Suche */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Nutzer, Einheit oder Notizen suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 h-11"
        />
      </div>

      {/* Laden */}
      {isLoading && (
        <div className="grid gap-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Liste */}
      {!isLoading && (
        <div className="grid gap-3">
          {filtered.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-gray-400">
                <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Keine Nutzungen gefunden</p>
              </CardContent>
            </Card>
          )}

          {filtered.map(usage => (
            <Card key={usage.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Users className="h-6 w-6 text-indigo-600" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">
                        {getContactName(usage)}
                      </span>
                      {usage.unit && (
                        <>
                          {usage.unit.name && (
                            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono">
                              {usage.unit.name}
                            </span>
                          )}
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono">
                            {usage.unit.short_code ?? usage.unit.name}
                          </span>
                        </>
                      )}
                      {getStatusBadge(usage)}
                    </div>

                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(usage.date_from)} – {usage.is_unlimited ? '∞' : formatDate(usage.date_to)}
                      </span>
                      {(usage.adults_count > 0 || usage.children_count > 0) && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {usage.adults_count} Erw.
                          {usage.children_count > 0 && `, ${usage.children_count} Kinder`}
                        </span>
                      )}
                      {usage.rent_actual != null && (
                        <span className="font-medium text-green-600">
                          {formatCurrency(usage.rent_actual)} / {usage.rental_period ?? 'Periode'}
                        </span>
                      )}
                    </div>

                    {usage.notes && (
                      <p className="text-xs text-gray-400 mt-1 truncate">{usage.notes}</p>
                    )}
                  </div>

                  {/* Aktionen */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/properties/usages/${usage.id}/edit`)}
                      title="Bearbeiten"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(usage.id)}
                      title="Löschen"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
