import { useState } from 'react'
import { useSkr03 } from '@/hooks/useSkr03'
import { Input } from '@/components/ui/input'
import { Search, ChevronDown, ChevronUp } from 'lucide-react'

export default function Skr03Page() {
  const [nurHauptkonten, setNurHauptkonten] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const { data: result, isLoading } = useSkr03(nurHauptkonten, search)
  const eintraege = result?.data ?? []
  const count = result?.count ?? 0

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kontenrahmen SKR03</h1>
          <p className="text-gray-500 mt-1">{count} Einträge</p>
        </div>

        {/* Schalter: Nur Hauptkonten */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">Nur Hauptkonten</span>
          <button
            onClick={() => setNurHauptkonten(v => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              nurHauptkonten ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              nurHauptkonten ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      {/* Suche */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Kontonummer, Bezeichnung oder Kontenzweck suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabelle */}
      {isLoading && <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />}

      {!isLoading && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="w-6 px-2"></th>
                <th className="px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap">Konto-Nr.</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Bezeichnung</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700 hidden lg:table-cell">Kontenzweck</th>
                <th className="px-3 py-2 text-center font-medium text-gray-700 hidden md:table-cell w-16">S/K/I</th>
              </tr>
            </thead>
            <tbody>
              {eintraege?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-gray-400">
                    Keine Einträge gefunden
                  </td>
                </tr>
              )}
              {eintraege?.map(entry => {
                const isExpanded = expandedIds.has(entry.id)
                const hasDetails = entry.konto_von || entry.konto_bis || entry.fe ||
                  entry.anlagenspiegelfkt || entry.zusatzfunktion || entry.hf_typ || entry.funktion

                return (
                  <>
                    <tr
                      key={entry.id}
                      className={`border-b transition-colors ${
                        hasDetails ? 'cursor-pointer hover:bg-gray-50' : ''
                      } ${isExpanded ? 'bg-blue-50' : ''} ${
                        entry.is_hauptkonto ? '' : 'text-gray-500 bg-gray-50/50'
                      }`}
                      onClick={() => hasDetails && toggleExpand(entry.id)}
                    >
                      <td className="px-2 py-2 text-gray-400">
                        {hasDetails && (
                          isExpanded
                            ? <ChevronUp className="h-3.5 w-3.5" />
                            : <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono font-medium whitespace-nowrap">
                        {entry.kontonummer}
                      </td>
                      <td className="px-3 py-2">
                        <span className={entry.is_hauptkonto ? 'font-medium text-gray-900' : ''}>
                          {entry.beschriftung || <span className="text-gray-400 italic">–</span>}
                        </span>
                      </td>
                      <td className="px-3 py-2 hidden lg:table-cell text-gray-600 truncate max-w-80">
                        {entry.kontenzweck}
                      </td>
                      <td className="px-3 py-2 text-center hidden md:table-cell">
                        {entry.s_k_i && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                            entry.s_k_i === 'S'
                              ? 'bg-blue-100 text-blue-700'
                              : entry.s_k_i === 'I'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {entry.s_k_i}
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Ausgeklappte Details */}
                    {isExpanded && (
                      <tr key={`${entry.id}-exp`} className="bg-blue-50 border-b">
                        <td colSpan={6} className="px-6 py-3">
                          <div className="grid grid-cols-3 gap-x-8 gap-y-2 text-xs">
                            <div className="lg:hidden">
                              <span className="font-medium text-gray-500">Kontenzweck: </span>
                              <span className="text-gray-700">{entry.kontenzweck || '–'}</span>
                            </div>
                            {entry.s_b_i && (
                              <div>
                                <span className="font-medium text-gray-500">S/B/I: </span>
                                <span className="font-mono text-gray-700">{entry.s_b_i}</span>
                              </div>
                            )}
                            {entry.konto_von && (
                              <div>
                                <span className="font-medium text-gray-500">Konto von: </span>
                                <span className="font-mono text-gray-700">{entry.konto_von}</span>
                              </div>
                            )}
                            {entry.konto_bis && (
                              <div>
                                <span className="font-medium text-gray-500">Konto bis: </span>
                                <span className="font-mono text-gray-700">{entry.konto_bis}</span>
                              </div>
                            )}
                            {entry.fe && entry.fe !== '0' && (
                              <div>
                                <span className="font-medium text-gray-500">FE: </span>
                                <span className="text-gray-700">{entry.fe}</span>
                              </div>
                            )}
                            {entry.anlagenspiegelfkt && entry.anlagenspiegelfkt !== '0' && (
                              <div>
                                <span className="font-medium text-gray-500">Anlagenspiegelfkt.: </span>
                                <span className="text-gray-700">{entry.anlagenspiegelfkt}</span>
                              </div>
                            )}
                            {entry.zusatzfunktion && entry.zusatzfunktion !== '0' && (
                              <div>
                                <span className="font-medium text-gray-500">Zusatzfunktion: </span>
                                <span className="text-gray-700">{entry.zusatzfunktion}</span>
                              </div>
                            )}
                            {entry.hf_typ && entry.hf_typ !== '0' && (
                              <div>
                                <span className="font-medium text-gray-500">HF-Typ: </span>
                                <span className="text-gray-700">{entry.hf_typ}</span>
                              </div>
                            )}
                            {entry.funktion && (
                              <div>
                                <span className="font-medium text-gray-500">Funktion: </span>
                                <span className="text-gray-700">{entry.funktion}</span>
                              </div>
                            )}
                            <div>
                              <span className="font-medium text-gray-500">S/K/I 2: </span>
                              <span className="font-mono text-gray-700">{entry.s_k_i_2 || '–'}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-500">S/K/I 3: </span>
                              <span className="font-mono text-gray-700">{entry.s_k_i_3 || '–'}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
