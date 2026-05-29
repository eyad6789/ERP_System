import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { BudgetSummary, ContractListItem } from '../api/finance'
import { FinancePage } from '../features/finance/FinancePage'
import i18n from '../i18n'

const summary: BudgetSummary = {
  fiscal_year: 2026,
  currency: 'IQD',
  total_amount: '480000000000.00',
  spent: '100.00',
  remaining: '479999999900.00',
  by_department: [{ department_code: 'OPS', amount: '100.00' }],
  by_category: [{ category: 'Operations', amount: '100.00' }],
}

// What the API returned for a clearance-2 viewer: an unlocked L2 contract (title
// present) and a locked L4 contract (title/vendor/value withheld -> null).
const contracts: ContractListItem[] = [
  {
    id: 1, classification: 2, locked: false, status: 'in_progress', progress: 65,
    title_ar: 'مركبات', title_en: 'Armored Vehicles', vendor: 'Rafidain', value: '90000.00',
  },
  {
    id: 2, classification: 4, locked: true, status: 'under_review', progress: 30,
    title_ar: null, title_en: null, vendor: null, value: null,
  },
]

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <FinancePage />
    </QueryClientProvider>,
  )
}

describe('FinancePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders KPI cards and withholds locked contract fields', async () => {
    await i18n.changeLanguage('en')
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/finance/summary')) return Promise.resolve(jsonResponse(summary))
      return Promise.resolve(jsonResponse(contracts))
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Armored Vehicles')).toBeInTheDocument())
    // Unlocked + locked rows both render; the locked row withholds title/vendor/value.
    expect(screen.getByTestId('contract-open')).toBeInTheDocument()
    expect(screen.getByTestId('contract-locked')).toBeInTheDocument()
    // KPI cards are present (total / spent / remaining).
    expect(screen.getAllByTestId('finance-kpi')).toHaveLength(3)
  })

  it('creates a contract via the dialog and POSTs to /finance/contracts', async () => {
    await i18n.changeLanguage('en')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      const method = (init?.method ?? 'GET').toUpperCase()
      if (url.includes('/finance/summary')) return Promise.resolve(jsonResponse(summary))
      if (url.includes('/finance/contracts') && method === 'POST') {
        return Promise.resolve(jsonResponse({ id: 9 }))
      }
      return Promise.resolve(jsonResponse(contracts))
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Armored Vehicles')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('finance-new'))
    fireEvent.change(screen.getByTestId('contract-title-ar'), { target: { value: 'عقد' } })
    fireEvent.change(screen.getByTestId('contract-title-en'), { target: { value: 'New Contract' } })
    // vendor is the third text input inside the dialog
    const inputs = screen.getByRole('dialog').querySelectorAll('input')
    fireEvent.change(inputs[2] as HTMLInputElement, { target: { value: 'Acme' } })

    fireEvent.click(screen.getByTestId('contract-save'))

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([u, i]) =>
            String(u).includes('/finance/contracts') &&
            (i?.method ?? 'GET').toUpperCase() === 'POST',
        ),
      ).toBe(true),
    )
  })

  it('confirms deletion and DELETEs the contract', async () => {
    await i18n.changeLanguage('en')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      const method = (init?.method ?? 'GET').toUpperCase()
      if (url.includes('/finance/summary')) return Promise.resolve(jsonResponse(summary))
      if (url.includes('/finance/contracts/1') && method === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }))
      }
      return Promise.resolve(jsonResponse(contracts))
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Armored Vehicles')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('contract-delete'))
    expect(screen.getByText(/audited/i)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('contract-confirm-delete'))

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([u, i]) =>
            String(u).includes('/finance/contracts/1') &&
            (i?.method ?? 'GET').toUpperCase() === 'DELETE',
        ),
      ).toBe(true),
    )
  })
})
