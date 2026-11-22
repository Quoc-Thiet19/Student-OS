import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, CalendarDays, ListTodo, Timer } from 'lucide-react'
import { recurringClasses, classOccurrences } from '../../shared/schedule'
import { DateTime } from 'luxon'
import { useAuth } from './auth'
import { useRecords, useSave } from './data'
import { displayDate } from './dates'
import { deadline, recommendation } from '../../shared/academic'
import { Add, Dialog, Empty, items, Load, Page } from './ui'
import { message } from './api'

const actions = [['Add assignment','/app/assignments?add=1',ListTodo],['Add course','/app/courses?add=course',BookOpen],['Start focus session','/app/focus',Timer],['Add event','/app/calendar?add=1',CalendarDays]]
function Actions() { return actions.map(([label,to,Icon]) => <Link className="secondary" to={to} key={label}><Icon size={16}/>{label}</Link>) }
export default function Dashboard() {
  const { user } = useAuth()
  const courses = useRecords('courses'), semesters = useRecords('semesters'), assignments = useRecords('assignments')
  const calendar = useRecords('calendar'), study = useRecords('study-sessions'), prefs = useRecords('preferences')
  const [quick,setQuick] = useState(false), [error,setError] = useState('')
  const mutation = useSave('assignments')
  const zone = prefs.data?.timezone
  const now = DateTime.now().setZone(zone || 'local')
  const week = now.startOf('day').minus({ days:(now.weekday % 7 - (prefs.data?.firstDay ?? 1) + 7) % 7 })
  const active = new Set(items(semesters).filter(x => x.state === 'active').map(x => x._id))
  const pending = items(assignments).filter(x => x.status !== 'completed')
  const upcoming = pending.filter(x => ['today','this week'].includes(deadline(x)))
  const completed = items(assignments).length - pending.length
  const hours = items(study).filter(x => new Date(x.end) >= week.toJSDate()).reduce((sum,x) => sum+x.seconds,0)/3600
  const events = items(calendar).filter(x => new Date(x.start) >= now.toJSDate() && new Date(x.start) < now.plus({ days:7 }).toJSDate()).concat(classOccurrences(recurringClasses(items(courses),items(semesters)),now,now.plus({ days:7 }))).sort((a,b) => a.start.localeCompare(b.start))
  const daily = Array.from({ length:7 }, (_,i) => {
    const date = now.minus({ days:6-i })
    return { day:date.toFormat('ccc'), minutes:Math.round(items(study).filter(x => DateTime.fromISO(x.end,{ zone }).hasSame(date,'day')).reduce((sum,x) => sum+x.seconds,0)/60) }
  })
  const time = now.hour < 12 ? 'morning' : now.hour < 18 ? 'afternoon' : 'evening'
  return <><p className="eyebrow">{now.toLocaleString(DateTime.DATE_HUGE)}</p>
    <Page title={'Good '+time+', '+user.name.split(' ')[0]+'.'} subtitle={assignments.data && (upcoming.length ? upcoming.length+' '+(upcoming.length === 1 ? 'assignment is' : 'assignments are')+' due in the next seven days.' : 'No upcoming assignment deadlines in the next seven days.')} action={<Add onClick={() => setQuick(true)}>Quick add</Add>}>
      <Load queries={[courses,semesters,assignments,calendar,study,prefs]}>
        <div className="metrics">{[['Active courses',items(courses).filter(x => active.has(x.semester)).length,BookOpen],['Pending assignments',pending.length,ListTodo],['Upcoming deadlines',upcoming.length,CalendarDays],['Study hours this week',hours.toFixed(1),Timer]].map(([label,value,Icon]) => <div className="panel metric" key={label}><span><Icon size={16}/>{label}</span><strong>{value}</strong></div>)}</div>
        <div className="dashboard-grid space">
          <section className="panel"><div className="section-heading"><h2>Today’s priorities</h2><Link to="/app/assignments">View all</Link></div>{error && <p className="error" role="alert">{error}</p>}
            {pending.length ? pending.sort((a,b) => recommendation(b).score-recommendation(a).score).slice(0,5).map(x => <div className="record" key={x._id}><label className="inline"><input type="checkbox" aria-label={'Complete '+x.title} checked={false} disabled={mutation.isPending} onChange={() => mutation.mutate({ id:x._id,data:{ status:'completed' } }, { onError:error => setError(message(error)),onSuccess:() => setError('') })}/>
              <span><strong>{x.title}</strong><small className="muted block">{items(courses).find(c => c._id === x.course)?.code} · {displayDate(x.dueAt,zone)} · {x.priority}</small></span></label></div>)
            : <Empty>No pending assignments.<Link to="/app/assignments?add=1">Add an assignment</Link></Empty>}
          </section>
          <section className="panel"><div className="section-heading"><h2>Weekly schedule</h2><Link to="/app/calendar">Calendar</Link></div>{events.length ? events.slice(0,5).map(x => <div className="record" key={x._id}><strong>{x.title}</strong><span>{displayDate(x.start,zone)}</span></div>) : <Empty>No events in the next seven days.</Empty>}</section>
          <section className="panel"><h2>Assignment progress</h2>{items(assignments).length ? <><p>{completed} completed · {pending.length} pending</p><progress aria-label="Assignment progress" value={completed} max={items(assignments).length}/></> : <Empty>Progress appears after you add assignments.</Empty>}</section>
          <section className="panel"><h2>Study activity</h2>{daily.some(x => x.minutes) ? <div className="activity">{daily.map(x => <div key={x.day}><small>{x.day}</small><meter min={0} max={Math.max(...daily.map(d => d.minutes))} value={x.minutes} aria-label={x.day+' study minutes'}/><span>{x.minutes}m</span></div>)}</div> : <Empty>No completed focus sessions in the last seven days.</Empty>}</section>
        </div>
        <section className="panel space"><h2>Quick actions</h2><div className="actions space"><Actions/></div></section>
      </Load>
      {quick && <Dialog title="Quick add" close={() => setQuick(false)}><div className="form"><Actions/></div></Dialog>}
    </Page></>
}


