import { api } from './client'

export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'late'

export interface AttendanceListItem {
  id: number
  employee: string
  date: string
  status: AttendanceStatus
  check_in: string
  check_out: string
  classification: number
}

export interface AttendanceDetail extends AttendanceListItem {
  updated_at: string
}

export interface AttendanceWriteBody {
  employee: string
  date: string
  status: AttendanceStatus
  check_in: string
  check_out: string
  classification: number
}

export interface AttendanceListParams {
  q?: string
  ordering?: string
}

export function fetchList(params: AttendanceListParams = {}): Promise<AttendanceListItem[]> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.ordering) search.set('ordering', params.ordering)
  const qs = search.toString()
  return api<AttendanceListItem[]>(`/attendance/${qs ? `?${qs}` : ''}`)
}

export function fetchOne(id: number): Promise<AttendanceDetail> {
  return api<AttendanceDetail>(`/attendance/${id}`)
}

export function create(body: AttendanceWriteBody): Promise<AttendanceDetail> {
  return api<AttendanceDetail>('/attendance/', { method: 'POST', body: JSON.stringify(body) })
}

export function update(id: number, body: Partial<AttendanceWriteBody>): Promise<AttendanceDetail> {
  return api<AttendanceDetail>(`/attendance/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function remove(id: number): Promise<void> {
  return api<void>(`/attendance/${id}`, { method: 'DELETE' })
}
