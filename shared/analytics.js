import { DateTime } from 'luxon'
import { deadline,weightedGrades } from './academic.js'
export function summarize({ assignments,study,courses,assessments,prefs }) {
  const now = DateTime.now().setZone(prefs.timezone)
  const first = now.startOf('day').minus({ days:27 })
  const groups = new Map()
  for (const row of study) groups.set(row.course,(groups.get(row.course) || 0)+row.seconds)
  const allStudy = [...groups].map(([_id,seconds]) => ({ _id,seconds }))
  const completed = assignments.filter(x => x.status === 'completed').length
  const overdue = assignments.filter(x => deadline(x) === 'overdue').length
  const dayOf = date => DateTime.fromISO(date,{ zone:now.zoneName }).toISODate()
  const days = Array.from({ length:28 },(_,index) => {
    const date = first.plus({ days:index })
    const key = date.toISODate()
    const sessions = study.filter(x => dayOf(x.end) === key)
    return { date:key,label:date.toFormat('MMM d'),hours:Number((sessions.reduce((sum,x) => sum+x.seconds,0)/3600).toFixed(3)),sessions:sessions.length,
      completed:assignments.filter(x => x.status === 'completed' && x.completedAt && dayOf(x.completedAt) === key).length }
  })
  const upcoming = Array.from({ length:7 },(_,index) => {
    const date = now.plus({ days:index })
    const tasks = assignments.filter(x => x.status !== 'completed' && Date.parse(x.dueAt) >= now.toMillis() && dayOf(x.dueAt) === date.toISODate())
    return { label:date.toFormat('MMM d'),deadlines:tasks.length,high:tasks.filter(x => ['high','urgent'].includes(x.priority)).length }
  })
  const performance = courses.map(course => {
    const list = assessments.filter(x => String(x.course) === String(course._id))
    return { id:course._id,label:course.code,name:course.name,target:course.target,current:weightedGrades(list,course.target).current,assessments:list }
  })
  const byCourse = allStudy.map(x => ({ id:String(x._id),label:courses.find(course => String(course._id) === String(x._id))?.code || 'Unassigned',hours:x.seconds/3600 }))
  const weeks = Array.from({ length:4 },(_,index) => {
    const interval = days.slice(index*7,index*7+7)
    return { label:interval[0].label,hours:Number(interval.reduce((sum,x) => sum+x.hours,0).toFixed(2)),completed:interval.reduce((sum,x) => sum+x.completed,0),days:interval.filter(x => x.sessions).length }
  })
  return { completed,overdue,pending:assignments.length-completed,rate:assignments.length ? completed/assignments.length*100 : null,days,upcoming,performance,byCourse,weeks }
}



