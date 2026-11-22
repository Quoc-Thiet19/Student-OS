import React from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGrid from '@fullcalendar/daygrid'
import timeGrid from '@fullcalendar/timegrid'
import list from '@fullcalendar/list'
import interaction from '@fullcalendar/interaction'
import luxon from '@fullcalendar/luxon3'

export default function CalendarGrid({ preferences, events, onSelect, onDrop, onDate }) {
  const compact = window.matchMedia('(max-width: 700px)').matches
  return <div className="panel calendar-panel"><FullCalendar plugins={[dayGrid,timeGrid,list,interaction,luxon]}
    initialView={compact ? 'listWeek' : 'dayGridMonth'}
    headerToolbar={{ left:'prev,next today', center:'title', right:'dayGridMonth,timeGridWeek,timeGridDay,listWeek' }}
    height="auto" timeZone={preferences.timezone} firstDay={preferences.firstDay} events={events}
    editable={!!onDrop} eventDurationEditable={false} eventDrop={onDrop} dateClick={onDate}
    eventClick={({ event }) => onSelect?.(event.id)} eventInteractive dayMaxEvents={4}/>
  </div>
}

