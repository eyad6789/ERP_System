import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Workspace } from '../api/workspaces'
import { WorkspacesPage } from '../features/workspaces/WorkspacesPage'
import i18n from '../i18n'

// The signed-in viewer is an HR member: they own the 'hr' workspace only.
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    me: {
      department: 'HR',
      username: 'hr1',
      clearance: 2,
      modules: [],
      role: { code: 'hr', name_ar: '', name_en: '' },
    },
    isLoading: false,
    can: () => true,
    refetch: () => {},
  }),
}))

const workspaces: Workspace[] = [
  {
    key: 'hr',
    name_ar: 'الموارد البشرية',
    name_en: 'Human Resources',
    description_ar: 'وصف',
    description_en: 'People and payroll',
    mission_ar: 'مهمة',
    mission_en: 'Serve the workforce',
    accent_color: '#6fa8c7',
    owner_department: 'HR',
    head_name: 'A. Salem',
    featured: ['personnel'],
    can_edit: true,
    updated_at: '2026-05-30T10:00:00Z',
    updated_by: 'hr1',
  },
  {
    key: 'finance',
    name_ar: 'المالية والمشتريات',
    name_en: 'Finance & Procurement',
    description_ar: 'وصف',
    description_en: 'Money and buying',
    mission_ar: 'مهمة',
    mission_en: 'Steward funds',
    accent_color: '#5aa97f',
    owner_department: 'Finance',
    head_name: 'N. Faris',
    featured: ['finance'],
    can_edit: false,
    updated_at: '2026-05-29T10:00:00Z',
    updated_by: null,
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
      <WorkspacesPage />
    </QueryClientProvider>,
  )
}

describe('WorkspacesPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders a card per workspace with owner chips', async () => {
    await i18n.changeLanguage('en')
    mockFetch(() => json(workspaces))
    renderPage()

    await waitFor(() => expect(screen.getByText('Human Resources')).toBeInTheDocument())
    expect(screen.getByText('Finance & Procurement')).toBeInTheDocument()
    // The viewer owns HR, so the "Your department" chip is on that card only.
    expect(screen.getByTestId('ws-yours-hr')).toBeInTheDocument()
    expect(screen.queryByTestId('ws-yours-finance')).not.toBeInTheDocument()
  })

  it('enables Edit for the owned workspace and disables it otherwise', async () => {
    await i18n.changeLanguage('en')
    mockFetch(() => json(workspaces))
    renderPage()

    await waitFor(() => expect(screen.getByText('Human Resources')).toBeInTheDocument())
    expect(screen.getByTestId('ws-edit-hr')).not.toBeDisabled()
    expect(screen.getByTestId('ws-edit-finance')).toBeDisabled()
  })

  it('saves an edit and PATCHes /workspaces/hr with the new name', async () => {
    await i18n.changeLanguage('en')
    const fetchSpy = mockFetch((_url, init) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'PATCH') {
        return json({ ...workspaces[0], name_en: 'People Ops' })
      }
      return json(workspaces)
    })
    renderPage()

    await waitFor(() => expect(screen.getByText('Human Resources')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('ws-edit-hr'))

    fireEvent.change(screen.getByTestId('ws-field-name_en'), {
      target: { value: 'People Ops' },
    })
    fireEvent.click(screen.getByTestId('ws-dialog-save'))

    await waitFor(() => {
      const patch = fetchSpy.mock.calls.find(
        ([u, init]) =>
          (init?.method ?? 'GET').toUpperCase() === 'PATCH' &&
          (typeof u === 'string' ? u : u.toString()).includes('/workspaces/hr'),
      )
      expect(patch).toBeTruthy()
      expect(JSON.parse(String(patch?.[1]?.body))).toMatchObject({ name_en: 'People Ops' })
    })
  })
})
