import { api } from './client'

export type ComplianceStatus = 'compliant' | 'non_compliant' | 'in_review'

export interface ComplianceListItem {
  id: number
  title_ar: string
  title_en: string
  standard: string
  status: ComplianceStatus
  finding: string
  classification: number
}

export interface ComplianceDetail extends ComplianceListItem {
  updated_at: string
}

export interface ComplianceWriteBody {
  title_ar: string
  title_en: string
  standard: string
  status: ComplianceStatus
  finding: string
  classification: number
}

export interface ComplianceListParams {
  q?: string
  ordering?: string
}

export function fetchList(params: ComplianceListParams = {}): Promise<ComplianceListItem[]> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.ordering) search.set('ordering', params.ordering)
  const qs = search.toString()
  return api<ComplianceListItem[]>(`/compliance/${qs ? `?${qs}` : ''}`)
}

export function fetchOne(id: number): Promise<ComplianceDetail> {
  return api<ComplianceDetail>(`/compliance/${id}`)
}

export function create(body: ComplianceWriteBody): Promise<ComplianceDetail> {
  return api<ComplianceDetail>('/compliance/', { method: 'POST', body: JSON.stringify(body) })
}

export function update(id: number, body: Partial<ComplianceWriteBody>): Promise<ComplianceDetail> {
  return api<ComplianceDetail>(`/compliance/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function remove(id: number): Promise<void> {
  return api<void>(`/compliance/${id}`, { method: 'DELETE' })
}
