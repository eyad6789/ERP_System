import { api } from './client'

// Administration suite (sysadmin only). Mirrors the IAM admin_views contract:
// users live under /admin/users(/:id) and roles under /admin/roles(/:id).
// All mutations are POST/PATCH so client.ts attaches CSRF + credentials.

export interface AdminUser {
  id: number
  username: string
  email: string
  full_name_ar: string
  full_name_en: string
  role: number | null
  clearance: number
  department: string
  is_active: boolean
  mfa_enabled: boolean
  date_joined: string
}

export interface Role {
  id: number
  code: string
  name_ar: string
  name_en: string
  modules: string[]
  clearance: number
}

export interface CreateUserBody {
  username: string
  password: string
  role?: number | null
  clearance: number
  department?: string
  full_name_ar?: string
  full_name_en?: string
}

export interface UpdateUserBody {
  role?: number | null
  clearance?: number
  department?: string
  is_active?: boolean
}

export interface CreateRoleBody {
  code: string
  name_ar: string
  name_en: string
  modules: string[]
  clearance: number
}

export interface UpdateRoleBody {
  name_ar?: string
  name_en?: string
  modules?: string[]
  clearance?: number
}

export function fetchUsers(): Promise<AdminUser[]> {
  return api<AdminUser[]>('/admin/users')
}

export function createUser(body: CreateUserBody): Promise<AdminUser> {
  return api<AdminUser>('/admin/users', { method: 'POST', body: JSON.stringify(body) })
}

export function updateUser(id: number, body: UpdateUserBody): Promise<AdminUser> {
  return api<AdminUser>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function fetchRoles(): Promise<Role[]> {
  return api<Role[]>('/admin/roles')
}

export function createRole(body: CreateRoleBody): Promise<Role> {
  return api<Role>('/admin/roles', { method: 'POST', body: JSON.stringify(body) })
}

export function updateRole(id: number, body: UpdateRoleBody): Promise<Role> {
  return api<Role>(`/admin/roles/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}
