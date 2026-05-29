import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { VehicleListItem } from '../api/fleet'
import { FleetPage } from '../features/fleet/FleetPage'
import i18n from '../i18n'

// What the API returned for a clearance-2 viewer: vehicles above the viewer's
// clearance are filtered out server-side, so they never arrive at the UI.
const vehicles: VehicleListItem[] = [
  {
    id: 1, plate: 'GOV-1001', vtype: 'Sedan', make: 'Toyota',
    status: 'active', odometer: 42000, classification: 2,
  },
  {
    id: 2, plate: 'GOV-2002', vtype: 'Truck', make: 'Volvo',
    status: 'maintenance', odometer: 118500, classification: 2,
  },
  {
    id: 3, plate: 'GOV-3003', vtype: 'Van', make: 'Ford',
    status: 'retired', odometer: 305000, classification: 1,
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
      <FleetPage />
    </QueryClientProvider>,
  )
}

describe('FleetPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders KPI counts and the vehicle table rows', async () => {
    await i18n.changeLanguage('en')
    mockFetch(() => json(vehicles))
    renderPage()

    await waitFor(() => expect(screen.getByText('GOV-1001')).toBeInTheDocument())
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('3')
    expect(screen.getByTestId('kpi-active')).toHaveTextContent('1')
    expect(screen.getByTestId('kpi-maintenance')).toHaveTextContent('1')
    expect(screen.getByTestId('kpi-retired')).toHaveTextContent('1')
    expect(screen.getAllByTestId('vehicle-row')).toHaveLength(3)
  })

  it('debounces the search box into the list query param q', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch(() => json(vehicles))
    renderPage()

    await waitFor(() => expect(screen.getByText('GOV-1001')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('fleet-search'), { target: { value: 'truck' } })

    await waitFor(() => {
      const called = fetchSpy.mock.calls.some(([u]) =>
        (typeof u === 'string' ? u : u.toString()).includes('q=truck'),
      )
      expect(called).toBe(true)
    })
  })

  it('creates a vehicle via the New dialog and POSTs the body', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'POST') {
        return json({ ...vehicles[0], id: 99 }, 201)
      }
      return json(vehicles)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('GOV-1001')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('vehicle-new'))

    fireEvent.change(screen.getByTestId('field-plate'), { target: { value: 'GOV-9999' } })
    fireEvent.change(screen.getByTestId('field-vtype'), { target: { value: 'Bus' } })
    fireEvent.click(screen.getByTestId('form-submit'))

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
      )
      expect(post).toBeTruthy()
      expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({
        plate: 'GOV-9999',
        vtype: 'Bus',
      })
    })
  })
})
