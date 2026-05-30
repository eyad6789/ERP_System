import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Attachment } from '../api/attachments'
import { FilesPage } from '../features/files/FilesPage'
import i18n from '../i18n'

const attachments: Attachment[] = [
  {
    id: 1,
    original_name: 'budget-2026.xlsx',
    content_type: 'application/vnd.ms-excel',
    size: 20480,
    kind: 'spreadsheet',
    classification: 2,
    owner: 'A. Salem',
    linked_module: 'finance',
    linked_id: '7',
    extracted: {},
    created_at: '2026-03-01T09:00:00Z',
    download_url: '/api/attachments/1/download',
  },
  {
    id: 2,
    original_name: 'policy-memo.pdf',
    content_type: 'application/pdf',
    size: 524288,
    kind: 'document',
    classification: 3,
    owner: 'N. Faris',
    linked_module: 'legal',
    linked_id: '4',
    extracted: {},
    created_at: '2026-02-12T11:30:00Z',
    download_url: '/api/attachments/2/download',
  },
]

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

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
      <FilesPage />
    </QueryClientProvider>,
  )
}

describe('FilesPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders rows from a mocked GET', async () => {
    await i18n.changeLanguage('en')
    mockFetch(() => json(attachments))
    renderPage()

    await waitFor(() => expect(screen.getByText('budget-2026.xlsx')).toBeInTheDocument())
    expect(screen.getByText('policy-memo.pdf')).toBeInTheDocument()
    expect(screen.getAllByTestId('file-row')).toHaveLength(2)
  })

  it('filters the list with the search box', async () => {
    await i18n.changeLanguage('en')
    mockFetch(() => json(attachments))
    renderPage()

    await waitFor(() => expect(screen.getByText('budget-2026.xlsx')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('files-search'), { target: { value: 'policy' } })

    await waitFor(() => expect(screen.getAllByTestId('file-row')).toHaveLength(1))
    expect(screen.getByText('policy-memo.pdf')).toBeInTheDocument()
    expect(screen.queryByText('budget-2026.xlsx')).not.toBeInTheDocument()
  })

  it('deletes a file after confirming in the dialog', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'DELETE') {
        return new Response(null, { status: 204 })
      }
      return json(attachments)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('budget-2026.xlsx')).toBeInTheDocument())
    const firstRow = screen.getAllByTestId('file-row')[0]!
    fireEvent.click(within(firstRow).getByTestId('file-delete'))

    expect(screen.getByText(/audited/i)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('confirm-delete'))

    await waitFor(() => {
      const del = fetchSpy.mock.calls.find(
        ([u, init]) =>
          (init?.method ?? 'GET').toUpperCase() === 'DELETE' &&
          (typeof u === 'string' ? u : u.toString()).includes('/attachments/1'),
      )
      expect(del).toBeTruthy()
    })
  })
})
