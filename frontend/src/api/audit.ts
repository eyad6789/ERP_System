import { api } from './client'

export type AuditResult = 'GRANTED' | 'DENIED'

export interface AuditEntry {
  id: number
  ts: string
  actor_label: string
  action: string
  target_type: string
  target_id: string
  result: AuditResult
  ip: string | null
  user_agent: string | null
  request_id: string | null
  metadata: Record<string, unknown> | null
}

export interface AuditPage {
  results: AuditEntry[]
  count: number
  page: number
  pages: number
  page_size: number
}

export interface AuditActionCount {
  action: string
  count: number
}

export interface AuditDay {
  date: string
  granted: number
  denied: number
}

export interface AuditActorCount {
  actor: string
  count: number
}

export interface AuditStats {
  total: number
  granted: number
  denied: number
  by_action: AuditActionCount[]
  by_day: AuditDay[]
  top_actors: AuditActorCount[]
}

export interface AuditParams {
  q?: string
  action?: string
  result?: AuditResult | ''
  actor?: string
  target_type?: string
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}

// Map the typed params onto the backend's snake_case query string, dropping
// blanks so an empty filter never narrows the result set.
function buildQuery(params: AuditParams): string {
  const qs = new URLSearchParams()
  const pairs: [string, string | number | undefined][] = [
    ['q', params.q],
    ['action', params.action],
    ['result', params.result],
    ['actor', params.actor],
    ['target_type', params.target_type],
    ['date_from', params.date_from],
    ['date_to', params.date_to],
    ['page', params.page],
    ['page_size', params.page_size],
  ]
  for (const [key, value] of pairs) {
    if (value === undefined || value === null || value === '') continue
    qs.set(key, String(value))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export function fetchAudit(params: AuditParams = {}): Promise<AuditPage> {
  return api<AuditPage>(`/audit${buildQuery(params)}`)
}

export function fetchAuditStats(): Promise<AuditStats> {
  return api<AuditStats>('/audit/stats')
}
