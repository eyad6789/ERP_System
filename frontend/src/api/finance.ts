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

export function fetchFinanceSummary(): Promise<BudgetSummary> {
  return api<BudgetSummary>('/finance/summary')
}

export function fetchContracts(): Promise<ContractListItem[]> {
  return api<ContractListItem[]>('/finance/contracts')
}

export function fetchContract(id: number): Promise<ContractDetail> {
  return api<ContractDetail>(`/finance/contracts/${id}`)
}
