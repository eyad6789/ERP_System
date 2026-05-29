import { api } from './client'

export type PurchaseOrderStatus = 'draft' | 'approved' | 'received' | 'closed'

export interface VendorListItem {
  id: number
  name_ar: string
  name_en: string
  category: string
  rating: number
  classification: number
}

export interface PurchaseOrderListItem {
  id: number
  vendor: number
  vendor_name_ar: string
  vendor_name_en: string
  title_ar: string
  title_en: string
  total: string
  status: PurchaseOrderStatus
  classification: number
}

export interface PurchaseOrderDetail extends PurchaseOrderListItem {
  updated_at: string
}

export interface PurchaseOrderWriteBody {
  vendor: number | ''
  title_ar: string
  title_en: string
  total: string
  status: PurchaseOrderStatus
  classification: number
}

export interface PurchaseOrderListParams {
  q?: string
  ordering?: string
}

export function fetchList(params: PurchaseOrderListParams = {}): Promise<PurchaseOrderListItem[]> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.ordering) search.set('ordering', params.ordering)
  const qs = search.toString()
  return api<PurchaseOrderListItem[]>(`/procurement/${qs ? `?${qs}` : ''}`)
}

export function fetchVendors(): Promise<VendorListItem[]> {
  return api<VendorListItem[]>('/procurement/vendors')
}

export function fetchOne(id: number): Promise<PurchaseOrderDetail> {
  return api<PurchaseOrderDetail>(`/procurement/${id}`)
}

export function create(body: PurchaseOrderWriteBody): Promise<PurchaseOrderDetail> {
  return api<PurchaseOrderDetail>('/procurement/', { method: 'POST', body: JSON.stringify(body) })
}

export function update(
  id: number,
  body: Partial<PurchaseOrderWriteBody>,
): Promise<PurchaseOrderDetail> {
  return api<PurchaseOrderDetail>(`/procurement/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function remove(id: number): Promise<void> {
  return api<void>(`/procurement/${id}`, { method: 'DELETE' })
}
