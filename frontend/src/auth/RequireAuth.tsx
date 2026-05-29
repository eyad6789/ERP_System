import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from './AuthProvider'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { me, isLoading } = useAuth()
  if (isLoading) return null
  if (!me) return <Navigate to="/login" replace />
  return <>{children}</>
}
