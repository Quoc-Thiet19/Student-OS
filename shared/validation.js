import { z } from 'zod'
import { priorities,statuses } from './academic.js'
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/)
const short = z.string().trim().min(1).max(120)
const text = z.string().max(8000)
const percent = z.number().min(0).max(100)
const date = z.iso.date()
const instant = z.iso.datetime({ offset: true }).transform(value => new Date(value).toISOString())
const clock = z.string().regex(/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/)
export const preferences = z.object({
  theme: z.enum(['light', 'dark', 'system']), timezone: z.string().max(100).refine(value => {
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true } catch { return false }
  }), firstDay: z.number().int().min(0).max(6), semester: id.nullable(),
  gradingScale: z.array(z.object({ label: z.string().trim().min(1).max(20), minimum: percent })).max(30),
  priority: z.enum(priorities), focus: z.number().int().min(1).max(180),
  short: z.number().int().min(1).max(180), long: z.number().int().min(1).max(180),
  inApp: z.boolean(), email: z.boolean(), reminderMinutes: z.number().int().min(5).max(10080),
  frequency: z.enum(['once', 'daily']), 
})
export const schemas = {
  semesters: z.object({ name: short, start: date, end: date, state: z.enum(['planned', 'active', 'archived']) }),
  courses: z.object({
    name: short, code: z.string().trim().min(1).max(30), instructor: z.string().max(120), semester: id,
    color: z.string().regex(/^#[0-9a-f]{6}$/i), room: z.string().max(120), description: text, target: percent,
    schedule: z.array(z.object({ weekday: z.number().int().min(0).max(6), start: clock, end: clock }).refine(row => row.end > row.start, 'Class end must follow its start.')).max(30),
  }),
  assignments: z.object({
    title: short, description: text, course: id, dueAt: instant, priority: z.enum(priorities),
    status: z.enum(statuses), estimate: z.number().int().min(0).max(10080), weight: percent.nullable(),
    checklist: z.array(z.object({ title: short, done: z.boolean() })).max(100),
  }),
  assessments: z.object({
    name: short, course: id, weight: percent, earned: z.number().min(0).nullable(), maximum: z.number().positive().max(100000),
    dueAt: instant.nullable(), completed: z.boolean(),
  }),
  calendar: z.object({
    title: short, course: id.nullable(), type: z.enum(['class', 'exam', 'study', 'personal']), start: instant, end: instant, description: text,
  }),
  'study-sessions': z.object({
    course: id.nullable(), assignment: id.nullable(), start: instant, end: instant,
    seconds: z.number().int().min(1).max(10800), status: z.literal('completed'), key: z.uuid(),
  }),
}
export function verify(key, data) {
  if (['semesters', 'calendar', 'study-sessions'].includes(key) && data.end <= data.start) throw new Error( 'The end must follow the start.')
  if (key === 'assessments' && (data.earned > data.maximum || (data.completed && data.earned == null))) throw new Error( 'Enter a score within the maximum for a completed assessment.')
  if (key === 'study-sessions' && (data.seconds * 1000 > Date.parse(data.end) - Date.parse(data.start) || Date.parse(data.end) > Date.now() + 60000)) throw new Error( 'Focus duration is outside the session interval.')
}

