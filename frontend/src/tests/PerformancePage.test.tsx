import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PerformanceListItem } from '../api/performance'
import { PerformancePage } from '../features/performance/PerformancePage'
import i18n from '../i18n'

const reviews: PerformanceListItem[] = [
  {
    id: 1, employee: 'Layla Hassan', period: '2026-Q1', score: 92,
    rating: 'outstanding', classification: 2,
  },
  {
    id: 2, employee: 'Omar Said', period: '2026-Q1', score: 74,
    rating: 'good', classification: 1,
  },
  {
    id: 3, employee: 'Nadia Fouad', period: '2026-Q1', score: 55,
    rating: 'needs_improvement', classification: 2,
  },
]

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

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
      <PerformancePage />
    </QueryClientProvider>,
  )
}

describe('PerformancePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders KPI counts and the review table rows', async () => {
    await i18n.changeLanguage('en')
    mockFetch(() => json(reviews))
    renderPage()

    await waitFor(() => expect(screen.getByText('Layla Hassan')).toBeInTheDocument())
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('3')
    expect(screen.getByTestId('kpi-outstanding')).toHaveTextContent('1')
    expect(screen.getByTestId('kpi-avg')).toHaveTextContent('74')
    expect(screen.getAllByTestId('performance-row')).toHaveLength(3)
  })

  it('debounces the search box into the list query param q', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(reviews))
    renderPage()

    await waitFor(() => expect(screen.getByText('Layla Hassan')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('performance-search'), { target: { value: 'omar' } })

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('q=omar'),
      )
      expect(called).toBe(true)
    })
  })

  it('creates a review via the New dialog and POSTs the body', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        return json({ ...reviews[0], id: 99, notes: '' }, 201)
      }
      return json(reviews)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Layla Hassan')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('performance-new'))

    fireEvent.change(screen.getByTestId('field-employee'), { target: { value: 'Sami Adel' } })
    fireEvent.change(screen.getByTestId('field-period'), { target: { value: '2026-Q2' } })
    fireEvent.change(screen.getByTestId('field-score'), { target: { value: '88' } })
    fireEvent.click(screen.getByTestId('form-submit'))

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
      )
      expect(post).toBeTruthy()
      expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({
        employee: 'Sami Adel',
        period: '2026-Q2',
        score: 88,
      })
    })
  })

  it('deletes a review after confirming in the dialog', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'DELETE') {
        return new Response(null, { status: 204 })
      }
      return json(reviews)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Layla Hassan')).toBeInTheDocument())
    const firstRow = screen.getAllByTestId('performance-row')[0]!
    fireEvent.click(within(firstRow).getByTestId('performance-delete'))

    expect(screen.getByText(/audited/i)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('confirm-delete'))

    await waitFor(() => {
      const del = fetchSpy.mock.calls.find(
        ([u, init]) =>
          (init?.method ?? 'GET').toUpperCase() === 'DELETE' &&
          (typeof u === 'string' ? u : u.toString()).includes('/performance/1'),
      )
      expect(del).toBeTruthy()
    })
  })
})
