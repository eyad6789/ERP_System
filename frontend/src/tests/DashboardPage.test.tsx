import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { Overview } from '../api/dashboard'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import i18n from '../i18n'

const overview: Overview = {
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
    {
      ts: '2026-05-29T17:01:47Z',
      actor_label: 'hr1',
      action: 'open_module',
      target_type: 'audit',
      target_id: '',
      result: 'DENIED',
    },
  ],
  modules: {
    personnel: {
      total: 137,
      active: 120,
      on_mission: 9,
      by_clearance: [
        { level: 1, count: 40 },
        { level: 2, count: 60 },
        { level: 3, count: 25 },
        { level: 4, count: 12 },
      ],
    },
    incidents: {
      total: 18,
      open: 5,
      by_severity: [
        { severity: 'high', count: 2 },
        { severity: 'low', count: 3 },
      ],
    },
  },
  alerts: [
    {
      severity: 'critical',
      module: 'incidents',
      count: 2,
      message_ar: 'حوادث حرجة مفتوحة',
      message_en: 'Critical incidents open',
    },
  ],
}

function renderDashboard() {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(overview), {
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
  beforeAll(async () => {
    await i18n.changeLanguage('en')
  })

  it('renders cross-module KPIs, the alert strip, and the gated DENIED feed', async () => {
    renderDashboard()
    // personnel headcount KPI value
    await waitFor(() => expect(screen.getByText('137')).toBeInTheDocument())
    // alert message (EN) renders in the alert strip
    expect(screen.getByText('Critical incidents open')).toBeInTheDocument()
    // recent audit feed present => shows the DENIED chip
    expect(screen.getByText('DENIED')).toBeInTheDocument()
  })
})
