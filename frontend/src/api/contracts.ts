import { api } from './client'

export type ContractStatus = 'active' | 'expired' | 'renewed'

export interface ContractListItem {
  id: number
  title_ar: string
  title_en: string
  party: string
  value: string
  start_date: string
  end_date: string
  status: ContractStatus
  classification: number
}

export interface ContractDetail extends ContractListItem {
  updated_at: string
}

export interface ContractWriteBody {
  title_ar: string
  title_en: string
  party: string
  value: string
  start_date: string
  end_date: string
  status: ContractStatus
  classification: number
}

export interface ContractListParams {
  q?: string
  ordering?: string
}

export function fetchContracts(params: ContractListParams = {}): Promise<ContractListItem[]> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.ordering) search.set('ordering', params.ordering)
  const qs = search.toString()
  return api<ContractListItem[]>(`/contracts/${qs ? `?${qs}` : ''}`)
}

export function fetchContract(id: number): Promise<ContractDetail> {
  return api<ContractDetail>(`/contracts/${id}`)
}

export function createContract(body: ContractWriteBody): Promise<ContractDetail> {
  return api<ContractDetail>('/contracts/', { method: 'POST', body: JSON.stringify(body) })
}

export function updateContract(
  id: number,
  body: Partial<ContractWriteBody>,
): Promise<ContractDetail> {
  return api<ContractDetail>(`/contracts/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function removeContract(id: number): Promise<void> {
  return api<void>(`/contracts/${id}`, { method: 'DELETE' })
}
