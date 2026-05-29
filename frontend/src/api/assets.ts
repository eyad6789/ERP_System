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

export function fetchAssets(): Promise<AssetListItem[]> {
  return api<AssetListItem[]>('/assets/')
}

export function fetchAsset(id: number): Promise<AssetDetail> {
  return api<AssetDetail>(`/assets/${id}`)
}
