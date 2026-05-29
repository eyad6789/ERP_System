import { api } from './client'

export type RiskStatus = 'open' | 'mitigating' | 'closed'

export interface RiskListItem {
  id: number
  title_ar: string
  title_en: string
  likelihood: number
  impact: number
  score: number
  status: RiskStatus
  classification: number
}

export interface RiskDetail extends RiskListItem {
  mitigation: string
  updated_at: string
}

export interface RiskWriteBody {
  title_ar: string
  title_en: string
  likelihood: number
  impact: number
  status: RiskStatus
  mitigation: string
  classification: number
}

export interface RiskListParams {
  q?: string
  ordering?: string
}

export function fetchRisks(params: RiskListParams = {}): Promise<RiskListItem[]> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.ordering) search.set('ordering', params.ordering)
  const qs = search.toString()
  return api<RiskListItem[]>(`/risk/${qs ? `?${qs}` : ''}`)
}

export function fetchRisk(id: number): Promise<RiskDetail> {
  return api<RiskDetail>(`/risk/${id}`)
}

export function createRisk(body: RiskWriteBody): Promise<RiskDetail> {
  return api<RiskDetail>('/risk/', { method: 'POST', body: JSON.stringify(body) })
}

export function updateRisk(id: number, body: Partial<RiskWriteBody>): Promise<RiskDetail> {
  return api<RiskDetail>(`/risk/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function removeRisk(id: number): Promise<void> {
  return api<void>(`/risk/${id}`, { method: 'DELETE' })
}
