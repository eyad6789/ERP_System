import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Overview } from '../api/dashboard'
import { DashboardBuilderPage } from '../features/builder/DashboardBuilderPage'
import i18n from '../i18n'

const overview: Overview = {
  kpis: { total_users: 42, total_roles: 6, audit_events_7d: 12, denied_7d: 3 },
  clearance_distribution: [
    { level: 2, count: 5 },
    { level: 4, count: 1 },
  ],
  audit_activity: [{ date: '2026-05-01', granted: 4, denied: 1 }],
  recent_audit: [],
  modules: {
    incidents: { total: 18, open: 5, by_severity: [{ severity: 'high', count: 2 }] },
    finance: {
      budget_total: '1000',
      spent: '400',
      remaining: '600',
      contracts: 3,
      under_review: 1,
      contracts_value_visible: '500',
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

function renderBuilder() {
  mockFetchByUrl()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <DashboardBuilderPage />
    </QueryClientProvider>,
  )
}

describe('DashboardBuilderPage', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en')
  })

  beforeEach(() => {
    localStorage.clear()
  })

  it('adds a KPI widget and renders its real value from the overview', async () => {
    renderBuilder()
    // Palette button is present once data has loaded.
    const addBtn = await screen.findByTestId('add-kpi-users')
    expect(screen.getByTestId('builder-empty')).toBeInTheDocument()

    fireEvent.click(addBtn)

    // The placed KPI widget surfaces the total_users value (42).
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument())
    expect(screen.getByTestId('widget-kpi-users')).toBeInTheDocument()

    // Layout persisted to localStorage under the expected key.
    const stored = localStorage.getItem('erp.dashboard.layout')
    expect(stored).toBeTruthy()
    expect(JSON.parse(stored ?? '[]')).toHaveLength(1)
  })
})
