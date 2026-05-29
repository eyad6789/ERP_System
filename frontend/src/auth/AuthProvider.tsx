import { useQuery } from '@tanstack/react-query'
import { createContext, useContext, type ReactNode } from 'react'

import { fetchMe, type Me } from '../api/auth'

interface AuthState {
  me: Me | null
  isLoading: boolean
  can: (module: string) => boolean
  refetch: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    retry: false,
    staleTime: 60_000,
  })

  const me = data ?? null
  const value: AuthState = {
    me,
    isLoading,
    can: (module) => !!me?.modules.includes(module),
    refetch: () => void refetch(),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
