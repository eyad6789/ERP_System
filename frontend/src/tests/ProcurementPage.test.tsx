import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PurchaseOrderListItem, VendorListItem } from '../api/procurement'
import { ProcurementPage } from '../features/procurement/ProcurementPage'
import i18n from '../i18n'

// What the API returned for a clearance-2 viewer: only orders at/below clearance
// (over-clearance orders are filtered out server-side, so they never arrive).
const orders: PurchaseOrderListItem[] = [
  {
    id: 1, vendor: 10, vendor_name_ar: 'الرافدين', vendor_name_en: 'Rafidain Supply',
    title_ar: 'مركبات', title_en: 'Armored Vehicles', total: '90000.00',
    status: 'approved', classification: 2,
  },
  {
    id: 2, vendor: 11, vendor_name_ar: 'النهرين', vendor_name_en: 'Nahrain Trading',
    title_ar: 'معدات', title_en: 'Field Equipment', total: '12000.00',
    status: 'draft', classification: 1,
  },
]

const vendors: VendorListItem[] = [
  { id: 10, name_ar: 'الرافدين', name_en: 'Rafidain Supply', category: 'Logistics', rating: 4, classification: 1 },
  { id: 11, name_ar: 'النهرين', name_en: 'Nahrain Trading', category: 'Equipment', rating: 3, classification: 1 },
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
      <ProcurementPage />
    </QueryClientProvider>,
  )
}

describe('ProcurementPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders KPI cards and the purchase-order table rows', async () => {
    await i18n.changeLanguage('en')
    mockFetch((url) => {
      if (url.includes('/procurement/vendors')) return json(vendors)
      return json(orders)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Armored Vehicles')).toBeInTheDocument())
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('2')
    expect(screen.getByTestId('kpi-vendors')).toHaveTextContent('2')
    expect(screen.getAllByTestId('procurement-row')).toHaveLength(2)
  })

  it('creates a purchase order via the New dialog and POSTs the body', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((url, init) => {
      if (url.includes('/procurement/vendors')) return json(vendors)
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        return json({ ...orders[0], id: 99 }, 201)
      }
      return json(orders)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Armored Vehicles')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('procurement-new'))

    fireEvent.change(screen.getByTestId('field-title_ar'), { target: { value: 'جديد' } })
    fireEvent.change(screen.getByTestId('field-title_en'), { target: { value: 'New Order' } })
    fireEvent.change(screen.getByTestId('field-vendor'), { target: { value: '10' } })
    fireEvent.change(screen.getByTestId('field-total'), { target: { value: '500' } })
    fireEvent.click(screen.getByTestId('form-submit'))

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
      )
      expect(post).toBeTruthy()
      expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({
        title_en: 'New Order',
        vendor: 10,
      })
    })
  })
})
