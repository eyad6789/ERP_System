import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetListItem } from '../api/assets'
import { AssetsPage } from '../features/assets/AssetsPage'
import i18n from '../i18n'

// What the API returned for a clearance-2 viewer: only assets at/below clearance
// (over-clearance assets are filtered out server-side, so they never arrive).
const assets: AssetListItem[] = [
  {
    id: 1, name_ar: 'خادم', name_en: 'Archive Server', asset_type: 'IT Hardware',
    location: 'Server Room 2', condition: 'operational', classification: 2,
  },
  {
    id: 2, name_ar: 'مولّد', name_en: 'Backup Generator', asset_type: 'Equipment',
    location: 'Utility Block', condition: 'down', classification: 2,
  },
  {
    id: 3, name_ar: 'حافلة', name_en: 'Transport Bus', asset_type: 'Vehicle',
    location: 'Main Gate Lot', condition: 'maintenance', classification: 1,
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
      <AssetsPage />
    </QueryClientProvider>,
  )
}

describe('AssetsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders KPI counts and the asset table rows', async () => {
    await i18n.changeLanguage('en')
    mockFetch(() => json(assets))
    renderPage()

    await waitFor(() => expect(screen.getByText('Archive Server')).toBeInTheDocument())
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('3')
    expect(screen.getByTestId('kpi-operational')).toHaveTextContent('1')
    expect(screen.getByTestId('kpi-maintenance')).toHaveTextContent('1')
    expect(screen.getByTestId('kpi-down')).toHaveTextContent('1')
    expect(screen.getAllByTestId('asset-row')).toHaveLength(3)
  })

  it('debounces the search box into the list query param q', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(assets))
    renderPage()

    await waitFor(() => expect(screen.getByText('Archive Server')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('assets-search'), { target: { value: 'bus' } })

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('q=bus'),
      )
      expect(called).toBe(true)
    })
  })

  it('sets ordering when a column header is clicked', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(assets))
    renderPage()

    await waitFor(() => expect(screen.getByText('Archive Server')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Location'))

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('ordering=location'),
      )
      expect(called).toBe(true)
    })
  })

  it('creates an asset via the New dialog and POSTs the body', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        return json({ ...assets[0], id: 99 }, 201)
      }
      return json(assets)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Archive Server')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('asset-new'))

    fireEvent.change(screen.getByTestId('field-name_ar'), { target: { value: 'جديد' } })
    fireEvent.change(screen.getByTestId('field-name_en'), { target: { value: 'New Asset' } })
    fireEvent.click(screen.getByTestId('form-submit'))

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
      )
      expect(post).toBeTruthy()
      expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ name_en: 'New Asset' })
    })
  })

  it('deletes an asset after confirming in the dialog', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'DELETE') {
        return new Response(null, { status: 204 })
      }
      return json(assets)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Archive Server')).toBeInTheDocument())
    const firstRow = screen.getAllByTestId('asset-row')[0]!
    fireEvent.click(within(firstRow).getByTestId('asset-delete'))

    expect(screen.getByText(/audited/i)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('confirm-delete'))

    await waitFor(() => {
      const del = fetchSpy.mock.calls.find(
        ([u, init]) =>
          (init?.method ?? 'GET').toUpperCase() === 'DELETE' &&
          (typeof u === 'string' ? u : u.toString()).includes('/assets/1'),
      )
      expect(del).toBeTruthy()
    })
  })
})
