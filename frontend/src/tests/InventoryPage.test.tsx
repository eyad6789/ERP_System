import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { InventoryListItem } from '../api/inventory'
import { InventoryPage } from '../features/inventory/InventoryPage'
import i18n from '../i18n'

// What the API returned for a clearance-2 viewer: only items at/below clearance
// (over-clearance items are filtered out server-side, so they never arrive).
const items: InventoryListItem[] = [
  {
    id: 1, sku: 'SKU-001', name_ar: 'ورق', name_en: 'Printer Paper', quantity: 250,
    unit: 'ream', warehouse: 'Central Depot', classification: 1,
  },
  {
    id: 2, sku: 'SKU-002', name_ar: 'حبر', name_en: 'Toner Cartridge', quantity: 4,
    unit: 'box', warehouse: 'Central Depot', classification: 2,
  },
  {
    id: 3, sku: 'SKU-003', name_ar: 'كابلات', name_en: 'Network Cables', quantity: 60,
    unit: 'm', warehouse: 'North Annex', classification: 2,
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
      <InventoryPage />
    </QueryClientProvider>,
  )
}

describe('InventoryPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders KPI counts and the inventory table rows', async () => {
    await i18n.changeLanguage('en')
    mockFetch(() => json(items))
    renderPage()

    await waitFor(() => expect(screen.getByText('Printer Paper')).toBeInTheDocument())
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('3')
    expect(screen.getByTestId('kpi-low')).toHaveTextContent('1')
    expect(screen.getByTestId('kpi-warehouses')).toHaveTextContent('2')
    expect(screen.getAllByTestId('inventory-row')).toHaveLength(3)
  })

  it('debounces the search box into the list query param q', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(items))
    renderPage()

    await waitFor(() => expect(screen.getByText('Printer Paper')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('inventory-search'), { target: { value: 'toner' } })

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('q=toner'),
      )
      expect(called).toBe(true)
    })
  })

  it('sets ordering when a column header is clicked', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(items))
    renderPage()

    await waitFor(() => expect(screen.getByText('Printer Paper')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Warehouse'))

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('ordering=warehouse'),
      )
      expect(called).toBe(true)
    })
  })

  it('creates an inventory item via the New dialog and POSTs the body', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        return json({ ...items[0], id: 99 }, 201)
      }
      return json(items)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Printer Paper')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('inventory-new'))

    fireEvent.change(screen.getByTestId('field-sku'), { target: { value: 'SKU-099' } })
    fireEvent.change(screen.getByTestId('field-name_ar'), { target: { value: 'جديد' } })
    fireEvent.change(screen.getByTestId('field-name_en'), { target: { value: 'New Item' } })
    fireEvent.click(screen.getByTestId('form-submit'))

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
      )
      expect(post).toBeTruthy()
      expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({
        sku: 'SKU-099',
        name_en: 'New Item',
      })
    })
  })

  it('deletes an inventory item after confirming in the dialog', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'DELETE') {
        return new Response(null, { status: 204 })
      }
      return json(items)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Printer Paper')).toBeInTheDocument())
    const firstRow = screen.getAllByTestId('inventory-row')[0]!
    fireEvent.click(within(firstRow).getByTestId('inventory-delete'))

    expect(screen.getByText(/audited/i)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('confirm-delete'))

    await waitFor(() => {
      const del = fetchSpy.mock.calls.find(
        ([u, init]) =>
          (init?.method ?? 'GET').toUpperCase() === 'DELETE' &&
          (typeof u === 'string' ? u : u.toString()).includes('/inventory/1'),
      )
      expect(del).toBeTruthy()
    })
  })
})
