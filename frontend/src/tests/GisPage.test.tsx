import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

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

describe('GisPage', () => {
  it('renders projected markers and a popup with detail on click', async () => {
    await i18n.changeLanguage('en')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(sites), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <GisPage />
      </QueryClientProvider>,
    )

    await waitFor(() => expect(screen.getAllByTestId('gis-marker')).toHaveLength(2))
    fireEvent.click(screen.getAllByTestId('gis-marker')[0]!)
    await waitFor(() => expect(screen.getByTestId('gis-popup')).toBeInTheDocument())
    expect(screen.getByText('Baghdad Center')).toBeInTheDocument()
  })
})
