import { execFile } from 'node:child_process'
import { mkdtemp,rm,writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { deleteApp,initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { expect,test } from 'vitest'

const exec = promisify(execFile)
test('dry-runs and imports legacy data idempotently, rejecting conflicting records',async () => {
  const projectId = 'demo-studentos'
  const environment = { ...process.env,FIREBASE_PROJECT_ID:projectId,FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080' }
  process.env.FIREBASE_AUTH_EMULATOR_HOST = environment.FIREBASE_AUTH_EMULATOR_HOST
  process.env.FIRESTORE_EMULATOR_HOST = environment.FIRESTORE_EMULATOR_HOST
  const app = initializeApp({ projectId },crypto.randomUUID())
  const directory = await mkdtemp(join(tmpdir(),'studentos-import-'))
  try {
    const email = 'import-'+crypto.randomUUID()+'@example.com'
    const user = await getAuth(app).createUser({ email })
    const filename = join(directory,'source.json')
    const term = { _id:'507f1f77bcf86cd799439021',name:'Fall',start:'2026-09-01',end:'2026-12-20',state:'active',createdAt:'2026-08-01T00:00:00.000Z',updatedAt:'2026-08-01T00:00:00.000Z' }
    const input = { profile:{ email,name:'Legacy Student' },Semester:[term] }
    const write = data => writeFile(filename,JSON.stringify(data))
    const run = (...options) => exec(process.execPath,['tools/import-legacy.js',filename,user.uid,...options],{ env:environment })
    const ref = getFirestore(app).doc('users/'+user.uid+'/semesters/'+term._id)
    await write(input)
    await run()
    expect((await ref.get()).exists).toBe(false)
    await run('--apply')
    await run('--apply')
    expect((await ref.get()).data()).toMatchObject({ name:'Fall',state:'active' })
    expect((await getAuth(app).getUser(user.uid)).displayName).toBe('Legacy Student')
    await write({ ...input,Semester:[{ ...term,name:'Conflicting data' }] })
    await expect(run('--apply')).rejects.toThrow(/conflicting record/)
    expect((await ref.get()).data().name).toBe('Fall')
  } finally {
    await rm(directory,{ recursive:true,force:true })
    await deleteApp(app)
  }
},30000)


test('generates unattended in-app reminders once with the standalone worker',async () => {
  const projectId = 'demo-studentos'
  const environment = { ...process.env,FIREBASE_PROJECT_ID:projectId,FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',SMTP_URL:'' }
  process.env.FIREBASE_AUTH_EMULATOR_HOST = environment.FIREBASE_AUTH_EMULATOR_HOST
  process.env.FIRESTORE_EMULATOR_HOST = environment.FIRESTORE_EMULATOR_HOST
  const app = initializeApp({ projectId },crypto.randomUUID())
  try {
    const user = await getAuth(app).createUser({ email:'reminders-'+crypto.randomUUID()+'@example.com' })
    const root = getFirestore(app).collection('users').doc(user.uid)
    await root.collection('preferences').doc('settings').set({ inApp:true,email:false,timezone:'UTC',frequency:'daily',reminderMinutes:60 })
    await root.collection('assignments').doc('task').set({ title:'Check the syllabus',status:'not started',dueAt:new Date(Date.now()+600000).toISOString() })
    const run = () => exec(process.execPath,['tools/reminders.js','--once'],{ env:environment })
    await run()
    await run()
    const notes = await root.collection('notifications').get()
    expect(notes.docs.map(note => note.data().title)).toEqual(['Check the syllabus is due soon'])
  } finally { await deleteApp(app) }
},30000)
