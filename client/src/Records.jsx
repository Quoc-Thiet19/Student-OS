import React, { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { priorities, statuses, weightedGrades } from '../../shared/academic'
import { useRecords, useSave } from './data'
import { displayDate, isoValue, localValue } from './dates'
import { Add, Delete, Editor, Empty, Field, items, Load, Options, Page } from './ui'


const types = {
  semesters: ['semester', [['name','Semester name'],['start','Start date','date'],['end','End date','date'],['state','State',['planned','active','archived']]]],
  courses: ['course', [['name','Course name'],['code','Course code','text',undefined,undefined,30],['instructor','Instructor','optional'],['semester','Semester','semesters'],['room','Room or location','optional'],['color','Course color','color','#2563eb'],['description','Description','textarea'],['target','Target grade (%)','number',85,100]]],
  assignments: ['assignment', [['title','Title'],['course','Course','courses'],['description','Description','textarea'],['dueAt','Due date and time','datetime-local'],['priority','Priority',priorities],['status','Status',statuses],['estimate','Estimated minutes','number',30,10080],['weight','Grade weight (%)','optionalNumber','',100]]],
  assessments: ['assessment', [['name','Assessment name'],['weight','Weight (%)','number','',100],['earned','Score earned','optionalNumber'],['maximum','Maximum score','number',100],['dueAt','Due date','optionalDate'],['completed','Include in current grade','checkbox']]],
  calendar: ['event', [['title','Title'],['course','Course (optional)','optionalCourse'],['type','Type',['class','exam','study','personal']],['start','Start','datetime-local'],['end','End','datetime-local'],['description','Description','textarea']]],
}
const nullable = new Set(['optionalNumber','optionalDate','optionalCourse'])
export function RecordEditor({ resource, row, close, courses = [], semesters = [], preferences = {}, course, onSaved }) {
  const save = useSave(resource)
  const [singular, fields] = types[resource]
  const [deleting, setDeleting] = useState(false)
  const [original] = useState(row)
  const [list, setList] = useState(row.checklist || row.schedule || [])
  const zone = preferences.timezone
  const checklist = resource === 'assignments'
  const schedule = resource === 'courses'
  function change(index, field, value) { setList(list.map((entry, i) => i === index ? { ...entry, [field]: value } : entry)) }
  async function submit(form) {
    const data = Object.fromEntries(fields.map(([key, , type]) => {
      const value = form.get(key)
      if (type === 'checkbox') return [key, form.has(key)]
      if (type === 'datetime-local' || type === 'optionalDate') return [key, isoValue(value, zone)]
      if (nullable.has(type) && !value) return [key, null]
      return [key, ['number','optionalNumber'].includes(type) ? Number(value) : value]
    }))
    if (course) data.course = course
    if (checklist) data.checklist = list
    if (schedule) data.schedule = list
    const changes = schedule && original._id
      ? Object.fromEntries(Object.entries(data).filter(([key,value]) => key === 'schedule' ? list !== original.schedule : value !== original[key]))
      : data
    await save.mutateAsync({ id: row._id, data:changes })
    onSaved?.()
  }
  if (deleting) return <Delete title={'Delete ' + singular + '?'} close={() => setDeleting(false)} remove={async () => { await save.mutateAsync({ id: row._id, remove: true }); close() }}>
    <p>{resource === 'courses' ? 'This deletes the course, its assignments, assessments, and events. Study sessions are retained without course or assignment links.' : resource === 'semesters' ? 'Move or delete courses in this semester before deleting it.' : 'This entry will be permanently removed.'}</p>
  </Delete>
  return <Editor title={schedule && row._id ? 'Edit Course' : (row._id ? 'Edit ' : 'Add ') + singular} close={close} save={submit}
    protectDraft={schedule && !!row._id} listChanged={list !== original.schedule}
    discardAction={schedule && row._id ? { label:'Delete course',run:() => {
      setList(original.schedule || [])
      setDeleting(true)
    } } : undefined}>
    {fields.map(([key, label, type, initial, max, maxLength = 120]) => {
      const value = (schedule ? original : row)[key] ?? (key === 'priority' ? preferences.priority : initial) ?? ''
      if (type === 'checkbox') return <label key={key} className="inline"><input name={key} type="checkbox" defaultChecked={value}/>{label}</label>
      if (type === 'textarea') return <Field key={key} label={label}><textarea name={key} maxLength={8000} defaultValue={value}/></Field>
      const options = Array.isArray(type) ? type : type === 'semesters' ? semesters.map(x => [x._id, x.name]) : ['courses','optionalCourse'].includes(type) ? courses.map(x => [x._id, x.code + ' · ' + x.name]) : null
      if (options) return <Field key={key} label={label}><select name={key} required={type !== 'optionalCourse'} defaultValue={value || (key === 'state' ? 'active' : Array.isArray(type) ? options[0] : key === 'semester' ? preferences.semester || semesters.find(x => x.state === 'active')?._id : '')}>
        {!Array.isArray(type) && <option value="">{type === 'optionalCourse' ? 'No course' : 'Choose ' + label.toLowerCase()}</option>}<Options values={options}/></select></Field>
      const number = ['number','optionalNumber'].includes(type)
      const instant = ['datetime-local','optionalDate'].includes(type)
      return <Field key={key} label={instant && zone ? label + ' (' + zone + ')' : label} name={key}
        type={number ? 'number' : instant ? 'datetime-local' : type === 'optional' ? 'text' : type || 'text'}
        min={number ? (key === 'maximum' ? 0.01 : 0) : undefined} max={max} step={number ? key === 'estimate' ? 1 : 'any' : undefined}
        defaultValue={instant ? localValue(value, zone) : value} required={type !== 'optional' && !nullable.has(type)} maxLength={maxLength}/>
    })}
    {(checklist || schedule) && <fieldset className="form"><legend>{checklist ? 'Checklist' : 'Weekly classes'}</legend>
      {list.map((entry, i) => <div className="inline wrap" key={i}>{checklist ? <>
        <input aria-label={'Complete checklist item ' + (i + 1)} type="checkbox" checked={entry.done} onChange={e => change(i,'done',e.target.checked)}/>
        <input aria-label={'Checklist item ' + (i + 1)} required maxLength={120} value={entry.title} onChange={e => change(i,'title',e.target.value)}/>
      </> : <>
        <Field label="Day"><select value={entry.weekday} onChange={e => change(i,'weekday',Number(e.target.value))}><Options values={['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((name, index) => [index,name])}/></select></Field>
        <Field label="Class start" required type="time" value={entry.start} onChange={e => change(i,'start',e.target.value)}/>
        <Field label="Class end" required type="time" value={entry.end} onChange={e => change(i,'end',e.target.value)}/>
      </>}<button className="secondary" type="button" onClick={() => setList(list.filter((_, index) => i !== index))}>Remove</button></div>)}
      <button className="secondary" type="button" disabled={list.length >= (checklist ? 100 : 30)} onClick={() => setList([...list, checklist ? { title:'', done:false } : { weekday:1, start:'09:00', end:'10:00' }])}>{checklist ? 'Add checklist item' : 'Add weekly class'}</button>
    </fieldset>}
    {row._id && !schedule && <button className="secondary error" type="button" onClick={() => setDeleting(true)}>Delete {singular}</button>}
  </Editor>
}
export function Courses() {
  const [params,setParams] = useSearchParams()
  const [edit,setEdit] = useState(null)
  const semesters = useRecords('semesters'), courses = useRecords('courses'), prefs = useRecords('preferences')
  const selected = params.get('semester') || ''
  const resource = items(semesters).length ? 'courses' : 'semesters'
  const editor = edit || (params.has('add') ? { resource, row: {} } : null)
  const list = items(courses).filter(x => !selected || x.semester === selected)
  function close() { setEdit(null); if (params.has('add')) setParams(selected ? { semester:selected } : {}) }
  return <Page title="My Courses" subtitle="Organize your courses across semesters." action={<Add onClick={() => setEdit({ resource, row:{} })}>Add course</Add>}>
    <Load queries={[semesters,courses,prefs]}>
      <section className="panel"><div className="section-heading"><h2>Semesters</h2><Add onClick={() => setEdit({ resource:'semesters',row:{} })}>Add semester</Add></div>
      {items(semesters).map(row => <div className="record" key={row._id}><div><strong>{row.name}</strong><p className="muted">{row.start} to {row.end}</p></div><span className="badge">{row.state}</span><button className="secondary" onClick={() => setEdit({ resource:'semesters',row })}>Edit</button></div>)}
      {!items(semesters).length && <Empty>Create a semester to start organizing courses.</Empty>}</section>
      <section className="space"><div className="section-heading"><h2>Courses</h2><select aria-label="Filter courses by semester" value={selected} onChange={e => setParams(e.target.value ? { semester:e.target.value } : {})}><option value="">All semesters</option><Options values={items(semesters).map(x => [x._id,x.name])}/></select></div>
      {list.length ? <div className="card-grid">{list.map(row => <Link className="panel course-card" to={row._id} key={row._id} style={{ '--course':row.color }}><p className="eyebrow">{row.code}</p><h3>{row.name}</h3><p className="muted">{row.instructor || items(semesters).find(x => x._id === row.semester)?.name}</p><p>Target {row.target}%</p></Link>)}</div> : <Empty>No courses in this view.</Empty>}</section>
      {editor && <RecordEditor {...editor} close={close} semesters={items(semesters)} preferences={prefs.data}/>}
    </Load>
  </Page>
}
export function CourseDetail() {
  const { id } = useParams()
  const courses = useRecords('courses'), semesters = useRecords('semesters'), assignments = useRecords('assignments',{ course:id }), study = useRecords('study-sessions',{ course:id }), assessments = useRecords('assessments',{ course:id }), prefs = useRecords('preferences')
  const [editingId,setEditingId] = useState(null)
  const [savedId,setSavedId] = useState(null)
  const row = items(courses).find(x => x._id === id)
  const grade = weightedGrades(items(assessments),row?.target || 0)
  return <Load queries={[courses,semesters,assignments,study,assessments,prefs]}>{row ? <Page title={row.name} subtitle={[row.code,row.instructor,row.room].filter(Boolean).join(' · ')} action={<button className="secondary" onClick={() => { setSavedId(null); setEditingId(id) }}>Edit Course</button>}>
    <div role="status">{savedId === id && 'Course changes saved.'}</div>
    {row.description && <p className="panel">{row.description}</p>}
    <div className="card-grid space"><section className="panel"><h2>Progress</h2><p>{items(assignments).filter(x => x.status === 'completed').length} of {items(assignments).length} assignments completed</p></section><section className="panel"><h2>Grades</h2><p>{grade.current == null ? "No graded assessments" : grade.current.toFixed(1) + "% current"} · Target {row.target}%</p><Link to={'/app/grades?course='+id}>View grade breakdown</Link></section><section className="panel"><h2>Study hours</h2><p>{(items(study).reduce((sum,x) => sum+x.seconds,0)/3600).toFixed(2)} hours</p></section></div>
    <section className="panel space"><h2>Weekly classes</h2>{(row.schedule || []).map((x,i) => <p key={i}>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][x.weekday]} · {x.start}–{x.end}</p>)}<Link to={'/app/calendar?course='+id}>Open course calendar</Link></section>
    <section className="panel space"><div className="section-heading"><h2>Assignments</h2><Link to={'/app/assignments?course='+id}>Open tracker</Link></div>{items(assignments).map(x => <div className="record" key={x._id}><strong>{x.title}</strong><span>{displayDate(x.dueAt,prefs.data.timezone)}</span><span className="badge">{x.status}</span></div>)}{!items(assignments).length && <Empty>No assignments for this course.</Empty>}</section>
    {editingId === id && <RecordEditor key={id} resource="courses" row={row} close={() => setEditingId(null)} onSaved={() => setSavedId(id)} semesters={items(semesters)} preferences={prefs.data}/>}
  </Page> : <Empty>Course unavailable.<Link to="/app/courses">Back to My Courses</Link></Empty>}</Load>
}


