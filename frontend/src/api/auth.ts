import { api } from './client'

export interface Me {
  username: string
  full_name_ar: string
  full_name_en: string
  department: string
  clearance: number
  modules: string[]
  role: { code: string; name_ar: string; name_en: string } | null
}

export function fetchMe(): Promise<Me> {
  return api<Me>('/me')
}

export function login(username: string, password: string): Promise<Me> {
  return api<Me>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function logout(): Promise<void> {
  return api<void>('/auth/logout', { method: 'POST' })
}
