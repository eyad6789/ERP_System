import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// MapLibre GL needs WebGL (absent in jsdom); mock the map to plain DOM so the
// page's controls/markers can still be exercised in tests.
vi.mock('react-map-gl/maplibre', () => ({
  default: ({ children }: { children?: ReactNode }) => <div data-testid="live-map">{children}</div>,
  Marker: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
    <div onClick={onClick}>{children}</div>
  ),
  NavigationControl: () => null,
  ScaleControl: () => null,
}))

import type { Site } from '../api/gis'
import { GisPage } from '../features/gis/GisPage'
import i18n from '../i18n'

// What the API returned for a clearance-2 viewer: only sites at/below clearance 2.
// (Higher-classification sites are excluded server-side, never reaching the UI.)
const sites: Site[] = [
  {
    id: 1, name_ar: 'بغداد', name_en: 'Baghdad Center', site_type: 'facility',
    lat: 33.31, lng: 44.36, info_ar: 'مركز', info_en: 'Command center', classification: 2,
  },
  {
    id: 2, name_ar: 'النجف', name_en: 'Najaf Station', site_type: 'asset',
    lat: 31.99, lng: 44.33, info_ar: 'محطة', info_en: 'Public station', classification: 1,
  },
]

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <GisPage />
    </QueryClientProvider>,
  )
}

afterEach(() => vi.restoreAllMocks())

describe('GisPage', () => {
  it('renders projected markers and a popup with detail on click', async () => {
    await i18n.changeLanguage('en')
    // Route by URL: the list returns the array; the detail endpoint returns one site.
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      const m = url.match(/\/gis\/sites\/(\d+)$/)
      if (m) return Promise.resolve(json(sites.find((s) => s.id === Number(m[1]))))
      return Promise.resolve(json(sites))
    })
    renderPage()

    await waitFor(() => expect(screen.getAllByTestId('iraq-marker')).toHaveLength(2))
    fireEvent.click(screen.getAllByTestId('iraq-marker')[0]!)
    await waitFor(() => expect(screen.getByTestId('gis-popup')).toBeInTheDocument())
    // The popup shows the audited detail fetched for the selected site (async).
    expect(await screen.findByText('Command center')).toBeInTheDocument()
  })

  it('creates a site through the dialog and refetches the list', async () => {
    await i18n.changeLanguage('en')
    const posted: unknown[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      const method = (init?.method ?? 'GET').toUpperCase()
      if (method === 'POST') {
        posted.push(JSON.parse(String(init?.body)))
        return Promise.resolve(json({ ...sites[0], id: 3 }, 201))
      }
      const m = url.match(/\/gis\/sites\/(\d+)$/)
      if (m) return Promise.resolve(json(sites.find((s) => s.id === Number(m[1]))))
      return Promise.resolve(json(sites))
    })
    renderPage()

    fireEvent.click(await screen.findByTestId('gis-new'))
    const dialog = await screen.findByTestId('gis-form-dialog')
    const inputs = within(dialog).getAllByRole('textbox')
    fireEvent.change(inputs[0]!, { target: { value: 'موقع' } }) // name_ar
    fireEvent.change(inputs[1]!, { target: { value: 'New Site' } }) // name_en
    fireEvent.click(within(dialog).getByText('Save'))

    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toMatchObject({ name_en: 'New Site', name_ar: 'موقع' })
  })

  it('deletes a site after confirming', async () => {
    await i18n.changeLanguage('en')
    let deleted = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      const method = (init?.method ?? 'GET').toUpperCase()
      if (method === 'DELETE') {
        deleted += 1
        return Promise.resolve(new Response(null, { status: 204 }))
      }
      const m = url.match(/\/gis\/sites\/(\d+)$/)
      if (m) return Promise.resolve(json(sites.find((s) => s.id === Number(m[1]))))
      return Promise.resolve(json(sites))
    })
    renderPage()

    const delButtons = await screen.findAllByLabelText('Delete')
    fireEvent.click(delButtons[0]!)
    const confirm = await screen.findByTestId('gis-delete-dialog')
    fireEvent.click(within(confirm).getByText('Delete'))

    await waitFor(() => expect(deleted).toBe(1))
  })
})
