import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from './auth'
import { useRecords, useSave } from './data'
import { displayDate } from './dates'
import { Dialog, Empty, items, Load } from './ui'
import { message } from './api'

export default function Notifications({ zone }) {
  const [open,setOpen] = useState(false), [page,setPage] = useState(1), [error,setError] = useState('')
  const unread = useRecords('notifications',{ page:1 },{ refetchInterval:60000 })
  const notices = useRecords('notifications',{ page })
  const count = unread.data?.unread || 0
  const cache = useQueryClient()
  const { user } = useAuth()
  const save = useSave('notifications')
  useEffect(() => {
    let stopped = false
    let busy = false
    async function sync() {
      if (busy || document.hidden) return
      busy = true
      try {
        const { syncReminders } = await import('./firestore')
        if (stopped) return
        await syncReminders(user._id)
        if (!stopped) await cache.invalidateQueries({ queryKey:['notifications'] })
      } catch { /* The notification list provides query errors and retry controls. */ }
      finally { busy = false }
    }
    sync()
    const interval = setInterval(sync,60000)
    return () => { stopped = true; clearInterval(interval) }
  },[user._id,cache])
  const [busy,setBusy] = useState(false)
  async function mark(id) {
    setBusy(true)
    setError('')
    try { await save.mutateAsync({ id,data:{} }) }
    catch (error) { setError(message(error)) }
    finally { setBusy(false) }
  }
  return <><button className="icon" aria-label={count ? 'Notifications, '+count+' unread' : 'Notifications'} onClick={() => setOpen(true)}><Bell size={17}/>{count > 0 && <span>{count}</span>}</button>
    {open && <Dialog title="Notifications" close={() => setOpen(false)}><Load queries={[notices]}>
      {count > 0 && <button className="secondary" disabled={busy} onClick={() => mark('read')}>Mark all read</button>}
      {error && <p className="error" role="alert">{error}</p>}
      {items(notices).length ? items(notices).map(note => <div className="record" key={note._id}><div><Link to={note.destination} onClick={() => { if (!note.readAt) mark(note._id); setOpen(false) }}>{note.title}</Link><p className="muted">{displayDate(note.createdAt,zone)}</p></div>
        {!note.readAt && <button className="secondary" disabled={busy} onClick={() => mark(note._id)}>Mark read</button>}</div>) : <Empty>No reminders yet.</Empty>}
      {notices.data?.total > notices.data.limit && <div className="actions"><button className="secondary" disabled={page === 1} onClick={() => setPage(page-1)}>Previous</button><span>Page {page}</span><button className="secondary" disabled={page*notices.data.limit >= notices.data.total} onClick={() => setPage(page+1)}>Next</button></div>}
    </Load></Dialog>}
  </>
}



