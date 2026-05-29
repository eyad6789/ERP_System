import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { DocumentListItem } from '../api/documents'
import { DocumentsPage } from '../features/documents/DocumentsPage'
import i18n from '../i18n'

// What the API returned for a clearance-2 viewer: unlocked L2 doc (title present),
// locked L4 doc (title withheld server-side -> null).
const docs: DocumentListItem[] = [
  {
    id: 1, classification: 2, locked: false, version: 5, access_count: 3,
    owner: 'admin', updated_at: '2026-05-29T00:00:00Z',
    title_ar: 'دليل', title_en: 'Logistics Manual',
  },
  {
    id: 2, classification: 4, locked: true, version: 3, access_count: 9,
    owner: 'admin', updated_at: '2026-05-29T00:00:00Z',
    title_ar: null, title_en: null,
  },
]

describe('DocumentsPage', () => {
  it('shows the unlocked title and withholds the locked one', async () => {
    await i18n.changeLanguage('en')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(docs), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <DocumentsPage />
      </QueryClientProvider>,
    )

    await waitFor(() => expect(screen.getByText('Logistics Manual')).toBeInTheDocument())
    // One card is locked; the locked card exposes no title text from the API.
    expect(screen.getByTestId('doc-locked')).toBeInTheDocument()
    expect(screen.getByTestId('doc-open')).toBeInTheDocument()
  })
})
