import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePropertyUnits, usePropertyAreas, useDeletePropertyUnit } from '@/modules/properties/hooks/useProperties'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import CreateDocumentDialog from '@/components/CreateDocumentDialog'
import { Plus, Pencil, Trash2, Search, DoorOpen, Users, Maximize2, FileText } from 'lucide-react'
import type { PropertyUnit } from '@/modules/properties/hooks/useProperties'

export default function UnitList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [areaFilter, setAreaFilter] = useState<string>('all')
  const [createDocUnit, setCreateDocUnit] = useState<PropertyUnit | null>(null)
  const { data: units, isLoading } = usePropertyUnits()
  const { data: areas } = usePropertyAreas()
  const deleteUnit = useDeletePropertyUnit()

  const filtered = units?.filter(u => {
    const matchesSearch =
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.short_code?.toLowerCase().includes(search.toLowerCase()) ||
      u.location?.toLowerCase().includes(search.toLowerCase())
    const matchesArea = areaFilter === 'all' || u.area_id === areaFilter
    return matchesSearch && matchesArea
  }) ?? []

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Einheit "${name}" wirklich deaktivieren?`)) {
      await deleteUnit.mutateAsync(id)
    }
  }

  const formatCurrency = (val: number | null) =>
    val != null ? `${val.toLocaleString('de')} €` : '–'

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Einheiten</h1>
          <p className="text-gray-500 mt-1">{filtered.length} Einheiten</p>
        </div>
        <Button onClick={() => navigate('/properties/units/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          Neue Einheit
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Name, Kürzel oder Lage suchen..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-11"
          />
        </div>
        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="w-48 h-11">
            <SelectValue placeholder="Alle Bereiche" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Bereiche</SelectItem>
            {areas?.map(a => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Laden */}
      {isLoading && (
        <div className="grid gap-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Liste */}
      {!isLoading && (
        <div className="grid gap-3">
          {filtered.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-gray-400">
                <DoorOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Keine Einheiten gefunden</p>
              </CardContent>
            </Card>
          )}

          {filtered.map(unit => (
            <Card key={unit.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Farb-Indikator */}
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
                    style={{ backgroundColor: unit.color ?? unit.area?.color ?? '#6b7280' }}
                  >
                    {unit.short_code?.slice(0, 3) ?? '?'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">
                        {unit.name ?? unit.location ?? `Einheit ${unit.nr}`}
                      </span>
                      {unit.short_code && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                          {unit.short_code}
                        </span>
                      )}
                      {unit.area && (
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                          {unit.area.name}
                        </span>
                      )}
                      {!unit.is_rentable && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                          nicht mietbar
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                      {unit.location && <span>{unit.location}</span>}
                      {unit.max_persons != null && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {(unit as any).max_extra_beds > 0
                            ? `${unit.max_persons} Betten +${(unit as any).max_extra_beds - unit.max_persons} Aufbettung`
                            : `${unit.max_persons} Betten`
                          }
                        </span>
                      )}
                      {unit.sqm_measured != null && (
                        <span className="flex items-center gap-1">
                          <Maximize2 className="h-3 w-3" />
                          {unit.sqm_measured} m²
                        </span>
                      )}
                      {unit.rent_target != null && (
                        <span className="font-medium text-green-600">
                          {formatCurrency(unit.rent_target)} / {unit.rental_period ?? 'Woche'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Aktionen */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCreateDocUnit(unit)}
                      title="Dokument erstellen"
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/properties/units/${unit.id}/edit`)}
                      title="Bearbeiten"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(unit.id, unit.name ?? unit.location ?? '')}
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

      {/* Dokument erstellen Dialog */}
      {createDocUnit && (
        <CreateDocumentDialog
          unit={createDocUnit}
          onClose={() => setCreateDocUnit(null)}
        />
      )}
    </div>
  )
}
