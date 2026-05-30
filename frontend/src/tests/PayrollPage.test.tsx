import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PayslipListItem } from '../api/payroll'
import { PayrollPage } from '../features/payroll/PayrollPage'
import i18n from '../i18n'

// DecimalField values come back as strings (DRF default).
const payslips: PayslipListItem[] = [
  {
    id: 1, employee: 'Layla Hassan', period: '2026-05', base: '8000.00',
    allowances: '1200.00', deductions: '300.00', net: '8900.00', classification: 2,
  },
  {
    id: 2, employee: 'Omar Farouk', period: '2026-05', base: '6000.00',
    allowances: '500.00', deductions: '100.00', net: '6400.00', classification: 1,
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
      <PayrollPage />
    </QueryClientProvider>,
  )
}

describe('PayrollPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders KPI counts and a payslip row with its net', async () => {
    await i18n.changeLanguage('en')
    mockFetch(() => json(payslips))
    renderPage()

    await waitFor(() => expect(screen.getByText('Layla Hassan')).toBeInTheDocument())
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('2')
    expect(screen.getByText('8900.00')).toBeInTheDocument()
    expect(screen.getAllByTestId('payroll-row')).toHaveLength(2)
  })

  it('debounces the search box into the list query param q', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(payslips))
    renderPage()

    await waitFor(() => expect(screen.getByText('Layla Hassan')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('payroll-search'), { target: { value: 'omar' } })

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('q=omar'),
      )
      expect(called).toBe(true)
    })
  })

  it('sets ordering when a column header is clicked', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(payslips))
    renderPage()

    await waitFor(() => expect(screen.getByText('Layla Hassan')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Period'))

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('ordering=period'),
      )
      expect(called).toBe(true)
    })
  })

  it('creates a payslip via the New dialog and POSTs the body', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        return json({ ...payslips[0], id: 99 }, 201)
      }
      return json(payslips)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Layla Hassan')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('payroll-new'))

    fireEvent.change(screen.getByTestId('field-employee'), { target: { value: 'Sara Nabil' } })
    fireEvent.change(screen.getByTestId('field-period'), { target: { value: '2026-06' } })
    fireEvent.change(screen.getByTestId('field-base'), { target: { value: '7000' } })
    fireEvent.click(screen.getByTestId('form-submit'))

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
      )
      expect(post).toBeTruthy()
      expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({
        employee: 'Sara Nabil',
        period: '2026-06',
        base: 7000,
      })
    })
  })
})
