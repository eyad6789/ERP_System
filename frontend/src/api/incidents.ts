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

export function fetchIncidents(): Promise<Incident[]> {
  return api<Incident[]>('/incidents/')
}

export function fetchIncident(id: number): Promise<Incident> {
  return api<Incident>(`/incidents/${id}`)
}

export function updateIncidentStatus(id: number, status: IncidentStatus): Promise<Incident> {
  return api<Incident>(`/incidents/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  })
}
