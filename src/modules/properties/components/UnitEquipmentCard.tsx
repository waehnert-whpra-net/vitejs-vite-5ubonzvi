import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useIsAdmin, useIsSuperAdmin } from '@/hooks/usePermissions'
import {
  useUnitEquipment,
  useUpdateUnitEquipment,
  useAddUnitEquipment,
  useDeleteUnitEquipment,
  type UnitEquipment,
} from '../hooks/useUnitEquipment'

// Spalten: Ausstattung | Soll | Ist | (Löschen)
const GRID = { gridTemplateColumns: '1fr 6rem 6rem 2rem' } as const

// Zahlenfeld, das erst beim Verlassen des Feldes speichert
function NumberCell({
  value, disabled, onCommit, warn,
}: { value: number; disabled?: boolean; onCommit: (v: number) => void; warn?: boolean }) {
  const [text, setText] = useState(String(value))
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) { setLastValue(value); setText(String(value)) }

  const commit = () => {
    const n = Math.max(0, Math.trunc(Number(text)))
    if (!Number.isFinite(n) || text.trim() === '') { setText(String(value)); return }
    setText(String(n))
    if (n !== value) onCommit(n)
  }

  return (
    <Input
      type="number"
      min={0}
      className={`h-8 ${disabled ? 'bg-gray-50 text-gray-700' : ''} ${warn ? 'border-amber-400 bg-amber-50' : ''}`}
      value={text}
      disabled={disabled}
      onChange={e => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    />
  )
}

function TextCell({
  value, disabled, onCommit,
}: { value: string; disabled?: boolean; onCommit: (v: string) => void }) {
  const [text, setText] = useState(value)
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) { setLastValue(value); setText(value) }

  const commit = () => {
    const t = text.trim()
    if (!t) { setText(value); return }
    if (t !== value) onCommit(t)
  }

  return (
    <Input
      className={`h-8 ${disabled ? 'bg-gray-50 text-gray-700' : ''}`}
      value={text}
      disabled={disabled}
      onChange={e => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    />
  )
}

export default function UnitEquipmentCard({ unitId }: { unitId: string }) {
  const isAdminPerm = useIsAdmin()
  const { data: isSuperAdmin } = useIsSuperAdmin()
  const isAdmin = isAdminPerm || isSuperAdmin === true

  const { data: items, isLoading, error: loadError } = useUnitEquipment(unitId)
  const update = useUpdateUnitEquipment(unitId)
  const add = useAddUnitEquipment(unitId)
  const remove = useDeleteUnitEquipment(unitId)

  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [newItem, setNewItem] = useState<Record<string, string>>({})
  const [newBereich, setNewBereich] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Bereiche in der Reihenfolge ihres ersten Eintrags
  const groups: { bereich: string; rows: UnitEquipment[] }[] = []
  for (const it of items ?? []) {
    let g = groups.find(x => x.bereich === it.bereich)
    if (!g) { g = { bereich: it.bereich, rows: [] }; groups.push(g) }
    g.rows.push(it)
  }

  const run = async (fn: () => Promise<unknown>) => {
    setError(null)
    try { await fn() } catch (e: any) { setError(e?.message ?? 'Speichern fehlgeschlagen') }
  }

  const addItem = (bereich: string) => {
    const name = (newItem[bereich] ?? '').trim()
    if (!name) return
    const nextSort = Math.max(0, ...(items ?? []).filter(i => i.bereich === bereich).map(i => i.sort_order)) + 1
    run(async () => {
      await add.mutateAsync({ bereich, ausstattung: name, anzahl_soll: 1, sort_order: nextSort })
      setNewItem(s => ({ ...s, [bereich]: '' }))
    })
  }

  const addBereich = () => {
    const name = newBereich.trim()
    if (!name) return
    const nextSort = Math.max(0, ...(items ?? []).map(i => i.sort_order)) + 1
    run(async () => {
      await add.mutateAsync({ bereich: name, ausstattung: 'Neue Ausstattung', anzahl_soll: 1, sort_order: nextSort })
      setNewBereich('')
      setOpen(s => ({ ...s, [name]: true }))
    })
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Ausstattung</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-gray-500">Wird geladen...</p>}
        {loadError && <p className="text-sm text-red-600">Ausstattung konnte nicht geladen werden.</p>}
        {error && (
          <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{error}</div>
        )}
        {!isLoading && !loadError && groups.length === 0 && (
          <p className="text-sm text-gray-500">Für diese Einheit ist noch keine Ausstattung hinterlegt.</p>
        )}

        {groups.map(g => {
          const isOpen = !!open[g.bereich]
          const missing = g.rows.filter(r => r.anzahl_ist < r.anzahl_soll).length
          return (
            <div key={g.bereich} className="border rounded-md">
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
                onClick={() => setOpen(s => ({ ...s, [g.bereich]: !isOpen }))}
              >
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="font-medium">{g.bereich}</span>
                <span className="text-xs text-gray-500">{g.rows.length} Positionen</span>
                {missing > 0 && (
                  <span className="ml-auto text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                    {missing} unter Soll
                  </span>
                )}
              </button>

              {isOpen && (
                <div className="px-3 pb-3 space-y-1.5">
                  <div className="grid gap-2 text-xs font-medium text-gray-500 pt-1" style={GRID}>
                    <span>Ausstattung</span><span>Anzahl-SOLL</span><span>Anzahl-IST</span><span />
                  </div>
                  {g.rows.map(r => (
                    <div key={r.id} className="grid gap-2 items-center" style={GRID}>
                      <TextCell
                        value={r.ausstattung}
                        disabled={!isAdmin}
                        onCommit={v => run(() => update.mutateAsync({ id: r.id, ausstattung: v }))}
                      />
                      <NumberCell
                        value={r.anzahl_soll}
                        disabled={!isAdmin}
                        onCommit={v => run(() => update.mutateAsync({ id: r.id, anzahl_soll: v }))}
                      />
                      <NumberCell
                        value={r.anzahl_ist}
                        warn={r.anzahl_ist < r.anzahl_soll}
                        onCommit={v => run(() => update.mutateAsync({ id: r.id, anzahl_ist: v }))}
                      />
                      {isAdmin ? (
                        <Button
                          type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600"
                          title="Position löschen"
                          onClick={() => run(() => remove.mutateAsync(r.id))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : <span />}
                    </div>
                  ))}

                  {isAdmin && (
                    <div className="flex items-center gap-2 pt-2">
                      <Input
                        className="h-8"
                        placeholder="Neue Ausstattung in diesem Bereich..."
                        value={newItem[g.bereich] ?? ''}
                        onChange={e => setNewItem(s => ({ ...s, [g.bereich]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(g.bereich) } }}
                      />
                      <Button type="button" variant="outline" size="sm" className="gap-1 flex-shrink-0" onClick={() => addItem(g.bereich)}>
                        <Plus className="h-4 w-4" /> Hinzufügen
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {isAdmin && (
          <div className="flex items-center gap-2 pt-2">
            <Input
              className="h-8"
              placeholder="Neuen Bereich anlegen (z. B. Wohnzimmer)..."
              value={newBereich}
              onChange={e => setNewBereich(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addBereich() } }}
            />
            <Button type="button" variant="outline" size="sm" className="gap-1 flex-shrink-0" onClick={addBereich}>
              <Plus className="h-4 w-4" /> Bereich
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
