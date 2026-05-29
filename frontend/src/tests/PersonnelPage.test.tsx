import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Person } from '../api/personnel'
import { PersonnelPage } from '../features/personnel/PersonnelPage'
import i18n from '../i18n'

// Directory the server returned for a clearance-2 viewer: only levels 1-2 present
// (the API already excluded higher-classification records server-side).
const people: Person[] = [
  {
    id: 1, name_ar: 'هدى', name_en: 'Huda', rank_ar: 'نقيب', rank_en: 'Captain',
    department_code: 'OPS', department_name_ar: 'العمليات', department_name_en: 'Operations',
    classification: 2, status: 'active',
  },
  {
    id: 2, name_ar: 'طارق', name_en: 'Tariq', rank_ar: 'فني', rank_en: 'Technician',
    department_code: 'IT', department_name_ar: 'تقنية', department_name_en: 'IT',
    classification: 1, status: 'leave',
  },
]

describe('PersonnelPage', () => {
  it('renders the clearance-filtered directory the API returned', async () => {
    await i18n.changeLanguage('en')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(people), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <PersonnelPage />
      </QueryClientProvider>,
    )

    await waitFor(() => expect(screen.getByText('Huda')).toBeInTheDocument())
    expect(screen.getByText('Tariq')).toBeInTheDocument()
    // No level-3/4 names leaked into the rendered directory.
    expect(screen.queryByText(/Colonel|Lt\. Colonel/)).not.toBeInTheDocument()
  })
})
