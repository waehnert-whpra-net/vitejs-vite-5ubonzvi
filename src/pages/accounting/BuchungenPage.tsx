import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Search, ChevronDown, ChevronUp } from 'lucide-react'

type Buchung = {
  id: string
  buchungssatz_id: string
  datum: string
  betrag: number
  buchungstext: string | null
  anmerkungen: string | null
  sort_order: number
  sollkonto: { kontonummer: string; beschriftung: string | null } | null
  habenkonto: { kontonummer: string; beschriftung: string | null } | null
  buchungssatz: { nummer: number; datum: string; buchungstext: string | null; belegnummer: string | null } | null
}

export default function BuchungenPage() {
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<'datum' | 'betrag'>('datum')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const { data: buchungen, isLoading } = useQuery({
    queryKey: ['buchungen', search],
    queryFn: async () => {
      let query = supabase
        .from('buchungen')
        .select(`
          *,
          sollkonto:skr03!sollkonto_id(kontonummer, beschriftung),
          habenkonto:skr03!habenkonto_id(kontonummer, beschriftung),
          buchungssatz:buchungssaetze(nummer, datum, buchungstext, belegnummer)
        `)
        .order('datum', { ascending: false })
        .limit(1000)

      if (search) {
        query = query.or(`buchungstext.ilike.%${search}%,anmerkungen.ilike.%${search}%`)
      }

      const { data, error } = await query
      if (error) throw error
      return data as unknown as Buchung[]
    }
  })

  const sorted = [...(buchungen ?? [])].sort((a, b) => {
    const va = sortField === 'datum' ? (a.datum ?? '') : (a.betrag ?? 0)
    const vb = sortField === 'datum' ? (b.datum ?? '') : (b.betrag ?? 0)
    if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va)
    return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
  })

  const toggleSort = (field: 'datum' | 'betrag') => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const toggleExpand = (id: string) => setExpandedIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('de-DE') : '–'
  const formatAmount = (a: number) => a.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })

  const SortTh = ({ field, label, right }: { field: 'datum' | 'betrag'; label: string; right?: boolean }) => (
    <th className={`px-3 py-2 font-medium text-gray-700 cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap text-${right ? 'right' : 'left'}`}
      onClick={() => toggleSort(field)}>
      {label}
      {sortField === field
        ? sortDir === 'asc' ? <ChevronUp className="h-3 w-3 text-blue-600 ml-1 inline" /> : <ChevronDown className="h-3 w-3 text-blue-600 ml-1 inline" />
        : <ChevronDown className="h-3 w-3 text-gray-300 ml-1 inline" />}
    </th>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Buchungen</h1>
          <p className="text-gray-500 mt-1">{sorted.length} Einträge</p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder="Buchungstext oder Anmerkungen suchen..." value={search}
          onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {isLoading && <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />}
      {!isLoading && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="w-6 px-2"></th>
                <th className="px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap">BS-Nr.</th>
                <SortTh field="datum" label="Datum" />
                <SortTh field="betrag" label="Betrag" right />
                <th className="px-3 py-2 text-left font-medium text-gray-700">Sollkonto</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Habenkonto</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Buchungstext</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400">Keine Buchungen gefunden</td></tr>
              )}
              {sorted.map(b => {
                const isExpanded = expandedIds.has(b.id)
                return (
                  <>
                    <tr key={b.id}
                      className={`border-b cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      onClick={() => toggleExpand(b.id)}>
                      <td className="px-2 py-2 text-gray-400">
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-gray-500">
                        {b.buchungssatz ? `#${b.buchungssatz.nummer}` : '–'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(b.datum)}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatAmount(b.betrag)}</td>
                      <td className="px-3 py-2 text-xs">
                        {b.sollkonto
                          ? <span><span className="font-mono text-blue-700">{b.sollkonto.kontonummer}</span> {b.sollkonto.beschriftung}</span>
                          : '–'}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {b.habenkonto
                          ? <span><span className="font-mono text-blue-700">{b.habenkonto.kontonummer}</span> {b.habenkonto.beschriftung}</span>
                          : '–'}
                      </td>
                      <td className="px-3 py-2 text-gray-600 truncate max-w-48">{b.buchungstext || '–'}</td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${b.id}-exp`} className="bg-blue-50 border-b">
                        <td colSpan={7} className="px-6 py-3">
                          <div className="grid grid-cols-3 gap-4 text-xs">
                            <div>
                              <span className="font-medium text-gray-500">Buchungssatz: </span>
                              <span className="text-gray-700">{b.buchungssatz?.buchungstext || '–'}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-500">Belegnummer: </span>
                              <span className="text-gray-700">{b.buchungssatz?.belegnummer || '–'}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-500">Anmerkungen: </span>
                              <span className="text-gray-700">{b.anmerkungen || '–'}</span>
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
