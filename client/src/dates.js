import { DateTime } from 'luxon'
export const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone
export const displayDate = (value, zone = browserZone, options = { dateStyle: 'medium', timeStyle: 'short' }) =>
  new Intl.DateTimeFormat(undefined, { ...options, timeZone: zone }).format(new Date(value))
export const localValue = (value, zone = browserZone) => value ? DateTime.fromISO(value, { zone }).toFormat("yyyy-MM-dd'T'HH:mm") : ''
export function isoValue(value, zone = browserZone) {
  if (!value) return null
  const date = DateTime.fromISO(value, { zone })
  if (!date.isValid || date.toFormat("yyyy-MM-dd'T'HH:mm") !== value) throw new Error('Choose a valid local date and time.')
  return date.toUTC().toISO()
}

