import { addDoc, collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, query, runTransaction, setDoc, where, writeBatch } from 'firebase/firestore/lite'
import { DateTime } from 'luxon'
import { app,auth,emulated } from './firebase'
import { firestoreOperation } from './firestore-errors'
import { schemas,preferences,verify } from '../../shared/validation'
import { weightedGrades } from '../../shared/academic'
import { pendingReminders,reminderId } from '../../shared/reminders'

const db = getFirestore(app)
if (emulated) connectFirestoreEmulator(db,'127.0.0.1',8080)
export const resources = [...Object.keys(schemas),'grade-history','notifications','preferences']
const defaults = {
  theme:'system',timezone:'UTC',firstDay:1,semester:null,gradingScale:[],priority:'medium',
  focus:25,short:5,long:15,inApp:true,email:false,reminderMinutes:60,frequency:'daily',
}
const path = (uid,resource) => collection(db,'users',uid,resource)
const ref = (uid,resource,id) => doc(path(uid,resource),id)
const values = snapshot => snapshot.docs.map(row => ({ ...row.data(),_id:row.id }))
const list = async (uid,resource,field,value) => {
  const target = path(uid,resource)
  return values(await firestoreOperation(field ? 'list filtered by ' + field : 'list',target,
    () => getDocs(field ? query(target,where(field,'==',value)) : target)))
}
const get = async (uid,resource,id) => {
  const target = ref(uid,resource,id)
  return (await firestoreOperation('read',target,() => getDoc(target))).data()
}
const prefs = async uid => ({ ...defaults,...await get(uid,'preferences','settings') })
const now = () => new Date().toISOString()
const owns = async uid => {
  await auth.authStateReady()
  if (!uid || auth.currentUser?.uid !== uid) throw new Error('Please sign in.')
}

