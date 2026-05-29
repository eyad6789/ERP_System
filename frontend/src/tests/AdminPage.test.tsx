import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { AdminUser, Role } from '../api/admin'
import { AdminPage } from '../features/admin/AdminPage'
import i18n from '../i18n'

const roles: Role[] = [
  {
    id: 1,
    code: 'SYSADMIN',
    name_ar: 'مدير النظام',
    name_en: 'System Administrator',
    modules: ['dashboard', 'audit'],
    clearance: 4,
  },
  {
    id: 2,
    code: 'ANALYST',
    name_ar: 'محلل',
    name_en: 'Analyst',
    modules: ['dashboard'],
    clearance: 2,
  },
]

const users: AdminUser[] = [
  {
    id: 1,
    username: 'cpt.salim',
    email: 'salim@example.gov',
    full_name_ar: 'سالم',
    full_name_en: 'Salim',
    role: 1,
    clearance: 4,
    department: 'OPS',
    is_active: true,
    mfa_enabled: true,
    date_joined: '2026-01-01T00:00:00Z',
  },
]

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('AdminPage', () => {
  it('renders a username and a role code from the mocked endpoints', async () => {
    await i18n.changeLanguage('en')
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/admin/roles')) return Promise.resolve(jsonResponse(roles))
      return Promise.resolve(jsonResponse(users))
    })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <AdminPage />
      </QueryClientProvider>,
    )

    await waitFor(() => expect(screen.getByText('cpt.salim')).toBeInTheDocument())
    // The role code renders both in the user's row and in the Roles table.
    expect(screen.getAllByText('SYSADMIN').length).toBeGreaterThan(0)
  })
})
