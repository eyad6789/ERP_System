import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ImportPage } from '../features/import/ImportPage'
import i18n from '../i18n'

// Deterministic CSV parse: Papa.parse calls complete synchronously with fixed rows.
vi.mock('papaparse', () => ({
  default: {
    parse: (_f: File, opts: { complete: (res: { data: string[][] }) => void }) =>
      opts.complete({
        data: [
          ['name', 'amount'],
          ['Alpha', '10'],
          ['Beta', '20'],
        ],
      }),
  },
}))

// Minimal xlsx mock so the module-top import resolves without loading the real lib.
vi.mock('xlsx', () => ({
  read: () => ({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } }),
  utils: { sheet_to_json: () => [] },
}))

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
      <ImportPage />
    </QueryClientProvider>,
  )
}

function selectCsv() {
  const input = screen.getByTestId('import-input') as HTMLInputElement
  const file = new File(['name,amount\nAlpha,10\nBeta,20'], 'my.csv', { type: 'text/csv' })
  fireEvent.change(input, { target: { files: [file] } })
}

describe('ImportPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('parses a selected CSV and previews columns and rows', async () => {
    await i18n.changeLanguage('en')
    renderPage()

    selectCsv()

    const table = await screen.findByTestId('import-preview-table')
    expect(within(table).getByText('name')).toBeInTheDocument()
    expect(within(table).getByText('amount')).toBeInTheDocument()
    expect(within(table).getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByTestId('import-rowcount')).toHaveTextContent('2')
  })

  it('uploads the file with extracted metadata on Import', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        return json({ id: 7, original_name: 'my.csv' }, 201)
      }
      return json([])
    })
    renderPage()

    selectCsv()
    await screen.findByTestId('import-preview-table')

    fireEvent.click(screen.getByTestId('import-save'))

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
      )
      expect(post).toBeTruthy()
      expect(post?.[1]?.body).toBeInstanceOf(FormData)
    })
    await screen.findByTestId('import-success')
  })
})
