// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './auth'
import AuthPage from './AuthPage'
vi.mock('./firebase', () => ({ auth:{},configured:false }))

vi.mock('./api', () => ({ api: { post: vi.fn() }, message: vi.fn(), restore: async () => null, setToken: vi.fn() }))
afterEach(cleanup)
function form(mode) {
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><AuthProvider><AuthPage mode={mode}/></AuthProvider></MemoryRouter></QueryClientProvider>)
}
test('validates the login fields',async () => {
  form('login')
  fireEvent.click(screen.getByRole('button',{ name:'Sign in' }))
  expect(await screen.findByText('Enter a valid email address.')).toBeTruthy()
  expect(await screen.findByText('Enter your password.')).toBeTruthy()
})
test('validates password confirmation on registration',async () => {
  form('register')
  fireEvent.change(screen.getByLabelText('Full name'),{ target:{ value:'Taylor Jordan' } })
  fireEvent.change(screen.getByLabelText('Email'),{ target:{ value:'taylor@example.com' } })
  fireEvent.change(screen.getByLabelText(/^Password$/),{ target:{ value:'long-password' } })
  fireEvent.change(screen.getByLabelText('Confirm password'),{ target:{ value:'other-password' } })
  fireEvent.click(screen.getByRole('button',{ name:'Create your account' }))
  expect(await screen.findByText('Passwords must match.')).toBeTruthy()
})


