import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AnnouncementListItem } from '../api/announcements'
import { AnnouncementsPage } from '../features/announcements/AnnouncementsPage'
import i18n from '../i18n'

// What the API returned for a clearance-2 viewer: over-clearance announcements
// are filtered out server-side, so they never arrive on the wire.
const announcements: AnnouncementListItem[] = [
  {
    id: 1, title_ar: 'إغلاق المكتب', title_en: 'Office Closure', body: 'Closed Friday.',
    audience: 'All Staff', published_date: '2026-05-01', classification: 1,
  },
  {
    id: 2, title_ar: 'تحديث الأمن', title_en: 'Security Update', body: 'New badges.',
    audience: 'Security', published_date: '2026-05-10', classification: 2,
  },
  {
    id: 3, title_ar: 'اجتماع القيادة', title_en: 'Leadership Briefing', body: 'Q3 plan.',
    audience: 'All Staff', published_date: '2026-05-20', classification: 2,
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
      <AnnouncementsPage />
    </QueryClientProvider>,
  )
}

describe('AnnouncementsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders KPI counts and the announcement table rows', async () => {
    await i18n.changeLanguage('en')
    mockFetch(() => json(announcements))
    renderPage()

    await waitFor(() => expect(screen.getByText('Office Closure')).toBeInTheDocument())
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('3')
    // Distinct audiences: "All Staff" + "Security" = 2
    expect(screen.getByTestId('kpi-audiences')).toHaveTextContent('2')
    expect(screen.getAllByTestId('announcement-row')).toHaveLength(3)
  })

  it('debounces the search box into the list query param q', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(announcements))
    renderPage()

    await waitFor(() => expect(screen.getByText('Office Closure')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('announcements-search'), {
      target: { value: 'security' },
    })

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('q=security'),
      )
      expect(called).toBe(true)
    })
  })

  it('sets ordering when a column header is clicked', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(announcements))
    renderPage()

    await waitFor(() => expect(screen.getByText('Office Closure')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Audience'))

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('ordering=audience'),
      )
      expect(called).toBe(true)
    })
  })

  it('creates an announcement via the New dialog and POSTs the body', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        return json({ ...announcements[0], id: 99 }, 201)
      }
      return json(announcements)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Office Closure')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('announcement-new'))

    fireEvent.change(screen.getByTestId('field-title_ar'), { target: { value: 'تنبيه' } })
    fireEvent.change(screen.getByTestId('field-title_en'), { target: { value: 'New Notice' } })
    fireEvent.click(screen.getByTestId('form-submit'))

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
      )
      expect(post).toBeTruthy()
      expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ title_en: 'New Notice' })
    })
  })
})
