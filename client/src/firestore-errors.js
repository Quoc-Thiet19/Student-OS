export async function firestoreOperation(action, target, operation) {
  try {
    return await operation()
  } catch (error) {
    if (error?.code !== 'permission-denied') throw error
    const [, , collection, document] = target.path.split('/')
    const path = 'users/{uid}/' + collection + (document ? '/' + (collection === 'preferences' ? 'settings' : '{id}') : '')
    throw Object.assign(new Error('Firestore denied ' + action + ' on ' + path + '.', { cause: error }), {
      code: error.code,
      firestoreOperation: { action,path },
    })
  }
}

