import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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

const detail = {
  id: 1, title_ar: 'دليل', title_en: 'Logistics Manual', body: 'Body text',
  classification: 2, version: 5, access_count: 3, owner: 'admin',
  updated_at: '2026-05-29T00:00:00Z', versions: [],
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

// Route the mocked fetch by URL + method so list/detail/mutations each resolve.
function mockApi() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = (init?.method ?? 'GET').toUpperCase()
    if (url.includes('/documents/') && !/\/documents\/\d/.test(url)) {
      return Promise.resolve(jsonResponse(docs)) // list (GET) + create (POST)
    }
    if (/\/documents\/\d+$/.test(url)) {
      if (method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }))
      return Promise.resolve(jsonResponse(detail)) // detail (GET) + update (PATCH)
    }
    return Promise.resolve(jsonResponse(detail)) // version POST
  })
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <DocumentsPage />
    </QueryClientProvider>,
  )
}

afterEach(() => vi.restoreAllMocks())

describe('DocumentsPage', () => {
  it('shows the unlocked title and withholds the locked one', async () => {
    await i18n.changeLanguage('en')
    mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('Logistics Manual')).toBeInTheDocument())
    // One card is locked; the locked card exposes no title text from the API.
    expect(screen.getByTestId('doc-locked')).toBeInTheDocument()
    expect(screen.getByTestId('doc-open')).toBeInTheDocument()
  })

  it('opens a create dialog and submits a new document', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('Logistics Manual')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('doc-new'))

    const titleAr = screen.getByTestId('doc-form-title-ar')
    const titleEn = screen.getByTestId('doc-form-title-en')
    fireEvent.change(titleAr, { target: { value: 'وثيقة' } })
    fireEvent.change(titleEn, { target: { value: 'New Doc' } })
    fireEvent.click(screen.getByTestId('doc-form-submit'))

    await waitFor(() => {
      const posted = fetchSpy.mock.calls.some(
        ([url, init]) =>
          String(url).includes('/documents/') &&
          (init?.method ?? '').toUpperCase() === 'POST',
      )
      expect(posted).toBe(true)
    })
  })

  it('confirms before deleting a document', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('Logistics Manual')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('doc-delete-1'))

    // Confirm dialog appears; deletion only fires after confirmation.
    const confirm = await screen.findByTestId('doc-delete-confirm')
    fireEvent.click(confirm)

    await waitFor(() => {
      const deleted = fetchSpy.mock.calls.some(
        ([url, init]) =>
          /\/documents\/1$/.test(String(url)) &&
          (init?.method ?? '').toUpperCase() === 'DELETE',
      )
      expect(deleted).toBe(true)
    })
  })

  it('filters the list with the debounced search box', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('Logistics Manual')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('doc-search'), { target: { value: 'manual' } })

    await waitFor(
      () => {
        const searched = fetchSpy.mock.calls.some(([url]) =>
          String(url).includes('q=manual'),
        )
        expect(searched).toBe(true)
      },
      { timeout: 2000 },
    )
  })

  it('adds a version from the detail dialog', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockApi()
    renderPage()

    await waitFor(() => expect(screen.getByText('Logistics Manual')).toBeInTheDocument())
    fireEvent.click(within(screen.getByTestId('doc-open')).getByText('Logistics Manual'))

    // Wait for the detail query to resolve (button is disabled until data loads).
    await screen.findByText('Body text')
    fireEvent.click(await screen.findByTestId('doc-add-version'))

    await waitFor(() => {
      const versioned = fetchSpy.mock.calls.some(
        ([url, init]) =>
          String(url).includes('/version') &&
          (init?.method ?? '').toUpperCase() === 'POST',
      )
      expect(versioned).toBe(true)
    })
  })
})
