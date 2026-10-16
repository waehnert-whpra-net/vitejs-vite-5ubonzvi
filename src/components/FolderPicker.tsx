import { useEffect, useState } from 'react'
import { useFolderBrowser } from '@/hooks/useFolderBrowser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Folder, FolderOpen, ChevronUp, X, Check, FolderPlus, AlertCircle } from 'lucide-react'

type Props = {
  initialPath?: string
  onSelect: (path: string) => void
  onClose: () => void
}

export default function FolderPicker({ initialPath = '/', onSelect, onClose }: Props) {
  const {
    currentPath, folders, loading, error,
    loadFolder, navigateInto, navigateUp, createFolder,
  } = useFolderBrowser(initialPath)

  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadFolder(initialPath)
  }, [])

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    setCreating(true)
    const ok = await createFolder(newFolderName.trim())
    setCreating(false)
    if (ok) {
      setNewFolderName('')
      setShowNewFolder(false)
    }
  }

  const pathSegments = currentPath === '/' ? [] : currentPath.split('/').filter(Boolean)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[80vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Verzeichnis auswählen</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden flex flex-col space-y-3">

          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm text-gray-600 flex-wrap bg-gray-50 rounded-md px-3 py-2">
            <button onClick={() => loadFolder('/')} className="hover:underline font-medium">
              Stammverzeichnis
            </button>
            {pathSegments.map((seg, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="text-gray-400">/</span>
                <button
                  onClick={() => loadFolder('/' + pathSegments.slice(0, i + 1).join('/'))}
                  className="hover:underline"
                >
                  {seg}
                </button>
              </span>
            ))}
          </div>

          {/* Aktueller Pfad + Aktionen */}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={navigateUp}
              disabled={currentPath === '/'}
              className="gap-1"
            >
              <ChevronUp className="h-4 w-4" />
              Übergeordnet
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewFolder(!showNewFolder)}
              className="gap-1"
            >
              <FolderPlus className="h-4 w-4" />
              Neuer Ordner
            </Button>
          </div>

          {/* Neuer Ordner Eingabe */}
          {showNewFolder && (
            <div className="flex gap-2">
              <Input
                placeholder="Ordnername"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                autoFocus
              />
              <Button onClick={handleCreateFolder} disabled={creating || !newFolderName.trim()} size="sm">
                {creating ? '...' : 'Erstellen'}
              </Button>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Ordnerliste */}
          <div className="flex-1 overflow-y-auto border rounded-md">
            {loading && (
              <div className="p-6 text-center text-gray-400 text-sm">Lädt...</div>
            )}
            {!loading && folders.length === 0 && (
              <div className="p-6 text-center text-gray-400 text-sm">
                <Folder className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Keine Unterordner vorhanden
              </div>
            )}
            {!loading && folders.map(folder => (
              <button
                key={folder.id}
                onClick={() => navigateInto(folder.name)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 text-left text-sm border-b last:border-0"
              >
                <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />
                {folder.name}
              </button>
            ))}
          </div>

          {/* Aktuelle Auswahl + Bestätigen */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-xs text-gray-500 truncate flex-1 mr-3">
              <FolderOpen className="h-3.5 w-3.5 inline mr-1" />
              {currentPath}
            </div>
            <Button onClick={() => onSelect(currentPath)} className="gap-2 flex-shrink-0">
              <Check className="h-4 w-4" />
              Dieses Verzeichnis wählen
            </Button>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}
