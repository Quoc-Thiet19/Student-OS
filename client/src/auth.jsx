import React, { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { useQueryClient } from '@tanstack/react-query'
import { auth, configured } from './firebase'

const Auth = createContext(null)
export const useAuth = () => useContext(Auth)
export function AuthProvider({ children }) {
  const [user,setUser] = useState(configured ? undefined : null)
  const cache = useQueryClient()
  useEffect(() => {
    if (!configured) return
    return onAuthStateChanged(auth,current => {
      cache.clear()
      setUser(current ? { _id:current.uid,name:current.displayName || current.email.split('@')[0],email:current.email,avatar:current.photoURL || '' } : null)
    })
  },[cache])
  return <Auth.Provider value={{ user,setUser,logout:() => signOut(auth) }}>{children}</Auth.Provider>
}
