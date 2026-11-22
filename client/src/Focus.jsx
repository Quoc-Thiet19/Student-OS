import React, { useEffect, useRef, useState } from 'react'
import { DateTime } from 'luxon'
import { useAuth } from './auth'
import { useRecords, useSave } from './data'
import { displayDate } from './dates'
import { message } from './api'
import { Empty, Field, items, Load, Options, Page } from './ui'
import { remainingTime } from '../../shared/focus'

const modes = [['focus','Focus'],['short','Short break'],['long','Long break']]
function read(key) { try { return JSON.parse(localStorage.getItem(key)) } catch { return null } }
export default function Focus() {
  const courses = useRecords('courses'), study = useRecords('study-sessions'), prefs = useRecords('preferences'), assignments = useRecords('assignments')
  const { user } = useAuth()
  return <Page title="Focus Mode" subtitle="Set aside time for one thing at a time."><Load queries={[courses,study,prefs,assignments]}>
    <Timer key={user._id} storageKey={'studentos:focus:' + user._id} preferences={prefs.data} courses={items(courses)} assignments={items(assignments)} history={items(study)}/>
  </Load></Page>
}
function Timer({ storageKey,preferences,courses,assignments,history }) {
  const [state,setState] = useState(() => read(storageKey) || { mode:'focus',course:'',assignment:'' })
  const [now,setNow] = useState(Date.now), [error,setError] = useState(''), [saved,setSaved] = useState(false)
  const block = useRef(null), sending = useRef(false)
  const save = useSave('study-sessions')
  const duration = preferences[state.mode] * 60000
  const left = remainingTime(state,duration,now)
  const seconds = Math.ceil(left/1000)
  const display = String(Math.floor(seconds/60)).padStart(2,'0') + ':' + String(seconds%60).padStart(2,'0')
  useEffect(() => { localStorage.setItem(storageKey,JSON.stringify(state)) }, [state,storageKey])
  useEffect(() => {
    if (!state.deadline) return
    const interval = setInterval(() => setNow(Date.now()),250)
    return () => clearInterval(interval)
  },[state.deadline])
  useEffect(() => {
    if (state.deadline && left === 0) {
      setState({ ...state,deadline:null,remaining:0,finished:state.deadline })
    }
  },[state,left])
  async function persist() {
    if (sending.current) return
    sending.current = true
    try {
      setError('')
      await save.mutateAsync({ data:{
        course:state.course || null,assignment:state.assignment || null,start:new Date(state.start).toISOString(),
        end:new Date(state.finished).toISOString(),seconds:state.duration/1000,status:'completed',key:state.key,
      } })
      reset()
      setSaved(true)
    } catch (error) { setError(message(error)) }
    finally { sending.current = false }
  }
  useEffect(() => {
    if (state.finished && state.mode === 'focus') persist()
  },[state.finished])
  function reset(mode = state.mode) { setState({ mode,course:state.course,assignment:state.assignment }); setSaved(false); setError('') }
  function toggle() {
    const stamp = Date.now()
    setNow(stamp)
    setSaved(false)
    if (state.deadline) setState({ ...state,deadline:null,remaining:remainingTime(state,duration,stamp) })
    else setState({ ...state,start:state.start || stamp,key:state.key || crypto.randomUUID(),duration:state.duration || duration,deadline:stamp+left })
  }
  const today = DateTime.now().setZone(preferences.timezone).startOf('day')
  const week = today.minus({ days:(today.weekday%7-preferences.firstDay+7)%7 })
  const sumSince = date => history.filter(x => new Date(x.end) >= date.toJSDate()).reduce((sum,x) => sum+x.seconds,0)
  const byCourse = Object.entries(history.reduce((group,x) => {
    const label = courses.find(c => c._id === x.course)?.name || 'Unassigned'
    group[label] = (group[label] || 0)+x.seconds
    return group
  },Object.create(null)))
  return <>
    <section className="panel timer-panel" ref={block}>
      <div className="tabs">{modes.map(([key,label]) => <button key={key} aria-pressed={state.mode === key} disabled={!!state.start && (!state.finished || state.mode === 'focus') || save.isPending} onClick={() => reset(key)}>{label}</button>)}</div>
      <div className="timer" role="timer" aria-label="Time remaining">{display}</div>
      <div className="actions">{state.finished ? <><p role="status">{state.mode === 'focus' ? 'Focus interval complete.' : 'Break complete.'}</p>{state.mode === 'focus' && <button className="primary" onClick={persist} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save session'}</button>}</> :
        <button className="primary" onClick={toggle}>{state.deadline ? 'Pause' : state.start ? 'Resume' : 'Start'}</button>}
        <button className="secondary" disabled={!state.start || save.isPending || !!state.finished && state.mode === 'focus'} onClick={() => reset()}>Reset</button>
        {document.fullscreenEnabled && <button className="secondary" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : block.current.requestFullscreen()).catch(() => setError('Full screen is unavailable.'))}>Toggle full screen</button>}
      </div>
      <div className="filters"><Field label="Course"><select disabled={!!state.start} value={state.course} onChange={e => setState({ ...state,course:e.target.value,assignment:'' })}><option value="">No course</option><Options values={courses.map(x => [x._id,x.code])}/></select></Field>
      <Field label="Assignment"><select disabled={!!state.start || !state.course} value={state.assignment} onChange={e => setState({ ...state,assignment:e.target.value })}><option value="">No assignment</option><Options values={assignments.filter(x => x.course === state.course).map(x => [x._id,x.title])}/></select></Field></div>
      {saved && <p role="status">Study session saved.</p>}{error && <p role="alert" className="error">{error}</p>}
      <p className="muted">The timer continues while this browser is closed. Reopen Focus Mode to save a completed interval. If you’re offline, retry saving after reconnecting.</p>
    </section>
    <div className="metrics space">{[['Focus today',(sumSince(today)/60).toFixed(1)+' min'],['Study this week',(sumSince(week)/3600).toFixed(2)+' hr'],['Completed sessions',history.length]].map(([label,value]) => <div key={label} className="panel metric"><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="dashboard-grid space"><section className="panel"><h2>Recent sessions</h2>{history.length ? [...history].sort((a,b) => b.end.localeCompare(a.end)).slice(0,10).map(x => <div className="record" key={x._id}><span>{displayDate(x.end,preferences.timezone)}</span><strong>{(x.seconds/60).toFixed(1)} min</strong></div>) : <Empty>No completed sessions yet.</Empty>}</section>
    <section className="panel"><h2>Study by course</h2>{byCourse.length ? byCourse.map(([label,value]) => <div className="record" key={label}><span>{label}</span><strong>{(value/60).toFixed(1)} min</strong></div>) : <Empty>Course study time appears after a completed session.</Empty>}</section></div>
  </>
}


