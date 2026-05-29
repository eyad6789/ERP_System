import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

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

describe('AssetsPage', () => {
  it('renders KPI counts and the asset table rows', async () => {
    await i18n.changeLanguage('en')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(assets), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <AssetsPage />
      </QueryClientProvider>,
    )

    await waitFor(() => expect(screen.getByText('Archive Server')).toBeInTheDocument())
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('3')
    expect(screen.getByTestId('kpi-operational')).toHaveTextContent('1')
    expect(screen.getByTestId('kpi-maintenance')).toHaveTextContent('1')
    expect(screen.getByTestId('kpi-down')).toHaveTextContent('1')
    expect(screen.getAllByTestId('asset-row')).toHaveLength(3)
  })
})
