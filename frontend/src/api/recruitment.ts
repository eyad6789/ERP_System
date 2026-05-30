import { api } from './client'

export type ApplicantStage =
  | 'applied'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'hired'
  | 'rejected'

export interface ApplicantListItem {
  id: number
  name: string
  position: string
  email: string
  stage: ApplicantStage
  classification: number
}

export interface ApplicantDetail extends ApplicantListItem {
  updated_at: string
}

export interface ApplicantWriteBody {
  name: string
  position: string
  email: string
  stage: ApplicantStage
  classification: number
}

export interface ApplicantListParams {
  q?: string
  ordering?: string
}

export function fetchList(params: ApplicantListParams = {}): Promise<ApplicantListItem[]> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.ordering) search.set('ordering', params.ordering)
  const qs = search.toString()
  return api<ApplicantListItem[]>(`/recruitment/${qs ? `?${qs}` : ''}`)
}

export function fetchOne(id: number): Promise<ApplicantDetail> {
  return api<ApplicantDetail>(`/recruitment/${id}`)
}

export function create(body: ApplicantWriteBody): Promise<ApplicantDetail> {
  return api<ApplicantDetail>('/recruitment/', { method: 'POST', body: JSON.stringify(body) })
}

export function update(id: number, body: Partial<ApplicantWriteBody>): Promise<ApplicantDetail> {
  return api<ApplicantDetail>(`/recruitment/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function remove(id: number): Promise<void> {
  return api<void>(`/recruitment/${id}`, { method: 'DELETE' })
}
