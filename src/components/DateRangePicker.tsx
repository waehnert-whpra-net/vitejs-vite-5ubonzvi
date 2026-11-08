import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface DateRangePickerProps {
  dateFrom: string        // yyyy-mm-dd oder ''
  dateTo: string          // yyyy-mm-dd oder ''
  disabled?: boolean      // Bis-Datum deaktiviert (unbefristet)
  onChange: (from: string, to: string) => void
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const MONTHS = [
  'Januar','Februar','März','April','Mai','Juni',
  'Juli','August','September','Oktober','November','Dezember',
]

function isoToDate(s: string): Date | null {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function dateToIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

export default function DateRangePicker({ dateFrom, dateTo, disabled, onChange }: DateRangePickerProps) {
  const today = new Date()

  // Welcher Monat ist gerade sichtbar (Kalender-Anzeige)?
  const [viewYear, setViewYear] = useState(() => {
    if (dateFrom) return Number(dateFrom.slice(0, 4))
    return today.getFullYear()
  })
  const [viewMonth, setViewMonth] = useState(() => {
    if (dateFrom) return Number(dateFrom.slice(5, 7)) - 1
    return today.getMonth()
  })

  // Hover-Zustand für Live-Vorschau des Zeitraums
  const [hoverDate, setHoverDate] = useState<Date | null>(null)

  // Klick-Zustand: null = kein Startdatum gewählt, 'from' = warte auf Enddatum
  const [picking, setPicking] = useState<'idle' | 'from'>(() =>
    dateFrom ? 'idle' : 'idle'
  )

  const fromDate = isoToDate(dateFrom)
  const toDate = isoToDate(dateTo)

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  // Erster Wochentag des Monats (0=Mo…6=So)
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1)
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7   // Mo=0
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const handleDayClick = (d: Date) => {
    if (picking === 'idle' || picking === 'from') {
      // Erster Klick: Startdatum setzen, auf Enddatum warten
      onChange(dateToIso(d), '')
      setPicking('from')
    }
    // Zweiter Klick: Enddatum setzen
    // Dieser Fall wird unten über den Guard abgedeckt
  }

  const handleDayClickFinal = (d: Date) => {
    if (picking === 'from' && fromDate) {
      // Wenn Klick auf Datum vor fromDate: neu starten
      if (d < fromDate) {
        onChange(dateToIso(d), '')
        return
      }
      onChange(dateFrom, dateToIso(d))
      setPicking('idle')
      setHoverDate(null)
    } else {
      onChange(dateToIso(d), '')
      setPicking('from')
    }
  }

  // Welche "Rolle" hat ein bestimmter Tag?
  const getDayState = (d: Date) => {
    const effectiveTo = picking === 'from' && hoverDate ? hoverDate : toDate
    const isFrom = fromDate && sameDay(d, fromDate)
    const isTo = effectiveTo && sameDay(d, effectiveTo)
    const inRange = fromDate && effectiveTo && d > fromDate && d < effectiveTo
    const isPreview = picking === 'from' && hoverDate && d > (fromDate ?? d) && d < hoverDate
    return { isFrom, isTo, inRange: inRange || isPreview, isToday: sameDay(d, today) }
  }

  // Kalender-Grid aufbauen
  const cells: (Date | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewYear, viewMonth, i + 1)),
  ]
  // Auf volle Wochen auffüllen
  while (cells.length % 7 !== 0) cells.push(null)

  const formatDisplay = (iso: string) => {
    if (!iso) return '–'
    const d = isoToDate(iso)!
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const nightCount = fromDate && toDate
    ? Math.round((toDate.getTime() - fromDate.getTime()) / 86400000)
    : null

  return (
    <div className="space-y-3">
      {/* Anzeige-Zeile: Von / Bis / Nächte */}
      <div className="flex items-center gap-2">
        <div
          onClick={() => { onChange('', ''); setPicking('idle') }}
          className={`flex-1 flex flex-col items-center px-3 py-2 rounded-lg border-2 cursor-pointer transition-colors ${
            picking === 'from' && !dateFrom
              ? 'border-blue-400 bg-blue-50'
              : fromDate
                ? 'border-blue-300 bg-blue-50'
                : 'border-dashed border-gray-300 hover:border-blue-300'
          }`}
        >
          <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Von</span>
          <span className={`text-sm font-medium mt-0.5 ${fromDate ? 'text-gray-900' : 'text-gray-400'}`}>
            {fromDate ? formatDisplay(dateFrom) : 'Klicken'}
          </span>
        </div>

        <div className="text-gray-300 text-lg">→</div>

        <div
          className={`flex-1 flex flex-col items-center px-3 py-2 rounded-lg border-2 transition-colors ${
            disabled
              ? 'border-gray-200 bg-gray-50 opacity-50'
              : toDate
                ? 'border-blue-300 bg-blue-50'
                : picking === 'from'
                  ? 'border-dashed border-blue-300 animate-pulse'
                  : 'border-dashed border-gray-300'
          }`}
        >
          <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Bis</span>
          <span className={`text-sm font-medium mt-0.5 ${toDate ? 'text-gray-900' : 'text-gray-400'}`}>
            {disabled ? 'Unbefristet' : toDate ? formatDisplay(dateTo) : picking === 'from' ? 'Klicken' : '–'}
          </span>
        </div>

        {nightCount !== null && nightCount > 0 && (
          <div className="flex flex-col items-center px-2">
            <span className="text-[10px] uppercase tracking-wide text-gray-400">Nächte</span>
            <span className="text-sm font-bold text-indigo-600">{nightCount}</span>
          </div>
        )}
      </div>

      {/* Kalender */}
      {!disabled && (
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm select-none">
          {/* Navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-gray-800">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Wochentag-Header */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map(w => (
              <div key={w} className="text-center text-[11px] font-semibold text-gray-400 py-1">{w}</div>
            ))}
          </div>

          {/* Tage */}
          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              if (!d) return <div key={`empty-${i}`} />
              const { isFrom, isTo, inRange, isToday } = getDayState(d)
              const isSelected = isFrom || isTo

              return (
                <div
                  key={d.toISOString()}
                  className={`
                    relative h-9 flex items-center justify-center cursor-pointer text-sm transition-colors
                    ${inRange ? 'bg-blue-100' : ''}
                    ${isFrom ? 'rounded-l-full' : ''}
                    ${isTo ? 'rounded-r-full' : ''}
                    ${!isFrom && !isTo && !inRange ? 'hover:bg-gray-100 rounded-full' : ''}
                  `}
                  onClick={() => handleDayClickFinal(d)}
                  onMouseEnter={() => picking === 'from' && setHoverDate(d)}
                  onMouseLeave={() => picking === 'from' && setHoverDate(null)}
                >
                  <span className={`
                    w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium z-10 relative
                    ${isSelected
                      ? 'bg-blue-600 text-white shadow-md'
                      : isToday
                        ? 'ring-2 ring-blue-400 text-blue-700'
                        : inRange
                          ? 'text-blue-800'
                          : 'text-gray-700'}
                  `}>
                    {d.getDate()}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Hinweis */}
          {picking === 'from' && (
            <p className="text-center text-xs text-blue-500 mt-2">
              Jetzt Enddatum klicken
            </p>
          )}
        </div>
      )}
    </div>
  )
}
