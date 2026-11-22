import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './auth'

export function useRecords(resource, params = {}, options = {}) {
  const uid = useAuth().user?._id
  return useQuery({
    ...options,enabled:!!uid && (options.enabled ?? true),queryKey:[resource,uid,params],
    queryFn:async () => (await import('./firestore')).read(uid,resource,params),
  })
}
export function useSave(resource) {
  const uid = useAuth().user?._id
  const cache = useQueryClient()
  return useMutation({
    mutationFn:async operation => (await import('./firestore')).write(uid,resource,operation),
    onSuccess:() => cache.invalidateQueries({ predicate:query => query.queryKey[1] === uid }),
  })
}


