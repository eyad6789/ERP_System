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

// ---- Cross-module Command Center overview ----

export interface LevelCount {
  level: number
  count: number
}

export interface PersonnelModule {
  total: number
  active: number
  on_mission: number
  by_clearance: LevelCount[]
}

export interface DocumentsModule {
  total: number
  accessible: number
  locked: number
  by_classification: LevelCount[]
}

export interface FinanceModule {
  budget_total: string
  spent: string
  remaining: string
  contracts: number
  under_review: number
  contracts_value_visible: string
}

export interface OperationsModule {
  total: number
  by_status: { status: string; count: number }[]
}

export interface AssetsModule {
  total: number
  by_condition: { condition: string; count: number }[]
}

export interface IncidentsModule {
  total: number
  open: number
  by_severity: { severity: string; count: number }[]
}

export interface GisModule {
  total: number
  by_type: { type: string; count: number }[]
}

export interface OverviewModules {
  personnel?: PersonnelModule
  documents?: DocumentsModule
  finance?: FinanceModule
  operations?: OperationsModule
  assets?: AssetsModule
  incidents?: IncidentsModule
  gis?: GisModule
}

export interface OverviewAlert {
  severity: 'critical' | 'high' | 'info'
  module: string
  count: number
  message_ar: string
  message_en: string
}

export interface Overview {
  kpis: {
    total_users: number
    total_roles: number
    audit_events_7d: number
    denied_7d: number
  }
  clearance_distribution: ClearanceSlice[]
  audit_activity: ActivityPoint[]
  recent_audit?: AuditRow[]
  modules: OverviewModules
  alerts: OverviewAlert[]
}

export function fetchOverview(): Promise<Overview> {
  return api<Overview>('/dashboard/overview')
}
