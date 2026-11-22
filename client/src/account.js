import { EmailAuthProvider, confirmPasswordReset, createUserWithEmailAndPassword, deleteUser, reauthenticateWithCredential, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updatePassword, updateProfile, verifyBeforeUpdateEmail } from 'firebase/auth'
import { auth, configured } from './firebase'

export const profile = user => user ? { _id:user.uid, name:user.displayName || user.email.split('@')[0], email:user.email, avatar:user.photoURL || '' } : null
export async function authenticate(mode,values,code) {
  if (!configured) throw new Error('Firebase web configuration is missing.')
  switch (mode) {
    case 'register': {
      const { user } = await createUserWithEmailAndPassword(auth,values.email,values.password)
      await updateProfile(user,{ displayName:values.name })
      return profile(user)
    }
    case 'login': return profile((await signInWithEmailAndPassword(auth,values.email,values.password)).user)
    case 'reset-password': return confirmPasswordReset(auth,code || '',values.password)
    case 'forgot-password':
      try { await sendPasswordResetEmail(auth,values.email) }
      catch (error) { if (error.code !== 'auth/user-not-found') throw error }
  }
}
async function confirm(current) {
  const user = auth.currentUser
  await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,current))
  return user
}
export async function saveProfile({ name, email, avatar, current }) {
  const user = auth.currentUser
  let pendingEmail = false
  if (email.toLowerCase() !== user.email.toLowerCase()) {
    await confirm(current)
    await verifyBeforeUpdateEmail(user,email)
    pendingEmail = true
  }
  if (avatar && new URL(avatar).protocol !== 'https:') throw new Error('Use an HTTPS avatar URL.')
  await updateProfile(user,{ displayName:name.trim(), photoURL:avatar || null })
  return { user:profile(user), pendingEmail }
}
export async function changePassword({ current,password }) {
  await updatePassword(await confirm(current),password)
  await signOut(auth)
}
export async function deleteAccount(current) {
  const user = await confirm(current)
  const { purge } = await import('./firestore')
  await purge(user.uid)
  await deleteUser(user)
}


export async function verifyEmail() {
  const user = auth.currentUser
  await user.reload()
  if (user.emailVerified) return 'This email address is already verified.'
  await sendEmailVerification(user)
  return 'Check your inbox for the verification link.'
}

