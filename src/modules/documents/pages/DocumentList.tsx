import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDocuments, useDocumentTypes, useDeleteDocument } from '@/modules/documents/hooks/useDocuments'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Plus, FileText, Lock, Pencil, Trash2, Search, Package } from 'lucide-react'

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('de-DE')
}

export default function DocumentList() {
  const navigate = useNavigate()
  const { data: documents = [], isLoading } = useDocuments()
  const { data: docTypes = [] } = useDocumentTypes()
  const deleteDocument = useDeleteDocument()
  const [search, setSearch] = useState('')
  const [filterTypeId, setFilterTypeId] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const filtered = documents.filter(d => {
    if (filterTypeId && d.document_type_id !== filterTypeId) return false
    const q = search.toLowerCase()
    if (!q) return true
    const contactName = d.contact
      ? d.contact.is_company
        ? d.contact.company_name ?? ''
        : [d.contact.first_name, d.contact.last_name].filter(Boolean).join(' ')
      : ''
    return (
      d.document_number.toLowerCase().includes(q) ||
      contactName.toLowerCase().includes(q) ||
      (d.subject_line2 ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Belege</h1>
          <p className="text-gray-500 mt-1 text-sm">Angebote, Rechnungen und weitere Belege</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/documents/articles')} className="gap-2">
            <Package className="h-4 w-4" /> Artikelstamm
          </Button>
          <Button onClick={() => navigate('/documents/new')} className="gap-2">
            <Plus className="h-4 w-4" /> Neuer Beleg
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input className="pl-10" placeholder="Suchen…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setFilterTypeId('')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${!filterTypeId ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Alle
          </button>
          {docTypes.map(t => (
            <button
              key={t.id}
              onClick={() => setFilterTypeId(t.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterTypeId === t.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-gray-400 py-12 text-center">Wird geladen…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            {documents.length === 0 ? 'Noch keine Belege vorhanden' : 'Keine Treffer'}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Belegnr.</th>
                  <th className="px-4 py-3 text-left">Datum</th>
                  <th className="px-4 py-3 text-left">Empfänger</th>
                  <th className="px-4 py-3 text-left">Betreff</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(doc => {
                  const contactName = doc.contact
                    ? doc.contact.is_company
                      ? doc.contact.company_name ?? ''
                      : [doc.contact.first_name, doc.contact.last_name].filter(Boolean).join(' ')
                    : '–'
                  return (
                    <tr key={doc.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium text-gray-900">{doc.document_number}</span>
                        <div className="text-xs text-gray-400">{doc.document_type?.name}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{fmtDate(doc.date)}</td>
                      <td className="px-4 py-3 text-gray-800">{contactName}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                        {doc.subject_line2 || (doc.service_from ? `${fmtDate(doc.service_from)}–${fmtDate(doc.service_to)}` : '–')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {doc.is_finalized ? (
                          <Badge className="bg-gray-100 text-gray-600 border border-gray-200 gap-1 text-xs">
                            <Lock className="h-2.5 w-2.5" /> PDF
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-xs">Entwurf</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => navigate(`/documents/${doc.id}/edit`)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {!doc.is_finalized && (
                            confirmDelete === doc.id ? (
                              <div className="flex gap-1">
                                <Button variant="destructive" size="sm" className="h-7 text-xs"
                                  onClick={async () => { await deleteDocument.mutateAsync(doc.id); setConfirmDelete(null) }}>
                                  Löschen
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 text-xs"
                                  onClick={() => setConfirmDelete(null)}>Abbrechen</Button>
                              </div>
                            ) : (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600"
                                onClick={() => setConfirmDelete(doc.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
