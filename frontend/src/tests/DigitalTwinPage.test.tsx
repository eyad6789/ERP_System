import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { Overview } from '../api/dashboard'
import { DigitalTwinPage } from '../features/twin/DigitalTwinPage'
import i18n from '../i18n'

const overview: Overview = {
  kpis: { total_users: 4, total_roles: 4, audit_events_7d: 12, denied_7d: 3 },
  clearance_distribution: [],
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
  alerts: [
    {
      severity: 'critical',
      module: 'incidents',
      count: 2,
      message_ar: 'حوادث مفتوحة',
      message_en: 'Open incidents',
    },
  ],
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

function renderTwin() {
  mockFetchByUrl()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <DigitalTwinPage />
    </QueryClientProvider>,
  )
}

describe('DigitalTwinPage', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en')
  })

  it('renders a module node with its live count from the overview endpoint', async () => {
    renderTwin()
    // personnel node label + count surface in the SVG diagram
    await waitFor(() => expect(screen.getByText('Personnel')).toBeInTheDocument())
    expect(screen.getByText('137')).toBeInTheDocument()
    // the incidents node carries the critical alert
    expect(screen.getByTestId('twin-node-incidents')).toBeInTheDocument()
  })
})
