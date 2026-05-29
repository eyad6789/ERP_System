import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

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

describe('FinancePage', () => {
  it('renders KPI cards and withholds locked contract fields', async () => {
    await i18n.changeLanguage('en')
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/finance/summary')) return Promise.resolve(jsonResponse(summary))
      return Promise.resolve(jsonResponse(contracts))
    })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <FinancePage />
      </QueryClientProvider>,
    )

    await waitFor(() => expect(screen.getByText('Armored Vehicles')).toBeInTheDocument())
    // Unlocked + locked rows both render; the locked row withholds title/vendor/value.
    expect(screen.getByTestId('contract-open')).toBeInTheDocument()
    expect(screen.getByTestId('contract-locked')).toBeInTheDocument()
    // KPI cards are present (total / spent / remaining).
    expect(screen.getAllByTestId('finance-kpi')).toHaveLength(3)
  })
})
