import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EventListItem } from '../api/events'
import { EventsPage } from '../features/events/EventsPage'
import i18n from '../i18n'

// What the API returned for a clearance-2 viewer: only events at/below clearance
// (over-clearance events are filtered out server-side, so they never arrive).
const events: EventListItem[] = [
  {
    id: 1, title_ar: 'اجتماع', title_en: 'Steering Committee', start_at: '2026-06-01T09:00',
    end_at: '2026-06-01T10:30', event_type: 'meeting', location: 'Council Room', classification: 2,
  },
  {
    id: 2, title_ar: 'موعد نهائي', title_en: 'Budget Submission', start_at: '2026-06-05T17:00',
    end_at: '2026-06-05T17:00', event_type: 'deadline', location: 'Finance Wing', classification: 2,
  },
  {
    id: 3, title_ar: 'عطلة', title_en: 'National Day', start_at: '2026-06-10T00:00',
    end_at: '2026-06-10T23:59', event_type: 'holiday', location: 'Nationwide', classification: 1,
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
      <EventsPage />
    </QueryClientProvider>,
  )
}

describe('EventsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders KPI counts and the event table rows', async () => {
    await i18n.changeLanguage('en')
    mockFetch(() => json(events))
    renderPage()

    await waitFor(() => expect(screen.getByText('Steering Committee')).toBeInTheDocument())
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('3')
    expect(screen.getByTestId('kpi-meeting')).toHaveTextContent('1')
    expect(screen.getByTestId('kpi-deadline')).toHaveTextContent('1')
    expect(screen.getByTestId('kpi-holiday')).toHaveTextContent('1')
    expect(screen.getByTestId('kpi-operation')).toHaveTextContent('0')
    expect(screen.getAllByTestId('event-row')).toHaveLength(3)
  })

  it('debounces the search box into the list query param q', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(events))
    renderPage()

    await waitFor(() => expect(screen.getByText('Steering Committee')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('events-search'), { target: { value: 'budget' } })

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('q=budget'),
      )
      expect(called).toBe(true)
    })
  })

  it('sets ordering when a column header is clicked', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(events))
    renderPage()

    await waitFor(() => expect(screen.getByText('Steering Committee')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Location'))

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('ordering=location'),
      )
      expect(called).toBe(true)
    })
  })

  it('creates an event via the New dialog and POSTs the body', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        return json({ ...events[0], id: 99 }, 201)
      }
      return json(events)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Steering Committee')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('event-new'))

    fireEvent.change(screen.getByTestId('field-title_ar'), { target: { value: 'جديد' } })
    fireEvent.change(screen.getByTestId('field-title_en'), { target: { value: 'Kickoff Briefing' } })
    fireEvent.click(screen.getByTestId('form-submit'))

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
      )
      expect(post).toBeTruthy()
      expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ title_en: 'Kickoff Briefing' })
    })
  })
})
