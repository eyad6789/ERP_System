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

// Write payload for create/update (no id; mirrors the backend SiteWriteSerializer).
export type SiteInput = Omit<Site, 'id'>

export interface SiteListParams {
  q?: string
  ordering?: string
}

export function fetchSites(params: SiteListParams = {}): Promise<Site[]> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.ordering) search.set('ordering', params.ordering)
  const qs = search.toString()
  return api<Site[]>(`/gis/sites${qs ? `?${qs}` : ''}`)
}

export function fetchSite(id: number): Promise<Site> {
  return api<Site>(`/gis/sites/${id}`)
}

export function createSite(body: SiteInput): Promise<Site> {
  return api<Site>('/gis/sites', { method: 'POST', body: JSON.stringify(body) })
}

export function updateSite(id: number, body: Partial<SiteInput>): Promise<Site> {
  return api<Site>(`/gis/sites/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function removeSite(id: number): Promise<void> {
  return api<void>(`/gis/sites/${id}`, { method: 'DELETE' })
}
