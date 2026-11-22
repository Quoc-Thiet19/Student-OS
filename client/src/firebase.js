import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'

const env = import.meta.env
export const emulated = env.DEV && env.VITE_FIREBASE_EMULATORS === 'true'
const projectId = emulated ? 'demo-studentos' : env.VITE_FIREBASE_PROJECT_ID || 'studentos-4b78c'
const apiKey = emulated ? 'demo-studentos-key' : env.VITE_FIREBASE_API_KEY
export const app = initializeApp({
  projectId, apiKey: apiKey || 'missing-firebase-web-key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || projectId + '.firebaseapp.com',
  appId: env.VITE_FIREBASE_APP_ID,
})
export const auth = getAuth(app)
export const configured = !!apiKey
if (emulated) connectAuthEmulator(auth,'http://127.0.0.1:9099',{ disableWarnings:true })

