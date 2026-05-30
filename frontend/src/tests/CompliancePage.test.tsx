import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComplianceListItem } from '../api/compliance'
import { CompliancePage } from '../features/compliance/CompliancePage'
import i18n from '../i18n'

// What the API returned for a clearance-2 viewer: only items at/below clearance
// (over-clearance items are filtered out server-side, so they never arrive).
const items: ComplianceListItem[] = [
  {
    id: 1, title_ar: 'سياسة الوصول', title_en: 'Access Policy', standard: 'ISO 27001',
    status: 'compliant', finding: 'All controls verified.', classification: 2,
  },
  {
    id: 2, title_ar: 'سجل التدقيق', title_en: 'Audit Trail', standard: 'SOC 2',
    status: 'non_compliant', finding: 'Retention gap found.', classification: 2,
  },
  {
    id: 3, title_ar: 'خطة الطوارئ', title_en: 'Continuity Plan', standard: 'NIST',
    status: 'in_review', finding: 'Pending committee sign-off.', classification: 1,
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
      <CompliancePage />
    </QueryClientProvider>,
  )
}

describe('CompliancePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders KPI counts and the compliance table rows', async () => {
    await i18n.changeLanguage('en')
    mockFetch(() => json(items))
    renderPage()

    await waitFor(() => expect(screen.getByText('Access Policy')).toBeInTheDocument())
    expect(screen.getByText('Audit Trail')).toBeInTheDocument()
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('3')
    expect(screen.getByTestId('kpi-non_compliant')).toHaveTextContent('1')
    expect(screen.getAllByTestId('compliance-row')).toHaveLength(3)
  })

  it('debounces the search box into the list query param q', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(items))
    renderPage()

    await waitFor(() => expect(screen.getByText('Access Policy')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('compliance-search'), { target: { value: 'audit' } })

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('q=audit'),
      )
      expect(called).toBe(true)
    })
  })

  it('sets ordering when a column header is clicked', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(items))
    renderPage()

    await waitFor(() => expect(screen.getByText('Access Policy')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Standard'))

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('ordering=standard'),
      )
      expect(called).toBe(true)
    })
  })

  it('creates a compliance item via the New dialog and POSTs the body', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        return json({ ...items[0], id: 99 }, 201)
      }
      return json(items)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Access Policy')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('compliance-new'))

    fireEvent.change(screen.getByTestId('field-title_ar'), { target: { value: 'جديد' } })
    fireEvent.change(screen.getByTestId('field-title_en'), { target: { value: 'New Control' } })
    fireEvent.click(screen.getByTestId('form-submit'))

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
      )
      expect(post).toBeTruthy()
      expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ title_en: 'New Control' })
    })
  })
})
