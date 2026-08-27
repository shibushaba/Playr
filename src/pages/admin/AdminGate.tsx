import { LoadingBall } from '@/components/motion/LoadingBall'
import { useAuth } from '@/contexts/AuthContext'
import { checkIsPlayrAdmin } from '@/services/admin'
import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

export function AdminGate() {
  const { user, loading: authLoading } = useAuth()
  const location = useLocation()
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setChecking(false)
      setIsAdmin(false)
      return
    }

    let cancelled = false
    void checkIsPlayrAdmin()
      .then((ok) => {
        if (!cancelled) setIsAdmin(ok)
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })

    return () => {
      cancelled = true
    }
  }, [authLoading, user])

  if (authLoading || checking) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center bg-surface"
        role="status"
        aria-live="polite"
      >
        <LoadingBall size="lg" />
        <span className="sr-only">Checking admin access</span>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface px-6">
        <div className="glass max-w-md rounded-2xl p-8 text-center">
          <p className="label-caps text-status-danger">Access denied</p>
          <h1 className="display-md mt-3">Admin only</h1>
          <p className="mt-3 text-[14px] text-white/55">
            You don&apos;t have permission to access the PLAYR admin portal.
          </p>
        </div>
      </div>
    )
  }

  return <Outlet />
}
