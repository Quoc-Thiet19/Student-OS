import { applicationDefault,initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import nodemailer from 'nodemailer'
import { pendingReminders,reminderId } from '../shared/reminders.js'

const projectId = process.env.FIREBASE_PROJECT_ID
const smtp = process.env.SMTP_URL
const sender = process.env.MAIL_FROM
const site = process.env.STUDENTOS_URL
if (!projectId) throw new Error('Set FIREBASE_PROJECT_ID.')
if (smtp && (!sender || !site || new URL(site).protocol !== 'https:')) throw new Error('Set MAIL_FROM and HTTPS STUDENTOS_URL for SMTP delivery.')
const app = initializeApp({ projectId,credential:applicationDefault() })
const db = getFirestore(app)
const transport = smtp ? nodemailer.createTransport(smtp) : null
const budget = Number(process.env.MAIL_PER_MINUTE || 10)
let running = false
async function tick() {
  if (running) return
  running = true
  let sent = 0
  try {
    const enabled = [db.collectionGroup('preferences').where('inApp','==',true).get()]
    if (transport) enabled.push(db.collectionGroup('preferences').where('email','==',true).get())
    const settings = new Map((await Promise.all(enabled)).flatMap(result => result.docs).map(setting => [setting.ref.path,setting]))
    for (const setting of settings.values()) {
      const prefs = setting.data()
      const root = setting.ref.parent.parent
      if (root.parent.id !== 'users' || root.path.split('/').length !== 2 || setting.id !== 'settings') continue
      const user = await getAuth(app).getUser(root.id).catch(error => {
        if (error.code !== 'auth/user-not-found') throw error
      })
      if (!user || user.disabled) continue
      const address = transport && prefs.email && user.emailVerified ? user.email : null
      if (!prefs.inApp && !address) continue
      const lists = await Promise.all(['assignments','calendar','courses','semesters'].map(async name =>
        (await root.collection(name).get()).docs.map(row => ({ ...row.data(),_id:row.id }))))
      const [assignments,calendar,courses,semesters] = lists
      for (const note of pendingReminders({ prefs,assignments,calendar,courses,semesters })) {
        const target = root.collection('notifications').doc(await reminderId(note.key))
        const claimed = await db.runTransaction(async transaction => {
          const row = await transaction.get(target)
          const previous = row.data()
          const send = address && sent < budget && !['sending','sent','unknown'].includes(previous?.delivery)
          if (send) {
            transaction.set(target,{ ...note,visible:prefs.inApp,createdAt:new Date().toISOString(),readAt:null,...previous,delivery:'sending' })
          } else if (!row.exists && prefs.inApp) {
            transaction.create(target,{ ...note,visible:true,createdAt:new Date().toISOString(),readAt:null })
          }
          return !!send
        })
        if (!claimed) continue
        sent++
        let delivery = 'unknown'
        try {
          await transport.sendMail({ from:sender,to:address,subject:'StudentOS reminder',text:note.title+'\n\n'+new URL(note.destination,site) })
          delivery = 'sent'
        } catch (error) {
          console.error('Reminder delivery failed:',error.code || error.name)
        } finally { await target.update({ delivery }) }
      }
    }
  } catch (error) { console.error('Reminder cycle failed:',error.code || error.name); if (process.argv.includes('--once')) process.exitCode = 1 }
  finally { running = false }
}
await tick()
if (!process.argv.includes('--once')) setInterval(tick,60000)

