import { api } from './client'

// DRF serializes DecimalField as strings, so monetary fields arrive as strings
// on read; the write body sends numbers (the server derives `net` on save).
export interface PayslipListItem {
  id: number
  employee: string
  period: string
  base: string
  allowances: string
  deductions: string
  net: string
  classification: number
}

export interface PayslipDetail extends PayslipListItem {
  updated_at: string
}

export interface PayslipWriteBody {
  employee: string
  period: string
  base: number
  allowances: number
  deductions: number
  classification: number
}

export interface PayslipListParams {
  q?: string
  ordering?: string
}

export function fetchPayslips(params: PayslipListParams = {}): Promise<PayslipListItem[]> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.ordering) search.set('ordering', params.ordering)
  const qs = search.toString()
  return api<PayslipListItem[]>(`/payroll/${qs ? `?${qs}` : ''}`)
}

export function fetchPayslip(id: number): Promise<PayslipDetail> {
  return api<PayslipDetail>(`/payroll/${id}`)
}

export function createPayslip(body: PayslipWriteBody): Promise<PayslipDetail> {
  return api<PayslipDetail>('/payroll/', { method: 'POST', body: JSON.stringify(body) })
}

export function updatePayslip(
  id: number,
  body: Partial<PayslipWriteBody>,
): Promise<PayslipDetail> {
  return api<PayslipDetail>(`/payroll/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function removePayslip(id: number): Promise<void> {
  return api<void>(`/payroll/${id}`, { method: 'DELETE' })
}
