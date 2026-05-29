import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Me } from '../api/auth'
import { ProfilePage } from '../features/profile/ProfilePage'
import i18n from '../i18n'

const me: Me = {
  username: 'k.alani',
  full_name_ar: 'كرار العاني',
  full_name_en: 'Karrar Al-Ani',
  department: 'OPS',
  clearance: 3,
  modules: ['personnel', 'finance', 'gis'],
  role: { code: 'ops_lead', name_ar: 'قائد العمليات', name_en: 'Operations Lead' },
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('ProfilePage', () => {
  it('renders the username and authorized module chips', async () => {
    await i18n.changeLanguage('en')
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/me')) return Promise.resolve(jsonResponse(me))
      return Promise.resolve(jsonResponse({}))
    })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <ProfilePage />
      </QueryClientProvider>,
    )

    await waitFor(() => expect(screen.getByText('k.alani')).toBeInTheDocument())
    // Module chip uses the nav.* label, e.g. personnel -> "Personnel".
    expect(screen.getByText('Personnel')).toBeInTheDocument()
    // Role + department surface as well.
    expect(screen.getByText('Operations Lead')).toBeInTheDocument()
  })
})
