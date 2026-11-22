import { readFile } from 'node:fs/promises'
import { applicationDefault,initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { reminderId } from '../shared/reminders.js'
import { schemas,preferences } from '../shared/validation.js'

const [filename,uid] = process.argv.slice(2)
const projectId = process.env.FIREBASE_PROJECT_ID
if (!filename || !uid || !projectId) throw new Error('Set FIREBASE_PROJECT_ID and pass the legacy export path and destination Firebase UID.')
const data = JSON.parse(await readFile(filename,'utf8'))
const app = initializeApp({ projectId,credential:applicationDefault() })
const auth = getAuth(app)
const db = getFirestore(app)
const user = await auth.getUser(uid)
if (data.profile?.email?.toLowerCase() !== user.email?.toLowerCase()) throw new Error('Source and destination email addresses must match.')
const mapping = { Semester:'semesters',Course:'courses',Assignment:'assignments',Assessment:'assessments',CalendarEvent:'calendar',
  StudySession:'study-sessions',Notification:'notifications',GradeSnapshot:'grade-history',UserPreferences:'preferences' }
const pending = []
for (const [legacy,name] of Object.entries(mapping)) {
  for (const row of data[legacy] || []) {
    let id = row._id
    let value
    if (name === 'preferences') {
      id = 'settings'
      value = preferences.parse({ semester:null,...row })
    } else if (name === 'grade-history') {
      id = row.course+'_'+row.day
      value = { course:row.course,day:row.day,grade:row.grade }
    } else if (name === 'notifications') {
      id = await reminderId(row.key)
      const { key,category,title,destination,visible,delivery,createdAt,readAt = null } = row
      value = { key,category,title,destination,visible,delivery,createdAt,readAt }
    } else {
      if (name === 'study-sessions') id = row.key
      value = { ...schemas[name].parse(row),createdAt:row.createdAt || row.start,updatedAt:row.updatedAt || row.end }
      if (name === 'assignments') value.completedAt = row.completedAt || (row.status === 'completed' ? row.updatedAt : null)
    }
    if (!id || id.includes('/')) throw new Error('Invalid legacy record ID.')
    pending.push([db.doc('users/'+uid+'/'+name+'/'+id),Object.fromEntries(Object.entries(value).filter(([,v]) => v !== undefined))])
  }
}
const counts = {}
for (const [ref] of pending) counts[ref.parent.id] = (counts[ref.parent.id] || 0)+1
console.log('Prepared records:',counts)
if (process.argv.includes('--apply')) {
  for (let index = 0; index < pending.length; index += 400) {
    const rows = pending.slice(index,index+400)
    await db.runTransaction(async transaction => {
      const existing = await transaction.getAll(...rows.map(([ref]) => ref))
      for (const [i,[ref,value]] of rows.entries()) {
        if (existing[i].exists) {
          const saved = existing[i].data()
          if (JSON.stringify(Object.entries(saved).sort()) !== JSON.stringify(Object.entries(value).sort())) throw new Error('Destination contains a conflicting record: '+ref.path)
        } else transaction.create(ref,value)
      }
    })
  }
  if (!user.displayName && data.profile.name) await auth.updateUser(uid,{ displayName:data.profile.name,photoURL:data.profile.avatar || undefined })
  console.log('Imported records verified against source during writes. Keep the source database until the account is checked in StudentOS.')
}

