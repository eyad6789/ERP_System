import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MeetingListItem } from '../api/meetings'
import { MeetingsPage } from '../features/meetings/MeetingsPage'
import i18n from '../i18n'

const meetings: MeetingListItem[] = [
  {
    id: 1, title_ar: 'لجنة الميزانية', title_en: 'Budget Committee',
    start_at: '2026-06-01T09:00', end_at: '2026-06-01T10:00',
    location: 'Conference Hall A', status: 'scheduled', classification: 2,
  },
  {
    id: 2, title_ar: 'مراجعة الأمن', title_en: 'Security Review',
    start_at: '2026-05-20T14:00', end_at: '2026-05-20T15:30',
    location: 'Operations Room', status: 'done', classification: 3,
  },
  {
    id: 3, title_ar: 'إحاطة الموردين', title_en: 'Vendor Briefing',
    start_at: '2026-05-10T11:00', end_at: '2026-05-10T11:45',
    location: 'Annex 2', status: 'cancelled', classification: 1,
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
      <MeetingsPage />
    </QueryClientProvider>,
  )
}

describe('MeetingsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders KPI counts and the meeting table rows', async () => {
    await i18n.changeLanguage('en')
    mockFetch(() => json(meetings))
    renderPage()

    await waitFor(() => expect(screen.getByText('Budget Committee')).toBeInTheDocument())
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('3')
    expect(screen.getByTestId('kpi-scheduled')).toHaveTextContent('1')
    expect(screen.getAllByTestId('meeting-row')).toHaveLength(3)
  })

  it('debounces the search box into the list query param q', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(meetings))
    renderPage()

    await waitFor(() => expect(screen.getByText('Budget Committee')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('meetings-search'), { target: { value: 'security' } })

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('q=security'),
      )
      expect(called).toBe(true)
    })
  })

  it('creates a meeting via the New dialog and POSTs the body', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        return json({ ...meetings[0], id: 99 }, 201)
      }
      return json(meetings)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Budget Committee')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('meeting-new'))

    fireEvent.change(screen.getByTestId('field-title_ar'), { target: { value: 'اجتماع جديد' } })
    fireEvent.change(screen.getByTestId('field-title_en'), { target: { value: 'New Meeting' } })
    fireEvent.click(screen.getByTestId('form-submit'))

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
      )
      expect(post).toBeTruthy()
      expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ title_en: 'New Meeting' })
    })
  })
})
