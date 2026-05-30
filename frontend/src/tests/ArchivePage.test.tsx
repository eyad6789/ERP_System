import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DocumentListItem } from '../api/documents'
import { ArchivePage } from '../features/archive/ArchivePage'
import i18n from '../i18n'

// One unlocked doc (title present) + one locked doc (title withheld server-side).
const docs: DocumentListItem[] = [
  {
    id: 1, classification: 2, locked: false, version: 5, access_count: 3,
    owner: 'admin', updated_at: '2026-05-29T00:00:00Z',
    title_ar: 'دليل', title_en: 'Logistics Manual',
  },
  {
    id: 2, classification: 4, locked: true, version: 3, access_count: 9,
    owner: 'admin', updated_at: '2026-05-28T00:00:00Z',
    title_ar: null, title_en: null,
  },
]

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

// Route the mocked fetch by URL: the archive register only reads /documents/.
function mockApi() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/documents/')) {
      return Promise.resolve(jsonResponse(docs))
    }
    return Promise.resolve(jsonResponse([]))
  })
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ArchivePage />
    </QueryClientProvider>,
  )
}

afterEach(() => vi.restoreAllMocks())

describe('ArchivePage', () => {
  it('shows the unlocked title and a lock marker for the withheld one', async () => {
    await i18n.changeLanguage('en')
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('Logistics Manual')).toBeInTheDocument())
    // The locked row exposes no title from the API, only a lock marker.
    expect(screen.getByTestId('archive-locked')).toBeInTheDocument()
    expect(screen.getAllByTestId('archive-row')).toHaveLength(2)
  })
})
