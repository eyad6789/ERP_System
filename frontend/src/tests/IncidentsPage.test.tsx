import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <IncidentsPage />
    </QueryClientProvider>,
  )
}

describe('IncidentsPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })
  afterEach(() => vi.restoreAllMocks())

  it('renders KPI counts and the incidents table', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(incidents))
    renderPage()

    await waitFor(() => expect(screen.getByText('Suspected Breach')).toBeInTheDocument())
    // One critical, one active, one closed; both rows shown.
    expect(screen.getByTestId('kpi-critical')).toHaveTextContent('1')
    expect(screen.getByTestId('kpi-active')).toHaveTextContent('1')
    expect(screen.getByTestId('kpi-closed')).toHaveTextContent('1')
    expect(screen.getAllByTestId('incident-row')).toHaveLength(2)
  })

  it('debounces the search box into the list query', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(json(incidents))
    renderPage()
    await waitFor(() => expect(screen.getByText('Suspected Breach')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('incidents-search'), { target: { value: 'breach' } })

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map((c) => String(c[0]))
      expect(urls.some((u) => u.includes('q=breach'))).toBe(true)
    })
  })

  it('creates an incident and refetches the list', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(incidents))
    renderPage()
    await waitFor(() => expect(screen.getByText('Suspected Breach')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('incident-new'))
    fireEvent.change(screen.getByTestId('field-title-ar'), { target: { value: 'حادث' } })
    fireEvent.change(screen.getByTestId('field-title-en'), { target: { value: 'New Incident' } })
    fireEvent.click(screen.getByTestId('incident-save'))

    await waitFor(() => {
      const post = fetchMock.mock.calls.find((c) => (c[1]?.method ?? 'GET') === 'POST')
      expect(post).toBeTruthy()
      expect(String(post?.[0])).toContain('/incidents/')
    })
  })

  it('deletes an incident after confirmation', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(incidents))
    renderPage()
    await waitFor(() => expect(screen.getByText('Suspected Breach')).toBeInTheDocument())

    const firstRow = screen.getAllByTestId('incident-row')[0]!
    fireEvent.click(within(firstRow).getByTestId('incident-delete'))
    fireEvent.click(screen.getByTestId('incident-delete-confirm'))

    await waitFor(() => {
      const del = fetchMock.mock.calls.find((c) => c[1]?.method === 'DELETE')
      expect(del).toBeTruthy()
      expect(String(del?.[0])).toContain('/incidents/1')
    })
  })
})
