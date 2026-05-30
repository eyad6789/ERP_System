import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AttendanceListItem } from '../api/attendance'
import { AttendancePage } from '../features/attendance/AttendancePage'
import i18n from '../i18n'

// What the API returned for a clearance-2 viewer: only records at/below clearance
// (over-clearance records are filtered out server-side, so they never arrive).
const records: AttendanceListItem[] = [
  {
    id: 1, employee: 'Layla Hassan', date: '2026-05-28', status: 'present',
    check_in: '08:02', check_out: '16:10', classification: 2,
  },
  {
    id: 2, employee: 'Omar Farouk', date: '2026-05-28', status: 'absent',
    check_in: '', check_out: '', classification: 2,
  },
  {
    id: 3, employee: 'Sara Nabil', date: '2026-05-28', status: 'late',
    check_in: '09:31', check_out: '17:00', classification: 1,
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
      <AttendancePage />
    </QueryClientProvider>,
  )
}

describe('AttendancePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders KPI counts and the attendance table rows', async () => {
    await i18n.changeLanguage('en')
    mockFetch(() => json(records))
    renderPage()

    await waitFor(() => expect(screen.getByText('Layla Hassan')).toBeInTheDocument())
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('3')
    expect(screen.getByTestId('kpi-present')).toHaveTextContent('1')
    expect(screen.getAllByTestId('attendance-row')).toHaveLength(3)
  })

  it('debounces the search box into the list query param q', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(records))
    renderPage()

    await waitFor(() => expect(screen.getByText('Layla Hassan')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('attendance-search'), { target: { value: 'omar' } })

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('q=omar'),
      )
      expect(called).toBe(true)
    })
  })

  it('sets ordering when a column header is clicked', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(records))
    renderPage()

    await waitFor(() => expect(screen.getByText('Layla Hassan')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Employee'))

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('ordering=employee'),
      )
      expect(called).toBe(true)
    })
  })

  it('creates a record via the New dialog and POSTs the body', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        return json({ ...records[0], id: 99 }, 201)
      }
      return json(records)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Layla Hassan')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('attendance-new'))

    fireEvent.change(screen.getByTestId('field-employee'), { target: { value: 'Khalid Aziz' } })
    fireEvent.change(screen.getByTestId('field-date'), { target: { value: '2026-05-29' } })
    fireEvent.click(screen.getByTestId('form-submit'))

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
      )
      expect(post).toBeTruthy()
      expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ employee: 'Khalid Aziz' })
    })
  })

  it('deletes a record after confirming in the dialog', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'DELETE') {
        return new Response(null, { status: 204 })
      }
      return json(records)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Layla Hassan')).toBeInTheDocument())
    const firstRow = screen.getAllByTestId('attendance-row')[0]!
    fireEvent.click(within(firstRow).getByTestId('attendance-delete'))

    expect(screen.getByText(/audited/i)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('confirm-delete'))

    await waitFor(() => {
      const del = fetchSpy.mock.calls.find(
        ([u, init]) =>
          (init?.method ?? 'GET').toUpperCase() === 'DELETE' &&
          (typeof u === 'string' ? u : u.toString()).includes('/attendance/1'),
      )
      expect(del).toBeTruthy()
    })
  })
})
