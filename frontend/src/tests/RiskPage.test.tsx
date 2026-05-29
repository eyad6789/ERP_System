import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RiskListItem } from '../api/risk'
import { RiskPage } from '../features/risk/RiskPage'
import i18n from '../i18n'

// What the API returned for a clearance-2 viewer: only risks at/below clearance
// (over-clearance risks are filtered out server-side, so they never arrive).
const risks: RiskListItem[] = [
  {
    id: 1, title_ar: 'تسرب بيانات', title_en: 'Data Breach',
    likelihood: 4, impact: 5, score: 20, status: 'open', classification: 2,
  },
  {
    id: 2, title_ar: 'انقطاع الطاقة', title_en: 'Power Outage',
    likelihood: 3, impact: 2, score: 6, status: 'mitigating', classification: 2,
  },
  {
    id: 3, title_ar: 'تأخر المورّد', title_en: 'Vendor Delay',
    likelihood: 2, impact: 2, score: 4, status: 'closed', classification: 1,
  },
]

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

// Route mock fresh per request (Response bodies are single-use, refetches occur).
function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = typeof input === 'string' ? input : input.toString()
    return Promise.resolve(handler(url, init))
  })
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <RiskPage />
    </QueryClientProvider>,
  )
}

describe('RiskPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders KPI counts and the risk table rows', async () => {
    await i18n.changeLanguage('en')
    mockFetch(() => json(risks))
    renderPage()

    await waitFor(() => expect(screen.getByText('Data Breach')).toBeInTheDocument())
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('3')
    expect(screen.getByTestId('kpi-open')).toHaveTextContent('1')
    expect(screen.getByTestId('kpi-high')).toHaveTextContent('1')
    expect(screen.getAllByTestId('risk-row')).toHaveLength(3)
  })

  it('debounces the search box into the list query param q', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(risks))
    renderPage()

    await waitFor(() => expect(screen.getByText('Data Breach')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('risk-search'), { target: { value: 'power' } })

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('q=power'),
      )
      expect(called).toBe(true)
    })
  })

  it('sets ordering when a column header is clicked', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(risks))
    renderPage()

    await waitFor(() => expect(screen.getByText('Data Breach')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Status'))

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('ordering=status'),
      )
      expect(called).toBe(true)
    })
  })

  it('creates a risk via the New dialog and POSTs the body', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        return json({ ...risks[0], id: 99 }, 201)
      }
      return json(risks)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Data Breach')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('risk-new'))

    fireEvent.change(screen.getByTestId('field-title_ar'), { target: { value: 'خطر جديد' } })
    fireEvent.change(screen.getByTestId('field-title_en'), { target: { value: 'New Risk' } })
    fireEvent.click(screen.getByTestId('form-submit'))

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
      )
      expect(post).toBeTruthy()
      expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ title_en: 'New Risk' })
    })
  })

  it('deletes a risk after confirming in the dialog', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'DELETE') {
        return new Response(null, { status: 204 })
      }
      return json(risks)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Data Breach')).toBeInTheDocument())
    const firstRow = screen.getAllByTestId('risk-row')[0]!
    fireEvent.click(within(firstRow).getByTestId('risk-delete'))

    expect(screen.getByText(/audited/i)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('confirm-delete'))

    await waitFor(() => {
      const del = fetchSpy.mock.calls.find(
        ([u, init]) =>
          (init?.method ?? 'GET').toUpperCase() === 'DELETE' &&
          (typeof u === 'string' ? u : u.toString()).includes('/risk/1'),
      )
      expect(del).toBeTruthy()
    })
  })
})
