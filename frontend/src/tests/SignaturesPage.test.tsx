import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DocumentListItem } from '../api/documents'
import { SignaturesPage } from '../features/signatures/SignaturesPage'
import i18n from '../i18n'

const documents: DocumentListItem[] = [
  {
    id: 1, classification: 2, locked: false, version: 3, access_count: 5,
    owner: 'rania', updated_at: '2026-05-01T00:00:00Z',
    title_ar: 'سياسة الأمن', title_en: 'Security Policy',
  },
  {
    id: 2, classification: 4, locked: true, version: 1, access_count: 0,
    owner: null, updated_at: '2026-05-02T00:00:00Z',
    title_ar: 'الميزانية', title_en: 'Sealed Budget',
  },
]

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

// Route mock fresh per request (Response bodies are single-use; refetches occur).
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
      <SignaturesPage />
    </QueryClientProvider>,
  )
}

describe('SignaturesPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('lists documents from /api/documents/ with a Sign button on unlocked rows', async () => {
    await i18n.changeLanguage('en')
    mockFetch((url) => {
      if (url.includes('/documents/')) return json(documents)
      return json([])
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Security Policy')).toBeInTheDocument())
    expect(screen.getByText('Sealed Budget')).toBeInTheDocument()
    expect(screen.getByTestId('sign-button')).toBeInTheDocument()
  })

  it('signs a document, showing a Signed chip and persisting to localStorage', async () => {
    await i18n.changeLanguage('en')
    mockFetch((url) => {
      if (url.includes('/documents/')) return json(documents)
      return json([])
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Security Policy')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('sign-button'))

    await waitFor(() => expect(screen.getByTestId('signed-chip')).toBeInTheDocument())
    const stored = JSON.parse(localStorage.getItem('erp.signatures') ?? '{}')
    expect(stored['1']).toBeTruthy()
    expect(typeof stored['1'].hash).toBe('string')
  })
})
