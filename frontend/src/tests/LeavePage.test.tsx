import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LeaveListItem } from '../api/leave'
import { LeavePage } from '../features/leave/LeavePage'
import i18n from '../i18n'

const requests: LeaveListItem[] = [
  {
    id: 1, employee: 'Layla Hassan', leave_type: 'annual', start_date: '2026-06-01',
    end_date: '2026-06-05', status: 'pending', reason: 'Family trip', classification: 2,
  },
  {
    id: 2, employee: 'Omar Said', leave_type: 'sick', start_date: '2026-06-03',
    end_date: '2026-06-04', status: 'approved', reason: 'Flu', classification: 1,
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
      <LeavePage />
    </QueryClientProvider>,
  )
}

describe('LeavePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders KPI counts and leave request rows', async () => {
    await i18n.changeLanguage('en')
    mockFetch(() => json(requests))
    renderPage()

    await waitFor(() => expect(screen.getByText('Layla Hassan')).toBeInTheDocument())
    expect(screen.getByText('Omar Said')).toBeInTheDocument()
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('2')
    expect(screen.getByTestId('kpi-pending')).toHaveTextContent('1')
    expect(screen.getAllByTestId('leave-row')).toHaveLength(2)
  })

  it('creates a leave request via the New dialog and POSTs the body', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        return json({ ...requests[0], id: 99 }, 201)
      }
      return json(requests)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Layla Hassan')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('leave-new'))

    fireEvent.change(screen.getByTestId('field-employee'), { target: { value: 'Nour Adel' } })
    fireEvent.change(screen.getByTestId('field-start_date'), { target: { value: '2026-07-01' } })
    fireEvent.change(screen.getByTestId('field-end_date'), { target: { value: '2026-07-03' } })
    fireEvent.click(screen.getByTestId('form-submit'))

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
      )
      expect(post).toBeTruthy()
      expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ employee: 'Nour Adel' })
    })
  })
})
