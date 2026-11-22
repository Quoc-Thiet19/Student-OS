import { DateTime } from 'luxon'
import { classOccurrences, recurringClasses } from './schedule.js'

export function pendingReminders({ prefs,assignments,calendar,courses,semesters }, time = DateTime.now()) {
  const now = time.setZone(prefs.timezone)
  const end = now.plus({ minutes:prefs.reminderMinutes })
  const result = []
  const add = (key,category,title,destination) => result.push({ key,category,title,destination })
  for (const task of assignments) {
    const due = DateTime.fromISO(task.dueAt)
    if (task.status === 'completed' || due > end) continue
    const overdue = due < now
    const category = overdue ? 'overdue' : 'due soon'
    const period = overdue && prefs.frequency === 'daily' ? ':'+now.toISODate() : ''
    add('task:'+task._id+':'+category+':'+task.dueAt+period,category,task.title+(overdue ? ' is overdue' : ' is due soon'),'/app/assignments')
  }
  for (const event of calendar) {
    const start = DateTime.fromISO(event.start)
    if (['exam','class','study'].includes(event.type) && start >= now && start <= end) add('event:'+event._id+':'+event.start,event.type,event.title+' is coming up','/app/calendar')
  }
  for (const entry of classOccurrences(recurringClasses(courses,semesters),now,end)) {
    add(entry._id+':'+entry.start,'class',entry.title+' is coming up','/app/calendar')
  }
  return result
}
export async function reminderId(key) {
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))
  return Array.from(new Uint8Array(bytes),byte => byte.toString(16).padStart(2,'0')).join('')
}

