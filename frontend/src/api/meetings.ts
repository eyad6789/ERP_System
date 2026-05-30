import { api } from './client'

export type MeetingStatus = 'scheduled' | 'done' | 'cancelled'

export interface MeetingListItem {
  id: number
  title_ar: string
  title_en: string
  start_at: string
  end_at: string
  location: string
  status: MeetingStatus
  classification: number
}

export interface MeetingDetail extends MeetingListItem {
  updated_at: string
}

export interface MeetingWriteBody {
  title_ar: string
  title_en: string
  start_at: string
  end_at: string
  location: string
  status: MeetingStatus
  classification: number
}

export interface MeetingListParams {
  q?: string
  ordering?: string
}

export function fetchList(params: MeetingListParams = {}): Promise<MeetingListItem[]> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.ordering) search.set('ordering', params.ordering)
  const qs = search.toString()
  return api<MeetingListItem[]>(`/meetings/${qs ? `?${qs}` : ''}`)
}

export function fetchOne(id: number): Promise<MeetingDetail> {
  return api<MeetingDetail>(`/meetings/${id}`)
}

export function create(body: MeetingWriteBody): Promise<MeetingDetail> {
  return api<MeetingDetail>('/meetings/', { method: 'POST', body: JSON.stringify(body) })
}

export function update(id: number, body: Partial<MeetingWriteBody>): Promise<MeetingDetail> {
  return api<MeetingDetail>(`/meetings/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function remove(id: number): Promise<void> {
  return api<void>(`/meetings/${id}`, { method: 'DELETE' })
}
