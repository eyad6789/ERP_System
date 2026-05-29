import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Incident } from '../api/incidents'
import { IncidentsPage } from '../features/incidents/IncidentsPage'
import i18n from '../i18n'

// What the API returned for a clearance-3 viewer (over-clearance rows already
// filtered out server-side): a critical active incident and a closed one.
const incidents: Incident[] = [
  {
    id: 1, title_ar: 'اختراق', title_en: 'Suspected Breach',
    severity: 'critical', status: 'active', reported_date: '2026-05-20',
    classification: 3, updated_at: '2026-05-29T00:00:00Z',
  },
  {
    id: 2, title_ar: 'عطل', title_en: 'Alarm Fault',
    severity: 'medium', status: 'closed', reported_date: '2026-05-10',
    classification: 1, updated_at: '2026-05-29T00:00:00Z',
  },
]

describe('IncidentsPage', () => {
  it('renders KPI counts and the incidents table', async () => {
    await i18n.changeLanguage('en')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(incidents), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <IncidentsPage />
      </QueryClientProvider>,
    )

    await waitFor(() => expect(screen.getByText('Suspected Breach')).toBeInTheDocument())
    // One critical, one active, one closed; both rows shown.
    expect(screen.getByTestId('kpi-critical')).toHaveTextContent('1')
    expect(screen.getByTestId('kpi-active')).toHaveTextContent('1')
    expect(screen.getByTestId('kpi-closed')).toHaveTextContent('1')
    expect(screen.getAllByTestId('incident-row')).toHaveLength(2)
  })
})
