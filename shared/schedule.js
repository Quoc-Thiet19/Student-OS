import { DateTime } from 'luxon'

export function recurringClasses(courses, semesters) {
  const byId = new Map(semesters.map(row => [row._id,row]))
  return courses.flatMap(course => {
    const semester = byId.get(course.semester)
    if (!semester || semester.state === 'archived') return []
    return course.schedule.map((entry,index) => ({
      id:'class-' + course._id + '-' + index, title:course.code + ' · ' + course.name, course:course._id, color:course.color,
      daysOfWeek:[entry.weekday], startTime:entry.start, endTime:entry.end, startRecur:semester.start,
      endRecur:DateTime.fromISO(semester.end).plus({ days:1 }).toISODate(), editable:false,
    }))
  })
}
export function classOccurrences(classes, start, end) {
  const instances = []
  for (let day = start.startOf('day'); day < end; day = day.plus({ days:1 })) {
    const date = day.toISODate()
    for (const entry of classes) {
      if (!entry.daysOfWeek.includes(day.weekday % 7) || date < entry.startRecur || date >= entry.endRecur) continue
      const time = DateTime.fromISO(date + 'T' + entry.startTime,{ zone:day.zoneName })
      if (time >= start && time < end) instances.push({ _id:entry.id + date,title:entry.title,start:time.toUTC().toISO(),course:entry.course })
    }
  }
  return instances
}

