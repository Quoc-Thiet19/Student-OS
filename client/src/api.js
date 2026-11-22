const errors = {
  'auth/invalid-credential':'Email or password is incorrect.',
  'auth/wrong-password':'Email or password is incorrect.',
  'auth/email-already-in-use':'An account already uses this email address.',
  'auth/invalid-action-code':'This link is invalid or has expired.',
  'auth/expired-action-code':'This link is invalid or has expired.',
  'auth/too-many-requests':'Too many attempts. Please try again later.',
  'auth/network-request-failed':'Could not connect. Please try again.',
  'permission-denied':'You do not have permission to access this record.',
  unavailable:'Could not connect. Please try again.',
}
export function message(error) {
  if (error?.code === 'permission-denied' && error.firestoreOperation) return error.message
  return errors[error?.code] || (error?.code ? 'Could not complete the request. Please try again.' : error?.message) || 'Could not complete the request.'
}


