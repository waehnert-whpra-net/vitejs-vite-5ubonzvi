import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export type FolderItem = {
  id: string
  name: string
}

const GRAPH_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/graph-service`

async function callGraphService(action: string, payload: any) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(GRAPH_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ action, payload }),
  })
  return res.json()
}

export function useFolderBrowser(initialPath: string = '/') {
  const [currentPath, setCurrentPath] = useState(initialPath)
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadFolder = useCallback(async (path: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await callGraphService('listFolder', { path })
      if (!result.success) throw new Error(result.error)
      setFolders(result.folders ?? [])
      setCurrentPath(path)
    } catch (err: any) {
      setError(err.message ?? 'Fehler beim Laden des Verzeichnisses')
    } finally {
      setLoading(false)
    }
  }, [])

  const navigateInto = (folderName: string) => {
    const newPath = currentPath === '/' ? `/${folderName}` : `${currentPath}/${folderName}`
    loadFolder(newPath)
  }

  const navigateUp = () => {
    if (currentPath === '/' || !currentPath.includes('/')) {
      loadFolder('/')
      return
    }
    const parts = currentPath.split('/').filter(Boolean)
    parts.pop()
    loadFolder(parts.length > 0 ? '/' + parts.join('/') : '/')
  }

  const createFolder = async (name: string): Promise<boolean> => {
    setError(null)
    try {
      const result = await callGraphService('createFolder', { path: currentPath, name })
      if (!result.success) throw new Error(result.error)
      await loadFolder(currentPath)
      return true
    } catch (err: any) {
      setError(err.message ?? 'Fehler beim Erstellen des Ordners')
      return false
    }
  }

  return {
    currentPath,
    folders,
    loading,
    error,
    loadFolder,
    navigateInto,
    navigateUp,
    createFolder,
  }
}
