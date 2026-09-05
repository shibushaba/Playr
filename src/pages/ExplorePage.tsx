import { Navigate, useSearchParams } from 'react-router-dom'

/** Explore is merged into Play. Keep this route so old links still work. */
export function ExplorePage() {
  const [params] = useSearchParams()
  const q = params.get('q')?.trim()
  const next = q
    ? `/home?search=1&q=${encodeURIComponent(q)}`
    : '/home?search=1'
  return <Navigate to={next} replace />
}
