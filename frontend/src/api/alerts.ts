import { api } from './client'

// Sovereign command-center alerts (severity-ranked, bilingual messages).
export type AlertSeverity = 'critical' | 'high' | 'info'

export interface Alert {
  severity: AlertSeverity
  module: string
  count: number
  message_ar: string
  message_en: string
}

export interface AlertsResponse {
  alerts: Alert[]
}

export function fetchAlerts(): Promise<AlertsResponse> {
  return api<AlertsResponse>('/alerts')
}
