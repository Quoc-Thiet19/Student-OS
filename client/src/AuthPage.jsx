import React, { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from './auth'
import { authenticate } from './account'
import { message } from './api'

const email = z.email('Enter a valid email address.')
const pass = z.string().min(10, 'Use at least 10 characters.').refine(value => new TextEncoder().encode(value).length <= 72, 'Use at most 72 bytes.')
const modes = {
  login: ['Sign in', { email, password: z.string().min(1, 'Enter your password.') }],
  register: ['Create your account', { name: z.string().trim().min(2, 'Enter your full name.'), email, password: pass, confirm: z.string() }],
  'forgot-password': ['Reset your password', { email }],
  'reset-password': ['Choose a new password', { password: pass }],
}
const labels = { name: 'Full name', email: 'Email', password: 'Password', confirm: 'Confirm password' }
export default function AuthPage({ mode }) {
  const { user, setUser } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [heading, shape] = modes[mode]
  const schema = z.object(shape).refine(values => !('confirm' in shape) || values.password === values.confirm, { path: ['confirm'], message: 'Passwords must match.' })
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) })
  const [feedback, setFeedback] = useState(null)
  if (user && !isSubmitting && ['register', 'login'].includes(mode)) return <Navigate to="/app" replace />
  async function submit(values) {
    setFeedback(null)
    try {
      const result = await authenticate(mode,values,params.get('oobCode'))
      if (result) { setUser(result); navigate('/app') }
      else if (mode === 'reset-password') navigate('/login')
      else setFeedback({ message:'If the address is registered, a reset link will arrive shortly.' })
    } catch (error) { setFeedback({ message: message(error), error: true }) }
  }
  return <main className="auth-page"><Link to="/" className="brand"><span>S</span>StudentOS</Link>
    <form className="auth-form" onSubmit={handleSubmit(submit)} noValidate>
      <h1>{heading}</h1>
      {Object.keys(shape).map(field => <label key={field}>{labels[field]}
        <input {...register(field)} type={field === 'email' ? 'email' : ['password', 'confirm'].includes(field) ? 'password' : 'text'}
          autoComplete={field === 'name' ? 'name' : field === 'email' ? 'email' : mode === 'login' ? 'current-password' : 'new-password'}
          aria-invalid={!!errors[field]} aria-describedby={errors[field] ? field + '-error' : undefined} />
        {errors[field] && <small className="error" id={field + '-error'}>{errors[field].message}</small>}
      </label>)}
      {feedback && <p role={feedback.error ? 'alert' : 'status'} className={feedback.error ? 'error' : ''}>{feedback.message}</p>}
      <button className="primary" disabled={isSubmitting}>{isSubmitting ? 'Submitting…' : heading}</button>
      {mode === 'login' && <Link to="/forgot-password">Forgot your password?</Link>}
      <Link to={mode === 'login' ? '/register' : '/login'}>{mode === 'login' ? 'Create an account' : 'Back to sign in'}</Link>
    </form>
  </main>
}



