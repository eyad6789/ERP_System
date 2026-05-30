import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { OrgNode } from '../api/org'
import { DepartmentsPage } from '../features/departments/DepartmentsPage'
import i18n from '../i18n'

// Flat org tree: a root department (Operations) and one child (Field Unit).
const tree: OrgNode[] = [
  { code: 'OPS', name_ar: 'العمليات', name_en: 'Operations', parent: null, member_count: 12 },
  { code: 'FLD', name_ar: 'الوحدة الميدانية', name_en: 'Field Unit', parent: 'OPS', member_count: 5 },
]

function jsonResponse(body: unknown, status = 200): Response {
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
  render(
    <QueryClientProvider client={qc}>
      <DepartmentsPage />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DepartmentsPage', () => {
  it('fetches the org tree and renders the department hierarchy', async () => {
    await i18n.changeLanguage('en')
    mockFetch((url) => {
      if (url.includes('/personnel/tree')) return jsonResponse(tree)
      return jsonResponse([])
    })
    renderPage()

    // A root and its child both render by name.
    await waitFor(() => expect(screen.getByText('Operations')).toBeInTheDocument())
    expect(screen.getByText('Field Unit')).toBeInTheDocument()

    // KPIs reflect 2 departments and 17 total members.
    expect(screen.getByTestId('kpi-departments')).toHaveTextContent('2')
    expect(screen.getByTestId('kpi-members')).toHaveTextContent('17')
    expect(screen.getAllByTestId('department-row')).toHaveLength(2)
  })
})
