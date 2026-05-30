import { api } from './client'

export type EventType = 'meeting' | 'deadline' | 'holiday' | 'operation'

export interface EventListItem {
  id: number
  title_ar: string
  title_en: string
  start_at: string
  end_at: string
  event_type: EventType
  location: string
  classification: number
}

export interface EventDetail extends EventListItem {
  updated_at: string
}

export interface EventWriteBody {
  title_ar: string
  title_en: string
  start_at: string
  end_at: string
  event_type: EventType
  location: string
  classification: number
}

export interface EventListParams {
  q?: string
  ordering?: string
}

export function fetchList(params: EventListParams = {}): Promise<EventListItem[]> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.ordering) search.set('ordering', params.ordering)
  const qs = search.toString()
  return api<EventListItem[]>(`/events/${qs ? `?${qs}` : ''}`)
}

export function fetchOne(id: number): Promise<EventDetail> {
  return api<EventDetail>(`/events/${id}`)
}

export function create(body: EventWriteBody): Promise<EventDetail> {
  return api<EventDetail>('/events/', { method: 'POST', body: JSON.stringify(body) })
}

export function update(id: number, body: Partial<EventWriteBody>): Promise<EventDetail> {
  return api<EventDetail>(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function remove(id: number): Promise<void> {
  return api<void>(`/events/${id}`, { method: 'DELETE' })
}
