import React, { useState } from 'react'
import { useAuth } from './auth'
import { message } from './api'
import { saveProfile, changePassword, deleteAccount, verifyEmail } from './account'
import { useQueryClient } from '@tanstack/react-query'
import { useRecords, useSave } from './data'
import { browserZone } from './dates'
import { Editor, Field, items, Load, Options, Page } from './ui'
import { priorities } from '../../shared/academic'

function Section({ title, submit, onSuccess, children }) {
  const [state,setState] = useState({})
  async function save(event) {
    event.preventDefault()
    const form = event.currentTarget
    setState({ busy:true })
    try {
      const response = await submit(new FormData(form))
      setState({ text:response?.pendingEmail ? 'Profile saved. Check your new address to confirm the email change.' : 'Changes saved.' })
      onSuccess?.(response,form)
    } catch (error) { setState({ error:message(error) }) }
  }
  return <section className="panel space"><h2>{title}</h2><form className="form space" onSubmit={save}>{children}
    {state.error && <p role="alert" className="error">{state.error}</p>}
    {state.text && <p role="status">{state.text}</p>}
    <div><button className="primary" disabled={state.busy}>{state.busy ? 'Saving…' : 'Save '+title.toLowerCase()}</button></div>
  </form></section>
}
export default function Settings() {
  const { user,setUser,logout } = useAuth()
  const prefs = useRecords('preferences'), semesters = useRecords('semesters')
  const cache = useQueryClient()
  const save = useSave('preferences')
  const [deleting,setDeleting] = useState(false), [error,setError] = useState('')
  const [verification,setVerification] = useState('')
  async function action(work) {
    setError('')
    try { await work() } catch (error) { setError(message(error)) }
  }
  async function exportData() {
    const { exportData:download } = await import('./firestore')
    const data = await download(user._id,user)
    const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{ type:'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'studentos-data.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url),1000)
  }
  const preferences = prefs.data
  const zones = [...new Set([browserZone,'UTC',...(Intl.supportedValuesOf?.('timeZone') || []),preferences?.timezone].filter(Boolean))].sort()
  function savePreferences(form) {
    const raw = Object.fromEntries(form)
    const gradingScale = raw.gradingScale.split('\n').filter(line => line.trim()).map(line => {
      const [label,min,...extra] = line.split(',')
      if (!label?.trim() || !min?.trim() || extra.length || !Number.isFinite(Number(min)) || Number(min) < 0 || Number(min) > 100) throw new Error('Enter each grade as a label and percentage, such as A,90.')
      return { label:label.trim(),minimum:Number(min) }
    })
    return save.mutateAsync({ data:{ ...raw,gradingScale,semester:raw.semester || null,firstDay:Number(raw.firstDay),
      focus:Number(raw.focus),short:Number(raw.short),long:Number(raw.long),reminderMinutes:Number(raw.reminderMinutes),inApp:form.has('inApp'),email:form.has('email') } })
  }
  return <Page title="Settings" subtitle="Manage your account and academic preferences.">
    <Section title="Profile" submit={form => saveProfile(Object.fromEntries(form))} onSuccess={result => setUser(result.user)}>
      <div className="filters"><Field name="name" label="Full name" defaultValue={user.name} minLength={2} maxLength={100} required/>
      <Field name="email" label="Email" type="email" defaultValue={user.email} required/>
      <Field name="avatar" label="Avatar URL (HTTPS)" type="url" defaultValue={user.avatar}/><Field name="current" type="password" autoComplete="current-password" label="Current password (for email changes)"/></div>
    </Section>
    <Load queries={[prefs,semesters]}>{preferences && <Section title="Preferences" submit={savePreferences} onSuccess={() => cache.invalidateQueries()}>
      <div className="filters">
        <Field label="Appearance"><select name="theme" defaultValue={preferences.theme}><Options values={['light','dark','system']}/></select></Field>
        <Field label="Time zone"><select name="timezone" defaultValue={preferences.timezone}><Options values={zones.map(zone => [zone,zone])}/></select></Field>
        <Field label="First day of week"><select name="firstDay" defaultValue={preferences.firstDay}><Options values={['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((label,index) => [index,label])}/></select></Field>
        <Field label="Default semester"><select name="semester" defaultValue={preferences.semester || ''}><option value="">Use active semester</option><Options values={items(semesters).map(x => [x._id,x.name])}/></select></Field>
        <Field label="Default priority"><select name="priority" defaultValue={preferences.priority}><Options values={priorities}/></select></Field>
      </div>
      <Field label="Grading scale (one label, minimum percentage per line)"><textarea name="gradingScale" placeholder="A,90" defaultValue={preferences.gradingScale.map(x => x.label+','+x.minimum).join('\n')}/></Field>
      <div className="filters">{[['focus','Focus minutes'],['short','Short break minutes'],['long','Long break minutes']].map(([key,label]) => <Field key={key} label={label} name={key} type="number" min={1} max={180} required defaultValue={preferences[key]}/>)}</div>
      <div className="filters"><Field name="reminderMinutes" label="Reminder lead time (minutes)" type="number" min={5} max={10080} required defaultValue={preferences.reminderMinutes}/>
      <Field label="Overdue reminder frequency"><select name="frequency" defaultValue={preferences.frequency}><Options values={[['once','Once'],['daily','Daily']]}/></select></Field></div>
      <label className="inline"><input type="checkbox" name="inApp" defaultChecked={preferences.inApp}/> In-app reminders</label>
      <label className="inline"><input type="checkbox" name="email" defaultChecked={preferences.email}/> Email reminders</label>
      <div><button className="secondary" type="button" onClick={() => action(async () => setVerification(await verifyEmail()))}>Verify email for reminders</button>
        {verification && <p role="status">{verification}</p>}</div>
    </Section>}</Load>
    <Section title="Password" submit={form => changePassword(Object.fromEntries(form))}>
      <div className="filters"><Field label="Current password" type="password" autoComplete="current-password" name="current" required/>
      <Field label="New password" type="password" autoComplete="new-password" name="password" minLength={10} required/></div>
    </Section>
    <section className="panel space"><h2>Account</h2><div className="actions space"><button className="secondary" onClick={() => action(exportData)}>Export personal data</button><button className="secondary" onClick={() => action(logout)}>Sign out</button>
      <button className="secondary error" onClick={() => setDeleting(true)}>Delete account</button></div>{error && <p role="alert" className="error">{error}</p>}</section>
    {deleting && <Editor title="Delete your account?" submit="Permanently delete account" close={() => setDeleting(false)} save={async form => { await deleteAccount(form.get('current')) }}>
      <p>This permanently removes your profile, courses, assignments, grades, calendar, and study history.</p>
      <Field label="Confirm current password" name="current" type="password" autoComplete="current-password" required/>
    </Editor>}
  </Page>
}



