import { api } from './client'

export interface ClearanceSlice {
  level: number
  count: number
}

export interface ActivityPoint {
  date: string
  granted: number
  denied: number
}

export interface AuditRow {
  ts: string
  actor_label: string
  action: string
  target_type: string
  target_id: string
  result: 'GRANTED' | 'DENIED'
}

export interface DashboardSummary {
  kpis: {
    total_users: number
    total_roles: number
    audit_events_7d: number
    denied_7d: number
  }
  clearance_distribution: ClearanceSlice[]
  audit_activity: ActivityPoint[]
  recent_audit?: AuditRow[]
}

export function fetchDashboard(): Promise<DashboardSummary> {
  return api<DashboardSummary>('/dashboard/summary')
}
