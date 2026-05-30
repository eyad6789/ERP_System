import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { TicketListItem } from '../api/helpdesk'
import { HelpDeskPage } from '../features/helpdesk/HelpDeskPage'
import i18n from '../i18n'

// What the API returned for a clearance-2 viewer: only tickets at/below clearance
// (over-clearance tickets are filtered out server-side, so they never arrive).
const tickets: TicketListItem[] = [
  {
    id: 1, title_ar: 'تعطل الطابعة', title_en: 'Printer offline', requester: 'Registry',
    priority: 'high', status: 'open', classification: 2,
  },
  {
    id: 2, title_ar: 'إعادة تعيين كلمة المرور', title_en: 'Password reset', requester: 'Finance',
    priority: 'low', status: 'resolved', classification: 1,
  },
  {
    id: 3, title_ar: 'بطء الشبكة', title_en: 'Slow network', requester: 'Operations',
    priority: 'medium', status: 'in_progress', classification: 2,
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
      <HelpDeskPage />
    </QueryClientProvider>,
  )
}

describe('HelpDeskPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders KPI counts and the ticket table rows', async () => {
    await i18n.changeLanguage('en')
    mockFetch(() => json(tickets))
    renderPage()

    await waitFor(() => expect(screen.getByText('Printer offline')).toBeInTheDocument())
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('3')
    expect(screen.getByTestId('kpi-open')).toHaveTextContent('1')
    expect(screen.getAllByTestId('ticket-row')).toHaveLength(3)
  })

  it('debounces the search box into the list query param q', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(tickets))
    renderPage()

    await waitFor(() => expect(screen.getByText('Printer offline')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('helpdesk-search'), { target: { value: 'printer' } })

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('q=printer'),
      )
      expect(called).toBe(true)
    })
  })

  it('sets ordering when a column header is clicked', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(tickets))
    renderPage()

    await waitFor(() => expect(screen.getByText('Printer offline')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Requester'))

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('ordering=requester'),
      )
      expect(called).toBe(true)
    })
  })

  it('creates a ticket via the New dialog and POSTs the body', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        return json({ ...tickets[0], id: 99 }, 201)
      }
      return json(tickets)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Printer offline')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('ticket-new'))

    fireEvent.change(screen.getByTestId('field-title_ar'), { target: { value: 'عطل جديد' } })
    fireEvent.change(screen.getByTestId('field-title_en'), { target: { value: 'New Ticket' } })
    fireEvent.click(screen.getByTestId('form-submit'))

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
      )
      expect(post).toBeTruthy()
      expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ title_en: 'New Ticket' })
    })
  })

  it('deletes a ticket after confirming in the dialog', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'DELETE') {
        return new Response(null, { status: 204 })
      }
      return json(tickets)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Printer offline')).toBeInTheDocument())
    const firstRow = screen.getAllByTestId('ticket-row')[0]!
    fireEvent.click(within(firstRow).getByTestId('ticket-delete'))

    expect(screen.getByText(/audited/i)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('confirm-delete'))

    await waitFor(() => {
      const del = fetchSpy.mock.calls.find(
        ([u, init]) =>
          (init?.method ?? 'GET').toUpperCase() === 'DELETE' &&
          (typeof u === 'string' ? u : u.toString()).includes('/helpdesk/1'),
      )
      expect(del).toBeTruthy()
    })
  })
})
