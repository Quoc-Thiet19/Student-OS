import React, { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { message } from './api'
export const EMPTY = []
export const items = query => query.data?.items || EMPTY
export const capitalize = value => value ? value[0].toUpperCase() + value.slice(1) : ''
export function Page({ title, subtitle, action, children }) {
  return <><div className="page-heading"><div><h1>{title}</h1>{subtitle && <p className="muted">{subtitle}</p>}</div>{action}</div>{children}</>
}
export function Add({ children, onClick }) {
  return <button className="primary" type="button" onClick={onClick}><Plus size={17}/>{children}</button>
}
export function Empty({ children, action }) {
  return <div className="empty"><p>{children}</p>{action}</div>
}
export function Load({ queries, children }) {
  const failed = queries.find(query => query.isError)
  if (failed) return <div className="empty"><p role="alert">{message(failed.error)}</p><button className="secondary" onClick={() => failed.refetch()}>Retry</button></div>
  if (queries.some(query => query.isPending)) return <div className="skeleton" role="status" aria-label="Loading workspace data"/>
  return children
}
export function Dialog({ title, close, children }) {
  const ref = useRef(null)
  useEffect(() => { ref.current.showModal() }, [])
  return <dialog ref={ref} aria-labelledby="dialog-title" onCancel={event => { event.preventDefault(); close() }}>
    <div className="dialog-heading"><h2 id="dialog-title">{title}</h2><button type="button" className="icon" aria-label="Close dialog" onClick={close}><X size={20}/></button></div>
    {children}
  </dialog>
}
export function Editor({ title, close, save, children, submit = 'Save changes', protectDraft = false, listChanged = false, discardAction }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [fieldsChanged, setFieldsChanged] = useState(false)
  const saving = useRef(false)
  const dirty = protectDraft && (fieldsChanged || listChanged)
  useEffect(() => {
    if (!dirty) return
    const warn = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload',warn)
    return () => window.removeEventListener('beforeunload',warn)
  }, [dirty])
  function discard(action) {
    if (saving.current || (dirty && !window.confirm('Discard unsaved changes?'))) return
    action()
  }
  async function handle(event) {
    event.preventDefault()
    if (saving.current) return
    saving.current = true
    setBusy(true)
    setError('')
    try { await save(new FormData(event.currentTarget)); close() }
    catch (error) { setError(message(error)); setBusy(false) }
    finally { saving.current = false }
  }
  return <Dialog title={title} close={() => discard(close)}><form className="form" onSubmit={handle} onChange={protectDraft ? () => setFieldsChanged(true) : undefined} aria-busy={busy}>
    <div className="form" inert={busy}>{children}
      {discardAction && <button className="secondary error" type="button" onClick={() => discard(discardAction.run)}>{discardAction.label}</button>}
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="actions"><button type="button" className="secondary" onClick={() => discard(close)} disabled={busy}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : submit}</button></div>
  </form></Dialog>
}
export function Delete({ title, close, remove, children }) {
  return <Editor title={title} close={close} save={remove} submit="Delete">{children}</Editor>
}
export function Field({ label, children, ...props }) {
  return <label>{label}{children || <input {...props}/>}</label>
}
export function Options({ values }) {
  return values.map(value => Array.isArray(value) ? <option key={value[0]} value={value[0]}>{value[1]}</option> : <option key={value} value={value}>{capitalize(value)}</option>)
}


