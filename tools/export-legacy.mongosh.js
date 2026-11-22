// Execute with mongosh and redirect stdout to a private JSON file.
const source = globalThis.db
const requested = process.env.STUDENTOS_LEGACY_USER_ID
if (!requested || !/^[a-f0-9]{24}$/i.test(requested)) throw new Error('Set STUDENTOS_LEGACY_USER_ID to the source account ID.')
const uid = new globalThis.ObjectId(requested)
const profile = source.users.findOne({ _id:uid },{ _id:1,name:1,email:1,avatar:1 })
if (!profile) throw new Error('Legacy account not found.')
const names = {
  Semester:'semesters',Course:'courses',Assignment:'assignments',Assessment:'assessments',CalendarEvent:'calendarevents',
  StudySession:'studysessions',Notification:'notifications',GradeSnapshot:'gradesnapshots',UserPreferences:'userpreferences',
}
function plain(value) {
  if (value?._bsontype === 'ObjectId') return value.toHexString()
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(plain)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,plain(item)]))
  return value
}
const rows = Object.entries(names).map(([name,collection]) => [name,source.getCollection(collection).find({ user:uid }).toArray()])
globalThis.print(JSON.stringify(plain({ profile,...Object.fromEntries(rows) })))

