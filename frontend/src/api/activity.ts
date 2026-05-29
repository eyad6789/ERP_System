import { api } from './client'

import type { AuditEntry } from './audit'

// A target-scoped slice of the audit ledger: every recorded action against one
// record (e.g. a single personnel file or contract).
export interface ActivityResponse {
  target_type: string
  target_id: string
  count: number
  results: AuditEntry[]
}

export function fetchActivity(targetType: string, targetId: string): Promise<ActivityResponse> {
  const qs = new URLSearchParams({ target_type: targetType, target_id: targetId })
  return api<ActivityResponse>(`/activity?${qs.toString()}`)
}
