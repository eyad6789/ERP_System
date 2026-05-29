import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { KnowledgeListItem } from '../api/knowledge'
import { KnowledgePage } from '../features/knowledge/KnowledgePage'
import i18n from '../i18n'

// What the API returned for the current viewer: articles at/below their clearance
// (over-clearance articles are filtered out server-side, so they never arrive).
const articles: KnowledgeListItem[] = [
  { id: 1, title_ar: 'دليل الأمن', title_en: 'Security Handbook', category: 'Policy', classification: 2 },
  { id: 2, title_ar: 'إجراءات الطوارئ', title_en: 'Emergency Procedures', category: 'Operations', classification: 3 },
  { id: 3, title_ar: 'مقدمة', title_en: 'Onboarding Guide', category: 'Policy', classification: 1 },
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
      <KnowledgePage />
    </QueryClientProvider>,
  )
}

describe('KnowledgePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders KPI counts and the article rows', async () => {
    await i18n.changeLanguage('en')
    mockFetch(() => json(articles))
    renderPage()

    await waitFor(() => expect(screen.getByText('Security Handbook')).toBeInTheDocument())
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('3')
    // Two distinct categories: Policy, Operations.
    expect(screen.getByTestId('kpi-categories')).toHaveTextContent('2')
    expect(screen.getAllByTestId('knowledge-row')).toHaveLength(3)
  })

  it('creates an article via the New dialog and POSTs the body', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        return json({ ...articles[0], id: 99, body: 'x', updated_at: '2026-01-01' }, 201)
      }
      return json(articles)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Security Handbook')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('knowledge-new'))

    fireEvent.change(screen.getByTestId('field-title_ar'), { target: { value: 'جديد' } })
    fireEvent.change(screen.getByTestId('field-title_en'), { target: { value: 'New Article' } })
    fireEvent.click(screen.getByTestId('form-submit'))

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
      )
      expect(post).toBeTruthy()
      expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ title_en: 'New Article' })
    })
  })
})
