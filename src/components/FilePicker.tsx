import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Folder, FileText, ChevronUp, X, Check, Loader2, AlertCircle } from 'lucide-react'

type SharePointItem = {
  id: string
  name: string
  isFolder: boolean
  size?: number
  webUrl: string
}

type Props = {
  initialPath?: string
  onSelect: (item: { name: string; path: string; webUrl: string }) => void
  onClose: () => void
}

const GRAPH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/graph-service`

async function callGraph(action: string, payload: any) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(GRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ action, payload }),
  })
  return res.json()
}

export default function FilePicker({ initialPath = '/', onSelect, onClose }: Props) {
  const [currentPath, setCurrentPath] = useState(initialPath)
  const [items, setItems] = useState<SharePointItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<SharePointItem | null>(null)

  const loadFolder = useCallback(async (path: string) => {
    setLoading(true); setError(null)
    try {
      const result = await callGraph('listFolderWithFiles', { path })
      if (!result.success) throw new Error(result.error)
      setItems(result.items ?? [])
      setCurrentPath(path)
      setSelected(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadFolder(initialPath) }, [])

  const navigateInto = (name: string) => {
    const newPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`
    loadFolder(newPath)
  }

  const navigateUp = () => {
    if (currentPath === '/') return
    const parts = currentPath.split('/').filter(Boolean)
    parts.pop()
    loadFolder(parts.length > 0 ? '/' + parts.join('/') : '/')
  }

  const pathSegments = currentPath === '/' ? [] : currentPath.split('/').filter(Boolean)

  const handleConfirm = () => {
    if (!selected || selected.isFolder) return
    const path = currentPath === '/'
      ? `/${selected.name}`
      : `${currentPath}/${selected.name}`
    onSelect({ name: selected.name, path, webUrl: selected.webUrl })
  }

  const formatSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-xl max-h-[80vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">SharePoint-Datei auswählen</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden flex flex-col space-y-3">

          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm text-gray-600 flex-wrap bg-gray-50 rounded-md px-3 py-2">
            <button onClick={() => loadFolder('/')} className="hover:underline font-medium">Stammverzeichnis</button>
            {pathSegments.map((seg, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="text-gray-400">/</span>
                <button onClick={() => loadFolder('/' + pathSegments.slice(0, i + 1).join('/'))} className="hover:underline">{seg}</button>
              </span>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={navigateUp} disabled={currentPath === '/'} className="gap-1 self-start">
            <ChevronUp className="h-4 w-4" />Übergeordnet
          </Button>

          {error && (
            <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />{error}
            </div>
          )}

          {/* Liste */}
          <div className="flex-1 overflow-y-auto border rounded-md">
            {loading && <div className="p-6 text-center text-gray-400 text-sm flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Lädt...</div>}
            {!loading && items.length === 0 && <div className="p-6 text-center text-gray-400 text-sm">Leer</div>}
            {!loading && items.map(item => (
              <button
                key={item.id}
                onClick={() => item.isFolder ? navigateInto(item.name) : setSelected(item)}
                className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 text-left text-sm border-b last:border-0 transition-colors ${
                  selected?.id === item.id ? 'bg-blue-100' : ''
                }`}
              >
                {item.isFolder
                  ? <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  : <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                <span className="flex-1 truncate">{item.name}</span>
                {!item.isFolder && item.size && (
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatSize(item.size)}</span>
                )}
                {selected?.id === item.id && <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-xs text-gray-500 truncate flex-1 mr-3">
              {selected ? selected.name : 'Keine Datei ausgewählt'}
            </div>
            <Button onClick={handleConfirm} disabled={!selected || selected.isFolder} className="gap-2 flex-shrink-0">
              <Check className="h-4 w-4" />Auswählen
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
