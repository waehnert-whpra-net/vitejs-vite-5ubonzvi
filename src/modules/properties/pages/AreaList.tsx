import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePropertyAreas, useDeletePropertyArea } from '@/modules/properties/hooks/useProperties'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Pencil, Trash2, Search, Sun, Home } from 'lucide-react'

export default function AreaList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const { data: areas, isLoading } = usePropertyAreas()
  const deleteArea = useDeletePropertyArea()

  const filtered = areas?.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.description?.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Bereich "${name}" wirklich deaktivieren?`)) {
      await deleteArea.mutateAsync(id)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bereiche</h1>
          <p className="text-gray-500 mt-1">{filtered.length} Bereiche</p>
        </div>
        <Button onClick={() => navigate('/properties/areas/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          Neuer Bereich
        </Button>
      </div>

      {/* Suche */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Bereich suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 h-11"
        />
      </div>

      {/* Laden */}
      {isLoading && (
        <div className="grid gap-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Liste */}
      {!isLoading && (
        <div className="grid gap-3">
          {filtered.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-gray-400">
                <Home className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Keine Bereiche gefunden</p>
              </CardContent>
            </Card>
          )}

          {filtered.map(area => (
            <Card key={area.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Farb-Indikator */}
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: area.color ?? '#e5e7eb' }}
                  >
                    {area.is_outdoor
                      ? <Sun className="h-6 w-6 text-gray-700" />
                      : <Home className="h-6 w-6 text-gray-700" />
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        {area.name}
                      </span>
                      <span className="text-xs text-gray-400">
                        Nr. {area.nr}
                      </span>
                      {area.is_outdoor && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                          Außen
                        </span>
                      )}
                    </div>
                    {area.description && (
                      <p className="text-sm text-gray-500 truncate mt-0.5">
                        {area.description}
                      </p>
                    )}
                  </div>

                  {/* Aktionen */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/properties/areas/${area.id}/edit`)}
                      title="Bearbeiten"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(area.id, area.name)}
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