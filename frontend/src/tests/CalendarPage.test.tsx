import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EventListItem } from '../api/events'
import { CalendarPage } from '../features/calendar/CalendarPage'
import i18n from '../i18n'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

// Route mock by URL: only /events/ returns the event list.
function mockFetch(events: EventListItem[]) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/events/')) return Promise.resolve(json(events))
    return Promise.resolve(json([], 404))
  })
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <CalendarPage />
    </QueryClientProvider>,
  )
}

describe('CalendarPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders an event chip on its start day in the visible month', async () => {
    await i18n.changeLanguage('en')

    // Place the event in the currently-visible month (the component opens on "now").
    const now = new Date()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const start = `${now.getFullYear()}-${mm}-15T09:00`
    const event: EventListItem = {
      id: 1,
      title_ar: 'اجتماع',
      title_en: 'Steering Committee',
      start_at: start,
      end_at: `${now.getFullYear()}-${mm}-15T10:30`,
      event_type: 'meeting',
      location: 'Council Room',
      classification: 2,
    }

    mockFetch([event])
    renderPage()

    await waitFor(() =>
      expect(screen.getByText('Steering Committee')).toBeInTheDocument(),
    )
  })
})
