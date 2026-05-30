import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import Tesseract from 'tesseract.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ScannerPage } from '../features/scanner/ScannerPage'
import i18n from '../i18n'

const OCR_TEXT =
  'INVOICE #INV-2024-0042\nDate: 2024-03-11\nAcme Trading Co\nSubtotal 900\nVAT 90\nTotal 990 USD'

// Mock tesseract.js so no real worker/WASM runs in jsdom.
vi.mock('tesseract.js', () => ({
  default: { recognize: vi.fn() },
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
      <ScannerPage />
    </QueryClientProvider>,
  )
}

function selectFile() {
  const input = screen.getByTestId('scanner-input') as HTMLInputElement
  const file = new File(['fake-bytes'], 'invoice.png', { type: 'image/png' })
  fireEvent.change(input, { target: { files: [file] } })
}

describe('ScannerPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // restoreAllMocks wipes the factory implementation — re-seed the OCR result.
    vi.mocked(Tesseract.recognize).mockResolvedValue({ data: { text: OCR_TEXT } } as never)
    // jsdom lacks object-URL support used for the <img> preview.
    Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:preview', writable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: () => undefined, writable: true })
  })

  it('shows the on-device privacy notice', async () => {
    await i18n.changeLanguage('en')
    renderPage()
    expect(screen.getByTestId('scanner-privacy')).toHaveTextContent(/on-device/i)
  })

  it('runs OCR on a chosen file and extracts invoice fields', async () => {
    await i18n.changeLanguage('en')
    renderPage()

    selectFile()

    const invoiceField = (await screen.findByTestId('field-invoiceNumber')) as HTMLInputElement
    await waitFor(() => expect(invoiceField.value).toBe('INV-2024-0042'))

    const totalField = screen.getByTestId('field-total') as HTMLInputElement
    expect(totalField.value).toContain('990')

    const subtotalField = screen.getByTestId('field-subtotal') as HTMLInputElement
    expect(subtotalField.value).toContain('900')

    const taxField = screen.getByTestId('field-tax') as HTMLInputElement
    expect(taxField.value).toContain('90')

    expect((screen.getByTestId('field-currency') as HTMLInputElement).value).toBe('USD')
    expect((screen.getByTestId('field-date') as HTMLInputElement).value).toBe('2024-03-11')

    expect(screen.getByTestId('scanner-text')).toHaveTextContent('INVOICE #INV-2024-0042')
  })

  it('uploads the invoice to Files on Save with kind=invoice', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        return json({ id: 7, kind: 'invoice' }, 201)
      }
      return json([])
    })
    renderPage()

    selectFile()
    const invoiceField = (await screen.findByTestId('field-invoiceNumber')) as HTMLInputElement
    await waitFor(() => expect(invoiceField.value).toBe('INV-2024-0042'))

    fireEvent.click(screen.getByTestId('scanner-save'))

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        ([u, init]) =>
          (init?.method ?? 'GET').toUpperCase() === 'POST' &&
          (typeof u === 'string' ? u : u.toString()).includes('/attachments/'),
      )
      expect(post).toBeTruthy()
      const body = post?.[1]?.body as FormData
      expect(body.get('kind')).toBe('invoice')
    })

    expect(await screen.findByTestId('scanner-saved')).toBeInTheDocument()
  })
})
