import React, { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DateTime } from 'luxon'
import { recurringClasses } from '../../shared/schedule'
import { useRecords, useSave } from './data'
import { message } from './api'
import { Add, Dialog, items, Load, Options, Page } from './ui'
import { RecordEditor } from './Records'
import CalendarGrid from './CalendarGrid'

export default function Calendar() {
  const [params,setParams] = useSearchParams()
  const [type,setType] = useState(''), [edit,setEdit] = useState(null), [details,setDetails] = useState(null), [error,setError] = useState('')
  const selected = params.get('course') || ''
  const courses = useRecords('courses'), semesters = useRecords('semesters'), assignments = useRecords('assignments'), calendar = useRecords('calendar'), prefs = useRecords('preferences')
  const save = useSave('calendar'), saveAssignment = useSave('assignments')
  const list = items(calendar).filter(x => (!selected || x.course === selected) && (!type || x.type === type))
  const courseList = items(courses).filter(x => !selected || x._id === selected)
  const courseMap = new Map(items(courses).map(x => [x._id,x]))
  const tasks = !type || type === 'deadline' ? items(assignments).filter(x => !selected || x.course === selected) : []
  const classes = !type || type === 'class' ? recurringClasses(courseList,items(semesters)) : []
  const events = [...list.map(x => ({ id:x._id,title:x.title,start:x.start,end:x.end,color:courseMap.get(x.course)?.color })),
    ...tasks.map(x => ({ id:'assignment-'+x._id,title:x.title,start:x.dueAt,color:courseMap.get(x.course)?.color })),...classes]
  const editor = edit || (params.has('add') ? { resource:'calendar',row:{ course:selected } } : null)
  function close() { setEdit(null); if (params.has('add')) setParams(selected ? { course:selected } : {}) }
  function open(id) {
    if (id.startsWith('class-')) return setDetails(classes.find(x => x.id === id))
    const task = tasks.find(x => 'assignment-'+x._id === id)
    if (task) return setEdit({ resource:'assignments',row:task })
    const event = list.find(x => x._id === id)
    if (event) setEdit({ resource:'calendar',row:event })
  }
  async function drop({ event,revert }) {
    try {
      setError('')
      if (event.id.startsWith('assignment-')) {
        await saveAssignment.mutateAsync({ id:event.id.slice(11),data:{ dueAt:event.start.toISOString() } })
      } else {
        const previous = list.find(x => x._id === event.id)
        const length = new Date(previous.end) - new Date(previous.start)
        await save.mutateAsync({ id:event.id,data:{ start:event.start.toISOString(),end:new Date(event.start.getTime()+length).toISOString() } })
      }
    } catch (error) { revert(); setError(message(error)) }
  }
  function dateClick({ dateStr,allDay }) {
    const value = DateTime.fromISO(dateStr,{ zone:prefs.data.timezone })
    const start = allDay ? value.set({ hour:9 }) : value
    setEdit({ resource:'calendar',row:{ course:selected,start:start.toUTC().toISO(),end:start.plus({ hours:1 }).toUTC().toISO() } })
  }
  return <Page title="Calendar" subtitle="Classes, deadlines, and personal commitments." action={<Add onClick={() => setEdit({ resource:'calendar',row:{ course:selected } })}>Add event</Add>}>
    <Load queries={[courses,semesters,assignments,calendar,prefs]}>
      <div className="filters"><select aria-label="Filter calendar by course" value={selected} onChange={e => setParams(e.target.value ? { course:e.target.value } : {})}><option value="">All courses</option><Options values={items(courses).map(x => [x._id,x.code])}/></select>
      <select aria-label="Filter by event type" value={type} onChange={e => setType(e.target.value)}><option value="">All event types</option><Options values={['class',['deadline','Assignment deadline'],'exam',['study','Study session'],['personal','Personal event']]}/></select></div>
      {error && <p role="alert" className="error">{error}</p>}
      <CalendarGrid preferences={prefs.data} events={events} onSelect={open} onDrop={drop} onDate={dateClick}/>
      {editor && <RecordEditor {...editor} close={close} courses={items(courses)} preferences={prefs.data}/>}
      {details && <Dialog title={details.title} close={() => setDetails(null)}><p>Weekly class · {details.startTime}–{details.endTime} · {prefs.data.timezone}</p><Link to={'/app/courses/'+details.course}>Open course to edit the weekly schedule</Link></Dialog>}
    </Load>
  </Page>
}