export async function read(uid,resource,params = {}) {
  await owns(uid)
  if (resource === 'preferences') return prefs(uid)
  if (resource === 'analytics') {
    const [assignments,study,courses,assessments,preferences,{ summarize }] = await Promise.all([
      list(uid,'assignments'),list(uid,'study-sessions'),list(uid,'courses'),list(uid,'assessments'),prefs(uid),import('../../shared/analytics'),
    ])
    return summarize({ assignments,study,courses,assessments,prefs:preferences })
  }
  if (resource === 'notifications') {
    const items = (await list(uid,'notifications','visible',true)).sort((a,b) => b.createdAt.localeCompare(a.createdAt))
    const page = params.page || 1
    return { items:items.slice((page-1)*30,page*30),unread:items.filter(x => !x.readAt).length,total:items.length,page,limit:30 }
  }
  let items = await list(uid,resource,params.course ? 'course' : null,params.course)
  if (resource === 'assignments' && params.semester) {
    const courses = new Set((await list(uid,'courses','semester',params.semester)).map(row => row._id))
    items = items.filter(row => courses.has(row.course))
  }
  const needle = params.q?.trim().toLowerCase()
  items = items.filter(row => (!params.priority || row.priority === params.priority) && (!params.status || row.status === params.status)
    && (!needle || (row.title || row.name || '').toLowerCase().includes(needle)))
  const sort = params.sort || (resource === 'assignments' ? 'dueAt' : resource === 'grade-history' ? '-day' : '-createdAt')
  const desc = sort.startsWith('-')
  const key = desc ? sort.slice(1) : sort
  items.sort((a,b) => ((a[key] || '').localeCompare(b[key] || '') || a._id.localeCompare(b._id)) * (desc ? -1 : 1))
  return { items:resource === 'grade-history' ? items.slice(0,90) : items }
}
function parsed(schema,data) {
  const result = schema.safeParse(data)
  if (!result.success) throw new Error(result.error.issues.map(issue => issue.path.join('.')+' - '+issue.message).join('. '))
  return result.data
}
async function snapshots(uid,course,changes,batch) {
  const [rows,setting] = await Promise.all([list(uid,'assessments','course',course),prefs(uid)])
  const day = DateTime.now().setZone(setting.timezone).toISODate()
  const remaining = rows.filter(x => x._id !== changes.id)
  if (changes.data?.course === course) remaining.push(changes.data)
  const { current } = weightedGrades(remaining,0)
  const target = ref(uid,'grade-history',course+'_'+day)
  if (current == null) batch.delete(target)
  else batch.set(target,{ course,day,grade:current })
}
async function cascade(uid,resource,id,batch) {
  if (resource === 'semesters') {
    if ((await list(uid,'courses','semester',id)).length) throw new Error('Move or delete the semester’s courses first.')
    if ((await prefs(uid)).semester === id) batch.set(ref(uid,'preferences','settings'),{ semester:null },{ merge:true })
  }
  if (resource === 'courses') {
    for (const name of ['assignments','assessments','calendar','grade-history','study-sessions']) {
      for (const row of await list(uid,name,'course',id)) {
        const target = ref(uid,name,row._id)
        if (name === 'study-sessions') batch.update(target,{ course:null,assignment:null })
        else batch.delete(target)
      }
    }
  }
  if (resource === 'assignments') {
    for (const row of await list(uid,'study-sessions','assignment',id)) batch.update(ref(uid,'study-sessions',row._id),{ assignment:null })
  }
}
export async function write(uid,resource,{ id,data,remove }) {
  await owns(uid)
  if (resource === 'preferences') {
    const next = { ...await prefs(uid),...parsed(preferences.partial(),data) }
    await setDoc(ref(uid,resource,'settings'),next)
    return next
  }
  if (resource === 'notifications') {
    const rows = id === 'read' ? (await list(uid,resource,'visible',true)).filter(row => !row.readAt) : [{ _id:id }]
    for (let offset = 0; offset < rows.length; offset += 400) {
      const batch = writeBatch(db)
      for (const row of rows.slice(offset,offset+400)) batch.update(ref(uid,resource,row._id),{ readAt:now() })
      await batch.commit()
    }
    return
  }
  const existing = id && await get(uid,resource,id)
  if (id && !existing) throw new Error('Record unavailable.')
  const batch = writeBatch(db)
  if (remove) {
    await cascade(uid,resource,id,batch)
    if (resource === 'assessments') await snapshots(uid,existing.course,{ id },batch)
    const target = ref(uid,resource,id)
    batch.delete(target)
    return firestoreOperation('delete batch for',target,() => batch.commit())
  }
  const next = parsed(schemas[resource],{ ...existing,...data })
  verify(resource,next)
  for (const [field,name] of [['course','courses'],['semester','semesters'],['assignment','assignments']]) {
    if (!next[field]) continue
    const related = await get(uid,name,next[field])
    if (!related || (field === 'assignment' && related.course !== next.course)) throw new Error('Select an available '+field+'.')
  }
  const stamp = now()
  const value = { ...next,createdAt:existing?.createdAt || stamp,updatedAt:stamp }
  if (resource === 'assignments') value.completedAt = next.status === 'completed' ? existing?.completedAt || stamp : null
  if (resource === 'study-sessions') {
    const target = ref(uid,resource,next.key)
    return runTransaction(db,async tx => { if (!(await tx.get(target)).exists()) tx.set(target,value) })
  }
  if (resource === 'assessments') {
    const target = id ? ref(uid,resource,id) : doc(path(uid,resource))
    batch.set(target,value)
    await snapshots(uid,next.course,{ id:target.id,data:next },batch)
    if (existing && existing.course !== next.course) await snapshots(uid,existing.course,{ id },batch)
    return batch.commit()
  }
  const target = id ? ref(uid,resource,id) : path(uid,resource)
  return firestoreOperation(id ? 'update' : 'create',target,
    () => id ? setDoc(target,value) : addDoc(target,value))
}
export async function exportData(uid,profile) {
  await owns(uid)
  const entries = await Promise.all(resources.map(async name => [name,await list(uid,name)]))
  return { profile,...Object.fromEntries(entries) }
}
export async function purge(uid) {
  await owns(uid)
  for (const name of resources) {
    const rows = await list(uid,name)
    for (let index = 0; index < rows.length; index += 400) {
      const batch = writeBatch(db)
      for (const row of rows.slice(index,index+400)) batch.delete(ref(uid,name,row._id))
      await batch.commit()
    }
  }
}
export async function syncReminders(uid) {
  await owns(uid)
  const saved = await get(uid,'preferences','settings')
  const setting = { ...defaults,...saved }
  if (!saved) {
    const target = ref(uid,'preferences','settings')
    await runTransaction(db,async tx => { if (!(await tx.get(target)).exists()) tx.set(target,defaults) })
  }
  if (!setting.inApp) return
  const [assignments,calendar,courses,semesters,existing] = await Promise.all([
    list(uid,'assignments'),list(uid,'calendar'),list(uid,'courses'),list(uid,'semesters'),list(uid,'notifications'),
  ])
  const keys = new Set(existing.map(row => row.key))
  for (const item of pendingReminders({ prefs:setting,assignments,calendar,courses,semesters })) {
    if (keys.has(item.key)) continue
    const target = ref(uid,'notifications',await reminderId(item.key))
    await runTransaction(db,async tx => {
      if (!(await tx.get(target)).exists()) tx.set(target,{ ...item,visible:true,readAt:null,createdAt:now() })
    })
  }
}



