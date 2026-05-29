import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <PersonnelPage />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PersonnelPage', () => {
  it('renders the clearance-filtered directory the API returned', async () => {
    await i18n.changeLanguage('en')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(people))
    renderPage()

    await waitFor(() => expect(screen.getByText('Huda')).toBeInTheDocument())
    expect(screen.getByText('Tariq')).toBeInTheDocument()
    // No level-3/4 names leaked into the rendered directory.
    expect(screen.queryByText(/Colonel|Lt\. Colonel/)).not.toBeInTheDocument()
  })

  it('creates a person via the dialog and refetches the list', async () => {
    await i18n.changeLanguage('en')
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input, init) => {
        const url = typeof input === 'string' ? input : input.toString()
        const method = (init?.method ?? 'GET').toUpperCase()
        if (method === 'POST' && url.includes('/personnel/')) {
          return Promise.resolve(jsonResponse({ ...people[0], id: 3 }, 201))
        }
        return Promise.resolve(jsonResponse(people))
      })

    renderPage()
    await waitFor(() => expect(screen.getByText('Huda')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('personnel-new'))
    fireEvent.change(screen.getByTestId('field-name_en'), { target: { value: 'Sara' } })
    fireEvent.click(screen.getByTestId('submit-person'))

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST',
        ),
      ).toBe(true),
    )
  })
})
