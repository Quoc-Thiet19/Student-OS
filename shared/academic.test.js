import { expect,test } from 'vitest'
import { deadline,recommendation,weightedGrades } from './academic'
import { remainingTime } from './focus'
import { recurringClasses,classOccurrences } from './schedule'
import { DateTime } from 'luxon'

test('normalizes graded weight and evaluates hypothetical scores without changing records',() => {
  const grades = [{ _id:'midterm',weight:70,earned:82,maximum:100,completed:true },{ _id:'final',weight:30,completed:false }]
  expect(weightedGrades(grades,85).current).toBeCloseTo(82)
  expect(weightedGrades(grades,85).required).toBeCloseTo(92)
  expect(weightedGrades(grades,85,{ final:90 }).impossible).toBe(true)
  expect(weightedGrades(grades,85,{ final:95 }).projected).toBeCloseTo(85.9)
  expect(grades[1].earned).toBeUndefined()
})
test('orders overdue work ahead of upcoming tasks and removes completed work',() => {
  const now = Date.parse('2026-09-06T10:00:00Z')
  const task = { dueAt:'2026-09-06T09:00:00Z',priority:'low',estimate:90,status:'in progress' }
  expect(deadline(task,now)).toBe('overdue')
  expect(recommendation(task,now).score).toBeGreaterThan(recommendation({ ...task,dueAt:'2026-09-07T09:00:00Z',priority:'urgent' },now).score)
  expect(recommendation({ ...task,status:'completed' },now).score).toBe(-1)
})
test('uses the local wall clock for recurring classes across daylight saving boundaries',() => {
  const classes = recurringClasses([{ _id:'course',semester:'term',name:'History',code:'HIS',schedule:[{ weekday:1,start:'09:00',end:'10:00' }] }],[{ _id:'term',state:'active',start:'2026-03-01',end:'2026-03-09' }])
  const start = DateTime.fromISO('2026-03-01',{ zone:'America/New_York' })
  const occurrences = classOccurrences(classes,start,start.plus({ days:14 }))
  expect(occurrences.map(x => x.start.slice(0,16))).toEqual(['2026-03-02T14:00','2026-03-09T13:00'])
})
test('keeps paused time fixed and clamps expired timers',() => {
  expect(remainingTime({ remaining:2400 },60000,500000)).toBe(2400)
  expect(remainingTime({ deadline:61500 },60000,60000)).toBe(1500)
  expect(remainingTime({ deadline:61500 },60000,65000)).toBe(0)
})

