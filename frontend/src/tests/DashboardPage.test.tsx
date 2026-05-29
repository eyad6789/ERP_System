import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { DashboardSummary } from '../api/dashboard'
import { DashboardPage } from '../features/dashboard/DashboardPage'

const summary: DashboardSummary = {
  kpis: { total_users: 4, total_roles: 4, audit_events_7d: 12, denied_7d: 3 },
  clearance_distribution: [
    { level: 1, count: 0 },
    { level: 2, count: 2 },
    { level: 3, count: 1 },
    { level: 4, count: 1 },
  ],
  audit_activity: Array.from({ length: 7 }, (_, i) => ({
    date: `2026-05-2${i}`,
    granted: i,
    denied: 0,
  })),
  recent_audit: [
    { ts: '2026-05-29T17:01:47Z', actor_label: 'hr1', action: 'open_module', target_type: 'audit', target_id: '', result: 'DENIED' },
  ],
}

function renderDashboard() {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(summary), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <DashboardPage />
    </QueryClientProvider>,
  )
}

describe('DashboardPage', () => {
  it('renders KPIs and the gated recent-audit feed from the summary', async () => {
    renderDashboard()
    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument()) // events 7d (unique)
    expect(screen.getAllByText('4').length).toBeGreaterThan(0) // total users + roles KPIs
    // recent audit feed present => shows the DENIED chip
    expect(screen.getByText('DENIED')).toBeInTheDocument()
  })
})
