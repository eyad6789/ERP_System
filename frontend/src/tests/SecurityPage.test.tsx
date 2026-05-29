import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { SessionInfo } from '../api/security'
import { SecurityPage } from '../features/security/SecurityPage'
import i18n from '../i18n'

const sessions: SessionInfo[] = [
  {
    key: 'sess-current',
    current: true,
    user_agent: 'Firefox on Linux',
    ip: '10.0.0.5',
    last_active: '2026-05-29T10:00:00Z',
  },
  {
    key: 'sess-other',
    current: false,
    user_agent: 'Safari on iOS',
    ip: '10.0.0.9',
    last_active: '2026-05-28T08:00:00Z',
  },
]

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('SecurityPage', () => {
  it('renders the password fields and a session row', async () => {
    await i18n.changeLanguage('en')
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/auth/sessions')) return Promise.resolve(jsonResponse(sessions))
      return Promise.resolve(jsonResponse({}))
    })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <SecurityPage />
      </QueryClientProvider>,
    )

    // Password panel fields render.
    expect(screen.getByTestId('old-password')).toBeInTheDocument()
    expect(screen.getByTestId('new-password')).toBeInTheDocument()

    // A session row from the mocked endpoint renders.
    await waitFor(() => expect(screen.getByText('Firefox on Linux')).toBeInTheDocument())
    expect(screen.getByText('Safari on iOS')).toBeInTheDocument()
    expect(screen.getAllByTestId('session-row')).toHaveLength(2)
  })
})
