import { api } from './client'

export type LeaveType = 'annual' | 'sick' | 'emergency'
export type LeaveStatus = 'pending' | 'approved' | 'rejected'

export interface LeaveListItem {
  id: number
  employee: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  status: LeaveStatus
  reason: string
  classification: number
}

export interface LeaveDetail extends LeaveListItem {
  updated_at: string
}

export interface LeaveWriteBody {
  employee: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  status: LeaveStatus
  reason: string
  classification: number
}

export interface LeaveListParams {
  q?: string
  ordering?: string
}

export function fetchList(params: LeaveListParams = {}): Promise<LeaveListItem[]> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.ordering) search.set('ordering', params.ordering)
  const qs = search.toString()
  return api<LeaveListItem[]>(`/leave/${qs ? `?${qs}` : ''}`)
}

export function fetchOne(id: number): Promise<LeaveDetail> {
  return api<LeaveDetail>(`/leave/${id}`)
}

export function create(body: LeaveWriteBody): Promise<LeaveDetail> {
  return api<LeaveDetail>('/leave/', { method: 'POST', body: JSON.stringify(body) })
}

export function update(id: number, body: Partial<LeaveWriteBody>): Promise<LeaveDetail> {
  return api<LeaveDetail>(`/leave/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function remove(id: number): Promise<void> {
  return api<void>(`/leave/${id}`, { method: 'DELETE' })
}
