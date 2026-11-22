import React, { lazy, Suspense } from 'react'
const Dashboard = lazy(() => import('./Dashboard'))
const AuthPage = lazy(() => import('./AuthPage'))
const Courses = lazy(() => import('./Records').then(module => ({ default: module.Courses })))
const CourseDetail = lazy(() => import('./Records').then(module => ({ default: module.CourseDetail })))
const Assignments = lazy(() => import('./Assignments'))
const Grades = lazy(() => import('./Grades'))
const Calendar = lazy(() => import('./Calendar'))
const Focus = lazy(() => import('./Focus'))
const Analytics = lazy(() => import('./Analytics'))
const SettingsPage = lazy(() => import('./Settings'))
import Theme from './Theme'
import Notifications from './Notifications'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LayoutGrid, BookOpen, ListTodo, CalendarDays, GraduationCap, Timer, ChartNoAxesColumn, Settings, LogOut } from 'lucide-react'
import '@fontsource-variable/inter'
import { AuthProvider, useAuth } from './auth'
import { message } from './api'
import './styles.css'
import './workspace.css'

const pages = [
  ['', 'Dashboard', LayoutGrid], ['courses', 'My Courses', BookOpen], ['assignments', 'Assignments', ListTodo],
  ['calendar', 'Calendar', CalendarDays], ['grades', 'Grades', GraduationCap], ['focus', 'Focus Mode', Timer],
  ['analytics', 'Analytics', ChartNoAxesColumn], ['settings', 'Settings', Settings],
]
function Shell() {
  const { user, logout } = useAuth()
  const [error, setError] = React.useState('')
  if (user === undefined) return <main className="center" role="status">Loading your workspace…</main>
  if (!user) return <Navigate to="/login" replace />
  return <div className="shell"><a className="skip-link" href="#main-content">Skip to workspace content</a>
    <aside><Link to="/app" className="brand"><span>S</span>StudentOS</Link>
      <nav aria-label="Workspace">{pages.map(([path, title, Icon]) => <NavLink key={path} to={path ? '/app/' + path : '/app'} end={!path}><Icon size={18}/>{title}</NavLink>)}</nav>
      <button className="logout" onClick={() => logout().catch(error => setError(message(error)))}><LogOut size={18}/> Sign out</button>
    </aside>
    <div className="workspace"><Theme/><header><span>Personal workspace</span><span className="inline"><Notifications/>{user.avatar && <img className="avatar" alt="" src={user.avatar} referrerPolicy="no-referrer"/>}{user.name}</span></header>
      <main id="main-content" className="content" tabIndex={-1}>{error && <p role="alert" className="error">{error}</p>}<Suspense fallback={<div className="skeleton" role="status" aria-label="Loading page"/>}><Outlet /></Suspense></main>
    </div>
  </div>
}
function Landing() {
  return <main className="landing">
    <header><Link to="/" className="brand"><span>S</span>StudentOS</Link><Link to="/login">Sign in</Link></header>
    <section><p className="eyebrow">A personal workspace for students</p><h1>Your semester.<br/>Your schedule.<br/>Your space.</h1>
      <p>Plan assignments, organize courses, and make time for focused study.</p>
      <Link className="primary" to="/register">Create an account</Link>
    </section>
  </main>
}
const query = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30000 } } })
createRoot(document.getElementById('root')).render(<QueryClientProvider client={query}><BrowserRouter><AuthProvider><Suspense fallback={<main className="center" role="status">Loading StudentOS…</main>}><Routes>
  <Route path="/" element={<Landing/>}/>
  {['login', 'register', 'forgot-password', 'reset-password'].map(mode => <Route key={mode} path={mode} element={<AuthPage key={mode} mode={mode}/>}/>)}
  <Route path="/app" element={<Shell/>}><Route index element={<Dashboard/>}/><Route path="courses" element={<Courses/>}/><Route path="courses/:id" element={<CourseDetail/>}/><Route path="assignments" element={<Assignments/>}/><Route path="grades" element={<Grades/>}/><Route path="calendar" element={<Calendar/>}/><Route path="focus" element={<Focus/>}/><Route path="analytics" element={<Analytics/>}/><Route path="settings" element={<SettingsPage/>}/></Route>
  <Route path="*" element={<main className="center"><h1>Page unavailable</h1><Link to="/">Return to StudentOS</Link></main>}/>
</Routes></Suspense></AuthProvider></BrowserRouter></QueryClientProvider>)






