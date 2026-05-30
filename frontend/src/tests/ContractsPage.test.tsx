import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ContractListItem } from '../api/contracts'
import { ContractsPage } from '../features/contracts/ContractsPage'
import i18n from '../i18n'

// What the API returned for a clearance-2 viewer: only contracts at/below clearance
// (over-clearance contracts are filtered out server-side, so they never arrive).
const contracts: ContractListItem[] = [
  {
    id: 1, title_ar: 'عقد التوريد', title_en: 'Supply Agreement', party: 'Acme Corp',
    value: '120000.00', start_date: '2026-01-01', end_date: '2026-12-31',
    status: 'active', classification: 2,
  },
  {
    id: 2, title_ar: 'عقد الصيانة', title_en: 'Maintenance Deal', party: 'BuildCo',
    value: '45000.00', start_date: '2025-01-01', end_date: '2025-12-31',
    status: 'expired', classification: 1,
  },
  {
    id: 3, title_ar: 'عقد التجديد', title_en: 'Renewal Pact', party: 'Globex',
    value: '80000.00', start_date: '2026-03-01', end_date: '2027-02-28',
    status: 'renewed', classification: 2,
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
      <ContractsPage />
    </QueryClientProvider>,
  )
}

describe('ContractsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders KPI tiles and the contract table rows', async () => {
    await i18n.changeLanguage('en')
    mockFetch(() => json(contracts))
    renderPage()

    await waitFor(() => expect(screen.getByText('Supply Agreement')).toBeInTheDocument())
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('3')
    expect(screen.getByTestId('kpi-active')).toHaveTextContent('1')
    expect(screen.getByTestId('kpi-value')).toHaveTextContent('245,000')
    expect(screen.getAllByTestId('contract-row')).toHaveLength(3)
  })

  it('debounces the search box into the list query param q', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(contracts))
    renderPage()

    await waitFor(() => expect(screen.getByText('Supply Agreement')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('contracts-search'), { target: { value: 'supply' } })

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('q=supply'),
      )
      expect(called).toBe(true)
    })
  })

  it('sets ordering when a column header is clicked', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(contracts))
    renderPage()

    await waitFor(() => expect(screen.getByText('Supply Agreement')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Party'))

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('ordering=party'),
      )
      expect(called).toBe(true)
    })
  })

  it('creates a contract via the New dialog and POSTs the body', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        return json({ ...contracts[0], id: 99 }, 201)
      }
      return json(contracts)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Supply Agreement')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('contract-new'))

    fireEvent.change(screen.getByTestId('field-title_ar'), { target: { value: 'عقد جديد' } })
    fireEvent.change(screen.getByTestId('field-title_en'), { target: { value: 'New Contract' } })
    fireEvent.click(screen.getByTestId('form-submit'))

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
      )
      expect(post).toBeTruthy()
      expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ title_en: 'New Contract' })
    })
  })

  it('deletes a contract after confirming in the dialog', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'DELETE') {
        return new Response(null, { status: 204 })
      }
      return json(contracts)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Supply Agreement')).toBeInTheDocument())
    const firstRow = screen.getAllByTestId('contract-row')[0]!
    fireEvent.click(within(firstRow).getByTestId('contract-delete'))

    expect(screen.getByText(/audited/i)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('confirm-delete'))

    await waitFor(() => {
      const del = fetchSpy.mock.calls.find(
        ([u, init]) =>
          (init?.method ?? 'GET').toUpperCase() === 'DELETE' &&
          (typeof u === 'string' ? u : u.toString()).includes('/contracts/1'),
      )
      expect(del).toBeTruthy()
    })
  })
})
