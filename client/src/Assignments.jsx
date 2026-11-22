import React, { lazy, Suspense, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { deadline, priorities, recommendation, statuses } from '../../shared/academic'
import { useRecords, useSave } from './data'
import { displayDate } from './dates'
import { message } from './api'
import { Add, Empty, items, Load, Options, Page } from './ui'
import { RecordEditor } from './Records'

const CalendarGrid = lazy(() => import('./CalendarGrid'))
export default function Assignments() {
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState('List')
  const [edit, setEdit] = useState(null)
  const [error, setError] = useState('')
  const [sort, setSort] = useState('dueAt')
  const [due, setDue] = useState('')
  const [filters, setFilters] = useState({ course: params.get('course') || '', q: '', status: '', priority: '', semester: '' })
  const courses = useRecords('courses'), semesters = useRecords('semesters'), prefs = useRecords('preferences')
  const assignments = useRecords('assignments', { ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)), sort: sort === 'recommended' ? 'dueAt' : sort })
  const mutation = useSave('assignments')
  const courseMap = new Map(items(courses).map(course => [course._id, course]))
  const list = items(assignments).filter(item => !due || deadline(item) === due)
  if (sort === 'recommended') list.sort((a,b) => recommendation(b).score - recommendation(a).score)
  const row = edit || (params.has('add') ? { course: filters.course } : null)
  function close() { setEdit(null); if (params.has('add')) setParams(filters.course ? { course: filters.course } : {}) }
  async function move(id, status) {
    setError('')
    try { await mutation.mutateAsync({ id, data: { status } }) } catch (error) { setError(message(error)) }
  }
  function record(item, board = false) {
    const checked = item.checklist.filter(task => task.done).length
    return <div className={board ? 'panel board-card' : 'record'} key={item._id} draggable={board} onDragStart={event => event.dataTransfer.setData('text/plain', item._id)}>
      <div><button className="text-button" onClick={() => setEdit(item)}>{item.title}</button>
      <p className="muted">{courseMap.get(item.course)?.code} · {displayDate(item.dueAt,prefs.data.timezone)}</p>
      {item.checklist.length > 0 && <p className="muted">{checked}/{item.checklist.length} checklist items</p>}
      {item.status !== 'completed' && <small className="muted">{recommendation(item).reason}</small>}</div>
      <span className={'badge ' + (deadline(item) === 'overdue' ? 'error' : '')}>{deadline(item) === 'overdue' ? 'Overdue' : item.priority}</span>
      <select aria-label={'Status for ' + item.title} value={item.status} disabled={mutation.isPending} onChange={e => move(item._id,e.target.value)}><Options values={statuses}/></select>
    </div>
  }
  return <Page title="Assignments" subtitle="Plan deadlines, prioritize work, and track completion." action={items(courses).length ? <Add onClick={() => setEdit({ course:filters.course })}>Add assignment</Add> : undefined}>
    <Load queries={[courses,semesters,prefs,assignments]}>
      <div className="toolbar"><div className="tabs" aria-label="Assignment view">{['List','Board','Calendar'].map(value => <button key={value} aria-pressed={view === value} onClick={() => setView(value)}>{value}</button>)}</div>
      <input aria-label="Search assignments" placeholder="Search assignments" value={filters.q} onChange={e => setFilters({ ...filters,q:e.target.value })}/></div>
      <div className="filters">
      {[['course','All courses',items(courses).map(x => [x._id,x.code])],['semester','All semesters',items(semesters).map(x => [x._id,x.name])],['status','All statuses',statuses],['priority','All priorities',priorities]].map(([key,label,options]) =>
        <select key={key} aria-label={label} value={filters[key]} onChange={e => setFilters({ ...filters,[key]:e.target.value })}><option value="">{label}</option><Options values={options}/></select>)}
      <select aria-label="Due date filter" value={due} onChange={e => setDue(e.target.value)}><option value="">Any deadline</option><Options values={['overdue',['today','Next 24 hours'],['this week','Next seven days'],'later']}/></select>
      <select aria-label="Sort assignments" value={sort} onChange={e => setSort(e.target.value)}><Options values={[[ 'dueAt','Due soonest'],['-dueAt','Due latest'],['title','Title'],['-createdAt','Newest'],['recommended','Recommended']]}/></select></div>
      {error && <p role="alert" className="error">{error}</p>}
      {view === 'Calendar' ? <Suspense fallback={<div className="skeleton" role="status" aria-label="Loading calendar"/>}><CalendarGrid preferences={prefs.data} events={list.map(x => ({ id:x._id,title:x.title,start:x.dueAt,color:courseMap.get(x.course)?.color }))} onSelect={id => setEdit(list.find(x => x._id === id))}/></Suspense>
        : !list.length ? <Empty>{items(courses).length ? 'No assignments match this view.' : 'Add a course before creating assignments.'}{!items(courses).length && <Link to="/app/courses?add=course">Set up a course</Link>}</Empty>
        : view === 'Board' ? <div className="board">{statuses.map(status => <section className="board-column" key={status} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (list.some(x => x._id === id)) move(id,status) }}><h2>{status}</h2>{list.filter(x => x.status === status).map(x => record(x,true))}</section>)}</div>
        : <section className="panel">{list.map(x => record(x))}</section>}
      {row && items(courses).length > 0 && <RecordEditor resource="assignments" row={row} close={close} courses={items(courses)} preferences={prefs.data}/>}
    </Load>
  </Page>
}

