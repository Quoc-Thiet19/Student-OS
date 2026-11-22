import { useEffect } from 'react'
import { useRecords } from './data'

export default function Theme() {
  const preferences = useRecords('preferences')
  const theme = preferences.data?.theme || 'system'
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    function apply() { document.documentElement.dataset.theme = theme === 'system' ? media.matches ? 'dark' : 'light' : theme }
    apply()
    media.addEventListener('change',apply)
    return () => { media.removeEventListener('change',apply); delete document.documentElement.dataset.theme }
  },[theme])
  return null
}

