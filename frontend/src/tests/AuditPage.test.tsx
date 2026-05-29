import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { AuditPage as AuditPageData, AuditStats } from '../api/audit'
import { AuditPage } from '../features/audit/AuditPage'
import i18n from '../i18n'

const stats: AuditStats = {
  total: 1280,
  granted: 1190,
  denied: 90,
  by_action: [
    { action: 'document.read', count: 540 },
    { action: 'finance.contract.read', count: 210 },
  ],
  by_day: [
    { date: '2026-05-28', granted: 40, denied: 3 },
    { date: '2026-05-29', granted: 55, denied: 6 },
  ],
  top_actors: [{ actor: 'cpt.salim', count: 320 }],
}

// A page with one GRANTED and one DENIED event, matching the backend contract.
const auditPage: AuditPageData = {
  results: [
    {
      id: 1,
      ts: '2026-05-29T08:14:02Z',
      actor_label: 'cpt.salim',
      action: 'document.read',
      target_type: 'document',
      target_id: '42',
      result: 'GRANTED',
      ip: '10.0.0.4',
      user_agent: 'Mozilla/5.0',
      request_id: 'req-1',
      metadata: null,
    },
    {
      id: 2,
      ts: '2026-05-29T09:02:55Z',
      actor_label: 'lt.noor',
      action: 'finance.contract.read',
      target_type: 'contract',
      target_id: '7',
      result: 'DENIED',
      ip: '10.0.0.9',
      user_agent: 'Mozilla/5.0',
      request_id: 'req-2',
      metadata: { reason: 'clearance' },
    },
  ],
  count: 2,
  page: 1,
  pages: 1,
  page_size: 25,
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('AuditPage', () => {
  it('renders stats KPIs, a DENIED chip and event rows', async () => {
    await i18n.changeLanguage('en')
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/audit/stats')) return Promise.resolve(jsonResponse(stats))
      return Promise.resolve(jsonResponse(auditPage))
    })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <AuditPage />
      </QueryClientProvider>,
    )

    // A row renders (actor of the GRANTED event).
    await waitFor(() => expect(screen.getByText('cpt.salim')).toBeInTheDocument())
    // Both events render as rows.
    expect(screen.getAllByTestId('audit-row')).toHaveLength(2)
    // The DENIED chip is present (label "Denied" in EN).
    expect(screen.getAllByText('Denied').length).toBeGreaterThan(0)
    // KPI cards are present (total / granted / denied).
    expect(screen.getAllByTestId('audit-kpi')).toHaveLength(3)
  })
})
