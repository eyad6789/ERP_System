import { api } from './client'

export type PerformanceRating = 'outstanding' | 'good' | 'needs_improvement'

export interface PerformanceListItem {
  id: number
  employee: string
  period: string
  score: number
  rating: PerformanceRating
  classification: number
}

export interface PerformanceDetail extends PerformanceListItem {
  notes: string
  updated_at: string
}

export interface PerformanceWriteBody {
  employee: string
  period: string
  score: number
  rating: PerformanceRating
  notes: string
  classification: number
}

export interface PerformanceListParams {
  q?: string
  ordering?: string
}

export function fetchList(params: PerformanceListParams = {}): Promise<PerformanceListItem[]> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.ordering) search.set('ordering', params.ordering)
  const qs = search.toString()
  return api<PerformanceListItem[]>(`/performance/${qs ? `?${qs}` : ''}`)
}

export function fetchOne(id: number): Promise<PerformanceDetail> {
  return api<PerformanceDetail>(`/performance/${id}`)
}

export function create(body: PerformanceWriteBody): Promise<PerformanceDetail> {
  return api<PerformanceDetail>('/performance/', { method: 'POST', body: JSON.stringify(body) })
}

export function update(
  id: number,
  body: Partial<PerformanceWriteBody>,
): Promise<PerformanceDetail> {
  return api<PerformanceDetail>(`/performance/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function remove(id: number): Promise<void> {
  return api<void>(`/performance/${id}`, { method: 'DELETE' })
}
