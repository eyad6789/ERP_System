import { api } from './client'

export type AssetCondition = 'operational' | 'maintenance' | 'down'

export interface AssetListItem {
  id: number
  name_ar: string
  name_en: string
  asset_type: string
  location: string
  condition: AssetCondition
  classification: number
}

export interface AssetDetail extends AssetListItem {
  updated_at: string
}

export interface AssetWriteBody {
  name_ar: string
  name_en: string
  asset_type: string
  location: string
  condition: AssetCondition
  classification: number
}

export interface AssetListParams {
  q?: string
  ordering?: string
}

export function fetchAssets(params: AssetListParams = {}): Promise<AssetListItem[]> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.ordering) search.set('ordering', params.ordering)
  const qs = search.toString()
  return api<AssetListItem[]>(`/assets/${qs ? `?${qs}` : ''}`)
}

export function fetchAsset(id: number): Promise<AssetDetail> {
  return api<AssetDetail>(`/assets/${id}`)
}

export function createAsset(body: AssetWriteBody): Promise<AssetDetail> {
  return api<AssetDetail>('/assets/', { method: 'POST', body: JSON.stringify(body) })
}

export function updateAsset(id: number, body: Partial<AssetWriteBody>): Promise<AssetDetail> {
  return api<AssetDetail>(`/assets/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function removeAsset(id: number): Promise<void> {
  return api<void>(`/assets/${id}`, { method: 'DELETE' })
}
