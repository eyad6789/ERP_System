import { api } from './client'

export interface DepartmentSpend {
  department_code: string
  amount: string
}

export interface CategorySpend {
  category: string
  amount: string
}

export interface BudgetSummary {
  fiscal_year: number | null
  currency: string
  total_amount: string
  spent: string
  remaining: string
  by_department: DepartmentSpend[]
  by_category: CategorySpend[]
}

export interface ContractListItem {
  id: number
  classification: number
  locked: boolean
  status: string
  progress: number
  title_ar: string | null
  title_en: string | null
  vendor: string | null
  value: string | null
}

export interface ContractDetail {
  id: number
  title_ar: string
  title_en: string
  vendor: string
  value: string
  progress: number
  status: string
  classification: number
  owner: string | null
  updated_at: string
}

export interface ContractInput {
  title_ar: string
  title_en: string
  vendor: string
  value: string
  progress: number
  status: string
  classification: number
}

export interface ContractListParams {
  q?: string
  ordering?: string
}

export function fetchFinanceSummary(): Promise<BudgetSummary> {
  return api<BudgetSummary>('/finance/summary')
}

export function fetchContracts(params: ContractListParams = {}): Promise<ContractListItem[]> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.ordering) search.set('ordering', params.ordering)
  const qs = search.toString()
  return api<ContractListItem[]>(`/finance/contracts${qs ? `?${qs}` : ''}`)
}

export function fetchContract(id: number): Promise<ContractDetail> {
  return api<ContractDetail>(`/finance/contracts/${id}`)
}

export function createContract(body: ContractInput): Promise<ContractDetail> {
  return api<ContractDetail>('/finance/contracts', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateContract(id: number, body: Partial<ContractInput>): Promise<ContractDetail> {
  return api<ContractDetail>(`/finance/contracts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function removeContract(id: number): Promise<void> {
  return api<void>(`/finance/contracts/${id}`, { method: 'DELETE' })
}

export function advanceContractStatus(id: number): Promise<ContractDetail> {
  return api<ContractDetail>(`/finance/contracts/${id}/status`, { method: 'POST' })
}
