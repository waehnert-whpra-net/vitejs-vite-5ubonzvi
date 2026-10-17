import { useState, useEffect } from 'react'

/**
 * Wie useState, aber der Wert wird in sessionStorage gespeichert.
 * Bleibt beim Navigieren erhalten, wird beim Tab-Schließen geleert.
 * Für dauerhaftes Speichern (auch nach Browser-Neustart) localStorage verwenden.
 */
export function usePersistedState<T>(key: string, defaultValue: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(key)
      if (stored !== null) return JSON.parse(stored) as T
    } catch {}
    return defaultValue
  })

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value))
    } catch {}
  }, [key, value])

  return [value, setValue]
}
