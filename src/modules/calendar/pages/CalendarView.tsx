import { useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { usePropertyUsages, useSavePropertyUsage } from '@/modules/properties/hooks/useProperties'
import { useIsAdmin } from '@/hooks/usePermissions'
import { Card, CardContent } from '@/components/ui/card'

import { useNavigate, useLocation } from 'react-router-dom'

export default function CalendarView() {
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const { data: usages, isLoading } = usePropertyUsages()
  const saveUsage = useSavePropertyUsage()
  const calendarRef = useRef<FullCalendar>(null)
  const [view, setView] = useState('dayGridMonth')
  const location = useLocation()
  const initialDate = location.state?.calendarDate ?? undefined

  // Nutzungen in FullCalendar Events umwandeln
  const events = usages
    ?.filter(u => u.show_in_calendar && u.date_from)
    .map(u => {
      const contactName = u.contact
        ? u.contact.is_company
          ? u.contact.company_name ?? ''
          : [u.contact.first_name, u.contact.last_name].filter(Boolean).join(' ')
        : ''

      const unitName = u.unit?.name ?? u.unit?.short_code ?? ''
      const color = (u.unit as any)?.color ?? '#3b82f6'

      // Endatum: FullCalendar braucht exklusives Enddatum
      let endDate = u.date_to
      if (endDate) {
        const d = new Date(endDate)
        d.setDate(d.getDate() + 1)
        endDate = d.toISOString().split('T')[0]
      }

      return {
        id: u.id,
        title: [unitName, contactName].filter(Boolean).join(' · '),
        start: u.date_from!,
        end: endDate ?? undefined,
        allDay: true,
        backgroundColor: color,
        borderColor: color,
        extendedProps: {
          unitName,
          contactName,
          notes: u.notes,
          calendar_comment: u.calendar_comment,
          rent_actual: u.rent_actual,
          usageId: u.id,
        }
      }
    }) ?? []

  // Drag & Drop Handler
  const handleEventDrop = async (info: any) => {
    if (!isAdmin) return

    const { event } = info
    const newStart = event.startStr
    const newEnd = event.endStr
      ? new Date(new Date(event.endStr).setDate(new Date(event.endStr).getDate() - 1))
          .toISOString().split('T')[0]
      : null

    try {
      await saveUsage.mutateAsync({
        id: event.id,
        date_from: newStart,
        date_to: newEnd,
      })
    } catch {
      info.revert()
    }
  }

  // Klick auf Event
  const handleEventClick = (info: any) => {
  const usageId = info.event.extendedProps.usageId
  if (isAdmin) {
    const currentDate = calendarRef.current?.getApi().getDate().toISOString()
    navigate(`/properties/usages/${usageId}/edit`, {
      state: { from: 'calendar', calendarDate: currentDate }
    })
  }
}

  // Tooltip Inhalt
  const renderEventContent = (eventInfo: any) => {
    const { unitName, contactName, calendar_comment } = eventInfo.event.extendedProps
    return (
      <div className="p-0.5 overflow-hidden">
        <div className="font-semibold text-xs truncate">{unitName}</div>
        {contactName && (
          <div className="text-xs opacity-90 truncate">{contactName}</div>
        )}
        {calendar_comment && (
          <div className="text-xs opacity-75 truncate italic">{calendar_comment}</div>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Kalender wird geladen...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kalender</h1>
          <p className="text-gray-500 mt-1">
            {events.length} Termine · {isAdmin ? 'Bearbeitbar per Drag & Drop' : 'Nur Ansicht'}
          </p>
        </div>

        {/* Ansicht wechseln */}
        <div className="flex gap-2">
          {[
            { key: 'dayGridMonth', label: 'Monat' },
            { key: 'timeGridWeek', label: 'Woche' },
            { key: 'dayGridYear', label: 'Jahr' },
          ].map(v => (
            <button
              key={v.key}
              onClick={() => {
                setView(v.key)
                calendarRef.current?.getApi().changeView(v.key)
              }}
              className={`
                px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                ${view === v.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border text-gray-600 hover:bg-gray-50'
                }
              `}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Admin Hinweis */}
      {isAdmin && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-md text-sm text-orange-700">
          🔒 Admin-Modus: Termine können per Drag & Drop verschoben werden. Klick auf einen Termin öffnet die Bearbeitung.
        </div>
      )}

      {/* Kalender */}
      <Card>
        <CardContent className="p-4">
          <FullCalendar
            ref={calendarRef}
            initialDate={initialDate}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale="de"
            firstDay={1}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: '',
            }}
            buttonText={{
              today: 'Heute',
              month: 'Monat',
              week: 'Woche',
            }}
            events={events}
            eventContent={renderEventContent}
            editable={isAdmin}
            droppable={isAdmin}
            eventDrop={handleEventDrop}
            eventClick={handleEventClick}
            eventDisplay="block"
            dayMaxEvents={4}
            moreLinkText={n => `+${n} weitere`}
            height="auto"
            weekNumbers={true}
            weekText="KW"
            eventTimeFormat={{
              hour: undefined,
              minute: undefined,
              meridiem: false,
            }}
          />
        </CardContent>
      </Card>

      {/* Legende */}
      <div className="mt-4 flex flex-wrap gap-3">
        {Array.from(
          new Map(
            usages
              ?.filter(u => u.show_in_calendar && u.unit)
              .map(u => [
                u.unit!.id,
                {
                  name: u.unit!.name ?? u.unit!.short_code ?? '',
                  color: (u.unit as any)?.color ?? '#3b82f6',
                }
              ])
          ).values()
        ).map((item, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            {item.name}
          </div>
        ))}
      </div>
    </div>
  )
}