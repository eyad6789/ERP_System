import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { Overview } from '../api/dashboard'
import { ReportsPage } from '../features/reports/ReportsPage'
import i18n from '../i18n'

const overview: Overview = {
  kpis: { total_users: 4, total_roles: 4, audit_events_7d: 12, denied_7d: 3 },
  clearance_distribution: [
    { level: 1, count: 0 },
    { level: 2, count: 5 },
    { level: 3, count: 2 },
    { level: 4, count: 1 },
  ],
  audit_activity: [],
  modules: {
    personnel: {
      total: 137,
      active: 120,
      on_mission: 9,
      by_clearance: [{ level: 2, count: 60 }],
    },
    incidents: {
      total: 18,
      open: 5,
      by_severity: [{ severity: 'high', count: 2 }],
    },
  },
  alerts: [],
}

// Mock fetch by URL so only the overview endpoint resolves to our fixture.
function mockFetchByUrl() {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/dashboard/overview')) {
      return Promise.resolve(
        new Response(JSON.stringify(overview), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    }
    return Promise.resolve(new Response('null', { status: 404 }))
  })
}

function renderReports() {
  mockFetchByUrl()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ReportsPage />
    </QueryClientProvider>,
  )
}

describe('ReportsPage', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en')
  })

  it('renders per-module totals from the overview endpoint', async () => {
    renderReports()
    // personnel module total surfaces (KPI sum 137 + 18 = 155, and the row value)
    await waitFor(() => expect(screen.getByText('155')).toBeInTheDocument())
    // export button present
    expect(screen.getByTestId('reports-export')).toBeInTheDocument()
  })
})
