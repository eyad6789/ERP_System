import { api } from './client'

export interface InventoryListItem {
  id: number
  sku: string
  name_ar: string
  name_en: string
  quantity: number
  unit: string
  warehouse: string
  classification: number
}

export interface InventoryDetail extends InventoryListItem {
  updated_at: string
}

export interface InventoryWriteBody {
  sku: string
  name_ar: string
  name_en: string
  quantity: number
  unit: string
  warehouse: string
  classification: number
}

export interface InventoryListParams {
  q?: string
  ordering?: string
}

export function fetchInventory(params: InventoryListParams = {}): Promise<InventoryListItem[]> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.ordering) search.set('ordering', params.ordering)
  const qs = search.toString()
  return api<InventoryListItem[]>(`/inventory/${qs ? `?${qs}` : ''}`)
}

export function fetchInventoryItem(id: number): Promise<InventoryDetail> {
  return api<InventoryDetail>(`/inventory/${id}`)
}

export function createInventoryItem(body: InventoryWriteBody): Promise<InventoryDetail> {
  return api<InventoryDetail>('/inventory/', { method: 'POST', body: JSON.stringify(body) })
}

export function updateInventoryItem(
  id: number,
  body: Partial<InventoryWriteBody>,
): Promise<InventoryDetail> {
  return api<InventoryDetail>(`/inventory/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function removeInventoryItem(id: number): Promise<void> {
  return api<void>(`/inventory/${id}`, { method: 'DELETE' })
}
