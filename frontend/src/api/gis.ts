import { api } from './client'

export type SiteType = 'facility' | 'unit' | 'asset'

export interface Site {
  id: number
  name_ar: string
  name_en: string
  site_type: SiteType
  lat: number
  lng: number
  info_ar: string
  info_en: string
  classification: number
}

export function fetchSites(): Promise<Site[]> {
  return api<Site[]>('/gis/sites')
}

export function fetchSite(id: number): Promise<Site> {
  return api<Site>(`/gis/sites/${id}`)
}
