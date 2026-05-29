import { api } from './client'

export type IncidentSeverity = 'critical' | 'high' | 'medium'
export type IncidentStatus = 'active' | 'open' | 'closed'

export interface Incident {
  id: number
  title_ar: string
  title_en: string
  severity: IncidentSeverity
  status: IncidentStatus
  reported_date: string | null
  classification: number
  updated_at: string
}

// Create/update payload mirrors the backend write serializer fields.
export interface IncidentInput {
  title_ar: string
  title_en: string
  severity: IncidentSeverity
  status: IncidentStatus
  reported_date: string | null
  classification: number
}

export interface IncidentListParams {
  q?: string
  ordering?: string
}

export function fetchIncidents(params: IncidentListParams = {}): Promise<Incident[]> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.ordering) search.set('ordering', params.ordering)
  const qs = search.toString()
  return api<Incident[]>(`/incidents/${qs ? `?${qs}` : ''}`)
}

export function fetchIncident(id: number): Promise<Incident> {
  return api<Incident>(`/incidents/${id}`)
}

export function createIncident(body: IncidentInput): Promise<Incident> {
  return api<Incident>('/incidents/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateIncident(id: number, body: Partial<IncidentInput>): Promise<Incident> {
  return api<Incident>(`/incidents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function removeIncident(id: number): Promise<void> {
  return api<void>(`/incidents/${id}`, { method: 'DELETE' })
}

export function updateIncidentStatus(id: number, status: IncidentStatus): Promise<Incident> {
  return api<Incident>(`/incidents/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  })
}
