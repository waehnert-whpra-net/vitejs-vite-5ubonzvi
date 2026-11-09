import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useArticles, useDeleteArticle } from '@/modules/documents/hooks/useDocuments'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Pencil, Trash2, Package } from 'lucide-react'

function fmt(n: number | null | undefined) {
  if (n == null) return '–'
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export default function ArticleList() {
  const navigate = useNavigate()
  const { data: articles = [], isLoading } = useArticles()
  const deleteArticle = useDeleteArticle()
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  if (isLoading) return <div className="p-6 text-gray-500">Wird geladen…</div>

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Artikelstamm</h1>
          <p className="text-gray-500 mt-1 text-sm">Vorlagen für Belegpositionen</p>
        </div>
        <Button onClick={() => navigate('/documents/articles/new')} className="gap-2">
          <Plus className="h-4 w-4" /> Neuer Artikel
        </Button>
      </div>

      {articles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
            Noch keine Artikel angelegt
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{articles.length} Artikel</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Bezeichnung</th>
                  <th className="px-4 py-3 text-right">Menge</th>
                  <th className="px-4 py-3 text-right">Brutto-EP</th>
                  <th className="px-4 py-3 text-right">Netto-EP</th>
                  <th className="px-4 py-3 text-right">MwSt.</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {articles.map(a => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{a.name}</div>
                      {a.description && <div className="text-xs text-gray-400 mt-0.5">{a.description}</div>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {a.quantity} {a.unit}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{fmt(a.gross_price)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">{fmt(a.net_price)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">{a.vat_rate} %</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => navigate(`/documents/articles/${a.id}/edit`)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {confirmDelete === a.id ? (
                          <div className="flex gap-1">
                            <Button variant="destructive" size="sm" className="h-7 text-xs"
                              onClick={async () => {
                                await deleteArticle.mutateAsync(a.id)
                                setConfirmDelete(null)
                              }}>
                              Löschen
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs"
                              onClick={() => setConfirmDelete(null)}>
                              Abbrechen
                            </Button>
                          </div>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600"
                            onClick={() => setConfirmDelete(a.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
