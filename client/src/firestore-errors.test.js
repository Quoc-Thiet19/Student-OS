import { expect,test } from 'vitest'
import { firestoreOperation } from './firestore-errors'
import { message } from './api'

test('reports the denied Firestore operation without exposing the UID or record ID',async () => {
  const cause = Object.assign(new Error('permission denied'),{ code:'permission-denied' })
  const error = await firestoreOperation('read',{ path:'users/private-user/assignments/private-record' },() => Promise.reject(cause)).catch(error => error)
  expect(error.cause).toBe(cause)
  expect(message(error)).toBe('Firestore denied read on users/{uid}/assignments/{id}.')
})
test('preserves other errors and successful results',async () => {
  const target = { path:'users/user/assignments' }
  const error = Object.assign(new Error('offline'),{ code:'unavailable' })
  await expect(firestoreOperation('list',target,() => Promise.reject(error))).rejects.toBe(error)
  await expect(firestoreOperation('list',target,() => Promise.resolve([]))).resolves.toEqual([])
})

