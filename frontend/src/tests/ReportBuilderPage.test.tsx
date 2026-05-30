import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '../i18n'
import { ReportBuilderPage } from '../features/reportbuilder/ReportBuilderPage'

// One module's list endpoint: a top-level array of records carrying a
// `classification` field we can aggregate counts by.
const assets = [
  { id: 1, name_en: 'Server', classification: 2, status: 'active' },
  { id: 2, name_en: 'Generator', classification: 2, status: 'active' },
  { id: 3, name_en: 'Bus', classification: 1, status: 'retired' },
]

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

// Mock fetch by URL: only the assets list resolves to our fixture.
function mockFetchByUrl() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/assets/')) return Promise.resolve(json(assets))
    return Promise.resolve(json(null, 404))
  })
}

describe('ReportBuilderPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('aggregates a module list by classification and renders table cells', async () => {
    await i18n.changeLanguage('en')
    mockFetchByUrl()
    render(<ReportBuilderPage />)

    // Switch module to assets and chart type to table for a deterministic cell.
    fireEvent.change(screen.getByTestId('rb-module'), { target: { value: 'assets' } })
    fireEvent.change(screen.getByTestId('rb-chart'), { target: { value: 'table' } })
    fireEvent.click(screen.getByTestId('rb-generate'))

    // Two rows: classification "2" (count 2) and "1" (count 1).
    await waitFor(() => expect(screen.getByTestId('rb-table')).toBeInTheDocument())
    const rows = screen.getAllByTestId('rb-row')
    expect(rows).toHaveLength(2)
    // Top bucket is classification "2" with count 2 (two cells both reading "2").
    const top = rows[0]!
    expect(within(top).getAllByText('2')).toHaveLength(2)
  })

  it('persists a saved report definition to localStorage erp.reports', async () => {
    await i18n.changeLanguage('en')
    mockFetchByUrl()
    render(<ReportBuilderPage />)

    fireEvent.change(screen.getByTestId('rb-module'), { target: { value: 'assets' } })
    fireEvent.click(screen.getByTestId('rb-save'))

    await waitFor(() => {
      const raw = localStorage.getItem('erp.reports')
      expect(raw).toBeTruthy()
      const defs = JSON.parse(raw ?? '[]') as Array<{ module: string }>
      expect(defs[0]?.module).toBe('assets')
    })
    expect(screen.getByTestId('rb-saved-item')).toBeInTheDocument()
  })
})
