import { readFileSync } from 'node:fs'
import { afterAll,beforeAll,expect,test } from 'vitest'
import { assertFails,assertSucceeds,initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { initializeApp,deleteApp } from 'firebase/app'
import { connectAuthEmulator,confirmPasswordReset,createUserWithEmailAndPassword,getAuth,sendPasswordResetEmail,signInWithEmailAndPassword,signOut } from 'firebase/auth'
import { collection,deleteDoc,doc,getDoc,getDocs,query,setDoc,updateDoc,where } from 'firebase/firestore'
import { pendingReminders,reminderId } from '../shared/reminders'
import { DateTime } from 'luxon'

const projectId = 'demo-studentos'
const stamp = '2026-11-21T20:00:00.000Z'
const timestamps = { createdAt:stamp,updatedAt:stamp }
let env
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId,firestore:{ host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8') } })
})
afterAll(async () => env?.cleanup())
test('enforces Firebase ownership and validates writes and references',async () => {
  const uid = 'academic-'+crypto.randomUUID()
  const alice = env.authenticatedContext(uid).firestore(), bob = env.authenticatedContext('bob').firestore()
  const visitor = env.unauthenticatedContext().firestore()
  const refs = (db,kind,id) => doc(db,'users',uid,kind,id)
  const semester = { name:'Fall',start:'2026-08-01',end:'2026-12-01',state:'active',...timestamps }
  await assertFails(setDoc(refs(alice,'semesters','bad'),{ ...semester,end:semester.start }))
  await assertSucceeds(setDoc(refs(alice,'semesters','term'),semester))
  const course = { name:'History',code:'HIS',instructor:'',semester:'term',color:'#2563eb',room:'',description:'',target:85,schedule:[],...timestamps }
  await assertFails(setDoc(doc(bob,'users','bob','courses','course'),course))
  await assertSucceeds(setDoc(refs(alice,'courses','course'),course))
  await assertFails(getDoc(refs(bob,'courses','course')))
  await assertFails(getDoc(refs(visitor,'courses','course')))
  await assertFails(getDocs(query(collection(bob,'users',uid,'courses'),where('code','==','HIS'))))
  await assertFails(updateDoc(refs(bob,'courses','course'),{ target:90 }))
  await assertFails(updateDoc(refs(alice,'courses','course'),{ user:'bob' }))
  const task = { title:'Essay',description:'',course:'course',dueAt:stamp,priority:'medium',status:'not started',estimate:60,weight:null,checklist:[],completedAt:null,...timestamps }
  await assertFails(setDoc(refs(alice,'assignments','essay'),{ ...task,priority:'invalid' }))
  await assertSucceeds(setDoc(refs(alice,'assignments','essay'),task))
  const assignment = refs(alice,'assignments','essay')
  const ownedAssignments = collection(alice,'users',uid,'assignments')
  await assertSucceeds(getDocs(collection(alice,'users',uid,'courses')))
  await assertSucceeds(getDocs(collection(alice,'users',uid,'semesters')))
  await assertSucceeds(getDoc(refs(alice,'preferences','settings')))
  expect((await assertSucceeds(getDocs(ownedAssignments))).size).toBe(1)
  expect((await assertSucceeds(getDocs(query(ownedAssignments,where('course','==','course'))))).size).toBe(1)
  await assertSucceeds(getDocs(query(collection(alice,'users',uid,'courses'),where('semester','==','term'))))
  await assertFails(getDocs(collection(bob,'users',uid,'assignments')))
  await assertFails(getDoc(refs(bob,'assignments','essay')))
  await assertFails(updateDoc(refs(bob,'assignments','essay'),{ title:'Unauthorized' }))
  await assertFails(deleteDoc(refs(bob,'assignments','essay')))
  await assertFails(setDoc(assignment,{ ...task,course:'unknown' }))
  await assertSucceeds(updateDoc(assignment,{ title:'Revised essay' }))
  await assertSucceeds(updateDoc(assignment,{ status:'completed',completedAt:stamp }))
  expect((await assertSucceeds(getDoc(assignment))).data()).toMatchObject({ title:'Revised essay',status:'completed' })
  await assertSucceeds(getDocs(query(collection(alice,'users',uid,'study-sessions'),where('assignment','==','essay'))))
  await assertSucceeds(deleteDoc(assignment))
  expect((await assertSucceeds(getDoc(assignment))).exists()).toBe(false)
  await assertSucceeds(setDoc(refs(alice,'grade-history','course_2026-11-21'),{ course:'course',day:'2026-11-21',grade:82 }))
  await assertFails(getDoc(refs(bob,'grade-history','course_2026-11-21')))
},20000)
test('registers, signs in and consumes a Firebase password reset code once',async () => {
  const app = initializeApp({ projectId,apiKey:'demo-studentos-key' },crypto.randomUUID())
  try {
    const auth = getAuth(app)
    const email = 'test-'+crypto.randomUUID()+'@example.com'
    const old = 'studentos-password-1', next = 'studentos-password-2'
    connectAuthEmulator(auth,'http://127.0.0.1:9099',{ disableWarnings:true })
    const { user } = await createUserWithEmailAndPassword(auth,email,old)
    await signOut(auth)
    expect((await signInWithEmailAndPassword(auth,email,old)).user.uid).toBe(user.uid)
    await signOut(auth)
    await sendPasswordResetEmail(auth,email)
    const response = await fetch('http://127.0.0.1:9099/emulator/v1/projects/'+projectId+'/oobCodes')
    const { oobCodes } = await response.json()
    const { oobCode } = oobCodes.find(x => x.email === email)
    await confirmPasswordReset(auth,oobCode,next)
    await expect(confirmPasswordReset(auth,oobCode,next)).rejects.toMatchObject({ code:'auth/invalid-action-code' })
    await expect(signInWithEmailAndPassword(auth,email,old)).rejects.toBeTruthy()
    expect((await signInWithEmailAndPassword(auth,email,next)).user.uid).toBe(user.uid)
  } finally { await deleteApp(app) }
},20000)
test('persists a deduplicated notification with owner-only read status',async () => {
  const time = DateTime.fromISO(stamp)
  const prefs = { timezone:'UTC',frequency:'daily',reminderMinutes:60 }
  const pending = pendingReminders({ prefs,assignments:[{ _id:'essay',title:'Essay',status:'not started',dueAt:'2026-11-21T20:30:00.000Z' }],calendar:[],courses:[],semesters:[] },time)
  const owner = 'notify-'+crypto.randomUUID()
  const alice = env.authenticatedContext(owner).firestore(), bob = env.authenticatedContext('bob').firestore()
  expect(pending).toHaveLength(1)
  const id = await reminderId(pending[0].key)
  const ref = doc(alice,'users',owner,'notifications',id)
  const value = { ...pending[0],visible:true,readAt:null,createdAt:stamp }
  await assertSucceeds(setDoc(ref,value))
  await assertFails(updateDoc(ref,{ delivery:'sent' }))
  await assertFails(getDoc(doc(bob,'users',owner,'notifications',id)))
  await assertSucceeds(updateDoc(ref,{ readAt:stamp }))
  await assertFails(setDoc(ref,value))
},20000)



