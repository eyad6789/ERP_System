import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import App from '../App'
import { AuthProvider } from '../auth/AuthProvider'

// Regression guard: the app must mount inside its real providers. This catches a
// missing <AuthProvider> (every screen calls useAuth()), which unit tests that
// mock useAuth would miss.
describe('App smoke', () => {
  it('renders the login route inside the real provider tree', async () => {
    // No session: /api/me rejects, so RequireAuth redirects to /login.
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Authentication required.' }), { status: 403 }),
    )
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/login']}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      // LoginPage rendered => the whole provider tree mounted without throwing.
      expect(screen.getByText(/تسجيل الدخول|Sign in/)).toBeInTheDocument()
    })
  })
})
