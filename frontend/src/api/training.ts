import { api } from './client'

export type TrainingStatus = 'upcoming' | 'ongoing' | 'completed'

export interface TrainingListItem {
  id: number
  title_ar: string
  title_en: string
  category: string
  hours: number
  status: TrainingStatus
  classification: number
}

export interface TrainingDetail extends TrainingListItem {
  updated_at: string
}

export interface TrainingWriteBody {
  title_ar: string
  title_en: string
  category: string
  hours: number
  status: TrainingStatus
  classification: number
}

export interface TrainingListParams {
  q?: string
  ordering?: string
}

export function fetchList(params: TrainingListParams = {}): Promise<TrainingListItem[]> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.ordering) search.set('ordering', params.ordering)
  const qs = search.toString()
  return api<TrainingListItem[]>(`/training/${qs ? `?${qs}` : ''}`)
}

export function fetchOne(id: number): Promise<TrainingDetail> {
  return api<TrainingDetail>(`/training/${id}`)
}

export function create(body: TrainingWriteBody): Promise<TrainingDetail> {
  return api<TrainingDetail>('/training/', { method: 'POST', body: JSON.stringify(body) })
}

export function update(id: number, body: Partial<TrainingWriteBody>): Promise<TrainingDetail> {
  return api<TrainingDetail>(`/training/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function remove(id: number): Promise<void> {
  return api<void>(`/training/${id}`, { method: 'DELETE' })
}
